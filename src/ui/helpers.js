/* ---------- small render helpers ---------- */
import { TODAY, diffD, esc, parse, relDate } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { LB, PR, PSTAT, ST } from '../core/constants.js';
import { D, mem, pColor } from '../core/store.js';
import { fileUrl } from '../core/sync.js';

export function av(id, cls = '', tip = true) {
  const m = mem(id);
  if (!m) return `<span class="av empty ${cls}" ${tip ? 'data-tip="Unassigned"' : ''}>${ic('user', 11)}</span>`;
  const ini = m.name
    .split(' ')
    .map(x => x[0])
    .join('')
    .slice(0, 2);
  return `<span class="av ${cls}" style="--c:${m.c}" ${tip ? `data-tip="${esc(m.name)}"` : ''} aria-label="${esc(m.name)}">${ini}</span>`;
}
export function avStack(ids, max = 4, cls = 'sm') {
  const v = ids.slice(0, max);
  return `<span class="avs">${v.map(i => av(i, cls)).join('')}${ids.length > max ? `<span class="av ${cls} more" style="--c:var(--gray)">+${ids.length - max}</span>` : ''}</span>`;
}
export function stIcon(st, s = 14) {
  const c = `var(--st-${st})`;
  const r = 5.4;
  let inner = '';
  if (st === 'backlog') inner = `<circle cx="7" cy="7" r="${r}" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="1.9 2.1"/>`;
  else if (st === 'todo') inner = `<circle cx="7" cy="7" r="${r}" fill="none" stroke="${c}" stroke-width="1.5"/>`;
  else if (st === 'progress')
    inner = `<circle cx="7" cy="7" r="${r}" fill="none" stroke="${c}" stroke-width="1.5"/><path d="M7 3.4A3.6 3.6 0 0 1 7 10.6Z" fill="${c}"/>`;
  else if (st === 'review')
    inner = `<circle cx="7" cy="7" r="${r}" fill="none" stroke="${c}" stroke-width="1.5"/><path d="M7 3.4A3.6 3.6 0 1 1 3.4 7L7 7Z" fill="${c}"/>`;
  else
    inner = `<circle cx="7" cy="7" r="6.2" fill="${c}"/><path d="M4.4 7.2 6.2 9 9.7 5.3" fill="none" stroke="var(--surface)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 14 14" aria-hidden="true" style="flex-shrink:0">${inner}</svg>`;
}
export function prIcon(p, s = 14) {
  if (p === 'urgent')
    return `<svg width="${s}" height="${s}" viewBox="0 0 14 14" aria-hidden="true" style="flex-shrink:0"><rect x="1" y="1" width="12" height="12" rx="3" fill="var(--red)"/><path d="M7 3.8v4" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="7" cy="10.1" r=".95" fill="#fff"/></svg>`;
  if (!p || p === 'none')
    return `<svg width="${s}" height="${s}" viewBox="0 0 14 14" aria-hidden="true" style="flex-shrink:0"><path d="M2.5 7h2M6 7h2M9.5 7h2" stroke="var(--text-3)" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  const w = PR[p].w;
  const bar = (x, h, on) => `<rect x="${x}" y="${12 - h}" width="2.6" height="${h}" rx="1" fill="${on ? 'var(--text-2)' : 'var(--border-strong)'}"/>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 14 14" aria-hidden="true" style="flex-shrink:0">${bar(1.8, 4.5, w >= 1)}${bar(5.7, 7.5, w >= 2)}${bar(9.6, 10.5, w >= 3)}</svg>`;
}
export const stPill = st => `${stIcon(st)}<span>${ST[st].name}</span>`;
export const prPill = p => `${prIcon(p)}<span>${PR[p || 'none'].name}</span>`;
export const lbl = id => (LB[id] ? `<span class="lbl" style="--c:${LB[id].c}"><i></i>${LB[id].name}</span>` : '');
export const pIcon = (p, cls = '', s = 15) => `<span class="picon ${cls}" style="--c:${pColor(p)}">${ic(p.icon, s)}</span>`;
export const pStatus = s => `<span class="pstatus" style="--c:${PSTAT[s].c}"><i></i>${PSTAT[s].name}</span>`;
export function dueHtml(t, withIcon = true) {
  if (!t.due) return '';
  const n = diffD(parse(t.due), TODAY);
  const cls = t.status === 'done' ? '' : n < 0 ? 'over' : n <= 1 ? 'soon' : '';
  return `<span class="due ${cls}">${withIcon ? ic('calendar', 12) : ''}${relDate(t.due)}</span>`;
}
export function progBar(v, cls = '') {
  return `<span class="prog ${cls}" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100"><i style="--p:${v / 100}"></i></span>`;
}
export function empty(icon, title, text, btn = '', cls = '', level = 2) {
  return `<div class="empty-state ${cls}"><div class="glyph">${ic(icon, 20)}</div><h${level} class="es-h">${esc(title)}</h${level}><p>${esc(text)}</p>${btn}</div>`;
}
export function hl(text, q) {
  if (!q) return esc(text);
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}
export function fmtComment(txt) {
  let h = esc(txt);
  D().members.forEach(m => {
    h = h.split('@' + esc(m.name)).join(`<span class="mention">@${esc(m.name)}</span>`);
  });
  return h;
}
export const FT = {
  fig: { c: '#8662C9', i: 'pen-tool', n: 'Figma' },
  pdf: { c: '#C4473A', i: 'file-text', n: 'PDF' },
  zip: { c: '#6B7280', i: 'folder-archive', n: 'Archive' },
  img: { c: '#23918A', i: 'image', n: 'Image' },
  sheet: { c: '#3D8E5F', i: 'file-spreadsheet', n: 'Spreadsheet' },
  doc: { c: '#3B82C4', i: 'file-text', n: 'Document' },
  code: { c: '#C48A1E', i: 'file-code', n: 'Code' },
  other: { c: '#6B7280', i: 'file', n: 'File' },
};
export function fileType(name) {
  const e = (name.split('.').pop() || '').toLowerCase();
  if (e === 'fig') return 'fig';
  if (e === 'pdf') return 'pdf';
  if (['zip', 'rar', '7z'].includes(e)) return 'zip';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(e)) return 'img';
  if (['xlsx', 'xls', 'csv', 'numbers'].includes(e)) return 'sheet';
  if (['doc', 'docx', 'txt', 'md', 'pages', 'rtf'].includes(e)) return 'doc';
  if (['js', 'ts', 'json', 'html', 'css', 'py'].includes(e)) return 'code';
  return 'other';
}
export function fsize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return Math.round(b / 1024) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}
export function filePrev(f) {
  const t = FT[f.type] || FT.other;
  let art;
  const url = f.type === 'img' && fileUrl(f);
  if (url) art = `<img class="art" src="${esc(url)}" alt="" loading="lazy" style="padding:0;width:100%;height:100%;object-fit:cover">`;
  else if (f.type === 'img')
    art = `<div class="art" style="padding:0;overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,${t.c} 35%,var(--surface)),color-mix(in srgb,${t.c} 10%,var(--surface)))"><svg viewBox="0 0 100 60" preserveAspectRatio="none" style="width:100%;height:100%"><path d="M0 60 L30 28 L52 46 L70 32 L100 58 L100 60Z" fill="color-mix(in srgb,${t.c} 45%,var(--surface))"/><circle cx="76" cy="16" r="7" fill="color-mix(in srgb,${t.c} 30%,var(--surface))"/></svg></div>`;
  else if (f.type === 'sheet') art = `<div class="art" style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px">${'<i></i>'.repeat(20)}</div>`;
  else if (f.type === 'fig')
    art = `<div class="art" style="flex-direction:row;gap:6px"><div style="flex:1;display:flex;flex-direction:column;gap:5px"><i class="h"></i><i></i><i style="width:70%"></i><i style="height:18px;background:color-mix(in srgb,${t.c} 20%,var(--surface))"></i></div><div style="width:34%;border-radius:3px;background:color-mix(in srgb,${t.c} 14%,var(--surface))"></div></div>`;
  else if (f.type === 'zip') art = `<div style="color:${t.c}">${ic('folder-archive', 30)}</div>`;
  else art = `<div class="art"><i class="h"></i><i></i><i></i><i style="width:80%"></i><i></i><i style="width:60%"></i></div>`;
  const ext = (f.name.split('.').pop() || '').slice(0, 4);
  return `<div class="fprev">${art}<span class="ext" style="--c:${t.c}">${esc(ext)}</span></div>`;
}
