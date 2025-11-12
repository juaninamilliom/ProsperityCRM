# Testing Strategy

- **API unit tests** live alongside source files in `apps/api/src/**.test.ts` and run with Vitest via `npm run test -- --filter api`.
- **Integration tests** should live under `tests/api/` and can target a Supabase/Neon branch database using the seed data stored in `tests/fixtures/`.
- **E2E tests** belong in `tests/e2e/` (Playwright recommended) and should run against the deployed preview environment before merging to `main`.
- Aim for ≥80% line/branch coverage; update pipelines to fail if coverage drops.
