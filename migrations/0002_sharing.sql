-- Workspace sharing: a name for the workspace switcher and pending invitations.
ALTER TABLE workspaces ADD COLUMN name TEXT NOT NULL DEFAULT 'Workspace';
UPDATE workspaces SET name = COALESCE(json_extract(data, '$.ws.name'), 'Workspace');

-- Emails are matched case-insensitively, so store them lowercased.
UPDATE users SET email = lower(email);
CREATE INDEX users_email ON users(email);

-- People added to a workspace who haven't signed in yet. Claimed on their first sign-in.
CREATE TABLE invites (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, email)
);
CREATE INDEX invites_email ON invites(email);
