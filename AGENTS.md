# Repository Guidelines

## Project Structure & Module Organization
ProsperityCRM is a Turbo monorepo on Node 18+. `apps/api` hosts the Express + Zod service under `src/modules/**`, `apps/web` delivers the Vite React client, SQL migrations sit in `infra/db/migrations`, helper scripts in `scripts/`, and fixtures plus API/E2E harnesses live inside `tests/{fixtures,api,e2e}`. Create workspaces only inside `apps/*`, `packages/*`, or `infra/*` so Turbo tracks them automatically.

## Build, Test, and Development Commands
- `npm install` – hoists workspace dependencies.
- `npm run dev` – `turbo run dev`, starting the API (`tsx watch src/server.ts`) and web (`vite`) in parallel.
- `npm run build` – production compile for every workspace; `npm run typecheck` runs `tsc --noEmit`.
- `npm run lint` – ESLint + Prettier via `.eslintrc.cjs`.
- `npm run test` – fan-out Vitest suites plus Playwright jobs declared under `tests/**`.
- `npm run migrate` – executes `infra/db/migrations/*.sql` through `scripts/run-migrations.mjs` using `DATABASE_URL`.

## Coding Style & Naming Conventions
All code is strict TypeScript formatted by `.prettierrc.cjs` (2 spaces, single quotes, trailing commas, 100-character width). React components/files stay PascalCase (`CandidateBoard.tsx`), functions camelCase, and environment variables SCREAMING_SNAKE_CASE. Keep DTOs, schema builders, and shared utilities in `packages/**/*` or module-level `types.ts` files. Run `npm run lint -- --fix` and `npm run typecheck` before opening a pull request.

## Testing Guidelines
Vitest is the default runner; scope API suites with `npm run test -- --filter api`. Integration suites belong in `tests/api` with data from `tests/fixtures`, while Playwright specs live in `tests/e2e` and should target the latest preview before merging. Name files `<feature>.test.ts` or `.spec.ts` and maintain ≥80% line/branch coverage with `npm run test -- --coverage`.

## Commit & Pull Request Guidelines
History favors short imperative subjects (e.g., `fix build errors for vercel`); keep each commit focused and mention schema or infra side effects in the body. Pull requests should state the problem, the change, and verification (`npm run test`, `npm run migrate`, screenshots/GIFs for UI). Link Linear or GitHub issues, tag affected workspaces (`@prosperity/api`, `@prosperity/web`, `infra`), and flag security reviewers for auth, invite, or `/admin` updates.

## Security & Configuration Tips
Copy `.env.example` to `.env.local`, then set `DATABASE_URL`, `PG_SSL`, `ROOT_ADMIN_TOKEN`, and `LOCAL_AUTH_SECRET` before running dev servers or migrations. `/admin/*` routes require the `x-admin-token` header, invite passcodes should stay out of logs, and tokens must never be pasted into issues. Validate payloads with Zod before database access and prefer disposable databases for schema experiments.
