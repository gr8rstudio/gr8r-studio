/* ---------- store ---------- */
import { TODAY, diffD, iso, parse, uid } from './utils.js';
import { PCOLORS, TEAMS_SEED } from './constants.js';
import { seed } from '../data/seed.js';
import { queueSave, session } from './sync.js';

export const DEFAULT_PREFS = {
  theme: 'system',
  accent: 'indigo',
  side: 'comfortable',
  density: 'comfortable',
  weekStart: 1,
  dateFmt: 'MMM d',
  lang: 'English (US)',
  tz: '(GMT-07:00) Pacific Time',
  motion: 'system',
  home: 'home',
  openTasks: 'drawer',
  name: 'Tanjim Islam',
  title: 'Head of Product',
};

/* Workspace data lives on the server (core/sync.js). The browser only keeps UI preferences so the
   sign-in screen opens in the right theme. STORE_KEY is the pre-sync key: its data is uploaded once
   on first sign-in, then removed. */
export const STORE_KEY = 'gr8r.v2';
export const UI_KEY = 'gr8r.ui';
function readLocal(key) {
  try {
    const j = JSON.parse(localStorage.getItem(key) || 'null');
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null; /* storage blocked or corrupt */
  }
}
export const legacyWorkspace = () => {
  const j = readLocal(STORE_KEY);
  return j?.data?.tasks ? j : null;
};
export function dropLegacyWorkspace() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* storage blocked */
  }
}
export const saved = readLocal(UI_KEY);
export const S = {
  data: seed(),
  prefs: Object.assign({}, DEFAULT_PREFS, saved?.prefs || {}),
  views: {},
  ui: {
    fx: {},
    auth: null,
    authStep: 'login',
    onb: 0,
    onbData: { use: 'product', team: 'kanban', size: '2-10', ws: '', proj: 'Website Launch', tmpl: 'web', invites: '' },
    route: 'home',
    params: {},
    history: [],
    collapsed: !!saved?.collapsed,
    mnav: false,
    expanded: { p1: true },
    drawer: null,
    drawerFull: false,
    drawerTab: 'comments',
    modals: [],
    pop: null,
    palette: null,
    loading: false,
    offline: false,
    sel: new Set(),
    composer: null,
    editCell: null,
    openTasks: {},
    collapsedGroups: {},
    calDate: iso(TODAY),
    calMode: 'month',
    tlZoom: 'week',
    tlGroup: 'status',
    fileView: 'grid',
    projView: 'grid',
    homeTab: 'upcoming',
    inboxCat: 'all',
    inboxUnread: false,
    inboxSel: null,
    notifFilter: 'all',
    settings: 'appearance',
    searchQ: '',
    searchCat: 'all',
    myView: 'list',
    membersTab: 'members',
    collapsedCols: {},
    errors: {},
    drafts: {},
  },
};
export let _saveT;
export const memberState = () => ({ prefs: S.prefs, views: S.views, collapsed: S.ui.collapsed });
export function save() {
  queueSave(() => ({ data: S.data, state: memberState() }));
  clearTimeout(_saveT);
  _saveT = setTimeout(() => {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ prefs: S.prefs, collapsed: S.ui.collapsed }));
    } catch {
      /* storage full or blocked: preferences still sync to the server */
    }
  }, 150);
}
/* Apply a workspace loaded from the server. */
export function hydrate(ws) {
  S.data = ws.data;
  S.prefs = Object.assign({}, DEFAULT_PREFS, ws.state?.prefs || { name: session.user?.name || DEFAULT_PREFS.name, title: '' });
  S.views = ws.state?.views || {};
  S.ui.collapsed = !!ws.state?.collapsed;
  adoptMe();
}
/* The workspace document is shared, so "me" is worked out per browser: the member whose email is the
   signed-in Google account. Someone joining from an invite becomes active under their Google name. */
export function adoptMe(user = session.user) {
  const d = S.data;
  if (!user) return;
  const email = user.email.toLowerCase();
  let m = d.members.find(x => (x.email || '').toLowerCase() === email);
  if (!m) {
    const r = session.ws?.role || 'member';
    m = { id: uid('m'), name: user.name, email, role: r[0].toUpperCase() + r.slice(1), team: '', title: '', c: '#6B7280', status: 'active', last: 0, tz: '—' };
    d.members.push(m);
    save();
  } else if (m.status === 'invited') {
    Object.assign(m, { name: user.name, status: 'active', last: 0 });
    save();
  }
  d.me = m.id;
}
/* Sample workspace with the signed-in person as its owner. The sample people are flagged `demo` so
   the server never gives their (fictional) email addresses access. */
export function freshSeed(user = session.user) {
  const d = seed();
  d.members.forEach(m => {
    if (m.id === d.me) Object.assign(m, user ? { name: user.name, email: user.email, role: 'Owner', status: 'active' } : {});
    else m.demo = true;
  });
  return d;
}
/* An empty workspace named `name`, owned by the signed-in person. */
export function blankWorkspace(name, user = session.user) {
  const d = freshSeed(user);
  const keys = ['projects', 'tasks', 'comments', 'activity', 'notifs', 'files', 'events', 'projOrder', 'savedViews', 'recentSearches'];
  keys.forEach(k => (d[k] = []));
  d.members = d.members.filter(m => m.id === d.me);
  delete d.teams;
  d.ws = { name, url: name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'workspace', c: '#5A67D8' };
  return d;
}
/* Workspaces this person can open, for the switcher. */
export const workspaceList = () =>
  session.list.map((w, i) => ({
    id: w.id,
    name: w.id === session.ws?.id ? S.data.ws.name : w.name,
    c: ['#1D1C1A', '#5A67D8', '#23918A', '#C54B78'][i % 4],
    plan: w.role[0].toUpperCase() + w.role.slice(1),
  }));
export const currentWsId = () => session.ws?.id;
export const canManage = () => ['owner', 'admin'].includes(session.ws?.role);

/* ---------- lookups ---------- */
export const D = () => S.data;
export const me = () => D().members.find(m => m.id === D().me);
export const mem = id => D().members.find(m => m.id === id);
export const proj = id => D().projects.find(p => p.id === id);
export const task = id => D().tasks.find(t => t.id === id);
export const pColor = p => PCOLORS[p?.color] || PCOLORS.slate;
export const visibleProjects = () =>
  D()
    .projOrder.map(proj)
    .filter(Boolean)
    .filter(p => !p.archived);
export const canSee = p => !p.private || p.members.includes(D().me);
export const tasksOf = pid => D().tasks.filter(t => t.project === pid && !t.archived);
export const allTasks = () => D().tasks.filter(t => !t.archived && canSee(proj(t.project)));
export const isOver = t => t.due && t.status !== 'done' && diffD(parse(t.due), TODAY) < 0;
export const commentsOf = tid => D().comments.filter(c => c.task === tid);
export function progressOf(pid) {
  const ts = tasksOf(pid);
  if (!ts.length) return 0;
  return Math.round((ts.filter(t => t.status === 'done').length / ts.length) * 100);
}
export function taskProg(t) {
  if (t.status === 'done') return 100;
  if (t.subtasks.length) return Math.round((t.subtasks.filter(s => s.done).length / t.subtasks.length) * 100);
  return { backlog: 0, todo: 5, progress: 45, review: 80 }[t.status] || 0;
}

/* ---------- activity + notification helpers ---------- */
export function logAct(verb, t, extra = '') {
  D().activity.unshift({ id: uid('a'), by: D().me, verb, task: t?.id || null, project: t?.project || null, at: Date.now(), extra });
  if (t) t.updated = Date.now();
}

/* ---------- teams (workspace data, seeded on first use) ---------- */
export const NO_TEAM = { id: '', name: 'No team', icon: 'users', c: '#8A867E', desc: '' };
export function teamsList() {
  const d = D();
  if (!d.teams) d.teams = TEAMS_SEED.map(t => ({ ...t }));
  return d.teams;
}
export function team(id) {
  return teamsList().find(t => t.id === id) || null;
}
export const TM = new Proxy({}, { get: (_, k) => team(k) || NO_TEAM });
