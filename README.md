# Gr8r Studio

A calm, structured project management workspace: home dashboard, inbox, my tasks, projects with
board / list / table / calendar / timeline / files views, members, teams, activity and settings.

Built with plain JavaScript ES modules and CSS, bundled by [Vite](https://vite.dev). There is no
UI framework and no runtime dependency. It runs on Cloudflare: static files are served from the
Worker's assets, and a small Worker API (`worker/index.js`) handles Google sign-in and saves each
workspace to a D1 database.

![Gr8r Studio home dashboard](docs/preview.png)

## Getting started

Requires Node.js 18 or newer (`.nvmrc` pins 22).

1. Create a Google OAuth client (see [Google sign-in](#google-sign-in)) and copy
   `.dev.vars.example` to `.dev.vars` with its client ID and secret.
2. Install and create the local database:

```bash
npm install
npm run db:migrate   # creates the tables in a local D1 database under .wrangler/
npm run dev          # http://localhost:5173: the app and the Worker API, with hot reload
```

Other scripts:

```bash
npm run build     # production build in dist/
npm run preview   # build, then serve it locally with the Worker
npm run lint      # ESLint
npm run format    # Prettier
npm run deploy    # build and deploy to Cloudflare
```

## Google sign-in

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Configure the OAuth consent screen (External, scopes `openid`, `email`, `profile`).
2. Create credentials → OAuth client ID → Web application.
3. Add these authorized redirect URIs:
   - `http://localhost:5173/api/auth/callback` for local development
   - `https://<your-worker>.<your-subdomain>.workers.dev/api/auth/callback` and any custom domain,
     each ending in `/api/auth/callback`

To limit who can sign in, set `ALLOWED_EMAILS` in `wrangler.jsonc` to a comma list of addresses
and `@domains` (for example `@higherdetail.com`). Empty lets any Google account in.

## Deploy to Cloudflare

Everything fits the Workers free plan. One-time setup:

```bash
npx wrangler login
npx wrangler d1 create gr8r-studio        # paste the printed database_id into wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npm run deploy
```

After that, `npm run deploy` ships each change. Add a migration file in `migrations/` and run
`npm run db:migrate:remote` when the schema changes.

## How data is stored

- On first sign-in, a person who was added to someone's workspace opens that workspace. Anyone
  else gets a new, empty workspace and goes through setup (name, first project from a template,
  invites). **Create workspace** in the workspace menu makes another; the menu lists every
  workspace you belong to. **Delete workspace** (owner only, in workspace settings) removes it for
  everyone.
- Each workspace (`S.data`) is stored as one JSON document in `workspaces`. Each member's
  preferences and view settings are stored in `workspace_members.state`.
- `save()` in `core/store.js` queues an upload through `core/sync.js` (debounced, one request at
  a time, retried on failure). Every write carries the version it was based on. If someone saved
  first, the server rejects it and the app merges both versions (`core/merge.js`): records are
  matched by `id`, so edits to different tasks or fields both survive; when two people change the
  same field, the later save wins. Open workspaces check for other people's changes every 10
  seconds while the tab is visible.
- Sessions are 30-day HttpOnly cookies. Only a SHA-256 hash of the token is stored.

## Sharing a workspace

The workspace's **Members** list decides who can open it. Adding someone with **Invite members**
(or sharing a project with a new email) gives that Google address access; removing them takes
it away. No email is sent: send them the app's address and they sign in with Google using the
invited email. Pending invites live in the `invites` table until then.

- Only owners and admins can change access. The server applies member changes only from their
  saves, so a member editing the list has no effect on who can get in. The owner can't be
  removed.
- Everyone with access can read and edit the whole workspace. Guest and per-project permissions
  are shown in the app but are not enforced by the server.

## Project structure

```
index.html              HTML entry; loads src/main.js
wrangler.jsonc          Cloudflare Worker config: static assets, D1 binding, vars
worker/index.js         API: Google OAuth, sessions, workspaces, sharing
migrations/             D1 schema
public/favicon.svg      brand mark
vite.config.js          Vite config, including the Lucide icon-subset plugin
eslint.config.js        lint rules (ESLint flat config); formatting by Prettier (.prettierrc.json)
.github/workflows/      CI: lint, format check, build
docs/preview.png        README screenshot
src/
  main.js               entry: imports styles and modules, then boots the app
  styles/
    index.css           imports every stylesheet in cascade order
    tokens.css          colours, spacing, type, radius, the shared --gutter
    base.css  components.css  shell.css  panels.css  overlays.css  states.css  motion.css  responsive.css
    views/              list, board, table, calendar, timeline, projects & files
    pages/              settings, auth & onboarding
  core/                 utilities, constants, icons, store (state + lookups), sync (server API),
                        merge (combines concurrent edits), theme
  data/workspace.js     the empty workspace a new workspace starts from
  ui/                   shared render helpers, toasts, the select dropdown
  shell/                render loop and router, sidebar/topbar layout, skeletons, view engine
  components/           task list renderer
  pages/                one module per route
  views/                project views: board, table, calendar, timeline, files, overview
  overlays/             task drawer, modals, popovers, context menu, command palette
  features/             teams, subtasks, archive (rendering)
  actions/              user actions, event wiring, keyboard shortcuts, drag and drop
```

### Layers

Dependencies point downward:

1. `core/` and `data/` depend on nothing else in the app.
2. `ui/`, `shell/`, `components/`, `pages/`, `views/`, `overlays/` and `features/` render HTML from state.
3. `actions/` change state and re-render. Each action module registers its handlers on the
   shared action table (`A`) when it loads, so `main.js` imports them after `actions/actions.js`.

## Conventions

- **Rendering:** each page or view is a function that returns an HTML string from the store
  (`S`). `render()` rebuilds the shell and keeps focus and scroll positions.
- **Interactions:** elements declare `data-a="actionName"`. `actions/events.js` delegates the
  click to `A.actionName`. Inputs use `data-in`, blur handlers use `data-blur`.
- **Layout:** every page edge uses `var(--gutter)`, so the breadcrumb, page header, toolbar,
  list, table and board start on the same line.
- **Dropdowns:** write a normal `<select class="select">`. `ui/select.js` renders it as the
  design-system menu and keeps the native element as the source of truth.
- **Icons:** call `ic('name')` with any [Lucide](https://lucide.dev) icon name. The
  `virtual:icons` plugin bundles only the icons the source uses.

## Continuous integration

Every push and pull request runs lint, the format check and a production build
(`.github/workflows/ci.yml`).
