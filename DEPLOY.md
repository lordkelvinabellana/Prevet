# Deploying to Vercel

The Car Pre-Vetting Tool is a standard **Next.js 16** App Router app backed by
**Supabase**. Vercel deploys it zero-config — no `vercel.json` needed. Run
`/preflight` first (the readiness gate), then follow this runbook.

## 1. Preflight (local)
Run the slash command **`/preflight`** — it runs the hard gate (`npm run lint`,
`npx tsc --noEmit`, `npm run build`, `npm test`) and checks for committed secrets.
The Vercel build runs `next build`, so a clean local build ≈ a clean deploy.

Commit everything you intend to ship — Vercel builds the committed tree.

## 2. Environment variables (the #1 gotcha)
Set these in **Vercel → Project → Settings → Environment Variables** for the
environments you build (Production and Preview), **before** the first build.
`NEXT_PUBLIC_*` vars are **inlined at build time**, so a missing one ships a
browser client that throws at runtime — they are not read lazily at request time.

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
