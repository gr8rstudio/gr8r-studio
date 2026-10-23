/* =====================================================================
   API WORKER: Google sign-in, sessions and workspace persistence in D1.
   Static files (the Vite build) are served by the assets binding; only
   /api/* reaches this code (see run_worker_first in wrangler.jsonc).
   ===================================================================== */

const SESSION_COOKIE = 'gr8r_session';
const OAUTH_COOKIE = 'gr8r_oauth';
const SESSION_DAYS = 30;
// D1 caps a single value at 2 MB; leave headroom for the rest of the request.
const MAX_BODY = 1_900_000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD' && request.headers.get('Origin') !== url.origin) return json({ error: 'bad_origin' }, 403);
      const route = `${request.method} ${url.pathname}`;
      if (route === 'GET /api/auth/google') return startGoogle(url, env);
      if (route === 'GET /api/auth/callback') return finishGoogle(request, url, env);
      if (route === 'POST /api/auth/logout') return logout(request, url, env);

      const user = await currentUser(request, env);
      if (!user) return json({ error: 'unauthenticated' }, 401);
      // Re-check on every request so someone removed from every workspace can't keep using an old session.
      if (!(await mayEnter(user.email, env))) return json({ error: 'not_allowed' }, 403);
      if (route === 'GET /api/me') return json({ user: publicUser(user) });
      if (route === 'GET /api/workspaces') return listWorkspaces(user, env);
      if (route === 'POST /api/workspaces') return createWorkspace(request, user, env);
      const m = url.pathname.match(/^\/api\/workspaces\/([\w-]+)(\/version)?$/);
      if (m && request.method === 'GET') return m[2] ? getVersion(user, m[1], env) : getWorkspace(user, m[1], env);
      if (m && !m[2] && request.method === 'PUT') return saveWorkspace(request, user, m[1], env);
      if (m && !m[2] && request.method === 'DELETE') return deleteWorkspace(user, m[1], env);
      return json({ error: 'not_found' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: 'server_error' }, 500);
    }
  },
};

/* ---------- helpers ---------- */
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers });
const now = () => Date.now();
const b64url = bytes =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
const sha256 = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

function cookies(request) {
  const out = {};
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function cookie(url, name, value, maxAge, path = '/') {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${url.protocol === 'https:' ? '; Secure' : ''}`;
}
function redirect(location, setCookies = []) {
  const h = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  setCookies.forEach(c => h.append('Set-Cookie', c));
  return new Response(null, { status: 302, headers: h });
}
async function readJson(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return null;
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  return JSON.parse(text);
}
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, picture: u.picture });

/* Who may sign in:
   - ALLOWED_EMAILS (comma list of addresses and @domains) always may. These people can also
     create workspaces when INVITE_ONLY is on, so put the account(s) that run things here.
   - Anyone invited to a workspace, or already a member of one, may.
   - Everyone else only when INVITE_ONLY is off and ALLOWED_EMAILS is empty. */
const inviteOnly = env => env.INVITE_ONLY === 'true';
function listed(email, env) {
  const e = email.toLowerCase();
  return (env.ALLOWED_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .some(x => (x.startsWith('@') ? e.endsWith(x) : e === x));
}
async function belongs(email, env) {
  const e = email.toLowerCase();
  const row = await env.DB.prepare(
    'SELECT 1 FROM invites WHERE email = ?1 UNION SELECT 1 FROM workspace_members m JOIN users u ON u.id = m.user_id WHERE u.email = ?1 LIMIT 1',
  )
    .bind(e)
    .first();
  return !!row;
}
async function mayEnter(email, env) {
  if (listed(email, env) || (await belongs(email, env))) return true;
  return !inviteOnly(env) && !(env.ALLOWED_EMAILS || '').trim();
}

/* ---------- Google OAuth (authorization code + PKCE) ---------- */
async function startGoogle(url, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return redirect('/?auth_error=not_configured');
  const state = randomToken(),
    verifier = randomToken();
  const q = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${url.origin}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: b64url(await sha256(verifier)),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, [cookie(url, OAUTH_COOKIE, `${state}.${verifier}`, 600, '/api/auth')]);
}

async function finishGoogle(request, url, env) {
  const clear = cookie(url, OAUTH_COOKIE, '', 0, '/api/auth');
  const fail = code => redirect(`/?auth_error=${code}`, [clear]);
  if (url.searchParams.get('error')) return fail('cancelled');
  const [state, verifier] = (cookies(request)[OAUTH_COOKIE] || '').split('.');
  if (!state || state !== url.searchParams.get('state')) return fail('state');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: url.searchParams.get('code') || '',
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/callback`,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    console.error('Google token exchange failed', res.status, await res.text());
    return fail('exchange');
  }
  // The ID token came straight from Google's token endpoint over TLS, so its claims can be read
  // without checking the signature (OpenID Connect Core §3.1.3.7). The claims are still validated.
  const { id_token } = await res.json();
  const claims = JSON.parse(
    new TextDecoder().decode(Uint8Array.from(atob(id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))),
  );
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) || claims.aud !== env.GOOGLE_CLIENT_ID || claims.exp * 1000 < now())
    return fail('token');
  if (!claims.email_verified) return fail('unverified');
  if (!(await mayEnter(claims.email, env))) return fail('not_allowed');

  const t = now(),
    token = randomToken();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO users (id, email, name, picture, created_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(id) DO UPDATE SET email = ?2, name = ?3, picture = ?4',
    ).bind(claims.sub, claims.email.toLowerCase(), claims.name || claims.email.split('@')[0], claims.picture || null, t),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(claims.sub, t),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(
      hex(await sha256(token)),
      claims.sub,
      t,
      t + SESSION_DAYS * 864e5,
    ),
  ]);
  return redirect('/', [clear, cookie(url, SESSION_COOKIE, token, SESSION_DAYS * 86400)]);
}

async function currentUser(request, env) {
  const token = cookies(request)[SESSION_COOKIE];
  if (!token) return null;
  return env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .bind(hex(await sha256(token)), now())
    .first();
}

async function logout(request, url, env) {
  const token = cookies(request)[SESSION_COOKIE];
  if (token)
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(hex(await sha256(token)))
      .run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(url, SESSION_COOKIE, '', 0) });
}

/* ---------- workspaces ---------- */
const parseOr = (s, d) => (s ? JSON.parse(s) : d);
const ROLES = ['admin', 'member', 'guest'];
const canManage = role => role === 'owner' || role === 'admin';
const wsName = data => String(data?.ws?.name || 'Workspace').slice(0, 120);
const membership = (env, id, userId) =>
  env.DB.prepare('SELECT m.role, w.owner_id FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id WHERE m.workspace_id = ? AND m.user_id = ?')
    .bind(id, userId)
    .first();

async function listWorkspaces(user, env) {
  // Accept invitations sent to this Google address first, so shared workspaces appear right away.
  const { results: invited } = await env.DB.prepare('SELECT workspace_id AS id FROM invites WHERE email = ?').bind(user.email).all();
  if (invited.length)
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) SELECT workspace_id, ?, role FROM invites WHERE email = ?').bind(
        user.id,
        user.email,
      ),
      env.DB.prepare('DELETE FROM invites WHERE email = ?').bind(user.email),
    ]);
  const { results } = await env.DB.prepare(
    'SELECT w.id, w.name, m.role FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id WHERE m.user_id = ? ORDER BY w.updated_at DESC',
  )
    .bind(user.id)
    .all();
  return json({ workspaces: results, joined: invited.map(r => r.id) });
}

async function getWorkspace(user, id, env) {
  const row = await env.DB.prepare(
    'SELECT w.data, w.version, m.role, m.state FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id WHERE m.workspace_id = ? AND m.user_id = ?',
  )
    .bind(id, user.id)
    .first();
  if (!row) return json({ error: 'not_found' }, 404);
  return json({ workspace: { id, data: JSON.parse(row.data), version: row.version, role: row.role, state: parseOr(row.state, null) } });
}

async function getVersion(user, id, env) {
  const row = await env.DB.prepare(
    'SELECT w.version FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id WHERE m.workspace_id = ? AND m.user_id = ?',
  )
    .bind(id, user.id)
    .first();
  return row ? json({ version: row.version }) : json({ error: 'not_found' }, 404);
}

async function createWorkspace(request, user, env) {
  if (inviteOnly(env) && !listed(user.email, env)) return json({ error: 'invite_only' }, 403);
  const body = await readJson(request);
  if (!body) return json({ error: 'too_large' }, 413);
  if (!body.data || !Array.isArray(body.data.tasks)) return json({ error: 'bad_data' }, 400);
  const id = crypto.randomUUID(),
    t = now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO workspaces (id, owner_id, name, data, version, updated_at) VALUES (?, ?, ?, ?, 1, ?)').bind(
      id,
      user.id,
      wsName(body.data),
      JSON.stringify(body.data),
      t,
    ),
    env.DB.prepare('INSERT INTO workspace_members (workspace_id, user_id, role, state) VALUES (?, ?, ?, ?)').bind(
      id,
      user.id,
      'owner',
      body.state ? JSON.stringify(body.state) : null,
    ),
  ]);
  await syncAccess(env, id, user.id, user, [], body.data.members);
  return json({ workspace: { id, data: body.data, version: 1, role: 'owner', state: body.state || null } }, 201);
}

async function saveWorkspace(request, user, id, env) {
  const member = await membership(env, id, user.id);
  if (!member) return json({ error: 'not_found' }, 404);
  const body = await readJson(request);
  if (!body) return json({ error: 'too_large' }, 413);
  if (body.state !== undefined)
    await env.DB.prepare('UPDATE workspace_members SET state = ? WHERE workspace_id = ? AND user_id = ?').bind(JSON.stringify(body.state), id, user.id).run();
  if (body.data === undefined) return getVersion(user, id, env);
  if (!Array.isArray(body.data?.tasks)) return json({ error: 'bad_data' }, 400);
  const prev = await env.DB.prepare("SELECT json_extract(data, '$.members') AS members FROM workspaces WHERE id = ?").bind(id).first();
  // Only write if nobody else saved since this client last loaded (optimistic concurrency).
  const res = await env.DB.prepare('UPDATE workspaces SET data = ?, name = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?')
    .bind(JSON.stringify(body.data), wsName(body.data), now(), id, body.version)
    .run();
  if (!res.meta.changes) {
    const row = await env.DB.prepare('SELECT data, version FROM workspaces WHERE id = ?').bind(id).first();
    return json({ error: 'conflict', version: row.version, data: JSON.parse(row.data) }, 409);
  }
  // Member and invite changes made in the app only grant or revoke access when an owner or admin saves them.
  if (canManage(member.role)) await syncAccess(env, id, member.owner_id, user, parseOr(prev.members, []), body.data.members);
  return json({ version: body.version + 1 });
}

async function deleteWorkspace(user, id, env) {
  const ws = await env.DB.prepare('SELECT owner_id FROM workspaces WHERE id = ?').bind(id).first();
  if (!ws || ws.owner_id !== user.id) return json({ error: 'not_found' }, 404);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM invites WHERE workspace_id = ?').bind(id),
    env.DB.prepare('DELETE FROM workspace_members WHERE workspace_id = ?').bind(id),
    env.DB.prepare('DELETE FROM workspaces WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}

/* The workspace's members list (data.members) decides who can open it. Each save by an owner or
   admin applies what that save changed in the list: existing accounts are added directly, other
   emails become invites claimed on first sign-in, removed people lose access. Members flagged
   `demo` are sample people and never get access. The owner can't be removed, and nobody changes
   their own access. */
function accessList(members) {
  const out = new Map();
  for (const m of Array.isArray(members) ? members : []) {
    const email = String(m?.email || '')
      .trim()
      .toLowerCase();
    if (m.demo || !/^\S+@\S+\.\S+$/.test(email)) continue;
    const r = String(m.role || '').toLowerCase();
    out.set(email, ROLES.includes(r) ? r : r === 'owner' ? 'admin' : 'member');
  }
  return out;
}
async function syncAccess(env, id, ownerId, saver, prevMembers, nextMembers) {
  const prev = accessList(prevMembers),
    next = accessList(nextMembers);
  const changed = [...new Set([...prev.keys(), ...next.keys()])].filter(e => prev.get(e) !== next.get(e) && e !== saver.email);
  if (!changed.length) return;
  const t = now(),
    stmts = [];
  for (const email of changed) {
    const role = next.get(email);
    if (!role) {
      stmts.push(
        env.DB.prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id IN (SELECT id FROM users WHERE email = ?) AND user_id != ?').bind(
          id,
          email,
          ownerId,
        ),
        env.DB.prepare('DELETE FROM invites WHERE workspace_id = ? AND email = ?').bind(id, email),
      );
      continue;
    }
    stmts.push(
      env.DB.prepare(
        'INSERT INTO workspace_members (workspace_id, user_id, role) SELECT ?1, id, ?2 FROM users WHERE email = ?3 AND id != ?4 ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = excluded.role',
      ).bind(id, role, email, ownerId),
      env.DB.prepare(
        'INSERT INTO invites (workspace_id, email, role, created_at) SELECT ?1, ?2, ?3, ?4 WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = ?2) ON CONFLICT (workspace_id, email) DO UPDATE SET role = excluded.role',
      ).bind(id, email, role, t),
    );
  }
  await env.DB.batch(stmts);
}
