# CLAUDE.md

This file provides guidance to Claude Code when working with code in this
repository: Prosperity CRM.

## ⚠️ STOP: Read This First - Architect Requirement

**BEFORE YOU DO ANYTHING ELSE**, determine if this task requires architect consultation:

### Does This Task Require an Architect?

**YES - Invoke architect FIRST** if the task involves:
- New features or functionality (beyond trivial changes)
- API changes (new endpoints, request/response shapes, auth)
- Database changes (models, schema, relationships, migrations)
- New UI components or state management changes
- Domain-critical operations: auth and invite redemption, org scoping, entry
  status moves, opportunity stage transitions, LinkedIn profile extraction,
  the content-script protocol, design tokens, any migration
- Refactoring that touches more than 2-3 files
- Bug fixes affecting core business logic or security

**NO - Proceed directly** only for:
- Single-line typo/bug fixes
- Documentation-only changes
- Adding comments to existing code
- Simple config value changes
- Test additions that don't change implementation

**How:** `/harness:plan [description]` auto-invokes the right architects
based on domain detection. For a single consultation, use the Task tool with
the agent name from the routing table below.

**VIOLATION**: Proceeding with major work without architect consultation
breaks project requirements.

### Architect Routing Table

The generic architects below ship with the `harness` plugin, so the Task tool must
dispatch them by their `harness:`-qualified name - a bare name resolves only inside the
plugin's own repo, never for a plugin consumer. The project's own architects, in the
second table, live in this repo's `.claude/agents/` and stay bare.

| Agent | Domain | Triggers |
|-------|--------|----------|
| `harness:code-architect` | General | **DEFAULT** - use when unsure |
| `harness:react-architect` | React/Next.js | components, hooks, `*.tsx`, TanStack Query, router |
| `harness:vue-architect` | Vue/Nuxt | `*.vue`, `nuxt.config.*`, Pinia, reactivity |
| `harness:angular-architect` | Angular | `angular.json`, signals, RxJS, standalone components |
| `harness:frontend-architect` | Frontend (generic) | CSS, accessibility, Core Web Vitals, vanilla JS, mixed/unclear stack |
| `harness:api-architect` | REST/API design | endpoints, request/response shapes, routes |
| `harness:db-architect` | Database (generic) | query shape, indexing theory, SQL idiom |
| `harness:security-architect` | Auth/security | encryption, OWASP, secrets, dependency risk |
| `harness:test-architect` | Testing | tests, coverage, mocks, `*.test.*` |
| `harness:performance-architect` | Performance | optimization, cache, bundle, slow |
| `harness:docs-architect` | Documentation | docs, README, JSDoc, guides |
| `harness:ai-systems-architect` | AI/LLM/MCP | agents, prompts, MCP, `.claude/` |
| `harness:android-architect` | Android/Kotlin | `*.kt`, Android Studio, Gradle |

**Project architects** - prefer these over the generic ones whenever the work
falls in their territory. They carry this codebase's invariants; the generic
ones do not.

| Agent | Domain | Triggers |
|-------|--------|----------|
| `tenancy-architect` | Identity, roles, orgs, invites | auth, login, magic link, passkey, invite code, role, organization, root admin, `apps/api/src/modules/{auth,invite,user,organization,admin}/**`, `apps/api/src/middleware/**` |
| `pipeline-architect` | The two CRM funnels | person, candidate, company, job, requisition, opportunity, deal, entry, status, activity, history, skill, `apps/api/src/modules/{person,company,job,opportunity,entry,status,activity,history,skill}/**` |
| `schema-architect` | DB substrate | migration, schema, column, table, index, constraint, RLS, seed, `infra/db/**`, `apps/api/src/db/**`, `scripts/run-*.mjs` |
| `extension-architect` | LinkedIn sourcing extension | extension, LinkedIn, content script, side panel, service worker, parser, protocol version, manifest, `apps/extension/**` |
| `design-system-architect` | Web design system | token, colour, theme, dark mode, Tailwind config, primitive, Button/Chip/Card/Field, spacing, `apps/web/src/styles/**`, `apps/web/src/components/ui/**` |

## Project Overview

Prosperity CRM is a low-budget CRM for local recruiting agencies. It runs two
funnels joined at the company: business development wins a contract, and
recruiting fills the requisitions that contract produces. `organization` is the
tenant; `company` is the client or prospect. The repo is an npm-workspaces
monorepo driven by Turbo, with three applications: an Express API on Node, a
React and Vite single-page web app, and a Manifest V3 Chrome extension that
sources candidates from LinkedIn profiles into the pipeline. Database access is
Drizzle over Postgres, with hand-written SQL migrations. The API deploys to
Render and the web app to Vercel.

## Components

| Component | Path | Dev command | Type check | Test command | Trustworthy suite? |
|---|---|---|---|---|---|
| api | `apps/api/` | `npm run dev --workspace @prosperity/api` | `npx tsc --noEmit` | `npm test --workspace @prosperity/api` | yes for what it covers - 13 files / 75 tests, deterministic, no DB. Coverage is narrow: schemas, rules, CORS, error handler, migration guards. **No test exercises the auth middleware, `requireRole`, the root-admin guard, or any route handler.** |
| web | `apps/web/` | `npm run dev --workspace @prosperity/web` | `npx tsc --noEmit` | `npm test --workspace @prosperity/web` | yes - 32 files / 147 tests, jsdom, fast and green. Includes token parity and spacing guards. |
| extension | `apps/extension/` | `npm run dev --workspace @prosperity/extension` | `npx tsc --noEmit` | `npm test --workspace @prosperity/extension` | yes - 1 file / 48 tests, jsdom fixtures captured from real LinkedIn DOM. A selector change without a fixture change is unverified. |

Repo-wide: `npm test`, `npm run typecheck`, `npm run lint` fan out through
Turbo. Turbo caches test and typecheck results, so a cached "pass" can be
stale - re-run the workspace directly when the answer matters.

Not workspaces despite the glob: `infra/db/` (SQL only) and `tests/` (README
only). `packages/` does not exist.

`npm run migrate` and `npm run seed` run from the repo root. The seed
truncates the funnel tables and must never be pointed at real data.

## Git Structure

- Integration branch: `main` - PRs target it directly, never push to it
- Protected branches: `main`
- **Never push directly to `main`.** Branch as `feat/...` or `fix/...`, push
  the branch, open a PR with `gh pr create`, and wait for review and merge.
  See `.agents/rules/git-workflow.md`.
- Branch prefixes in use: `feat/`, `fix/`, `redesign/NN-`, `spec/`
- Single repo; all git commands run at the repo root
- There is no CI. No `.github/` workflows exist, so the local suites and type
  checks are the only gate before merge.

## Worktree Setup

| Repo | Env files to copy | Install command |
|---|---|---|
| ProsperityCRM (root) | `.env` | `npm install` |

## Development Rules

### ⚠️ NEVER Run `npm run build` During Development
Dev servers hot-reload; build output breaks them. Validate types with the
type check commands above instead. Only build for production or when
explicitly asked. The one legitimate build is `npm run package:extension`,
which builds and zips the extension for distribution.

### Database
- Migrations run **once per database, keyed by filename**, and run on **every
  Render deploy** from `main`. Editing an applied migration does nothing.
  Changes need a new file.
- Comments in `0010` and in the BD funnel plan claim the runner replays every
  file. That is stale and predates the tracking table. Do not reason from it.
- Never reuse migration number `0012`. It was deleted for writing default
  credentials into production and databases that ran it still carry its row.
- Never put credentials or PostgREST grants in a migration. Guard tests
  enforce both.
- A schema change is two edits: the SQL migration and the hand-maintained
  Drizzle mirror in `apps/api/src/db/schema.ts`. The SQL wins; the mirror
  already drifts in several places.

### Tenancy
- `organization_id` is stamped on insert from `req.dbUser.organization_id` and
  is **not** filtered on reads, updates or deletes. Row-level security is
  `USING (true)` and isolates nothing between tenants.
- This is a recorded, accepted scope cut for the current single-organization
  deployment. **It must be closed before a second organization is onboarded.**
  Prefer scoping any query you are writing anyway.

### Environment
- Node is pinned to `20.19.4` in `.nvmrc` and `engines`. Check what you are
  actually running; a mismatch warns but does not block.
- Secrets live in `.env` at the repo root. Never read or print it; `.env.example`
  documents the variable names.
- Generated and gitignored, never edit by hand: `dist/`, `.turbo/`,
  `*.tsbuildinfo`, `prosperity-crm-extension.zip`.

### Conventions
- Prettier: single quotes, semicolons, trailing commas, 100 columns.
- All web HTTP goes through the single axios client in `apps/web/src/api/`.
  Do not introduce a second HTTP path.
- Colour is defined only in `apps/web/src/styles/tokens.css`. Tailwind names
  tokens but holds no values, and opacity modifiers do not work on `var()`
  colours.
- The extension's `PROTOCOL_VERSION` must be bumped whenever a message or
  profile shape changes.
