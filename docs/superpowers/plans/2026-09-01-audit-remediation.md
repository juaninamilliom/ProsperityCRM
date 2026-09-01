# Audit Remediation Implementation Plan

**Goal:** Close the 48 findings in the 1 September 2026 audit, starting with four
Criticals that are live today, without breaking a production deploy.

**Spec:** `docs/superpowers/specs/2026-09-01-audit-findings.md`

**Produced by:** `/harness:plan`. Seven architects planned their own territories in
parallel; `harness:code-architect` synthesized and resolved the conflicts between them.

---

## Global constraints

- **Never push to `main`.** Branch, push, open a PR with `gh pr create`, wait for review.
- **Never run `npm run build` during development.** Type-check instead. The one legitimate
  build is `npm run package:extension`.
- **A schema change is two edits** — the SQL migration and the Drizzle mirror. One
  exception: index migrations, because `apps/api/src/db/schema.ts` declares no indexes at
  all, so no mirror entry exists to update.
- **Migrations run once per database by filename, on every Render deploy from `main`.**
  There are no down migrations. Next free number is `0015`; `0012` is burned forever.
- **Turbo caches test and typecheck**, so a cached pass can be stale. Run the workspace
  directly when the answer matters; CI runs with `TURBO_FORCE=true`.
- **Not closed by this plan, so nobody assumes otherwise:** organization scoping on reads,
  updates and deletes remains an accepted scope cut and must close before a second tenant;
  plaintext password storage remains a documented temporary state.

---

## 1. Unified approach

The 48 findings are not one problem but four, and the plan is shaped around those rather
than around the six audit columns.

**Three of the four Criticals are live remote-exploitable auth defects and the fourth is a
destructive script.** They share almost no code and no prerequisites beyond `config.ts`
being edited twice, so they ship as one small PR in days. That PR is the critical path.

**The repo has no gate.** No CI, guards that scan one narrow thing and report green, and
`run-migrations.mjs` executing on every deploy from `main`. Every remaining fix lands
behind a gate that does not exist yet, so the gate is built first.

**A large block of findings is one defect class repeated: silent failure.** W1-W6 are
silent mutation failures, D1-D3 silent colour failures, S3/S5/P2/P5/P7 unexplained 500s,
E2 a silent import failure. Each cluster has a single structural fix that takes the whole
class to zero in one commit, so those are sequenced as class fixes, not site fixes.

**A smaller block is genuinely per-site judgement** — D5's type scale, D6's radii, E7's
heuristics — and those get their own phases with a human looking at a screen.

Sequence: gates, then criticals, then substrate (mirror and migrations, because everything
downstream reads them), then the delete-guard family, then the extension (which ships
without a deploy and whose fixes gate delivery of each other), then the funnel, then the
web and design-system tracks.

---

## 2. Contributing architects

| Architect | The decisions that shaped this plan |
|---|---|
| `tenancy-architect` | T1 has a second half the audit missed and it is worse: the endpoint returns the raw magic URL when `NODE_ENV !== 'production'`, and `render.yaml` never sets `NODE_ENV`. T2's naive form is an outage because `REQUIRED_VARS` contains `API_PORT`, which Render never sets. T3 has no caller, so the smallest safe fix is deletion. Do not reuse `isAllowedOrigin` for T1 — it falls open where the auth rule must fall closed. |
| `schema-architect` | S2 and S6 are mirror-only and both larger than stated; S2 does not fix its own symptom. S7 must be an in-place edit of an applied migration, gated on a content-hash manifest. `0015` and `0016` must be separate files because file granularity is the only rollback granularity the runner has. Found a fourth delete-guard instance nobody assigned. |
| `pipeline-architect` | P1's stated fix breaks creating a deal at `contacted`. P4 destroys a human-typed field. Entry status changes must be a loud 400, not a silent Zod strip, or the fix introduces the class it removes. `is_terminal` is a defect, but change what the metrics read, never the flag. |
| `extension-architect` | E5 ranks first and is worse than anchored. Do not fix E1 by changing `completeness` — that is the retry loop's stopping rule. Bump `PROTOCOL_VERSION` once for the whole content-script batch. E4 gates delivery of everything else. |
| `design-system-architect` | D1's stated fix is wrong on tone — flags are `warn`, or flags and skills become indistinguishable. D2 is worse than "no background": preflight paints a grey hairline in both themes. Found an eighth D2 site. Exactly one token addition, written into both blocks. Never land a guard with an allowlist. |
| `web-data-layer-architect` | Invert the default: a `MutationCache.onError` makes every mutation loud unless it opts out, dissolving W4/W5/W6 and nine unlisted sites into one commit. W3 collapses four states into one boolean plus a render-phase side effect. Leave `staleTime` alone. W2's naive fix creates a worse bug than it closes. |
| `harness:test-architect` | Nine guards, hours each, structurally covering 20+ findings. The S4 splitter is narrow rather than broken; the corrected scan needs an adversarial corpus, because a guard that only asserts `[]` cannot distinguish clean from broken. The route harness is feasible: `createApp()` is exported and `new Pool()` does not connect. |

---

## 3. Conflicts resolved

**A — the seed guard was claimed twice.** `tenancy-architect` owns it, with their design:
a `seedTargetVerdict(url, allowHost)` returning a verdict object, allowing localhost forms
and otherwise requiring `SEED_ALLOW_HOST` to *equal* the parsed hostname. Naming the host
beats a truthy override that can sit forgotten in a shell profile. `schema-architect`
correctly ranked it above everything else of theirs but produced no design.

**B — guard placement.** One rule: **a guard lands as early as it can be green, and never
lands red on `main`.** Green on arrival → its own commit first. Red at a few sites → the
same commit as its fix. Red at many → the final commit of the phase that drives it to
zero. **No allowlists and no ratchets.** This adopts design-system's position over
test-architect's ratchet, because the entire D column exists precisely because two guards
are green-while-dirty by construction. The case where the ratchet was strongest,
`useMutation` at 15 sites, dissolves: the global error net takes 15 to 0 in one commit.

**C — E5 spans two territories.** Extension half ships first and alone. The API half joins
P6's PR as a separate commit, because P6 already opens the same normalisation module.

**D — the delete guards were duplicated.** `pipeline-architect` authors, `schema-architect`
reviews and supplies the FK inventory. Absorbs the fourth instance schema found. Adds two
indexes schema had deferred, because the guard query that needs them is now specified.

**E — the date fix does not fix the symptom.** The web half is assigned, in the same PR,
and S2 cannot close without it. Added by the synthesizer: the web parse must accept both
wire formats, because the API and web deploy independently and the skew window cuts both
ways.

**F — cross-territory sequencing.** The `Alert` primitive lands first and alone in the
design-system PR, which removes the block rather than arguing about it. E2 must merge
before P6, or P6's new 400 is swallowed by the exact bug E2 fixes.

**G — CI is in scope and lands first.** A migration reaching `main` is already in
production, so a credential guard nothing runs before Render is decoration.

**H — one protocol bump per released build.** All four content-script fixes in one PR, the
bump in its first commit, and no packaging run between them.

---

## 4. Phases

Owners: TEN tenancy · SCH schema · PIP pipeline · EXT extension · DES design-system ·
WEB web data layer · TST test.

### PR 1 — Gates (no behaviour change, all green on arrival)

| # | Commit | Owner | Depends |
|---|---|---|---|
| 1 | `ci: run typecheck, test and lint on every pull request` | TST | — |
| 2 | `chore(extension): add the lint script turbo has been silently skipping` | TST | 1 |
| 3 | `test(db): rewrite the migration credential scan with an adversarial corpus` (S4) | SCH+TST | — |
| 4 | `test(db): pin migration numbering, the burned 0012 and RLS coverage` | SCH | 3 |
| 5 | `test(db): freeze applied migrations by content hash` | SCH | 3 |
| 6 | `test(web): give the spacing and token guards positive controls` | DES+TST | — |
| 7 | `test(web): assert every token the extension consumes resolves in both blocks` (D8) | DES | 6 |
| 8 | `test(api): assert every mounted router requires a bearer token` | TST+TEN | — |

### PR 2 — The four Criticals (the critical path)

**Pre-flight, no code, blocks 12 and 19:** confirm both secrets exist on the Render
service and record their lengths; confirm whether `NODE_ENV` is set; confirm the host
passkeys are enrolled under; run `select lower(email), count(*) from users group by 1
having count(*) > 1;`

| # | Commit | Owner | Depends |
|---|---|---|---|
| 9 | `fix(scripts): refuse to seed a non-local database without an explicit host override` (S1) | TEN | — |
| 10 | `fix(auth): build the magic-link URL from configured origins, not the caller's header` (T1) | TEN | 9 |
| 11 | `fix(user): remove the unreachable SSO signup route that let any user rewrite a colleague's email` (T3) | TEN | 8 |
| 12 | `fix(config): fail fast on a missing auth secret instead of signing with an empty key` (T2) | TEN | 10, 8 |

### PR 3 — Route harness and the findings only a request can prove

| # | Commit | Owner | Depends |
|---|---|---|---|
| 13 | `test(api): mock services at the route seam so the harness can exercise handlers` | TST | 8, 12 |
| 14 | `fix(organization): scope read and update to the caller's organization; drop the duplicate create` (T7) | TEN | 13 |

### PR 4 — Auth hardening

| # | Commit | Owner | Depends |
|---|---|---|---|
| 15 | `feat(api): rate-limit the auth and admin routers per client IP` (T4a) | TEN | 13 |
| 16 | `fix(api): send security headers and compare the root admin token in constant time` (T4b) | TEN | 15 |
| 17 | `fix(auth): redeem the invite before burning the magic link, in one transaction` (T8) | TEN | 10 |
| 18 | `fix(user): match email case-insensitively so a mixed-case signup is one account` (T5) | TEN | 11, pre-flight |
| 19 | `fix(auth): make the WebAuthn relying-party id configuration, not a request header` (T6) | TEN | 10, pre-flight |

### PR 5 — The Drizzle mirror and the date contract

| # | Commit | Owner | Depends |
|---|---|---|---|
| 20 | `fix(db): type expected_close and close_date as date in the Drizzle mirror` (S2 API half) | SCH | — |
| 21 | `fix(web): render date-only values as local dates, not UTC midnight` (S2 web half) | WEB | 20 |
| 22 | `fix(db): drop the mirror's invented not-null and default on five nullable columns` (S6) | SCH | — |
| 23 | `fix(db): mirror the two cascade deletes the DDL declares` | SCH | — |

### PR 6 — Migration hygiene

| # | Commit | Owner | Depends |
|---|---|---|---|
| 24 | `fix(db): reorder 0003 so it can apply to a database that already has users` (S7) | SCH | 5 |
| 25 | `feat(db): index the foreign keys the delete paths traverse` (S8a) | SCH | 4, 5, 24 |
| 26 | `feat(db): drop three indexes that duplicate a unique constraint` (S8b) | SCH | 25 |

### PR 7 — Delete guards and the Postgres error taxonomy

| # | Commit | Owner | Depends |
|---|---|---|---|
| 27 | `feat(api): map Postgres constraint violations onto explained 409s` | PIP+TST | 13 |
| 28 | `fix(api): count all four company dependents before deleting` (S5 + P2) | PIP | 25, 27 |
| 29 | `fix(api): the job, status and user deletes explain themselves instead of a 500` (S3 + P7) | PIP | 25, 27 |
| 30 | `fix(api): a duplicate entry returns 409 with the existing row` (P5) | PIP | 27 |

### PR 8 — Extension: delivery and panel safety (no protocol bump)

| # | Commit | Owner | Depends |
|---|---|---|---|
| 31 | `fix(extension): stamp the package version into the built manifest` (E4) | EXT | 1 |
| 32 | `fix(extension): match a duplicate only on an exact LinkedIn URL` (E5 panel half) | EXT | 31 |
| 33 | `fix(extension): carry fetched contact details across profile re-reads` (E1) | EXT | 32 |
| 34 | `fix(extension): report what the import actually wrote` (E2) | EXT | 30, 33 |

### PR 9 — Extension: the content-script batch (one released build)

**Do not run `npm run package:extension` between 35 and 38.**

| # | Commit | Owner | Depends |
|---|---|---|---|
| 35 | `fix(extension): let the contact overlay outrank a phone scraped from About` (E6) — **carries the 3 → 4 bump** | EXT | 34 |
| 36 | `fix(extension): only undo the URL when opening the contact overlay changed it` (E3) | EXT | 35 |
| 37 | `fix(extension): never take a school name as the job title` (E7) | EXT | 35 |
| 38 | `fix(extension): scope the legacy avatar fallback to main` (E8) | EXT | 35 |

### PR 10 — Funnel correctness

| # | Commit | Owner | Depends |
|---|---|---|---|
| 39 | `fix(api): a no-op stage move must not rewrite closed_at or blank lost_reason` (P4) | PIP | — |
| 40 | `fix(web): the deals board ignores a drop on the source column` | WEB | 39 |
| 41 | `fix(api): an opportunity cannot be created already closed` (P1) | PIP | 39 |
| 42 | `fix(api): entry status changes go through move_status only` | PIP | — |
| 43 | `fix(web): the candidate edit page routes a status change to move_status` | WEB | 42 |
| 44 | `fix(api): creating an entry writes its opening history row` | PIP | 42 |

Phases 42 and 43 are **one PR, mandatory**. Shipping 42 alone turns the edit form's status
change into a silent 200 no-op, which is strictly worse than today.

### PR 11 — History backfill (own deploy)

| # | Commit | Owner | Depends |
|---|---|---|---|
| 45 | `fix(db): backfill the opening history row for existing entries` | SCH (PIP designs) | 26, 44 |

### PR 12 — Placement metrics (own deploy)

| # | Commit | Owner | Depends |
|---|---|---|---|
| 46 | `fix(api): placement metrics count placements, not rejections` | PIP | 45 |

Separate deploys from PR 11 because the two move the same number in opposite directions.

### PR 13 — Person resolution and LinkedIn identity

| # | Commit | Owner | Depends |
|---|---|---|---|
| 47 | `fix(api): resolve-or-create is a single upsert, not a read then a write` (P3) | PIP | — |
| 48 | `fix(api): an unrecognised LinkedIn URL is rejected, not silently discarded` (P6) | PIP (EXT signs off) | 34 |
| 49 | `fix(api): match a duplicate person on an exact LinkedIn URL` (E5 API half) | PIP (EXT reviews) | 48 |

### PR 14 — Caps

| # | Commit | Owner | Depends |
|---|---|---|---|
| 50 | `fix(api): cap every funnel list query` (P8) | PIP | 47 |

Opens a tracked pagination follow-up. The caps bound memory and serialisation, not the
scan — no list query has an ordering an index can serve.

### PR 15 — Design system: the Alert primitive and silent colour failures

| # | Commit | Owner | Depends |
|---|---|---|---|
| 51 | `feat(web): add an Alert primitive with role="alert"` | DES (WEB reviews) | 7 |
| 52 | `fix(web): remove opacity modifiers from var() colours` (D1, D2) | DES | 7 |
| 53 | `fix(web): replace raw palette colours with status tokens` (D3, D7) | DES | 51, 52 |

### PR 16 — Web data layer foundation

| # | Commit | Owner | Depends |
|---|---|---|---|
| 54 | `feat(web): create the web-architect agent` — **needs explicit user approval**, edits `.claude/` and CLAUDE.md | WEB | — |
| 55 | `refactor(web): route every query key through a factory` | WEB | — |
| 56 | `feat(web): report every mutation failure by default` | WEB | 51, 55 |

### PR 17 — Web session and cache

| # | Commit | Owner | Depends |
|---|---|---|---|
| 57 | `fix(web): keep the token and the cache honest across sign-out and API failure` (W1 + W3) | WEB | 56 |

### PR 18 — Web write paths

| # | Commit | Owner | Depends |
|---|---|---|---|
| 58 | `fix(web): repair the invalidation keys that match no query` (W8) | WEB | 55 |
| 59 | `fix(web): hydrate the candidate and job forms once per record` (W7) | WEB | 57 |
| 60 | `fix(web): make the candidate write paths recoverable` (W2 + W4) | WEB | 49, 59 |
| 61 | `fix(web): report a failed drag and the remaining silent mutations` (W5 + W6) | WEB | 56 |

### PR 19 — Design system: primitives

| # | Commit | Owner | Depends |
|---|---|---|---|
| 62 | `fix(web): restore disabled styling on hand-rolled submit buttons` (D4a) | DES | 53 |
| 63 | `refactor(web): route remaining buttons through the Button primitive` (D4b) | DES | 62 |
| 64 | `refactor(web): use the exported fieldClass instead of copied field strings` (D4c) | DES | 63 |
| 65 | `refactor(web): route hand-rolled avatars through the Avatar primitive` (D5a) | DES | 64 |

Full `<Field>` adoption is explicitly **not** in this plan — it is a DOM and
label-association change, tracked separately as react work.

### PR 20 — Design system: type scale and radii

| # | Commit | Owner | Depends |
|---|---|---|---|
| 66 | `feat(web): add the 17px and 21px steps to the type scale` | DES | 65 |
| 67 | `refactor(web): move arbitrary font sizes onto named steps` (D5) | DES | 66 |
| 68 | `refactor(web): collapse exact-match and dead radius classes` (D6a) | DES | 67 |
| 69 | `feat(web): declare the 8px tile radius token` (D6b) — both theme blocks | DES | 7, 68 |
| 70 | `refactor(web): move remaining arbitrary radii onto tokens` (D6) | DES | 69 |
| 71 | `fix(extension): confirm the panel renders unchanged after the token addition` | EXT | 69, 70 |

### PR 21 — Documentation and retired warnings

| # | Commit | Owner | Depends |
|---|---|---|---|
| 72 | `docs(extension): correct the retry cadence, session pickup and the relay comment` | EXT | 38 |
| 73 | `chore(extension): drop the unused cookies permission` — a permissions change, deferrable at zero cost | EXT | 72 |
| 74 | `chore(web): lint the rules of hooks` | WEB | 61 |
| 75 | `docs: retire the warnings this programme closed` | all | 74 |

---

## 5. Cross-domain dependencies

| Dependency | Consequence of getting it wrong |
|---|---|
| 5 → 24 | The edit to an applied migration becomes an invisible diff instead of a deliberate act |
| 3,4 → 25,26,45 | New migrations land unscanned by the guard whose purpose is the production deploy path |
| 7 → 69 | A token rename leaves both suites green and the side panel rendering unresolved `var()` |
| 8 → 12 | Every harness test fails at import; phase 12 must add a vitest setup presetting the secrets |
| 10 → 12 | Merge conflict in `config.ts`, and T2's deploy risk blocks the most exploitable finding |
| 10 → 17, 10 → 19 | Conflict in `magic-link.service.ts`; T6 consumes T1's `resolveTrustedOrigin` |
| 11 → 18 | T5 would normalise a path about to be deleted |
| 13 → 14 | T7's missing-check fix has no proof; a unit test passes forever after the call site is deleted |
| 20 → 21 | Deploy skew shows wrong dates; the web parse must accept both formats |
| 25 → 28,29 | The status and job guards run FK-shaped counts against unindexed columns |
| 27 → 28,29,30 | Each guard hand-rolls its own error mapping |
| 30 → 34 | E2 reports "could not attach" for entries that already exist |
| 34 → 48 | P6's new 400 is swallowed by the exact bug E2 fixes |
| 35 → 36,37,38 | Any already-open LinkedIn tab keeps running the old parser |
| 44 → 45 → 46 | The last two move the same number in opposite directions, unattributable |
| 48 → 49 | Exact matching against a canonical form nothing yet guarantees is canonical |
| 49 → 60 | After exact matching, `existing` is null more often, so W2's null branch is load-bearing |
| 51 → 56 | The web territory builds a duplicate of a `components/ui/` primitive it does not own |
| 55 → 56,58 | A mechanical rename mixed into a behaviour change, unreviewable |
| 57 → 59 → 60 | W4's error path needs the hydrate-once ref W7 introduces |
| 66 → 67, 69 → 70 | The class exists in source and resolves to nothing |

---

## 6. Risks

| Risk | Phase | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **The config throw kills the API on deploy.** Config imports at module scope, so the throw precedes `app.listen`; `/health` never answers and Render marks the deploy failed. Migrations have already applied against a service that then refuses to boot | 12 | Low | Critical | Pre-flight dashboard check is a hard gate. Fatal set is exactly the two secrets, **never** `REQUIRED_VARS`, which contains `API_PORT` that Render never sets. Throw on missing, warn on too-short |
| **Token rotation invalidates every session at once**, including the extension's stored token | 12 | Certain if the secret changes | High | Read the value at pre-flight; supply it only where absent. Announce, do not discover |
| **Migration locks queue behind a long read** during the build window while the previous instance serves. Duration is not the risk; queueing is | 25, 26 | Low | High | `set local lock_timeout = '3s'`. No `CONCURRENTLY` — it cannot run in a transaction block. A failed migration is a failed deploy, not an outage |
| **The passkey relying-party id moves and every credential dies silently** | 19 | Medium | High | Confirm the enrolled host at pre-flight; ship alone, revert alone |
| **`npm run seed` truncates production** | until 9 | Medium | Critical | Phase 9 is the first fix after the gates. Until then, treat the command as production-destructive |
| **A company delete silently destroys open deals** behind a 204 | until 28 | Medium | High | Phase 28 guards all four dependents. A 500 is an annoyance; a vanished deal is unrecoverable |
| **The date change hits a deploy skew window** — API on Render, web on Vercel, independent | 20, 21 | High | Medium | The web parse accepts both forms, so either order is safe. Same PR |
| **The backfill writes history that did not happen**, dated at the entry's creation | 45 | Certain | Medium | `changed_by IS NULL` marks reconstructed rows; the migration comment must say so. The user's call, not a silent decision |
| **Phase 42 without 43 silently breaks a working screen** | 42, 43 | Low | High | Explicit 400 naming the correct route, both commits in one PR. Non-negotiable |
| **W2's ref attaches a candidate to the previous person** | 60 | Medium | High | Clear on success and on any identity-field change, with a test that submits twice |
| **The global error net double-reports** | 56 | Certain if missed | Medium | The opt-out on all 13 existing handlers in the same commit |
| **E4 strands installed copies** — Chrome only auto-updates upward | 31 | Unknown from repo | High | Version strictly greater than 1.0.0, plus a format assertion in packaging |
| **The content-script batch splits across two builds** | PR 9 | Low | Medium | One PR, bump first, no packaging run between 35 and 38 |
| **E7 narrows extraction with no fixture proving the live population** | 37 | Medium | Low | Bounded to the case where the role source was already a placeholder. Revert alone |
| **~80 sites of visual change with no visual-regression test** | 67-70 | High | Medium | Byte-identical changes in their own commits so a bisect separates them. One manual pass per role group. Never one regex over 45 sites |
| **T1 changes production email content** where `CORS_ORIGINS` is unset | 10 | Medium | High | Setting it is already a documented post-deploy step; this makes it load-bearing for sign-in |
| **Phases 15 and 16 both touch `app.ts`** | 15, 16 | Low | Critical | Review both diffs on mount order alone first. Phase 8's test is the automated backstop |
| **Nothing here onboards a second organization** | — | Certain when it happens | Critical | Remains open. Every funnel rule in this plan is service-enforced and therefore bypassable by a future write path that skips the route |

---

## 7. The critical path

The four Criticals share no code beyond `config.ts` being edited twice, and depend on
nothing else. **The shortest sequence that closes all four is PR 2 alone: four commits.**

1. **Phase 9 — S1.** No deploy, no prerequisites, no risk. Removes the ability to empty
   production by accident.
2. **Phase 10 — T1.** Includes inverting the dev-URL leak in the same commit; without
   that, the fix leaves the worse half of T1 open.
3. **Phase 11 — T3.** Deletion, not a guard.
4. **Phase 12 — T2.** Last, because it is the only commit that can fail a deploy.

**Carry with it:** phase 1 (CI, ~30 minutes — this is the PR you least want ungated) and
phase 8 (the mount-order test, green today, and what proves T3's deletion did not disturb
the router chain). **Do not carry** phase 13's service mocks; that is a day of work and is
not on this path.

Shipping only this leaves 22 High findings open. The three that most deserve to be next
are **P2's silent cascade**, **S2 in both halves**, and **W3**, where a cold Render dyno
deletes a valid token and kills extension auto-login.
