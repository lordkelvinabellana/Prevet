---
description: Pre-deploy readiness check for Vercel (lint, types, build, tests, secrets, env)
argument-hint: (no args)
allowed-tools: Bash, Read, Glob, Grep
---

You are running **preflight** — the deploy-readiness gate for the Car Pre-Vetting
Tool before it ships to **Vercel** (Next.js 16 App Router + Supabase). Work through
the steps in order, show the real command output, and end with a single PASS/FAIL
verdict. Do **not** fix anything or deploy — this is a read-only check; if a step
fails, stop and report exactly what failed and the likely fix.

## Hard gate — must all pass (run from the repo root)
Run each and report ✅/❌ with the key output:
1. `npm run lint` — ESLint must be clean (0 errors). Warnings are acceptable but note them.
2. `npx tsc --noEmit` — no type errors.
3. `npm run build` — `next build` must succeed. This is the truest check that the
   App Router routes type-check and the production bundle compiles. Confirm the
   route list includes the expected routes (`/`, `/assess`, `/assessments`,
   `/assessments/[id]`, `/dashboard`, `/login`, the `/api/*` handlers) and that
   `proxy` (Middleware) is listed.
4. `npm test` — Vitest unit suite green.

If any of these fail, STOP: the Vercel build will fail too. Report the failure.

## Secret & env safety
5. Confirm no secrets are committed or staged:
   - `git status --porcelain` — note any uncommitted changes (a deploy ships the
     committed tree, so flag anything not committed).
   - `git ls-files | grep -E '^\.env' || true` — only `.env.example` may be tracked.
     If a real `.env`/`.env.local` is tracked, that's a ❌ (rotate the keys).
   - Grep the staged/committed source for obvious leaked secrets (a Supabase
     `service_role` JWT, hardcoded keys): `git grep -nE 'service_role|eyJ[A-Za-z0-9_-]{20,}' -- src ':!*.example' || true`.
6. Confirm the app reads config from env, not hardcoded values:
   `grep -rn 'localhost\|127.0.0.1\|:3000' src/ || echo "clean"` (tests/scripts may
   reference localhost — only `src/` matters).

## Vercel project checklist (report as reminders — you can't verify these from here)
These are set in the Vercel dashboard / Supabase dashboard, not the repo. List them
so the user can confirm before/at deploy:
- **Environment Variables** must be set in the Vercel project for the building
  environment (Production/Preview) **before the build** — `NEXT_PUBLIC_*` vars are
  inlined at build time, so a missing one ships a broken client:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only; never `NEXT_PUBLIC_`)
  Cross-check against `.env.example` (read it) and report the exact list.
- **Framework preset**: Next.js (zero-config). No `vercel.json` is needed; don't add
  `output: 'export'` (the app is dynamic/server-rendered).
- **Supabase Auth → URL Configuration**: add the production + preview Vercel URLs to
  the Site URL / Redirect allow-list, or email/redirect-based auth will bounce.
- **Node**: `package.json` `engines.node` is `>=20.9.0`; Vercel's default (Node 24
  LTS) satisfies it.

## Output
Finish with a compact checklist (✅/❌ per item) and a one-line verdict:
**READY TO DEPLOY** only if the hard gate fully passed, otherwise **NOT READY** with
the blocking item. Then restate the Vercel/Supabase dashboard reminders the user
must confirm manually. See `DEPLOY.md` for the full runbook.
