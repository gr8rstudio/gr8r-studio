/* =====================================================================
   SETTINGS · AUTH · ONBOARDING · DESIGN SYSTEM · SYSTEM STATES
   ===================================================================== */
import { dOff, esc, fmtDate } from '../core/utils.js';
import { ic, wsLogo } from '../core/icons.js';
import { D, S, me } from '../core/store.js';
import { av, pIcon } from '../ui/helpers.js';
import { permsTable, teamsGrid } from './members.js';
import { page404 } from './errors.js';
import { SHORTCUTS } from '../overlays/modals.js';

export const SET_NAV = [
  [
    'General',
    [
      ['workspace', 'Workspace', 'building-2'],
      ['appearance', 'Appearance', 'palette'],
      ['language', 'Language', 'languages'],
      ['datetime', 'Date & time', 'clock'],
    ],
  ],
  [
    'Workspace',
    [
      ['members', 'Members', 'users'],
      ['teams', 'Teams', 'users-round'],
      ['projects', 'Projects', 'folder-kanban'],
      ['permissions', 'Permissions', 'shield'],
    ],
  ],
  [
    'Notifications',
    [
      ['notif-email', 'Email', 'mail'],
      ['notif-push', 'Push', 'smartphone'],
      ['notif-mentions', 'Mentions', 'at-sign'],
      ['notif-assign', 'Task assignments', 'user-check'],
    ],
  ],
  [
    'Personal',
    [
      ['profile', 'Profile', 'user'],
      ['preferences', 'Preferences', 'sliders-horizontal'],
      ['shortcuts', 'Keyboard shortcuts', 'keyboard'],
    ],
  ],
  [
    'Security',
    [
      ['password', 'Password', 'key-round'],
      ['sessions', 'Sessions', 'monitor-smartphone'],
      ['2fa', 'Two-factor authentication', 'shield-check'],
    ],
  ],
  [
    'Billing',
    [
      ['plan', 'Plan', 'gem'],
      ['payment', 'Payment', 'credit-card'],
      ['invoices', 'Invoices', 'receipt'],
    ],
  ],
];
export function srow(t, d, ctl) {
  return `<div class="srow"><div><div class="t">${t}</div>${d ? `<div class="d">${d}</div>` : ''}</div><div class="row">${ctl}</div></div>`;
}
export const tog = (k, on, src = 'pref') =>
  `<input type="checkbox" class="toggle" data-in="${src}Toggle" data-k="${k}" ${on ? 'checked' : ''} aria-label="${k}">`;
export const sel = (k, opts, v) =>
  `<select class="select" style="width:auto;min-width:180px" data-in="prefSel" data-k="${k}" aria-label="${k}">${opts
    .map(o => {
      const [val, n] = Array.isArray(o) ? o : [o, o];
      return `<option value="${val}" ${String(v) === String(val) ? 'selected' : ''}>${n}</option>`;
    })
    .join('')}</select>`;
export function pageSettings() {
  const sec = S.ui.params.sec || S.ui.settings || 'appearance';
  const title = SET_NAV.flatMap(g => g[1]).find(x => x[0] === sec) || ['appearance', 'Appearance'];
  return `<div class="set">
    <nav class="set-nav" aria-label="Settings">${SET_NAV.map(([g, items]) => `<div class="gh">${g}</div>${items.map(([k, n, i]) => `<button class="sitem ${sec === k ? 'on' : ''}" data-a="go" data-r="settings" data-sec="${k}">${ic(i, 15)}<span>${n}</span></button>`).join('')}`).join('')}</nav>
    <div class="set-body" data-keep="set:${sec}"><div class="set-in">${settingsBody(sec, title[1])}</div></div>
  </div>`;
}
export function settingsBody(sec, title) {
  const P = S.prefs;
  const d = D();
  const np = d.notifPrefs;
  const H = lead => `<h1>${title}</h1><p class="lead">${lead}</p>`;
  switch (sec) {
    case 'workspace':
      return (
        H('Your workspace name, address, and identity.') +
        `
      <form data-submit="saveWorkspace">
      <div class="sblock" style="margin-top:0"><div class="row" style="gap:14px;margin-bottom:18px">${wsLogo(d.ws, 52)}<div><div class="label" style="margin-bottom:6px">Workspace icon</div><div class="swatches">${['#2F2E2A', '#5A67D8', '#3B82C4', '#23918A', '#C54B78', '#C48A1E'].map(c => `<button type="button" class="sw ${d.ws.c === c ? 'on' : ''}" style="--c:${c};width:22px;height:22px" data-a="wsColor" data-v="${c}" aria-label="Color ${c}"></button>`).join('')}</div></div></div>
      <div class="col" style="gap:14px;max-width:440px"><div class="field"><label class="label" for="ws-name">Workspace name</label><input class="input" id="ws-name" value="${esc(d.ws.name)}"></div>
      <div class="field"><label class="label" for="ws-url">Workspace URL</label><div class="row" style="gap:0"><span class="input" style="width:auto;background:var(--surface-2);border-right:0;border-radius:6px 0 0 6px;display:flex;align-items:center;color:var(--text-2)">gr8rstudio.com/</span><input class="input" id="ws-url" value="${esc(d.ws.url)}" style="border-radius:0 6px 6px 0"></div><span class="hint">Changing the URL will break existing links.</span></div>
      <div><button class="btn btn-primary" data-a="saveWorkspace" id="ws-save">Save changes</button></div></div></div></form>
      <div class="sblock"><h2 style="color:var(--red)">Danger zone</h2>${srow('Delete workspace', 'Permanently delete this workspace, its projects, tasks, and files. This cannot be undone.', `<button class="btn btn-danger-ghost" style="border:1px solid color-mix(in srgb,var(--red) 35%,transparent)" data-a="delWorkspace">Delete workspace</button>`)}</div>`
      );
    case 'appearance':
      return (
        H('Customize how Gr8r looks on this device.') +
        `
      <div class="sblock" style="margin-top:0"><h2>Theme</h2><div class="themecards" style="margin-top:12px" role="radiogroup" aria-label="Theme">${[
        ['light', 'Light'],
        ['dark', 'Dark'],
        ['system', 'System'],
      ]
        .map(([k, n]) => {
          const L = { bg: '#FBFAF8', s: '#F2F1EE', t: '#1D1C1A', b: '#E3E1DC', a: '#4B5BD6' },
            Dk = { bg: '#1D1D1C', s: '#151514', t: '#ECEAE5', b: '#333230', a: '#8E9AF3' };
          const pv = c =>
            `<div class="s" style="background:${c.s}"><i style="background:${c.b};width:70%"></i><i style="background:${c.a};width:55%"></i><i style="background:${c.b};width:80%"></i><i style="background:${c.b};width:60%"></i></div><div class="m" style="background:${c.bg}"><i style="background:${c.t};width:45%;height:7px"></i><i style="background:${c.b}"></i><i style="background:${c.b};width:80%"></i><i style="background:${c.a};width:30%;height:10px;margin-top:4px"></i></div>`;
          return `<button class="tcard ${P.theme === k ? 'on' : ''}" role="radio" aria-checked="${P.theme === k}" data-a="setTheme" data-v="${k}"><div class="tprev" style="${k === 'system' ? 'grid-template-columns:1fr 1fr;display:grid' : ''}">${k === 'system' ? `<div style="display:grid;grid-template-columns:30% 1fr">${pv(L)}</div><div style="display:grid;grid-template-columns:30% 1fr">${pv(Dk)}</div>` : pv(k === 'light' ? L : Dk)}</div><span class="row" style="font-weight:500;font-size:13px;gap:6px">${ic(k === 'light' ? 'sun' : k === 'dark' ? 'moon' : 'monitor', 14)}${n}${P.theme === k ? `<span class="sp"></span><span style="color:var(--accent)">${ic('circle-check', 15)}</span>` : ''}</span></button>`;
        })
        .join('')}</div></div>
      <div class="sblock"><h2>Accent color</h2>${srow(
        'Accent',
        'Used for primary buttons, focus rings, and selection.',
        `<div class="swatches" role="radiogroup" aria-label="Accent color">${[
          ['indigo', '#4B5BD6'],
          ['blue', '#2F6CD4'],
          ['violet', '#7348CC'],
          ['teal', '#1A7F7A'],
          ['rose', '#B93D68'],
          ['graphite', '#34332F'],
        ]
          .map(
            ([k, c]) =>
              `<button class="sw ${P.accent === k ? 'on' : ''}" style="--c:${c}" role="radio" aria-checked="${P.accent === k}" data-a="setPref" data-k="accent" data-v="${k}" aria-label="${k}" data-tip="${k[0].toUpperCase() + k.slice(1)}">${P.accent === k ? ic('check', 13) : ''}</button>`,
          )
          .join('')}</div>`,
      )}</div>
      <div class="sblock"><h2>Density</h2>
        ${srow('Sidebar density', 'Compact fits more projects on screen.', `<div class="seg">${['comfortable', 'compact'].map(k => `<button class="${P.side === k ? 'on' : ''}" data-a="setPref" data-k="side" data-v="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>`)}
        ${srow('Task display', 'Row height in lists and card padding on boards.', `<div class="seg">${['comfortable', 'compact'].map(k => `<button class="${P.density === k ? 'on' : ''}" data-a="setPref" data-k="density" data-v="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>`)}
        ${srow(
          'Motion',
          'Reduce animations for drawers, modals, and transitions.',
          sel(
            'motion',
            [
              ['system', 'Follow system'],
              ['reduce', 'Reduce motion'],
            ],
            P.motion,
          ),
        )}
      </div>`
      );
    case 'language':
      return (
        H('Language and regional formats.') +
        srow(
          'Language',
          'The language used throughout the interface.',
          sel('lang', ['English (US)', 'English (UK)', 'Deutsch', 'Español', 'Français', '日本語'], P.lang),
        ) +
        srow('Spellcheck', 'Check spelling in descriptions and comments.', tog('spell', P.spell !== false))
      );
    case 'datetime':
      return (
        H('How dates and times appear across the workspace.') +
        srow(
          'Time zone',
          'Used for due dates and reminders.',
          sel('tz', ['(GMT-08:00) Pacific Time', '(GMT-05:00) Eastern Time', '(GMT+00:00) London', '(GMT+01:00) Berlin', '(GMT+08:00) Singapore'], P.tz),
        ) +
        srow(
          'Date format',
          `Preview: <b>${fmtDate(dOff(8))}</b>`,
          sel(
            'dateFmt',
            [
              ['MMM d', 'Oct 1'],
              ['d/M', '1/10'],
              ['M/d', '10/1'],
              ['yyyy-MM-dd', '2026-10-01'],
            ],
            P.dateFmt,
          ),
        ) +
        srow(
          'Start week on',
          'Affects calendars and the timeline.',
          sel(
            'weekStart',
            [
              ['1', 'Monday'],
              ['0', 'Sunday'],
              ['6', 'Saturday'],
            ],
            P.weekStart,
          ),
        ) +
        srow(
          'Time format',
          '',
          sel(
            'timeFmt',
            [
              ['12', '12-hour (2:30 PM)'],
              ['24', '24-hour (14:30)'],
            ],
            P.timeFmt || '12',
          ),
        )
      );
    case 'members':
      return (
        H(`${d.members.length} people have access to ${esc(d.ws.name)}.`) +
        `<div class="row" style="margin-bottom:12px"><button class="btn btn-primary" data-a="invite">${ic('user-plus', 14)}Invite member</button><button class="btn btn-secondary" data-a="go" data-r="members">Open member directory</button></div>
      <div class="panel" style="overflow:hidden">${d.members.map(m => `<div class="mini" style="min-height:52px;cursor:default" data-ctx="member" data-id="${m.id}">${av(m.id, 'md', false)}<div class="grow"><div style="font-weight:500">${esc(m.name)}</div><div class="faint" style="font-size:12px">${esc(m.email)}</div></div>${m.status === 'invited' ? '<span class="badge amber">Invited</span>' : ''}${m.role === 'Owner' ? `<span class="pillbtn">${ic('crown', 13)}Owner</span>` : `<button class="pillbtn bordered" data-a="pop" data-pop="role" data-id="${m.id}">${m.role}${ic('chevron-down', 12)}</button>`}<button class="ibtn ibtn-sm" data-a="ctxBtn" data-ctx="member" data-id="${m.id}" aria-label="Options">${ic('ellipsis', 14)}</button></div>`).join('')}</div>`
      );
    case 'teams':
      return H('Teams group people and projects.') + teamsGrid();
    case 'projects': {
      const arch = d.projects.filter(p => p.archived);
      return (
        H('Defaults for new projects and archived work.') +
        srow(
          'Default project view',
          'The tab that opens when you open a project.',
          sel(
            'defaultTab',
            [
              ['board', 'Board'],
              ['list', 'List'],
              ['table', 'Table'],
              ['overview', 'Overview'],
              ['timeline', 'Timeline'],
            ],
            P.defaultTab || 'board',
          ),
        ) +
        srow('Show completed tasks on boards', '', tog('showDoneBoard', P.showDoneBoard !== false)) +
        `<div class="sblock"><h2>Archived projects</h2>${arch.length ? arch.map(p => `<div class="srow"><div class="row">${pIcon(p, '', 14)}<b style="font-weight:500">${esc(p.name)}</b></div><div class="row"><button class="btn btn-secondary btn-sm" data-a="restoreProject" data-id="${p.id}">Restore</button><button class="btn btn-danger-ghost btn-sm" data-a="delProject" data-id="${p.id}">Delete</button></div></div>`).join('') : `<p class="faint" style="padding:12px 0">No archived projects. Archived projects are hidden from the sidebar but keep all their tasks.</p>`}<div style="margin-top:12px"><button class="btn btn-secondary btn-sm" data-a="go" data-r="archive">${ic('archive', 13)}Open archive</button></div></div>`
      );
    }
    case 'permissions':
      return (
        H('Control what each role can do.') +
        srow('Members can create projects', '', tog('permCreate', P.permCreate !== false)) +
        srow('Members can invite guests', 'Guests only see projects they are added to.', tog('permGuests', P.permGuests !== false)) +
        srow('Allow public share links', 'Anyone with the link can view a project.', tog('permPublic', !!P.permPublic)) +
        `<div class="sblock"><h2>Role permissions</h2><div style="margin-top:12px">${permsTable()}</div></div>`
      );
    case 'notif-email':
      return (
        H('Choose which emails you receive.') +
        srow('Mentions', 'When someone @mentions you.', tog('email_mention', np.email_mention, 'np')) +
        srow('Assignments', 'When a task is assigned to you.', tog('email_assign', np.email_assign, 'np')) +
        srow('Comments', 'On tasks you created or are assigned.', tog('email_comment', np.email_comment, 'np')) +
        srow('Daily digest', 'A summary of what changed, every weekday at 8:00.', tog('email_digest', np.email_digest, 'np'))
      );
    case 'notif-push':
      return (
        H('Notifications on desktop and mobile.') +
        srow('Mentions', '', tog('push_mention', np.push_mention, 'np')) +
        srow('Assignments', '', tog('push_assign', np.push_assign, 'np')) +
        srow('Comments', '', tog('push_comment', np.push_comment, 'np')) +
        srow('Due date reminders', 'One day before a task is due.', tog('push_due', np.push_due, 'np'))
      );
    case 'notif-mentions':
      return (
        H('Decide which mentions reach you.') +
        srow('@mentions in comments and descriptions', '', tog('mention_all', np.mention_all, 'np')) +
        srow('@team mentions', 'When your team is mentioned, e.g. @Product.', tog('mention_team', np.mention_team !== false, 'np')) +
        srow('@workspace mentions', 'Announcements to everyone.', tog('mention_ws', !!np.mention_ws, 'np'))
      );
    case 'notif-assign':
      return (
        H('Updates about tasks assigned to you.') +
        srow("When I'm assigned a task", '', tog('assign_self', np.assign_self, 'np')) +
        srow('When my task changes status', '', tog('assign_status', np.assign_status !== false, 'np')) +
        srow('When my task is overdue', '', tog('assign_over', np.assign_over !== false, 'np'))
      );
    case 'profile': {
      const err = S.ui.errors.pname2;
      return (
        H('How you appear to others in the workspace.') +
        `<form data-submit="saveProfile" class="col" style="gap:16px;max-width:440px">
      <div class="row" style="gap:14px">${av(d.me, 'xl', false)}<div><div class="label" style="margin-bottom:6px">Avatar color</div><div class="swatches">${['#5A67D8', '#C54B78', '#3B82C4', '#23918A', '#C48A1E', '#8662C9'].map(c => `<button type="button" class="sw ${me().c === c ? 'on' : ''}" style="--c:${c};width:22px;height:22px" data-a="avColor" data-v="${c}" aria-label="Color"></button>`).join('')}</div></div></div>
      <div class="field"><label class="label" for="pf-name">Full name</label><input class="input ${err ? 'is-error' : ''}" id="pf-name" value="${esc(P.name)}">${err ? `<span class="err">${ic('circle-alert', 12)}${err}</span>` : ''}</div>
      <div class="field"><label class="label" for="pf-title">Title</label><input class="input" id="pf-title" value="${esc(P.title)}"></div>
      <div class="field"><label class="label" for="pf-email">Email</label><input class="input" id="pf-email" value="${esc(me().email)}" disabled><span class="hint">Contact a workspace owner to change your sign-in email.</span></div>
      <div><button class="btn btn-primary" data-a="saveProfile" id="pf-save">Save profile</button></div></form>`
      );
    }
    case 'preferences':
      return (
        H('Personal defaults for how you work.') +
        srow(
          'Open on launch',
          'The page you see when Gr8r opens.',
          sel(
            'home',
            [
              ['home', 'Home'],
              ['mytasks', 'My Tasks'],
              ['inbox', 'Inbox'],
            ],
            P.home,
          ),
        ) +
        srow(
          'Open tasks in',
          'Side panel keeps your place in the list.',
          sel(
            'openTasks',
            [
              ['drawer', 'Side panel'],
              ['full', 'Full page'],
            ],
            P.openTasks,
          ),
        ) +
        srow('Confirm before deleting tasks', '', tog('confirmDel', P.confirmDel !== false))
      );
    case 'shortcuts':
      return (
        H('Move faster with the keyboard.') +
        SHORTCUTS.map(
          ([g, list]) =>
            `<div class="sblock" style="margin-top:18px"><h2>${g}</h2>${list.map(([n, k]) => `<div class="srow" style="padding:9px 0"><span>${n}</span><span class="row" style="gap:4px">${k.map((x, i) => `${i && k[0] === 'G' ? '<span class="faint" style="font-size:11px">then</span>' : ''}<kbd>${x}</kbd>`).join('')}</span></div>`).join('')}</div>`,
        ).join('')
      );
    case 'password': {
      const e = S.ui.errors;
      const pw = S.ui.pwNew || '';
      return (
        H("Use a long password you don't use anywhere else.") +
        `${S.ui.pwDone ? `<div class="alert ok" style="margin-bottom:14px">${ic('circle-check', 15)}<span>Password updated. Other sessions stay signed in.</span></div>` : ''}<form data-submit="savePassword" class="col" style="gap:14px;max-width:400px">
      <div class="field"><label class="label" for="pw-cur">Current password</label><input type="password" class="input ${e.pwCur ? 'is-error' : ''}" id="pw-cur" autocomplete="current-password">${e.pwCur ? `<span class="err">${ic('circle-alert', 12)}${e.pwCur}</span>` : ''}</div>
      <div class="field"><label class="label" for="pw-new">New password</label><input type="password" class="input ${e.pwNew ? 'is-error' : ''}" id="pw-new" data-in="pwStrength" value="${esc(pw)}" autocomplete="new-password">${strengthMeter(pw)}${e.pwNew ? `<span class="err">${ic('circle-alert', 12)}${e.pwNew}</span>` : '<span class="hint">At least 10 characters with a number or symbol.</span>'}</div>
      <div class="field"><label class="label" for="pw-conf">Confirm new password</label><input type="password" class="input ${e.pwConf ? 'is-error' : ''}" id="pw-conf" autocomplete="new-password">${e.pwConf ? `<span class="err">${ic('circle-alert', 12)}${e.pwConf}</span>` : ''}</div>
      <div><button class="btn btn-primary" data-a="savePassword" id="pw-save">Update password</button></div></form>`
      );
    }
    case 'sessions':
      return (
        H('Devices currently signed in to your account.') +
        d.sessions
          .map(s =>
            srow(
              `<span class="row" style="gap:8px">${ic(s.dev.includes('iPhone') ? 'smartphone' : 'monitor', 15)}${esc(s.dev)}${s.cur ? '<span class="badge green">This device</span>' : ''}</span>`,
              `${esc(s.loc)} · ${esc(s.at)}`,
              s.cur ? '' : `<button class="btn btn-secondary btn-sm" data-a="revokeSession" data-id="${s.id}">Sign out</button>`,
            ),
          )
          .join('') +
        `<div style="margin-top:16px"><button class="btn btn-danger-ghost" data-a="revokeAll" ${d.sessions.length > 1 ? '' : 'disabled'}>Sign out of all other sessions</button></div>`
      );
    case '2fa':
      return (
        H('Add a second step when signing in.') +
        (d.tfa
          ? `<div class="alert ok">${ic('shield-check', 16)}<div><b>Two-factor authentication is on.</b><div class="muted">You'll enter a code from your authenticator app when signing in on a new device.</div></div></div><div class="sblock"><h2>Recovery codes</h2><p class="muted" style="font-size:13px">Store these somewhere safe. Each code works once.</p><div style="display:grid;grid-template-columns:repeat(2,max-content);gap:6px 28px;font-family:var(--mono);font-size:13px;padding:14px;border:1px solid var(--border);border-radius:var(--r);background:var(--sunken);user-select:all">${['7KQ2-M8PX', 'D4TN-9WRE', 'HV3C-QZ6L', 'P2YB-J7SK', 'R9FG-4NUD', 'X6MA-T3HE'].map(c => `<span>${c}</span>`).join('')}</div><div style="margin-top:14px"><button class="btn btn-danger-ghost" data-a="disable2fa">Turn off two-factor authentication</button></div></div>`
          : S.ui.tfaSetup
            ? `<div class="panel" style="padding:18px;display:flex;gap:20px;flex-wrap:wrap"><div style="width:132px;height:132px;display:grid;grid-template-columns:repeat(11,1fr);gap:1px;padding:8px;background:#fff;border-radius:8px;border:1px solid var(--border)" aria-label="QR code">${Array.from(
                { length: 121 },
                (_, i) => {
                  const r = Math.floor(i / 11),
                    c = i % 11;
                  const f = (r < 3 && c < 3) || (r < 3 && c > 7) || (r > 7 && c < 3);
                  const on = f ? !((r === 1 && c === 1) || (r === 1 && c === 9) || (r === 9 && c === 1)) : (i * 7919) % 13 < 6;
                  return `<i style="background:${on ? '#1D1C1A' : '#fff'}"></i>`;
                },
              ).join('')}</div>
        <div class="grow col" style="gap:10px;min-width:220px"><div><b>1. Scan the QR code</b><div class="muted" style="font-size:13px">Use 1Password, Authy, or Google Authenticator.</div></div><div><b>2. Enter the 6-digit code</b></div><form data-submit="verify2fa" class="row"><input class="input mono ${S.ui.errors.tfa ? 'is-error' : ''}" id="tfa-code" inputmode="numeric" maxlength="6" placeholder="000000" style="width:130px;letter-spacing:.2em;font-size:15px" autofocus><button class="btn btn-primary" data-a="verify2fa">Verify</button><button type="button" class="btn btn-ghost" data-a="cancel2fa">Cancel</button></form>${S.ui.errors.tfa ? `<span class="err">${ic('circle-alert', 12)}${S.ui.errors.tfa}</span>` : '<span class="hint">Any 6 digits work in this prototype.</span>'}</div></div>`
            : `<div class="panel" style="padding:18px" ><div class="row" style="gap:14px;align-items:flex-start"><span class="ftype" style="--c:var(--amber);width:36px;height:36px">${ic('shield-alert', 18)}</span><div class="grow"><b>Two-factor authentication is off</b><p class="muted" style="margin:4px 0 12px;font-size:13px">Protect your account with a code from an authenticator app in addition to your password.</p><button class="btn btn-primary" data-a="setup2fa">Set up two-factor authentication</button></div></div></div>`)
      );
    case 'plan':
      return (
        H('Your subscription and usage.') +
        `<div class="panel" style="padding:18px;margin-bottom:18px"><div class="row" style="flex-wrap:wrap"><div><div class="eyebrow">Current plan</div><div style="font-size:20px;font-weight:600;letter-spacing:-.015em;margin-top:4px">${esc(d.plan || 'Team')} <span class="muted" style="font-size:14px;font-weight:400">· Sample plan, no real billing</span></div><div class="muted" style="font-size:13px">Renews ${fmtDate(dOff(7), true)} · Billed monthly</div></div><span class="sp"></span><button class="btn btn-secondary" data-a="go" data-r="settings" data-sec="invoices">View invoices</button></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px;margin-top:18px">${[
        ['Members', d.members.length, 10, ''],
        ['Storage', 12.4, 100, ' GB'],
        ['Projects', d.projects.length, 50, ''],
      ]
        .map(
          ([n, v, m, u]) =>
            `<div><div class="row" style="font-size:12.5px;margin-bottom:6px"><span class="muted">${n}</span><span class="sp"></span><span class="num">${v}${u} of ${m}${u}</span></div><div class="meter"><i style="width:${(v / m) * 100}%;${v / m > 0.75 ? 'background:var(--amber)' : ''}"></i></div></div>`,
        )
        .join('')}</div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">${[
        ['Free', '—', ['Up to 3 members', 'Unlimited tasks', '5 GB storage']],
        ['Team', '—', ['Up to 50 members', 'Timelines & custom views', '100 GB storage', 'Guest access']],
        ['Business', '—', ['Unlimited members', 'Advanced permissions', 'SAML SSO', '1 TB storage']],
      ]
        .map(([n, pr, fs]) => {
          const cur = (d.plan || 'Team') === n;
          return `<div class="plan ${cur ? 'cur' : ''}"><div class="row"><b>${n}</b>${cur ? '<span class="badge accent">Current</span>' : ''}</div><div class="pr">${pr}</div><ul>${fs.map(f => `<li>${ic('check', 13)}${f}</li>`).join('')}</ul><div style="margin-top:8px">${cur ? `<button class="btn btn-secondary btn-block" disabled>Current plan</button>` : `<button class="btn ${n === 'Business' ? 'btn-primary' : 'btn-secondary'} btn-block" data-a="changePlan" data-v="${n}">${n === 'Free' ? 'Downgrade' : 'Upgrade'}</button>`}</div></div>`;
        })
        .join('')}</div>`
      );
    case 'payment':
      return (
        H('Payment method and billing details.') +
        srow(
          `<span class="row" style="gap:10px"><span class="ftype" style="--c:var(--blue)">${ic('credit-card', 15)}</span>Visa ending in 4242</span>`,
          'Expires 08/2028 · Default',
          `<button class="btn btn-secondary btn-sm" data-a="toastInfo" data-msg="Card updates open in a secure payment window">Update</button>`,
        ) +
        srow('Billing email', 'Invoices and receipts are sent here.', `<span class="muted" style="user-select:all">hello@example.com</span>`) +
        srow(
          'Billing address',
          '2150 Mission St, San Francisco, CA 94110',
          `<button class="btn btn-secondary btn-sm" data-a="toastInfo" data-msg="Address editing opens in the billing portal">Edit</button>`,
        ) +
        srow('Tax ID', 'Shown on invoices', `<span class="muted">US EIN ••-•••4410</span>`)
      );
    case 'invoices':
      return (
        H('Past invoices for this workspace.') +
        `<div class="panel" style="overflow-x:auto"><table class="perm-t" style="min-width:480px"><thead><tr><th style="padding-left:14px">Invoice</th><th style="text-align:left">Date</th><th style="text-align:left">Amount</th><th style="text-align:left">Status</th></tr></thead><tbody>${d.invoices.map(i => `<tr><td style="padding-left:14px" class="mono">${i.id}</td><td style="text-align:left" class="num">${fmtDate(i.date, true)}</td><td style="text-align:left" class="num">${i.amt}</td><td style="text-align:left"><span class="badge green">${ic('check', 11)}${i.st}</span></td></tr>`).join('')}</tbody></table></div>`
      );
  }
  return page404();
}
export function strengthMeter(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  const c = ['var(--red)', 'var(--red)', 'var(--amber)', 'var(--green)', 'var(--green)'][s];
  const n = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][s];
  return pw
    ? `<div class="row" style="gap:8px"><div class="strength grow" aria-hidden="true">${[0, 1, 2, 3].map(i => `<i class="${i < s ? 'on' : ''}" style="--c:${c}"></i>`).join('')}</div><span style="font-size:11.5px;color:${c};width:60px;text-align:right">${n}</span></div>`
    : '';
}
