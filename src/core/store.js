/* ---------- store ---------- */
import { TODAY, diffD, fmtDate, iso, parse, uid } from './utils.js';
import { PCOLORS, TEAMS_SEED } from './constants.js';
import { emptyWorkspace } from '../data/workspace.js';
import { queueSave, session } from './sync.js';
import { VIEW, projectLevel } from '../../shared/permissions.js';

export const DEFAULT_PREFS = {
  theme: 'system',
  accent: 'indigo',
  side: 'comfortable',
  density: 'comfortable',
  weekStart: 1,
  dateFmt: 'MMM d',
  lang: 'English (US)',
  tz: 'auto',
  motion: 'system',
  home: 'home',
  openTasks: 'drawer',
  name: 'Tanjim Islam',
  title: 'Head of Product',
};

/* Workspace data lives on the server (core/sync.js). The browser only keeps UI preferences so the
   sign-in screen opens in the right theme. */
export const UI_KEY = 'gr8r.ui';
function readLocal(key) {
  try {
    const j = JSON.parse(localStorage.getItem(key) || 'null');
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null; /* storage blocked or corrupt */
  }
}
export const saved = readLocal(UI_KEY);
export const S = {
  data: emptyWorkspace(),
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
/* A new, empty workspace owned by the signed-in person. */
export const newWorkspace = (name, user = session.user) => emptyWorkspace(name, user);
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
/* My access to a project (shared/permissions.js; the server enforces the same rules). */
export const myLevel = p => projectLevel(p, session.ws?.role || 'member', D().me);
export const canSee = p => !!p && myLevel(p) >= VIEW;
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

/* ---------- notifications ----------
   Notifications live in the shared workspace document, each addressed to one member (`to`); every
   browser shows only its own. They're created by whoever makes the change. */
const NOTIF_KEEP = 150,
  NOTIF_DAYS = 60;
export const myNotifs = () => D().notifs.filter(n => n.to === D().me);
/* Each person's notification settings are stored on their member record. */
export const notifPrefs = id => ({ ...D().notifPrefs, ...(mem(id)?.notifPrefs || {}) });
const PREF = { mention: 'mention_all', team: 'mention_team', assign: 'assign_self', status: 'assign_status', due: 'assign_over' };
const wants = (id, pref) => !pref || notifPrefs(id)[PREF[pref]] !== false;
function pruneNotifs() {
  const d = D(),
    cutoff = Date.now() - NOTIF_DAYS * 864e5,
    count = {};
  d.notifs = d.notifs.filter(n => n.at > cutoff && mem(n.to) && (count[n.to] = (count[n.to] || 0) + 1) <= NOTIF_KEEP);
}
/* Tell member `to` about task `t`. Nobody is notified about their own change. */
export function notify(to, type, t, text, snippet = '', pref) {
  const d = D();
  const m = mem(to);
  if (!m || to === d.me || m.demo || !wants(to, pref)) return;
  d.notifs.unshift({ id: uid('n'), to, type, by: d.me, task: t?.id || null, project: t?.project || null, text, snippet, at: Date.now(), read: false });
  pruneNotifs();
}
/* The people who follow a task: its assignee, its creator, and everyone who commented on it. */
export function watchers(t) {
  return [...new Set([t.assignee, t.createdBy, ...commentsOf(t.id).map(c => c.by)])].filter(Boolean);
}
/* Members named in a comment: "@Full Name", or "@Team" for everyone on that team. */
export function mentioned(text) {
  const d = D(),
    out = new Map();
  d.members.forEach(m => {
    if (m.name && text.includes('@' + m.name)) out.set(m.id, 'mention');
  });
  teamsList().forEach(tm => {
    if (tm.name && text.includes('@' + tm.name)) d.members.filter(m => m.team === tm.id && !out.has(m.id)).forEach(m => out.set(m.id, 'team'));
  });
  return out;
}
/* Reminders for my own open tasks that are due today, tomorrow, or overdue. Created by my browser, once per task and due date. */
export function dueReminders() {
  const d = D();
  if (!d.me || !wants(d.me, 'due')) return false;
  let added = false;
  d.tasks.forEach(t => {
    if (t.assignee !== d.me || t.status === 'done' || t.archived || !t.due) return;
    const days = diffD(parse(t.due), TODAY);
    const kind = days < 0 ? 'overdue' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : null;
    if (!kind) return;
    const key = `due:${t.id}:${t.due}:${kind}`;
    if (d.notifs.some(n => n.key === key)) return;
    const text = { overdue: 'is overdue', today: 'is due today', tomorrow: 'is due tomorrow' }[kind];
    d.notifs.unshift({
      id: uid('n'),
      key,
      to: d.me,
      type: 'update',
      by: null,
      task: t.id,
      project: t.project,
      text,
      snippet: `Due ${fmtDate(t.due)}`,
      at: Date.now(),
      read: false,
    });
    added = true;
  });
  if (added) pruneNotifs();
  return added;
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
