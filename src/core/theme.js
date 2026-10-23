/* ---------- theme ---------- */
import { setDateFormat, setTimeZone } from './utils.js';
import { S } from './store.js';

export function applyPrefs() {
  const r = document.documentElement,
    p = S.prefs;
  setDateFormat(p.dateFmt, p.timeFmt);
  setTimeZone(p.tz);
  // Language sets the spellcheck dictionary; the interface itself is English only.
  r.lang = { 'English (UK)': 'en-GB' }[p.lang] || 'en-US';
  r.spellcheck = p.spell !== false;
  if (p.theme === 'system') r.removeAttribute('data-theme');
  else r.setAttribute('data-theme', p.theme);
  if (p.accent === 'indigo') r.removeAttribute('data-accent');
  else r.setAttribute('data-accent', p.accent);
  r.setAttribute('data-side', p.side);
  r.setAttribute('data-density', p.density);
  if (p.motion === 'reduce') r.setAttribute('data-motion', 'reduce');
  else r.removeAttribute('data-motion');
}
export function effectiveDark() {
  if (S.prefs.theme === 'dark') return true;
  if (S.prefs.theme === 'light') return false;
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
}
