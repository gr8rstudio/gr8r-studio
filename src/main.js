/* =====================================================================
   ENTRY: styles, then every module in dependency order (several register
   global listeners or add handlers to the action table when they load), then boot.
   ===================================================================== */
import './styles/index.css';
import './core/utils.js';
import './core/icons.js';
import './core/constants.js';
import './data/workspace.js';
import './core/store.js';
import './ui/helpers.js';
import './core/theme.js';
import './ui/toast.js';
import './ui/select.js';
import './shell/render.js';
import './shell/layout.js';
import './shell/skeletons.js';
import './shell/view-engine.js';
import './components/task-list.js';
import './pages/home.js';
import './pages/overview.js';
import './pages/my-tasks.js';
import './pages/tasks.js';
import './pages/inbox.js';
import './pages/notifications.js';
import './pages/favorites.js';
import './pages/projects.js';
import './pages/members.js';
import './pages/activity.js';
import './pages/search.js';
import './pages/errors.js';
import './pages/project.js';
import './views/project-overview.js';
import './views/board.js';
import './views/table.js';
import './views/calendar.js';
import './views/timeline.js';
import './views/files.js';
import './overlays/drawer.js';
import './overlays/modals.js';
import './overlays/popovers.js';
import './overlays/context-menu.js';
import './overlays/palette.js';
import './pages/settings.js';
import './pages/auth.js';
import './actions/actions.js';
import './actions/events.js';
import './actions/keyboard.js';
import './actions/drag-drop.js';
import './features/teams.js';
import './features/subtasks.js';
import './features/archive.js';
import './actions/teams.js';
import './actions/subtasks.js';
import './actions/archive.js';
import { S, D, adoptMe, dueReminders, hydrate, newWorkspace, save } from './core/store.js';
import { attach, createWorkspace, fetchMe, fetchWorkspace, fetchWorkspaces, onSync } from './core/sync.js';
import { A } from './actions/actions.js';
import { ROUTE_NAMES, render, go } from './shell/render.js';
import { toast } from './ui/toast.js';

const AUTH_ERRORS = {
  cancelled: 'Google sign-in was cancelled.',
  not_allowed: 'Gr8r Studio is invite-only. Ask a workspace owner to invite this Google account, then try again.',
  invite_only: "You're not in any workspace. Ask a workspace owner to invite you, then try again.",
  unverified: 'Your Google account email is not verified.',
  not_configured: 'Google sign-in is not configured on the server yet.',
  offline: "Couldn't reach the server. Check your connection and try again.",
};

export const LAST_WS_KEY = 'gr8r.ws';
const lastWs = () => {
  try {
    return localStorage.getItem(LAST_WS_KEY);
  } catch {
    return null;
  }
};

/* Open the workspace used last (or one just shared with this person). Someone with no workspace
   gets an empty one and goes through setup. */
async function openWorkspace(user) {
  const { workspaces, joined } = await fetchWorkspaces();
  let ws = null,
    isNew = false;
  const linked = new URLSearchParams(location.search).get('ws');
  const pick = workspaces.find(w => w.id === linked) || workspaces.find(w => w.id === joined[0]) || workspaces.find(w => w.id === lastWs()) || workspaces[0];
  if (pick) ws = await fetchWorkspace(pick.id);
  if (!ws) {
    ws = await createWorkspace(newWorkspace('My Workspace', user), null);
    isNew = true;
  }
  hydrate(ws);
  attach(ws);
  try {
    localStorage.setItem(LAST_WS_KEY, ws.id);
  } catch {
    /* storage blocked */
  }
  return { joined: joined.includes(ws.id), isNew };
}

let saveErrShown = false;
onSync({
  saved: () => (saveErrShown = false),
  remote: data => {
    S.data = data;
    adoptMe();
    if (dueReminders()) save();
    if (S.ui.drawer && !D().tasks.some(t => t.id === S.ui.drawer)) S.ui.drawer = null;
    render();
  },
  denied: () => toast("Some changes weren't saved because you don't have permission to make them.", { kind: 'err', ms: 5000 }),
  // Don't redraw under someone mid-edit: wait for the next poll.
  canApply: () => !document.activeElement?.matches('input, textarea, [contenteditable="true"]') && !S.ui.modals.length,
  removed: () => {
    toast(`You no longer have access to ${D().ws.name}.`, { kind: 'err', ms: 6000 });
    try {
      localStorage.removeItem(LAST_WS_KEY);
    } catch {
      /* storage blocked */
    }
    setTimeout(() => location.replace('/'), 2500);
  },
  error: why => {
    if (why === 'signed_out') {
      S.ui.auth = 'login';
      S.ui.errors = { login: 'Your session expired. Sign in again to keep saving.' };
      render();
    } else if (!saveErrShown) {
      saveErrShown = true;
      toast("Couldn't save your changes. Retrying…", { kind: 'err' });
    }
  },
});

(async function init() {
  document.documentElement.lang = 'en';
  if (!document.getElementById('sr-live')) {
    const l = document.createElement('div');
    l.id = 'sr-live';
    l.className = 'sr';
    l.setAttribute('aria-live', 'polite');
    document.body.appendChild(l);
  }
  const q = new URLSearchParams(location.search);
  let err = q.get('auth_error');
  if (err) history.replaceState(null, '', location.pathname + location.hash);
  // A shared link opened while signed out: Google sends people back to "/", so go back to the link.
  let next = null;
  try {
    next = sessionStorage.getItem('gr8r.next');
    sessionStorage.removeItem('gr8r.next');
  } catch {
    /* storage blocked */
  }
  if (next && !err && !location.hash && !location.search) history.replaceState(null, '', next);

  let user = null,
    opened = null;
  try {
    user = await fetchMe();
    if (user) opened = await openWorkspace(user);
  } catch (e) {
    console.error(e);
    user = null;
    err = AUTH_ERRORS[e.code] ? e.code : 'offline';
  }
  if (!user) {
    try {
      if (location.hash || location.search) sessionStorage.setItem('gr8r.next', location.pathname + location.search + location.hash);
    } catch {
      /* storage blocked */
    }
    S.ui.auth = 'login';
    if (err) S.ui.errors = { login: AUTH_ERRORS[err] || "Sign-in didn't complete. Please try again." };
    render();
    return;
  }
  const h = (location.hash || '').slice(1);
  if (opened.isNew || h === 'onboarding') {
    S.ui.auth = 'onboarding';
    S.ui.onb = 0;
  } else if (h && ROUTE_NAMES[h]) S.ui.route = h;
  else S.ui.route = S.prefs.home || 'home';
  // Links from Copy link: #task/KEY or #project/key, with ?ws=<workspace id>.
  const [kind, key] = h.split('/');
  const linkedTask = kind === 'task' && D().tasks.find(t => t.key === key);
  const linkedProj = kind === 'project' && D().projects.find(p => (p.key || '').toLowerCase() === (key || '').toLowerCase());
  if (linkedTask || linkedProj) {
    S.ui.route = 'project';
    S.ui.params = { id: linkedTask ? linkedTask.project : linkedProj.id, tab: S.prefs.defaultTab || 'board' };
    if (linkedTask) S.ui.drawer = linkedTask.id;
  } else if (kind === 'task' || kind === 'project') toast("That link isn't available. It may have been deleted, or you don't have access.", { kind: 'err' });
  if (location.search || kind === 'task' || kind === 'project') history.replaceState(null, '', '/');
  if (dueReminders()) save();
  render();
  if (opened.joined) toast(`You've joined ${D().ws.name}`);
})();

// Dev-only handle for debugging and screenshot tooling; stripped from production builds.
if (import.meta.env.DEV) window.__gr8r = { S, D, A, go, render };
