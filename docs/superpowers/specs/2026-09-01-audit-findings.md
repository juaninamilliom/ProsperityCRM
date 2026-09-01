# Audit Findings — Prosperity CRM, 1 September 2026

Six architect-led reviewers read the codebase in parallel, one per territory, each
loading its `.claude/agents/*-architect.md` file as operating instructions. Every
finding is anchored on a verbatim quote at a file and line. Seventeen were
re-verified by hand afterwards; one of those by execution rather than reading.

Published report: https://claude.ai/code/artifact/a08ee0d2-fada-42a5-bcc9-fe4cae9b6d88

**Totals:** 48 findings — 4 Critical, 22 High, 20 Medium, 2 Low.

Severity was re-ranked across territories after collection, because each reviewer
sees only its own ground and cannot compare a visual defect against an
authentication bypass.

## Excluded by decision

These were held out of the review so they would not crowd out new findings. Both
remain open and are tracked separately.

- **Organization scoping absent on reads, updates and deletes.** Recorded as an
  accepted scope cut for the current single-organization deployment. Row-level
  security is `USING (true)` and isolates nothing. This must close before a
  second organization is onboarded.
- **Plaintext password storage and comparison.** A documented temporary state for
  local email and password onboarding.

## Verification rules that applied

- Every finding carries a verbatim quote at `file:line`. Unanchored claims were dropped.
- The test suite was not used as evidence for any finding. A suite can confirm a
  false finding as readily as a true one.
- Nothing was built. Building breaks the hot-reloading dev servers.
- The review was read-only. No fix below has been applied.

---

## T — Identity and tenancy

| ID | Sev | Finding | Anchor | Fix |
|---|---|---|---|---|
| T1 | Critical | Magic-link sign-in URL is built from the caller's `Origin` header on an unauthenticated route, so an attacker can have the real sender email a victim a link pointing at attacker infrastructure. | `apps/api/src/modules/auth/magic-link.service.ts:40,:50` | Build from a configured app base URL; accept the header only when it is already in the CORS allowlist. |
| T2 | Critical | A missing `LOCAL_AUTH_SECRET` only warns, and the resulting empty HMAC key still signs and verifies valid tokens. Confirmed by execution against the repo's own `jose`. | `apps/api/src/config.ts:19,:29`; `apps/api/src/modules/auth/token.ts:5` | Throw rather than warn; reject a secret shorter than 32 bytes. |
| T3 | Critical | `POST /users/sso` has no role and no ownership check, letting any signed-in employee rewrite a colleague's email and take the account over via magic link. | `apps/api/src/modules/user/user.routes.ts:66,:74` | Reject when the matched user is not the caller. |
| T4 | High | No rate limiting or security headers anywhere in the API; the root-admin token is compared with plain inequality. | `apps/api/src/middleware/root-admin.ts:22`; `apps/api/src/app.ts:26-32` | Per-IP limiter on `/auth` and `/admin`; constant-time comparison. |
| T5 | Medium | Email is lowercased only on the magic-link path while every lookup is exact, so a mixed-case signup forks into a second account and consumes an invite use. | `magic-link.service.ts:23` vs `user.service.ts:41` | Normalise case in `getUserByEmail` and at every insert site. |
| T6 | Medium | WebAuthn `expectedOrigin` and `rpID` come from the request header; the `RP_ID` override appears in no config or example env file. | `apps/api/src/modules/auth/passkey.service.ts:23,:32` | Make the relying-party id a required config value; derive origin from the allowlist. |
| T7 | Medium | `PUT /organizations/:id` checks the role but never compares the id to the caller's organization; `POST /organizations` is likewise only role-gated. | `apps/api/src/modules/organization/organization.routes.ts:13,:22` | Compare to `req.dbUser.organization_id`; move create behind the root-admin guard. |
| T8 | Medium | The magic link is marked used before the invite code is redeemed, so any redemption failure permanently burns a link the user cannot re-obtain. | `magic-link.service.ts:82` then `:94` | Move the used-marking inside the redemption transaction. |

## S — Database substrate

| ID | Sev | Finding | Anchor | Fix |
|---|---|---|---|---|
| S1 | Critical | `npm run seed` truncates whatever `DATABASE_URL` points at with no environment check, reading the same variable the migration runner reads. | `scripts/run-seed.mjs:12,:22`; `infra/db/seed.sql:3,:53-57` | Refuse unless the host is local or an explicit override is set. |
| S2 | High | Two `date` columns are mirrored as `text`, so the driver's `Date` passes through unconverted and a UTC server renders the previous day. | SQL `0010:71`, `0007:2` vs `apps/api/src/db/schema.ts:104,:136` | Mirror only: use the `date` column type, which converts on read. |
| S3 | High | Three delete routes sit on foreign keys with no delete behaviour; each surfaces as a bare 500, one reproducible straight from the seed data. | `0010:147,:95,:96`; `opportunity.service.ts:223` | Keep the constraints; add the count-then-409 guard the company route uses. |
| S4 | High | The credential guard test splits SQL on the semicolon, so the two-statement form it exists to catch matches nothing; it also never looks for `update users set password` or role statements. | `apps/api/src/db/migrations.test.ts:23,:35` | Scan the whole file as well as per statement; add the update and role patterns. |
| S5 | Medium | The company delete guard counts pipeline entries only, one of the three foreign keys pointing at companies. | `apps/api/src/modules/company/company.routes.ts:67` | Count people and requisitions too; name each in the 409. |
| S6 | Medium | The Drizzle mirror asserts `notNull` and a default on five columns the DDL leaves nullable, so an omitted value stores null and reads as a silent zero. | `schema.ts:152-156,:242` vs `0007:12-16`, `0004:13` | Mirror only: drop the false constraints and let TypeScript surface the nulls. |
| S7 | Medium | Migration `0003` validates a CHECK and a SET NOT NULL before the statements that make the data satisfy them, so it cannot apply to a database that has users. | `infra/db/migrations/0003_add_organizations.sql:14,:16,:18` | Reorder and backfill. Knowingly a no-op on applied databases; needed for restores. |
| S8 | Medium | The only index leading with `person_id` on entries is partial, so the person page and the cascade both scan; three other indexes duplicate a unique constraint. | `0010:104-105`; `person.service.ts:118` | One migration adding the person index and two activity indexes; drop the redundant three. |

## P — CRM funnels

| ID | Sev | Finding | Anchor | Fix |
|---|---|---|---|---|
| P1 | High | A deal can be created already `signed`, skipping the transition that promotes the company and logs the win. The update schema omits stage for exactly this reason; create does not. | `apps/api/src/modules/opportunity/opportunity.schema.ts:9,:16-18` | Omit stage from create, or route a non-default create stage through the transition. |
| P2 | High | Deleting a company cascades its open deals away silently, and fails with a bare 500 when it has contacts or requisitions. | `apps/api/src/modules/company/company.routes.ts:67`; `0010:64,:44,:146` | Extend the guard to all three foreign keys and to open deals. |
| P3 | High | `resolveOrCreateCompanyId` is a read-then-write race against a unique index, and the loser is reported to the caller as a duplicate person. | `apps/api/src/modules/person/person.service.ts:208-210`; `person.routes.ts:47-61` | Insert with conflict-do-nothing and re-select. Same shape in `ensureOrganizationSkills`. |
| P4 | High | A stage PATCH that changes nothing still rewrites `closed_at` to today and blanks `lost_reason`; the deals board fires this on a same-column drop. | `apps/api/src/modules/opportunity/opportunity.service.ts:249-250` | Return the deal untouched when the stage is unchanged. |
| P5 | High | Creating a duplicate entry for the same person and requisition is an unexplained 500 where person and company both return a 409 with the existing row. | `apps/api/src/modules/entry/entry.routes.ts:44`; `0010:104-105` | Wrap in the same duplicate handler the person route uses. |
| P6 | Medium | The LinkedIn normaliser returns null for Sales Navigator and Recruiter URLs, and update writes that null over a good value, erasing the dedupe key. | `apps/api/src/modules/person/linkedin.ts:5,:24` vs `person.service.ts:303` | Reject an unrecognised non-empty URL with a 400 instead of coercing to null. |
| P7 | Medium | `DELETE /jobs/:id` is unguarded, so deleting a requisition with candidates is a 500 from a live admin button. | `apps/api/src/modules/job/job.service.ts:92-93` | Count dependents and return 409. Covered by the same work as S3. |
| P8 | Medium | No funnel list endpoint has a cap; only activities limits its rows, and there is no pagination. | `apps/api/src/modules/entry/entry.service.ts:84-85` | Append a hard limit to each list query. |

## E — Sourcing extension

| ID | Sev | Finding | Anchor | Fix |
|---|---|---|---|---|
| E1 | High | A later profile read replaces the whole profile object, discarding email and phone the recruiter just fetched, because completeness counts neither. | `apps/extension/src/sidepanel/App.tsx:189,:328`; `extraction.ts:55` | Merge fetched contact fields forward rather than replacing. |
| E2 | High | Import reports success when the pipeline entry was never created, because the entry POST is conditional and its rejection is swallowed. | `apps/extension/src/sidepanel/api.ts:320,:331-333`; `App.tsx:367` | Return whether the entry attached; warn when it did not. |
| E3 | High | Closing the contact overlay calls `history.back()` on any overlay path, navigating the tab away and discarding the extracted profile plus recruiter edits. | `apps/extension/src/content/content.ts:71` | Record the URL before the click; only go back if it changed. |
| E4 | High | The manifest version is frozen at 1.0.0 while the package is 0.1.0, and packaging never reconciles them, so builds cannot be published or auto-updated. | `apps/extension/public/manifest.json:4`; `apps/extension/package.json:3`; `scripts/package-extension.mjs` | Write the package version into the built manifest before zipping. |
| E5 | High | The duplicate fallback sends the LinkedIn URL to a substring search and takes the first row unverified, so it can merge into and then overwrite a different candidate. | `apps/extension/src/sidepanel/api.ts:220-222`; `person.service.ts:23-29` | Filter results to an exact normalised URL match. |
| E6 | Medium | A ten-to-fifteen digit run scraped from the About text permanently shadows the authoritative phone number from the contact dialog. | `linkedin-parser.ts:145,:1044-1045`; `App.tsx:322-323` | Track field source; let a dialog value overwrite an About-derived one. |
| E7 | Medium | `decomposeHeadline` returns a school or company name as the job title via its capitalisation fallback, and students have no Experience section to correct it. | `apps/extension/src/content/linkedin-parser.ts:199,:164` | Require a role word in the bare-primary branch. |
| E8 | Low | The legacy avatar lookup searches the whole document, so a right-rail thumbnail can display as the candidate. Display only. | `apps/extension/src/content/linkedin-parser.ts:828` | Scope the fallback to `main`. |

## W — Web data layer

| ID | Sev | Finding | Anchor | Fix |
|---|---|---|---|---|
| W1 | High | Logout never clears the query cache, so the next sign-in on that browser renders the previous user's name, role and pipeline until refetch. | `apps/web/src/App.tsx:68-71`; `main.tsx:9` | Clear the query client in the logout handler. |
| W2 | High | A partial candidate create cannot be retried: the person already exists, so every retry is rejected as a duplicate and the person never reaches the pipeline. | `apps/web/src/pages/CandidateFormPage.tsx:80,:86,:107` | Hold the created person id, or read it from the 409 body, and skip that step on retry. |
| W3 | High | Any failure to load the current user is treated as signed out and deletes a valid token during render, which also breaks extension auto-login. | `apps/web/src/App.tsx:52,:63-66` | Branch on the error state separately; clear only on a successful empty response. |
| W4 | High | The candidate edit save writes two records with no error handler, so a half-applied save is visually identical to no click at all. | `apps/web/src/pages/CandidateEditPage.tsx:112-118` | Add an error handler mirroring the sibling mutation in the same file. |
| W5 | Medium | Neither drag board reports a failed move; the pipeline one also leaves an unhandled promise rejection. | `DashboardPage.tsx:53-56`; `PipelineBoard.tsx:79`; `DealsPage.tsx:78-85` | Add error handlers and catch the awaited mutation. |
| W6 | Medium | Two more silent mutations on pages where every sibling surfaces errors, including a role promotion that appears to succeed when it failed. | `AccountSettingsPage.tsx:53-59`; `CompanyDetailPage.tsx:118-124` | Add error handlers; give the activity composer an error prop. |
| W7 | Medium | Form hydration effects overwrite unsaved edits whenever a focus refetch returns changed data. | `CandidateEditPage.tsx:76-77`; `JobDealPage.tsx:151-154` | Hydrate once per record id, or skip while the form is dirty. |
| W8 | Low | Two invalidation keys match no query and one query key is matched by no invalidation, since a longer key is not a prefix of a shorter one. | `DashboardPage.tsx:55`; `AccountSettingsPage.tsx:57`; `CandidateEditPage.tsx:114` | Delete the dead keys; standardise the org-users key. |

## D — Design system

| ID | Sev | Finding | Anchor | Fix |
|---|---|---|---|---|
| D1 | High | The candidate flag chips use `bg-brand/10` and `text-brand`, a colour declared in neither the Tailwind theme nor the token file, so they render untinted in both themes. | `CandidateFormPage.tsx:463`; `CandidateEditPage.tsx:422` | Use the Chip primitive's accent tone. |
| D2 | High | The passkey banner uses `border-accent/20 bg-accent/5`, verbatim the pattern the config comment forbids, so the border falls back to Tailwind's default grey. | `PasskeyEnrollmentBanner.tsx:62`; `tailwind.config.ts:4-5` | Use the border and soft-accent tokens, or add a dedicated banner token to both blocks. |
| D3 | High | Eleven places use raw palette colours; eight are success messages with no dark variant, rendering dark green on a near-black surface. The token test never scans component source. | 11 sites incl. `AccountSettingsPage.tsx:346`, `JobDealPage.tsx:465`, `CandidateDetailsModal.tsx:36` | Use the success tokens; extend the guard test to component source. |
| D4 | High | Fourteen hand-rolled buttons and twenty inputs reproduce the primitives, and the copies have dropped the disabled styling while still carrying a disabled attribute. | `JobDealPage.tsx:436,:438`; `Button.tsx:32` | Use the exported primitive and field class. |
| D5 | Medium | The type scale is bypassed by arbitrary pixel sizes at roughly thirty-eight sites; the spacing guard matches only spacing prefixes so font sizes are unguarded. | `JobsPage.tsx:96` and ~37 others | Map recurring sizes onto named steps; extend the guard. |
| D6 | Medium | Three declared radii, eight in use across fifty-one arbitrary values, including one inside a primitive. | `Chip.tsx:37`; `AppSidebar.tsx:168` | Collapse onto the three tokens; add a fourth to both blocks if genuinely needed. |
| D7 | Medium | The react-select menu shadow is a hardcoded light-mode rgba in a file whose header states every value is a custom property. | `apps/web/src/components/selectStyles.ts:54`; `tokens.css:25,:85` | Use the panel shadow token. |
| D8 | Medium | The extension imports twenty-nine token names with nothing asserting they still resolve; a rename leaves both suites green and the panel broken. | `apps/extension/src/sidepanel/index.css:4`; `apps/extension/tailwind.config.ts:10` | Treat a token rename as a two-workspace change; add a resolution test. |

---

## Territory ownership

Five of the six territories have an architect in `.claude/agents/`. The web data
layer does not, which is why its reviewer had to be briefed by hand. Every finding
in that territory is a failure that looks identical to success on screen. Creating
`web-architect` is tracked as part of this programme.
