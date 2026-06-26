# Deploying to Vercel

The Car Pre-Vetting Tool is a standard **Next.js 16** App Router app backed by
**Supabase**. Vercel deploys it zero-config — no `vercel.json` needed. Run
`/preflight` first (the readiness gate), then follow this runbook.

## 1. Preflight (local)
Run the slash command **`/preflight`** — it runs the hard gate (`npm run lint`,
`npx tsc --noEmit`, `npm run build`, an **env-less build**, `npm test`) and checks
for committed secrets.

> ⚠️ A green `npm run build` locally does **not** prove the Vercel build will pass —
> it's green because `.env.local` feeds it. Vercel builds without your local file.
> Preflight therefore also runs `NEXT_PUBLIC_SUPABASE_URL='' NEXT_PUBLIC_SUPABASE_ANON_KEY='' npm run build`
> to reproduce a fresh Vercel project. That must succeed. It does because the whole
> `(app)` area is `export const dynamic = "force-dynamic"` (in `(app)/layout.tsx`),
> so its auth-gated pages are rendered per-request and never prerendered at build —
> the build needs no Supabase secret. If you ever add a route that touches Supabase
> at build time, this check fails; make that route dynamic, don't lean on env being
> present at build.

Commit everything you intend to ship — Vercel builds the committed tree.

## 2. Environment variables (the #1 gotcha)
Set these in **Vercel → Project → Settings → Environment Variables** for both
**Production and Preview**. The build itself no longer needs them (the `(app)`
area is forced dynamic — see §1), but every authed page reads them **at runtime**,
so a deployment without them renders an error on `/`, `/assess`, etc. Set them
before the first build anyway — it's the safe default and covers any future
`NEXT_PUBLIC_*` use that would be inlined into a client bundle.

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production + Preview | anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview | **server-only** — never prefix with `NEXT_PUBLIC_`, never import in a Client Component |

Source of truth for the names is `.env.example`. The current project ref is
`cmwssucvqtaqkqosrumv` (see `PROGRESS.md`).

> If you change an env var after a build, **redeploy** — the value is baked into
> the build, not picked up at runtime for `NEXT_PUBLIC_*`.

## 3. Supabase configuration
- **Auth → URL Configuration**: add the production domain and the
  `*.vercel.app` preview URLs to the **Site URL** and **Redirect URLs** allow-list,
  or email-confirmation / redirect-based auth will fail in production.
- **RLS** is already enforced (migrations `0001`–`0004`); the deployed app uses the
  same hosted Supabase project and its policies. No DB change is needed to deploy.
- The deployed app talks to the **same database** as local dev — be mindful that
  test data you create in production is real rows in that project.

## 4. Deploy
- **Git integration (recommended):** import the repo in Vercel, set the env vars
  above, push to `main` → Production; PRs/branches → Preview deployments.
- **CLI (optional):** `npm i -g vercel`, then `vercel` (preview) / `vercel --prod`.
  Use `vercel env pull` to sync env vars locally.

Framework preset: **Next.js**. Build command `next build`, install `npm install`
(lockfile present). Node: `engines.node` is `>=20.9.0`; Vercel's default Node 24
LTS satisfies it. Do **not** set `output: 'export'` — the app is server-rendered
(auth, route handlers, server actions, the `proxy` session refresh).

## 5. Post-deploy smoke test
1. Visit the deployment → you should be redirected to `/login` (the `proxy` +
   `requireUser` gate working).
2. Sign in with a real Supabase user → lands on the launchpad.
3. `/assess` → run a scenario preset → a verdict renders.
4. `/assessments` and `/dashboard` load with RLS-scoped data; **Export CSV** downloads.
5. Toggle dark mode; reload — it persists (no flash).

If sign-in succeeds locally but not on Vercel, re-check step 2 (env vars baked at
build) and step 3 (Supabase URL allow-list).
