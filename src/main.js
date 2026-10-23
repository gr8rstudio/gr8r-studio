/* =====================================================================
   ENTRY: styles, then every module in dependency order (several register
   global listeners or add handlers to the action table when they load), then boot.
   ===================================================================== */
import './styles/index.css';
import './core/utils.js';
import './core/icons.js';
import './core/constants.js';
import './data/seed.js';
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
import './pages/design-system.js';
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
import { S, D, adoptMe, dropLegacyWorkspace, freshSeed, hydrate, legacyWorkspace } from './core/store.js';
import { attach, createWorkspace, fetchMe, fetchWorkspace, fetchWorkspaces, onSync } from './core/sync.js';
import { seed } from './data/seed.js';
import { A } from './actions/actions.js';
import { ROUTE_NAMES, render, go } from './shell/render.js';
import { toast } from './ui/toast.js';

const AUTH_ERRORS = {
  cancelled: 'Google sign-in was cancelled.',
  not_allowed: "That Google account isn't allowed to sign in to this workspace.",
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

/* Open the workspace used last (or one just shared with this person). On first sign-in with no
   shared workspace, create one: from data saved in this browser before sign-in existed if there is
   any, otherwise the sample workspace. */
async function openWorkspace(user) {
  const { workspaces, joined } = await fetchWorkspaces();
  let ws = null;
  const pick = workspaces.find(w => w.id === joined[0]) || workspaces.find(w => w.id === lastWs()) || workspaces[0];
  if (pick) ws = await fetchWorkspace(pick.id);
  if (!ws) {
    const legacy = legacyWorkspace();
    if (legacy) {
      // The sample people in old browser data have fictional emails: never give those access.
      const demo = new Set(seed().members.map(m => m.email));
      legacy.data.members.forEach(m => {
        if (m.id === legacy.data.me) Object.assign(m, { email: user.email, role: 'Owner', status: 'active' });
        else if (demo.has(m.email)) m.demo = true;
      });
    }
    ws = await createWorkspace(legacy?.data || freshSeed(user), legacy ? { prefs: legacy.prefs, views: legacy.views, collapsed: legacy.collapsed } : null);
    if (legacy) dropLegacyWorkspace();
  }
  hydrate(ws);
  attach(ws);
  try {
    localStorage.setItem(LAST_WS_KEY, ws.id);
  } catch {
    /* storage blocked */
  }
  return joined.includes(ws.id) ? ws : null;
}

let saveErrShown = false;
onSync({
  saved: () => (saveErrShown = false),
  remote: data => {
    S.data = data;
    adoptMe();
    if (S.ui.drawer && !D().tasks.some(t => t.id === S.ui.drawer)) S.ui.drawer = null;
    render();
  },
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

  let user = null,
    joined = null;
  try {
    user = await fetchMe();
    if (user) joined = await openWorkspace(user);
  } catch (e) {
    console.error(e);
    user = null;
    err = 'offline';
  }
  if (!user) {
    S.ui.auth = 'login';
    if (err) S.ui.errors = { login: AUTH_ERRORS[err] || "Sign-in didn't complete. Please try again." };
    render();
    return;
  }
  const h = (location.hash || '').slice(1);
  if (h === 'onboarding') S.ui.auth = h;
  else if (h && ROUTE_NAMES[h]) S.ui.route = h;
  else S.ui.route = S.prefs.home || 'home';
  render();
  if (joined) toast(`You've joined ${D().ws.name}`);
})();

// Dev-only handle for debugging and screenshot tooling; stripped from production builds.
if (import.meta.env.DEV) window.__gr8r = { S, D, A, go, render };
