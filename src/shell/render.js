/* =====================================================================
   SHELL: render loop, router, sidebar, topbar, skeletons, filter engine
   ===================================================================== */
import { $, $$ } from '../core/utils.js';
import { D, S, mem, proj, team } from '../core/store.js';
import { applyPrefs } from '../core/theme.js';
import { enhanceSelects, selectMenu } from '../ui/select.js';
import { renderShell } from './layout.js';
import { PTABS } from '../pages/project.js';
import { tlAfter } from '../views/timeline.js';
import { renderLayer } from '../overlays/drawer.js';
import { placePop } from '../overlays/popovers.js';
import { renderAuth } from '../pages/auth.js';

export const ROUTE_NAMES = {
  home: 'Home',
  inbox: 'Inbox',
  mytasks: 'My Tasks',
  favorites: 'Favorites',
  notifications: 'Notifications',
  search: 'Search',
  overview: 'Overview',
  projects: 'Projects',
  tasks: 'Tasks',
  calendar: 'Calendar',
  timeline: 'Timeline',
  members: 'Members',
  member: 'Member',
  teams: 'Teams',
  team: 'Team',
  activity: 'Activity',
  settings: 'Settings',
  archive: 'Archive',
};
export const ROUTE_ICONS = {
  home: 'house',
  inbox: 'inbox',
  mytasks: 'circle-check',
  favorites: 'star',
  notifications: 'bell',
  search: 'search',
  overview: 'layout-dashboard',
  projects: 'folder-kanban',
  tasks: 'list-checks',
  calendar: 'calendar',
  timeline: 'chart-gantt',
  members: 'users',
  activity: 'activity',
  teams: 'users',
  settings: 'settings',
  archive: 'archive',
};

export function go(route, params = {}, opt = {}) {
  if (route === 'project' && !params.tab) params.tab = 'board';
  if (!opt.back) S.ui.history.push({ route: S.ui.route, params: S.ui.params });
  const same = S.ui.route === route && JSON.stringify(S.ui.params) === JSON.stringify(params);
  S.ui.route = route;
  S.ui.params = params;
  S.ui.mnav = false;
  S.ui.sel.clear();
  S.ui.pop = null;
  S.ui.composer = null;
  S.ui.editCell = null;
  if (!opt.keepDrawer && S.ui.drawer && innerWidth < 900) S.ui.drawer = null;
  // Pages render instantly; motion (not a fake wait) carries the transition.
  clearTimeout(go._t);
  S.ui.loading = false;
  if (!same) fxSet(opt.tab ? { tab: true, tabs: true } : { route: true, tabs: true });
  render();
  const c = $('.content');
  if (c && !same) c.scrollTop = 0;
}

/* One-shot motion flags: read by templates during the next render, then cleared, so full re-renders never replay them. */
export const reduceMotion = () => S.prefs.motion === 'reduce' || (S.prefs.motion !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
export function fxSet(o) {
  S.ui.fx = Object.assign(S.ui.fx || {}, o);
}
export const fxc = (kind, id) => (S.ui.fx && S.ui.fx[kind] === id ? ' fx-' + kind : '');
/* Focus survives full re-renders: every control is addressable by its data-* identity. */
export const FKEYS = ['a', 'id', 'r', 'tab', 'pop', 'ctx', 'k', 'v', 'sec', 'i', 'field', 'sid', 'key', 'e', 'f', 'dragCard', 'taskRow'];
export function focusKey(el) {
  if (!el || el === document.body || !el.tagName) return null;
  if (el.id) return '#' + CSS.escape(el.id);
  const d = el.dataset || {};
  const parts = FKEYS.filter(k => d[k] != null).map(k => `[data-${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}="${CSS.escape(d[k])}"]`);
  return parts.length ? el.tagName.toLowerCase() + parts.join('') : null;
}
export function tryFocus(key) {
  if (!key) return false;
  let el;
  try {
    el = document.querySelector(key);
  } catch {
    return false;
  }
  if (el && el.offsetParent !== null) {
    el.focus({ preventScroll: true });
    return document.activeElement === el;
  }
  return false;
}
export function pageTitle() {
  const u = S.ui;
  if (u.auth) return 'Gr8r Studio';
  let t = ROUTE_NAMES[u.route] || 'Not found';
  if (u.route === 'project' && proj(u.params.id)) t = `${(PTABS.find(x => x[0] === u.params.tab) || [0, 'Saved view'])[1]} · ${proj(u.params.id).name}`;
  if (u.route === 'member' && mem(u.params.id)) t = mem(u.params.id).name;
  if (u.route === 'team' && team(u.params.id)) t = team(u.params.id).name;
  return `${t} · ${D().ws.name}`;
}
/* Anything clickable is keyboard-reachable: non-native [data-a] controls get a role and a tab stop. */
export function makeFocusable() {
  for (const el of document.querySelectorAll('[data-a]:not(button):not(a):not(input):not(label):not(select):not(textarea):not([tabindex])')) {
    if (el.matches('.scrim,.modal-wrap,.drawer-scrim,.side-scrim')) continue;
    el.tabIndex = 0;
    if (!el.hasAttribute('role')) el.setAttribute('role', el.dataset.a === 'go' ? 'link' : 'button');
  }
}
export function render() {
  applyPrefs();
  const prevOv = render._ov || {};
  const ov = { pop: !!S.ui.pop, modals: S.ui.modals.length, drawer: S.ui.drawer, pal: !!S.ui.palette, sub: !!S.ui.subOpen };
  // Entrances animate only on the render where the surface first appears.
  const fx = S.ui.fx || (S.ui.fx = {});
  if (ov.drawer && prevOv.drawer !== ov.drawer) fx.drawer = true;
  if (ov.modals > (prevOv.modals || 0)) fx.modal = ov.modals;
  const popSig = S.ui.pop ? [S.ui.pop.type, S.ui.pop.id, S.ui.pop.i, S.ui.pop.field, S.ui.pop.ctx, S.ui.pop.key].join('|') : '';
  if (popSig && popSig !== render._popSig) fx.pop = true;
  render._popSig = popSig;
  if (S.ui.sel.size && !render._selN) fx.bulk = true;
  render._selN = S.ui.sel.size;
  const authSig = S.ui.auth ? S.ui.auth + (S.ui.auth === 'onboarding' ? S.ui.onb : '') : '';
  if (authSig && authSig !== render._authSig) fx[S.ui.auth === 'onboarding' ? 'step' : 'auth'] = true;
  render._authSig = authSig;
  const a = document.activeElement;
  const fid = a && a.id;
  let s0 = null,
    s1 = null;
  const fkey = focusKey(a);
  try {
    s0 = a.selectionStart;
    s1 = a.selectionEnd;
  } catch {
    /* not supported here; safe to skip */
  }
  const keep = $$('[data-keep]').map(el => [el.dataset.keep, el.scrollTop, el.scrollLeft]);
  $('#app').innerHTML = S.ui.auth ? renderAuth() : renderShell();
  $('#layer').innerHTML = renderLayer();
  makeFocusable();
  keep.forEach(([k, t, l]) => {
    const el = document.querySelector(`[data-keep="${CSS.escape(k)}"]`);
    if (el) {
      el.scrollTop = t;
      el.scrollLeft = l;
    }
  });
  if (fid) {
    const el = document.getElementById(fid);
    if (el && el !== document.activeElement) {
      el.focus({ preventScroll: true });
      try {
        if (s0 != null) el.setSelectionRange(s0, s1);
      } catch {
        /* not supported here; safe to skip */
      }
    }
  }
  // Return focus to whatever opened a surface that just closed; otherwise keep the control that had it.
  const lost = () => !document.activeElement || document.activeElement === document.body;
  if (prevOv.modals > ov.modals) {
    const k = S.ui.modalOpeners.splice(ov.modals).shift();
    if (lost()) tryFocus(k);
  }
  if (prevOv.pop && !ov.pop && lost()) tryFocus(S.ui.popOpener);
  if (prevOv.drawer && !ov.drawer && lost()) tryFocus(S.ui.drawerOpener);
  if (prevOv.pal && !ov.pal && lost()) tryFocus(S.ui.palOpener);
  if (prevOv.sub && !ov.sub && lost()) tryFocus('.drawer .subt [data-sid="' + (S.ui.lastSub || '') + '"]');
  if (lost() && fkey) tryFocus(fkey);
  render._ov = ov;
  const played = S.ui.fx;
  S.ui.fx = {};
  if (played.route && !reduceMotion()) countUp();
  const title = pageTitle();
  if (document.title !== title) {
    document.title = title;
    const live = document.getElementById('sr-live');
    if (live && !S.ui.loading) live.textContent = title.split(' · ').slice(0, -1).join(', ');
  }
  afterRender();
}
export function afterRender() {
  selectMenu.close();
  enhanceSelects();
  placePop();
  $$('textarea[data-autosize]').forEach(autosize);
  const pal = $('#pal-in');
  if (pal && document.activeElement !== pal && !S.ui.pop) pal.focus();
  if ((S.ui.route === 'project' && S.ui.params.tab === 'timeline') || S.ui.route === 'timeline') tlAfter();
}
/* Headline numbers count up once when a dashboard is entered. */
export function countUp() {
  for (const el of document.querySelectorAll('.fx-route .stat .v')) {
    const m = el.textContent.match(/^(\d+)(%?)$/);
    if (!m) continue;
    const to = +m[1],
      suf = m[2];
    if (to < 2) continue;
    const t0 = performance.now(),
      dur = 520;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      if (!el.isConnected) return;
      el.textContent = Math.round(to * e) + suf;
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = '0' + suf;
    requestAnimationFrame(step);
  }
}
export function autosize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
