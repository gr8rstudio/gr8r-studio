/* ---------- CALENDAR ---------- */
import { MONL, TODAY, WD, addD, diffD, esc, fmtDate, fmtTime, iso, parse, sod } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { D, S, allTasks, pColor, proj } from '../core/store.js';
import { av, prIcon, stIcon } from '../ui/helpers.js';
import { fxc } from '../shell/render.js';
import { applyView, viewOf, viewToolbar } from '../shell/view-engine.js';

export function startOfWeek(d) {
  const x = sod(d);
  const ws = S.prefs.weekStart;
  const diff = (x.getDay() - ws + 7) % 7;
  return addD(x, -diff);
}
export function calendarHtml(ts, opt = {}) {
  const cur = parse(S.ui.calDate);
  const mode = S.ui.calMode;
  const evs = opt.events ? D().events.filter(e => !opt.project || e.project === opt.project) : [];
  const itemsOn = ds => [...evs.filter(e => e.date === ds).map(e => ({ ev: e })), ...ts.filter(t => t.due === ds).map(t => ({ t }))];
  const wdn = Array.from({ length: 7 }, (_, i) => WD[(i + S.prefs.weekStart) % 7]);
  const chip = it => {
    if (it.ev) {
      const p = proj(it.ev.project);
      return `<button class="cev event" style="--c:${pColor(p)}" data-a="pop" data-pop="event" data-id="${it.ev.id}" title="${esc(it.ev.title)} · ${fmtTime(it.ev.time)}"><span class="num faint" style="font-size:11px">${it.ev.time}</span><span class="trunc">${esc(it.ev.title)}</span></button>`;
    }
    const t = it.t;
    const p = proj(t.project);
    return `<button class="cev ${t.status === 'done' ? 'done' : ''}${fxc('moved', t.id)}" style="--c:${pColor(p)}" draggable="true" data-drag-cal="${t.id}" data-a="openTask" data-id="${t.id}" data-ctx="task" title="${esc(t.title)}">${t.status === 'done' ? stIcon('done', 11) : prIcon(t.priority, 11)}<span class="trunc">${esc(t.title)}</span>${av(t.assignee, '', false)}</button>`;
  };
  let label, body;
  if (mode === 'month') {
    label = `${MONL[cur.getMonth()]} ${cur.getFullYear()}`;
    const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const start = startOfWeek(first);
    const cells = Array.from({ length: 42 }, (_, i) => addD(start, i));
    const trimmed = cells[35].getMonth() !== cur.getMonth() ? cells.slice(0, 35) : cells;
    body = `<div class="cal-h">${wdn.map(d => `<div>${d}</div>`).join('')}</div>
      <div class="cal-g" style="grid-template-rows:repeat(${trimmed.length / 7},minmax(112px,1fr))">${trimmed
        .map(d => {
          const ds = iso(d);
          const items = itemsOn(ds);
          const today = diffD(d, TODAY) === 0;
          return `<div class="cday ${d.getMonth() !== cur.getMonth() ? 'out' : ''} ${today ? 'today' : ''}" data-drop-day="${ds}">
          <span class="dn" ${today ? 'aria-current="date"' : ''}>${d.getDate()}</span>
          <button class="ibtn ibtn-xs add" data-a="newTask" data-due="${ds}" ${opt.project ? `data-project="${opt.project}"` : ''} aria-label="Add task on ${fmtDate(ds)}">${ic('plus', 13)}</button>
          ${items.slice(0, 3).map(chip).join('')}
          ${items.length > 3 ? `<button class="cmore" data-a="pop" data-pop="daylist" data-date="${ds}" data-key="${opt.key || ''}">+${items.length - 3} more</button>` : ''}
        </div>`;
        })
        .join('')}</div>`;
  } else {
    const ws = startOfWeek(cur);
    const days = Array.from({ length: 7 }, (_, i) => addD(ws, i));
    label = `${fmtDate(iso(days[0]))} – ${fmtDate(iso(days[6]))}, ${days[6].getFullYear()}`;
    body = `<div class="week">${days
      .map(d => {
        const ds = iso(d);
        const items = itemsOn(ds).sort((a, b) => (a.ev ? 0 : 1) - (b.ev ? 0 : 1));
        const today = diffD(d, TODAY) === 0;
        return `<div class="wcol"><div class="wcol-h ${today ? 'today' : ''}"><span class="n">${d.getDate()}</span><span class="muted" style="font-size:12px">${WD[d.getDay()]}</span><span class="sp"></span><button class="ibtn ibtn-xs" data-a="newTask" data-due="${ds}" ${opt.project ? `data-project="${opt.project}"` : ''} aria-label="Add task">${ic('plus', 13)}</button></div>
        <div class="wcol-b" data-drop-day="${ds}">${
          items
            .map(it => {
              if (it.ev) {
                const p = proj(it.ev.project);
                return `<button class="wcard event" style="--c:${pColor(p)}" data-a="pop" data-pop="event" data-id="${it.ev.id}"><span class="t"><span class="pdot" style="--c:${pColor(p)};border-radius:50%"></span>${esc(it.ev.title)}</span><span class="m">${ic('clock', 11)}${fmtTime(it.ev.time)} · ${esc(p.name)}</span></button>`;
              }
              const t = it.t;
              const p = proj(t.project);
              return `<button class="wcard${fxc('moved', t.id)}" style="--c:${pColor(p)}" draggable="true" data-drag-cal="${t.id}" data-a="openTask" data-id="${t.id}" data-ctx="task"><span class="t" style="${t.status === 'done' ? 'text-decoration:line-through;color:var(--text-3)' : ''}"><span class="pdot" style="--c:${pColor(p)}"></span>${esc(t.title)}</span><span class="m">${stIcon(t.status, 11)}${prIcon(t.priority, 11)}<span class="trunc grow">${esc(p.name)}</span>${av(t.assignee, 'sm', false)}</span></button>`;
            })
            .join('') || '<span class="faint" style="font-size:12px;padding:4px">No tasks</span>'
        }</div></div>`;
      })
      .join('')}</div>`;
  }
  const projs = [...new Set(ts.map(t => t.project))].map(proj).filter(Boolean);
  return `<div class="cal" style="min-height:640px">
    <div class="toolbar" style="gap:8px">
      <button class="btn btn-secondary btn-sm" data-a="calNav" data-d="0">Today</button>
      <div class="row" style="gap:0"><button class="ibtn ibtn-sm" data-a="calNav" data-d="-1" aria-label="Previous">${ic('chevron-left', 16)}</button><button class="ibtn ibtn-sm" data-a="calNav" data-d="1" aria-label="Next">${ic('chevron-right', 16)}</button></div>
      <h2 style="font-size:15px;font-weight:600;margin:0 4px;letter-spacing:-.01em" aria-live="polite">${label}</h2>
      <span class="sp"></span>
      ${
        !opt.project && projs.length > 1
          ? `<span class="row hide-m" style="gap:10px;font-size:11.5px;color:var(--text-2);margin-right:8px">${projs
              .slice(0, 5)
              .map(p => `<span class="row" style="gap:4px"><span class="pdot" style="--c:${pColor(p)}"></span>${esc(p.name)}</span>`)
              .join('')}</span>`
          : ''
      }
      <div class="seg">${[
        ['month', 'Month'],
        ['week', 'Week'],
      ]
        .map(([k, n]) => `<button class="${mode === k ? 'on' : ''}" data-a="set" data-k="calMode" data-v="${k}">${n}</button>`)
        .join('')}</div>
    </div>
    ${body}
  </div>`;
}
export function pageWsCalendar() {
  const key = 'cal';
  const v = viewOf(key);
  return `<div class="page flush"><div class="ph"><div><h1>Calendar</h1><p>Deadlines and events across every project.</p></div><div class="acts"><button class="btn btn-primary" data-a="newTask">${ic('plus', 14)}New task</button></div></div>
  ${viewToolbar(key, { group: false })}${calendarHtml(applyView(allTasks(), v), { key, events: true })}</div>`;
}
