# Repository Guidelines

## Project Structure & Module Organization
Keep the mono-repo tidy: REST/GraphQL services live in `apps/api/`, the React front end in `apps/web/`, reusable models and hooks in `packages/common/`, and IaC or deployment assets in `infra/{dev,prod}/`. Place integration and unit tests under `tests/` mirroring the source tree (e.g., `tests/api/candidates.test.ts`). Store shared mock data in `tests/fixtures/`, and keep environment templates in `.env.example` at the root. Organization-aware logic (users, organizations, invites, statuses) sits under `apps/api/src/modules/**`; add a README when expanding a domain.

## Build, Test, and Development Commands
Install dependencies once via `npm install` (pnpm is fine if a lockfile is committed). Use `npm run dev` (Turbo fan-out) for local development, which spawns API and Web workspaces in parallel. `npm run build` compiles every workspace for CI, and `npm run lint` runs ESLint + Prettier checks. Before deploying, execute `npm run migrate` to apply Supabase/Neon migrations defined in `infra/db/migrations/`. Super-admin utilities live under `/admin` routes and require the `x-admin-token` header that matches `ROOT_ADMIN_TOKEN`; local email/password auth uses `LOCAL_AUTH_SECRET` to sign temporary JWTs.

## Coding Style & Naming Conventions
Write strict TypeScript targeting ES2022 with 2-space indentation, single quotes, and trailing commas. React components should be PascalCase (`CandidateBoard.tsx`), functions camelCase, and environment variables SCREAMING_SNAKE_CASE. Keep DTOs (including `OrganizationDTO` and the `Role` union) plus any schema builders in `packages/common/src/types/` to avoid duplication. Run `npm run lint -- --fix` before committing; Prettier config lives in `.prettierrc.cjs`.

## Testing Guidelines
Use Vitest (unit) and Playwright (E2E). Name specs `<feature>.test.ts` or `<feature>.spec.ts` alongside the mirrored source folder. Maintain ≥80% line/branch coverage; fail CI if `npm run test -- --coverage` drops below the threshold. Seed integration tests via JSON fixtures and mock Supabase/Neon clients to avoid touching production data.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). Keep commits scoped to a single concern and note schema or infra changes in the body. PRs must include: problem statement, summary, test evidence (`npm run test` output), screenshots/GIFs for UI changes, and linked Linear/GitHub issues. Tag module owners (`@prosperity-api`, `@prosperity-web`) plus `@prosperity-security` for auth/PII changes, and call out any organization, invite-code, or role-mapping implications when touching `users`, `organizations`, or `org_invite_codes`.

## Security & Configuration Tips
Authenticate via Google OAuth where possible; the temporary email/password bridge stores plain text passwords (dev use only) and signs JWTs with `LOCAL_AUTH_SECRET`. Persist the SSO `sub` in the User table along with `organization_id`, and gate every API route with auth middleware. Keep secrets in `.env.local` only, referencing them in `.env.example`. Validate payloads with Zod/Yup before touching the database, sanitize HTML rendered in `apps/web`, and restrict organization/status/agency CRUD endpoints to `OrgAdmin`. Super-admin actions require the `x-admin-token` header; never log or leak this value. Passcodes live in `org_invite_codes`, are single use by default, and should be revoked immediately if exposed.

## Passcodes & Org Provisioning
- Only super admins (developers/owners) can create organizations or seed the first `OrgAdmin` via `/admin/organizations` routes guarded by `x-admin-token`.
- Org admins manage invite codes at `/organizations/:orgId/invite-codes` (or via the Settings UI). Codes capture the resulting role; once redeemed, `/users/sso` assigns that role to the new user.
- The `/users/sso` endpoint requires a `passcode` for first-time sign-ins; returning users skip it and their metadata is refreshed via the same route.
- Keep codes short-lived: set `maxUses` cautiously and revoke with `/invite-codes/:code/revoke` after onboarding.
