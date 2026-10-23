/* =====================================================================
   PERMISSIONS: shared by the Worker (enforcement) and the app (what to show).
   A person's access to a project comes from their workspace role and the
   project's sharing settings:
   - Owner and Admin: full access to every project.
   - Member: every project open to the workspace, plus private ones they
     were added to. Default level: Can edit.
   - Guest: only projects they were added to. Default level: Can comment.
   - The project lead, and anyone given "Full access", can change the
     project's settings and sharing.
   ===================================================================== */

export const NONE = 0,
  VIEW = 1,
  COMMENT = 2,
  EDIT = 3,
  FULL = 4;
export const PERM_LEVEL = { 'Can view': VIEW, 'Can comment': COMMENT, 'Can edit': EDIT, 'Full access': FULL };
export const LEVEL_NAME = ['No access', 'Can view', 'Can comment', 'Can edit', 'Full access'];

export const isManager = role => role === 'owner' || role === 'admin';
/* "Only people invited" in the share dialog, or the older `private` flag. */
export const isRestricted = p => p.access === 'private' || !!p.private;
export const memberIdFor = (doc, email) => (doc.members || []).find(m => (m.email || '').toLowerCase() === (email || '').toLowerCase())?.id || null;

/* role: the person's workspace role ('owner' | 'admin' | 'member' | 'guest'); mid: their member id in the document. */
export function projectLevel(p, role, mid) {
  if (!p) return NONE;
  if (isManager(role)) return FULL;
  if (mid && p.lead === mid) return FULL;
  const added = !!mid && (p.members || []).includes(mid);
  const set = (mid && PERM_LEVEL[p.perms?.[mid]]) || 0;
  if (role === 'guest') return added ? set || COMMENT : NONE;
  if (isRestricted(p) && !added) return NONE;
  return set || EDIT;
}

/* ---------- what a person may load ---------- */
export function viewFor(doc, role, email) {
  if (isManager(role)) return doc;
  const mid = memberIdFor(doc, email);
  const see = new Set((doc.projects || []).filter(p => projectLevel(p, role, mid) >= VIEW).map(p => p.id));
  const taskProject = new Map((doc.tasks || []).map(t => [t.id, t.project]));
  const inSeen = pid => !pid || see.has(pid);
  return {
    ...doc,
    projects: (doc.projects || []).filter(p => see.has(p.id)),
    projOrder: (doc.projOrder || []).filter(id => see.has(id)),
    tasks: (doc.tasks || []).filter(t => see.has(t.project)),
    comments: (doc.comments || []).filter(c => see.has(taskProject.get(c.task))),
    files: (doc.files || []).filter(f => see.has(f.project)),
    activity: (doc.activity || []).filter(a => inSeen(a.project)),
    events: (doc.events || []).filter(e => inSeen(e.project)),
    savedViews: (doc.savedViews || []).filter(v => inSeen(v.project)),
    notifs: (doc.notifs || []).filter(n => n.to === mid),
  };
}

/* ---------- what a person may change ----------
   `full` is the stored document, `next` is the person's edited copy of their view. Returns the new
   stored document with only the changes they're allowed to make, plus `dropped` when something was
   refused. Owners and admins never reach this. */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const changedKeys = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !same(a[k], b[k]));
const only = (keys, allowed) => keys.every(k => allowed.includes(k));

function mergeList(prev = [], next = [], visible, allowed) {
  let dropped = false;
  const P = new Map(prev.map(x => [x.id, x])),
    N = new Map(next.map(x => [x.id, x])),
    out = [];
  for (const x of next) {
    const p = P.get(x.id);
    if (p && !visible(p)) continue; // re-added unchanged below
    if (!p) allowed(null, x) ? out.push(x) : (dropped = true);
    else if (same(p, x) || allowed(p, x)) out.push(x);
    else {
      out.push(p);
      dropped = true;
    }
  }
  prev.forEach((p, i) => {
    if (N.has(p.id) && visible(p)) return;
    // Records this person can't see stay where they were; deletions they may not make are undone.
    if (visible(p) && allowed(p, null)) return;
    if (visible(p)) dropped = true;
    out.splice(Math.min(i, out.length), 0, p);
  });
  return { list: out, dropped };
}

export function applyChanges(full, next, role, email) {
  const mid = memberIdFor(full, email) || memberIdFor(next, email);
  const P = new Map((full.projects || []).map(p => [p.id, p]));
  const created = new Set((next.projects || []).filter(p => !P.has(p.id)).map(p => p.id));
  // Levels come from the stored project, so nobody can raise their own access in the same save.
  const lv = pid => (created.has(pid) ? (role === 'guest' ? NONE : FULL) : projectLevel(P.get(pid), role, mid));
  const seen = pid => !pid || lv(pid) >= VIEW;
  const out = { ...full };
  let dropped = false;
  const take = (key, visible, allowed) => {
    const r = mergeList(full[key], next[key], visible, allowed);
    out[key] = r.list;
    dropped ||= r.dropped;
  };

  take(
    'projects',
    p => lv(p.id) >= VIEW,
    (a, b) => {
      if (!a) return role !== 'guest';
      if (!b) return lv(a.id) >= FULL;
      const keys = changedKeys(a, b);
      if (only(keys, ['fav'])) return lv(a.id) >= VIEW;
      if (only(keys, ['fav', 'status', 'milestones', 'updated'])) return lv(a.id) >= EDIT;
      return lv(a.id) >= FULL;
    },
  );
  const taskNeed = (a, b) => {
    const keys = changedKeys(a || {}, b || {});
    return a && b && only(keys, ['fav']) ? VIEW : a && b && only(keys, ['fav', 'updated']) ? COMMENT : EDIT;
  };
  take(
    'tasks',
    t => lv(t.project) >= VIEW,
    (a, b) => {
      const need = taskNeed(a, b);
      return (!a || lv(a.project) >= need) && (!b || lv(b.project) >= need);
    },
  );
  const taskProject = new Map([...(full.tasks || []), ...(out.tasks || [])].map(t => [t.id, t.project]));
  take(
    'comments',
    c => lv(taskProject.get(c.task)) >= VIEW,
    (a, b) => {
      const l = lv(taskProject.get((a || b).task));
      if (!a) return l >= COMMENT && b.by === mid;
      if (b && only(changedKeys(a, b), ['re'])) return l >= COMMENT; // reactions
      return a.by === mid ? l >= COMMENT : l >= EDIT;
    },
  );
  take(
    'files',
    f => lv(f.project) >= VIEW,
    (a, b) => (!a || lv(a.project) >= EDIT) && (!b || lv(b.project) >= EDIT),
  );
  take(
    'activity',
    a => seen(a.project),
    (a, b) => !a && (!b.project ? role !== 'guest' : lv(b.project) >= COMMENT),
  );
  take(
    'events',
    e => seen(e.project),
    (a, b) => [a, b].every(x => !x || (x.project ? lv(x.project) >= EDIT : role !== 'guest')),
  );
  take(
    'savedViews',
    v => seen(v.project),
    (a, b) => [a, b].every(x => !x || (x.project ? lv(x.project) >= COMMENT : role !== 'guest')),
  );
  take(
    'notifs',
    n => n.to === mid,
    // Anyone may notify someone else; only the recipient changes or removes their own.
    (a, b) => (!a ? b.by === mid || (b.by == null && b.to === mid) : a.to === mid && (!b || b.to === mid)),
  );
  take(
    'members',
    () => true,
    (a, b) => {
      const own = x => (x.email || '').toLowerCase() === (email || '').toLowerCase();
      if (!a) return own(b) || (role !== 'guest' && b.role === 'Guest');
      if (!b) return false;
      return own(a) && only(changedKeys(a, b), ['name', 'c', 'title', 'tz', 'team', 'status', 'last', 'notifPrefs']);
    },
  );

  // Project order: their order for the projects they see; others keep their place.
  if (!same(full.projOrder, next.projOrder) && role !== 'guest') {
    const ids = new Set(out.projects.map(p => p.id));
    const order = (next.projOrder || []).filter(id => ids.has(id) && seen(id));
    (full.projOrder || []).forEach((id, i) => {
      if (!seen(id) && ids.has(id)) order.splice(Math.min(i, order.length), 0, id);
    });
    out.projects.forEach(p => order.includes(p.id) || order.push(p.id));
    out.projOrder = order;
  } else if (!same(full.projOrder, next.projOrder)) dropped = true;

  // Everything else (workspace name, teams, default settings…) is for owners and admins.
  const handled = ['projects', 'tasks', 'comments', 'files', 'activity', 'events', 'savedViews', 'notifs', 'members', 'projOrder'];
  for (const k of new Set([...Object.keys(full), ...Object.keys(next)])) {
    if (handled.includes(k)) continue;
    if (k === 'me' || k === 'recentSearches') out[k] = next[k];
    else if (!same(full[k], next[k])) dropped = true;
  }
  return { data: out, dropped };
}
