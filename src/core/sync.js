/* ---------- server sync ----------
   Talks to the Worker API (worker/index.js). Workspaces live in D1 and can be shared; save() in
   store.js queues a debounced upload of the whole workspace document. When someone else saved
   first, their version is merged with this browser's edits (core/merge.js) and saved again. Open
   workspaces poll for other people's changes while the tab is visible. */
import { merge } from './merge.js';

export const session = { user: null, ws: null, list: [] };
const hooks = { remote: () => {}, error: () => {}, saved: () => {}, removed: () => {}, canApply: () => true };
export const onSync = h => Object.assign(hooks, h);
const POLL_MS = 10000;

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, { credentials: 'same-origin', ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/* Resolves to the signed-in user, or null when signed out. Throws when the server can't be reached. */
export async function fetchMe() {
  const r = await api('/me');
  if (r.status === 401) return null;
  if (r.status === 403) throw Object.assign(new Error('not allowed'), { code: 'not_allowed' });
  if (!r.ok) throw new Error('me ' + r.status);
  return (session.user = r.body.user);
}
/* Workspaces this user can open (accepting any pending invites). `joined` lists ones just accepted. */
export async function fetchWorkspaces() {
  const r = await api('/workspaces');
  if (!r.ok) throw new Error('workspaces ' + r.status);
  session.list = r.body.workspaces;
  return r.body;
}
export async function fetchWorkspace(id) {
  const r = await api('/workspaces/' + id);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('workspace ' + r.status);
  return r.body.workspace;
}
export async function createWorkspace(data, state) {
  const r = await api('/workspaces', { method: 'POST', body: JSON.stringify({ data, state }) });
  if (!r.ok) throw Object.assign(new Error('create ' + r.status), { code: r.body.error });
  const ws = r.body.workspace;
  session.list.unshift({ id: ws.id, name: data.ws?.name || 'Workspace', role: 'owner' });
  return ws;
}

/* `base` is the last server version this browser has seen (as JSON): the common ancestor for merges. */
let base = null;
export function attach(ws) {
  clearTimeout(timer);
  snap = null;
  session.ws = { id: ws.id, version: ws.version, role: ws.role };
  base = JSON.stringify(ws.data);
  const item = session.list.find(w => w.id === ws.id);
  if (item) item.name = ws.data.ws?.name || item.name;
}
/* Owner only. Resolves to true once the workspace and its memberships are gone. */
export async function deleteWorkspace(id) {
  const r = await api('/workspaces/' + id, { method: 'DELETE' });
  if (r.ok) session.ws = null;
  return r.ok;
}
export async function signOutServer() {
  await flush();
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
}

/* ---------- save queue: one request in flight, latest snapshot wins ---------- */
let snap = null,
  timer = null,
  inFlight = null,
  retryMs = 2000;
export const pending = () => !!(snap || inFlight);

export function queueSave(snapshot) {
  if (!session.ws) return;
  snap = snapshot;
  clearTimeout(timer);
  timer = setTimeout(flush, 800);
}

/* Someone else's newer version arrived: fold in any local edits and show the result. */
function adopt(remote, version) {
  const merged = snap ? merge(JSON.parse(base), snap().data, remote) : remote;
  base = JSON.stringify(remote);
  session.ws.version = version;
  hooks.remote(merged);
  return merged;
}

export async function flush({ keepalive = false } = {}) {
  clearTimeout(timer);
  while (inFlight) await inFlight;
  if (!snap || !session.ws) return;
  const take = snap;
  snap = null;
  inFlight = (async () => {
    const { data, state } = take();
    const ws = session.ws,
      sent = JSON.stringify(data);
    let r;
    try {
      r = await api('/workspaces/' + ws.id, { method: 'PUT', keepalive, body: `{"data":${sent},"state":${JSON.stringify(state)},"version":${ws.version}}` });
    } catch {
      r = { ok: false, status: 0, body: {} };
    }
    if (session.ws !== ws) return; // switched workspace mid-request
    if (r.ok) {
      ws.version = r.body.version;
      base = sent;
      retryMs = 2000;
      hooks.saved();
    } else if (r.status === 409) {
      // Someone saved first: merge their version with ours, then save the result.
      snap = take;
      adopt(r.body.data, r.body.version);
      timer = setTimeout(flush, 50);
    } else if (r.status === 401) {
      hooks.error('signed_out');
    } else if (r.status === 404 || r.status === 403) {
      hooks.removed();
    } else {
      // Network or server error: keep the newest snapshot queued and retry with backoff.
      snap = snap || take;
      hooks.error('retry');
      timer = setTimeout(flush, retryMs);
      retryMs = Math.min(retryMs * 2, 30000);
    }
  })();
  await inFlight;
  inFlight = null;
}

/* ---------- pull other people's changes ---------- */
let polling = false;
export async function poll() {
  const ws = session.ws;
  if (!ws || polling || inFlight || document.visibilityState !== 'visible') return;
  polling = true;
  try {
    const v = await api(`/workspaces/${ws.id}/version`);
    if (v.status === 404 || v.status === 403) return hooks.removed();
    if (!v.ok || v.body.version <= ws.version || !hooks.canApply()) return;
    const full = await fetchWorkspace(ws.id);
    if (!full) return hooks.removed();
    if (session.ws === ws && !inFlight && full.version > ws.version) adopt(full.data, full.version);
  } catch {
    /* offline: try again next tick */
  } finally {
    polling = false;
  }
}
setInterval(poll, POLL_MS);

addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && snap) flush({ keepalive: true });
  else if (document.visibilityState === 'visible') poll();
});
addEventListener('beforeunload', e => {
  if (pending()) e.preventDefault();
});
