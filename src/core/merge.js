/* ---------- three-way merge ----------
   Combines this browser's edits with someone else's saved edits. `base` is the version both started
   from, `mine` has this browser's changes, `theirs` is what the server has now. Records in arrays are
   matched by `id`, so two people editing different tasks (or different fields of one task) both keep
   their changes. When both changed the same field, this browser's value wins. */

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const keyed = a => Array.isArray(a) && a.length > 0 && a.every(x => isObj(x) && x.id != null);

export function merge(base, mine, theirs) {
  if (same(mine, base)) return theirs;
  if (same(theirs, base) || same(mine, theirs)) return mine;
  if (isObj(mine) && isObj(theirs)) {
    const b = isObj(base) ? base : {},
      out = {};
    for (const k of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      if (!(k in mine) && k in b) {
        // I deleted the key: keep it deleted unless they changed it.
        if (k in theirs && !same(theirs[k], b[k])) out[k] = theirs[k];
      } else if (!(k in theirs) && k in b) {
        if (!same(mine[k], b[k])) out[k] = mine[k];
      } else out[k] = k in mine && k in theirs ? merge(b[k], mine[k], theirs[k]) : k in mine ? mine[k] : theirs[k];
    }
    return out;
  }
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    const b = Array.isArray(base) ? base : [];
    if ((keyed(mine) || !mine.length) && (keyed(theirs) || !theirs.length) && (keyed(b) || !b.length)) return mergeRecords(b, mine, theirs);
    if ([...mine, ...theirs, ...b].every(x => typeof x !== 'object' || x === null)) return mergeSet(b, mine, theirs);
  }
  return mine;
}

/* Arrays of { id } records. Follows my order; records only they added keep their position. */
function mergeRecords(base, mine, theirs) {
  const B = new Map(base.map(x => [x.id, x])),
    M = new Map(mine.map(x => [x.id, x])),
    T = new Map(theirs.map(x => [x.id, x]));
  const out = [];
  for (const x of mine) {
    if (T.has(x.id)) out.push(merge(B.get(x.id), x, T.get(x.id)));
    else if (!B.has(x.id) || !same(x, B.get(x.id))) out.push(x); // I added it, or I edited what they deleted
  }
  theirs.forEach((x, i) => {
    if (M.has(x.id)) return;
    if (B.has(x.id) && same(x, B.get(x.id))) return; // I deleted it and they didn't touch it
    // They added it (or edited what I deleted): place it after the record that precedes it for them.
    const prevId = theirs[i - 1]?.id;
    const at = prevId == null ? 0 : out.findIndex(o => o.id === prevId) + 1;
    out.splice(at > 0 || prevId == null ? at : out.length, 0, x);
  });
  return out;
}

/* Arrays of plain values (ids, tags): keep my order, apply their additions and removals. */
function mergeSet(base, mine, theirs) {
  const B = new Set(base),
    T = new Set(theirs),
    M = new Set(mine);
  return [...mine.filter(x => !(B.has(x) && !T.has(x))), ...theirs.filter(x => !B.has(x) && !M.has(x))];
}
