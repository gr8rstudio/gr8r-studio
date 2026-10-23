/* ---------- empty workspace ---------- */
import { uid } from '../core/utils.js';

/* A new workspace document: no projects or tasks, with `user` (the signed-in Google account) as
   its only member and owner. */
export function emptyWorkspace(name = 'My Workspace', user = null) {
  const me = {
    id: uid('m'),
    name: user?.name || 'You',
    email: user?.email || '',
    role: 'Owner',
    team: '',
    title: '',
    c: '#5A67D8',
    status: 'active',
    last: 0,
    tz: '—',
  };
  return {
    ws: { name, url: name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'workspace', c: '#5A67D8' },
    me: me.id,
    members: [me],
    projects: [],
    tasks: [],
    comments: [],
    activity: [],
    notifs: [],
    files: [],
    events: [],
    projOrder: [],
    savedViews: [],
    recentSearches: [],
    sessions: [],
    tfa: false,
    notifPrefs: {
      email_mention: true,
      email_assign: true,
      email_digest: true,
      email_comment: false,
      push_mention: true,
      push_assign: true,
      push_comment: true,
      push_due: true,
      mention_all: true,
      assign_self: true,
    },
  };
}
