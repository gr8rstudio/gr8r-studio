/* =====================================================================
   QUIRE — core: utils, icons, seed data, store, render loop, events
   ===================================================================== */
// Web fonts load without blocking first paint (the link starts as media=print).
document.querySelectorAll('link[data-font]').forEach(l => {
  l.media = 'all';
});
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 8);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = isMac ? '⌘' : 'Ctrl';

/* ---------- dates ---------- */
export const DAY = 864e5;
export const sod = d => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
/* Time zone from preferences ('auto' = this device's). "Today", day grouping and the greeting follow it. */
export let timeZone = null;
export function zoned(ts = Date.now()) {
  return timeZone ? new Date(new Date(ts).toLocaleString('en-US', { timeZone })) : new Date(ts);
}
export let TODAY = sod(new Date());
export function setTimeZone(tz) {
  try {
    timeZone = tz && tz !== 'auto' ? Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone : null;
  } catch {
    timeZone = null; // not a valid IANA zone (e.g. a value saved by an older version)
  }
  const t = sod(zoned());
  if (+t !== +TODAY) TODAY = t;
}
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const iso = d => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const parse = s => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addD = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const dOff = n => iso(addD(TODAY, n));
export const diffD = (a, b) => Math.round((sod(a) - sod(b)) / DAY);
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/* Set from preferences on every render (core/theme.js), so utils never depends on the store. */
export let dateFormat = 'MMM d';
export let timeFormat = '12';
export function setDateFormat(f, t) {
  dateFormat = f || 'MMM d';
  timeFormat = t === '24' ? '24' : '12';
}
/* "14:30" → "2:30 PM" or "14:30", per the time format preference. */
export function fmtTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (timeFormat === '24') return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
export function fmtDate(s, long) {
  const d = typeof s === 'string' ? parse(s) : s;
  if (!d) return '';
  const fmt = dateFormat;
  if (fmt === 'd/M') return `${d.getDate()}/${d.getMonth() + 1}${long ? '/' + d.getFullYear() : ''}`;
  if (fmt === 'M/d') return `${d.getMonth() + 1}/${d.getDate()}${long ? '/' + d.getFullYear() : ''}`;
  if (fmt === 'yyyy-MM-dd') return iso(d);
  return `${MON[d.getMonth()]} ${d.getDate()}${long || d.getFullYear() !== TODAY.getFullYear() ? ', ' + d.getFullYear() : ''}`;
}
export function relDate(s) {
  if (!s) return '';
  const n = diffD(parse(s), TODAY);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return WD[parse(s).getDay()];
  return fmtDate(s);
}
export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 6e4);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24);
  if (d < 7) return d + 'd ago';
  return fmtDate(iso(zoned(ts)));
}
export const minsAgo = m => Date.now() - m * 6e4;
export function dayBucket(ts) {
  const n = diffD(zoned(ts), TODAY);
  if (n === 0) return 'Today';
  if (n === -1) return 'Yesterday';
  if (n > -7) return 'This week';
  return 'Earlier';
}
