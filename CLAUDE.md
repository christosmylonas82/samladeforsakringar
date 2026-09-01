# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git workflow — commit and push regularly

Work in this repository must not live only in the local working tree. As you make changes:

- Commit early and often, in small logical units — don't batch unrelated changes into one commit.
- Write clean, descriptive commit messages that explain *why*, not just *what* (e.g. `Fix CORS origin mismatch after Vercel redeploy`, not `update`).
- Push to `origin/main` regularly (after each meaningful commit or logical chunk of work), not just at the end of a session — this repo has no CI/CD trigger wired to pushes, so pushing does not risk an unwanted deploy.
- Before any commit, review `git status`/`git diff` to make sure only intended files are staged (never commit `.env`, only `.env.example`).
- Never force-push, rebase, or rewrite history on `main` without explicit approval.

This exists so that work is never lost and the GitHub repo (`christosmylonas82/samladeforsakringar`) always reflects current status, even if a local session is interrupted.

## Commands

Run from the repo root unless noted. This is an npm workspaces monorepo (`frontend`, `backend`).

```bash
npm install                              # installs deps for both workspaces
npm run dev                              # runs backend (:4000) + frontend (:5173) concurrently
npm run build                            # builds backend (prisma generate + tsc) then frontend (tsc -b + vite build)
npm run lint                             # lints backend (eslint) then frontend (oxlint)
docker compose up -d                     # starts local Postgres on host port 5433 (see "Local database" below)
```

Backend-specific (run with `--workspace=backend`, or `cd backend` first):

```bash
npm run dev --workspace=backend          # tsx watch src/index.ts
npm run prisma:migrate --workspace=backend   # prisma migrate dev — creates + applies a new migration
npm run prisma:generate --workspace=backend  # regenerate Prisma Client after schema.prisma changes
npm run prisma:seed --workspace=backend      # seeds an admin user (admin@samladeforsakringar.se)
npm run prisma:studio --workspace=backend    # opens Prisma Studio against DATABASE_URL
```

There is no test runner configured yet in either workspace — no `npm test` command exists.

## Local database — non-default port

Local Postgres runs on **host port 5433**, not 5432, because 5432 is already used by another local project's container on this machine. This is reflected in both `docker-compose.yml` (`"5433:5432"`) and `backend/.env.example`'s `DATABASE_URL`. Production (Railway) is unaffected — it uses Railway's internal network address via the `${{Postgres.DATABASE_URL}}` variable reference, not this port.

## Architecture

**Monorepo, two deploy targets:** `frontend` → Vercel (static Vite build), `backend` → Railway (long-running Node process + its own Postgres service). They are wired together via env vars, not a shared build: `VITE_API_BASE_URL` (frontend) must point at the deployed backend's `/api` URL, and `CLIENT_ORIGIN` (backend) must point at the deployed frontend's origin for CORS. Railway is **not** connected to GitHub for auto-deploy — deploys happen via `railway up` from the repo root (the build context must be the monorepo root, not `backend/`, because `railway.json`'s build/start commands invoke `npm run build/start --workspace=backend`).

**Backend request flow:** `src/index.ts` → `src/app.ts` (Express app, CORS + JSON body parsing + route mounting) → `src/routes/*.routes.ts` → `src/controllers/*.controller.ts`. Every route module except `auth.routes.ts` applies `requireAuth` (`src/middleware/auth.ts`) at the router level via `router.use(requireAuth)`, so individual route handlers can assume `req.user` is populated. Controllers validate input with Zod schemas defined inline at the top of the file (not shared/generated from the Prisma schema — keep them in sync manually when `schema.prisma` changes).

**Ownership checks are per-row, not just per-route.** `policies.controller.ts` and `claims.controller.ts` each have an `assertOwned*` helper that loads the row and throws `HttpError(403/404)` if it doesn't belong to `req.user.userId`. Any new resource-scoped endpoint should follow this pattern rather than relying on route-level auth alone — see `SKILL_Security_Chief.md` for why.

**Errors are centralized:** controllers throw `HttpError` (`src/middleware/errorHandler.ts`) or let Zod throw; routes wrap handlers in `asyncHandler` (`src/lib/asyncHandler.ts`) so async errors reach the single `errorHandler` middleware mounted last in `app.ts`. Don't add per-route try/catch — follow the existing throw-and-let-the-handler-catch-it pattern.

**Data model** (`backend/prisma/schema.prisma`): `User` owns `InsurancePolicy` rows, which own `Claim` rows; `Document` can attach to either a policy or a claim. Status/type fields are Prisma enums (`PolicyType`, `PolicyStatus`, `PaymentFrequency`, `ClaimStatus`, `DocumentType`, `SystemRole`) — when adding a new status value, update the enum in `schema.prisma`, run `prisma migrate dev`, and check both the Zod validation schema and any frontend `<select>` options that enumerate the same values, since none of these are currently generated from a single source of truth.

**Frontend routing** uses React Router v7's data-router API (`createBrowserRouter` + `RouterProvider`, wired in `src/router.tsx`/`src/main.tsx`), not the older `<BrowserRouter>/<Routes>` component API. `App.tsx` is the root layout (renders `<Outlet />`); page components live under `src/pages/` and are registered as `children` routes in `router.tsx`.

**Documents are stored as base64 in Postgres** (`Document.fileData`, a `@db.Text` column), not in object storage — see `claude_code_setup/SKILL_Security_Chief.md` for the security implications of this (base64 is an encoding, not encryption) before changing how files are handled.

**PDF → AI extraction pipeline (planned/documented, not yet implemented in code):** the intended flow — upload PDF as a `Document` → send to Claude API for structured extraction → validate the response against the same Zod schema used for manual input → show it to the user as an editable suggestion → only write to `InsurancePolicy`/`Claim` on explicit user confirmation — is specified in detail in `claude_code_setup/SKILL_Dev_Lead.md` (which fields to extract) and `claude_code_setup/SKILL_UX_Lead.md` (the review/edit UX). Follow those when implementing it.

## Role-specific guidance (`claude_code_setup/`)

Five role-specific skill files define standards for this project — read the relevant one before doing security, backend/architecture, frontend/UX, QA, or DevOps work: `SKILL_Security_Chief.md`, `SKILL_Dev_Lead.md`, `SKILL_UX_Lead.md`, `SKILL_QA_Engineer.md`, `SKILL_DevOps_Lead.md`.

## Known dependency vulnerabilities

`npm audit` currently reports vulnerabilities in `tar` (critical, via `bcrypt → @mapbox/node-pre-gyp`) and `deepmerge-ts` (high, via `prisma → @prisma/config`) that cannot be resolved with `npm audit fix` — both are pinned by upstream packages outside a fixable range. Both only run during `npm install`, not in the production request path. Don't attempt to force-fix these with overrides or upstream major-version bumps without checking in first — see the README's "Kända beroende-sårbarheter" section for the full explanation.
