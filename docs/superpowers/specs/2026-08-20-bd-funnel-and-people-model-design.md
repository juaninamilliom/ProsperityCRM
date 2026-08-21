# BD Funnel and Shared People Model — Design

**Date:** 2026-08-20
**Status:** Approved for planning
**Project:** P1 of a four-part expansion. P2 and P3 are scoped at the end.

## Goal

Expand Prosperity CRM from a recruiting-only pipeline into a two-funnel
system: a business-development funnel that wins recruiting contracts from
companies, feeding the recruiting funnel that already exists.

## The hole this fills

The app models candidates moving toward placement. It does not model
winning the client whose openings those candidates fill. The loop the
user actually works is:

```
company prospect -> outreach -> contract signed
                                      |
                            client issues job orders
                                      |
                      candidates sourced against those orders
                                      |
                            placement -> commission
```

Everything below "client issues job orders" exists. Everything above it
does not. The two halves meet at exactly one object — the company — which
today is `target_agency`: two columns, `name` and `contact_email`, used as
a dropdown.

Three concrete defects follow from that:

1. **`job_requisitions` has no company.** A requisition — carrying
   `deal_amount`, `stage` and `close_date` — does not record its client.
   `owner_name` is free text.
2. **`candidates` conflates the person with the pitch.** One row holds
   both, so a single `job_requisition_id` means a person can only ever be
   out for one role.
3. **`candidates.email` is `not null unique`.** LinkedIn does not expose
   email, so no capture flow can write to this table without fabricating
   addresses and poisoning the index.

## Decisions

Settled during brainstorming. Recorded with rationale so they are not
silently relitigated during implementation.

| Decision | Choice | Why |
|---|---|---|
| People model | **One `people` table** | A candidate placed two years ago turning up as a hiring manager at a prospect is the recruiting flywheel. Two tables make that person a duplicate with nothing linking the halves. |
| BD engagement unit | **The company** | You win one contract with a company; the several people you work there are contacts on that one deal. |
| Recruiting engagement unit | **The person x the req** | The same candidate goes out for several roles, each tracked separately. This is the `pipeline_entries` table. |
| Activity log | **Shared spine, not a BD feature** | Outreach happens on both sides. A touch log that works for only one is half a feature. |
| BD stages | **Fixed, not configurable** | `status_config` already exists for candidates; a second config surface is not worth it for one user. Migrate over time if needed. |
| Dedupe key | **`linkedin_url`, not email** | The one identifier LinkedIn reliably gives, stable across job changes. Email becomes nullable. |
| Migration shape | **Full re-model in one project** | No dual-write, no interim duplication. Affordable because there are 5 candidates, 2 agencies, 2 reqs and 1 user in the database. |
| `organization_id` on new tables | **Omitted** | Only `users`, `organizations`, `org_invite_codes` and `organization_skills` carry it. `candidates`, `target_agency`, `job_requisitions` and `status_config` do not. Adding it to six new tables would be building more multi-tenancy, which is explicitly out of scope. See Known Issues. |

## Data model

Creation order matters — each table references the ones above it.

### companies

Replaces `target_agency`. A prospect and a client are the same row at
different `relationship` values.

```sql
create table companies (
  company_id      uuid primary key default uuid_generate_v4(),
  name            text not null,
  linkedin_url    text,
  domain          text,
  industry        text,
  headcount       text,          -- LinkedIn reports ranges: "51-200 employees"
  location        text,
  relationship    text not null default 'prospect'
                  check (relationship in ('prospect','client','former','do_not_contact')),
  contact_email   text,          -- carried over from target_agency
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index idx_companies_name     on companies (lower(name));
create unique index idx_companies_domain   on companies (lower(domain))  where domain is not null;
create unique index idx_companies_linkedin on companies (linkedin_url)   where linkedin_url is not null;
```

`relationship` is stored, not derived from opportunities. A client
inherited without a BD deal, or a company marked do-not-contact, must be
representable without inventing a fake won opportunity.

### people

One table for candidates and BD contacts alike.

```sql
create table people (
  person_id          uuid primary key default uuid_generate_v4(),
  full_name          text not null,
  email              text,
  phone              text,
  linkedin_url       text,
  headline           text,        -- "Senior Talent Partner @ Acme | We're hiring"
  location           text,
  current_company_id uuid references companies(company_id),
  current_title      text,
  skills             jsonb not null default '[]'::jsonb,
  notes              text,
  source             text not null default 'manual'
                     check (source in ('manual','linkedin_capture','import')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index idx_people_email    on people (lower(email))  where email is not null;
create unique index idx_people_linkedin on people (linkedin_url)  where linkedin_url is not null;
create index        idx_people_skills   on people using gin (skills);
create index        idx_people_company  on people (current_company_id);
```

`email` is nullable with a partial unique index. This is what unblocks
capture in P2 with no placeholder-address hack.

`skills` lives on the person. `flags` does not — see `pipeline_entries`.

### bd_opportunities

```sql
create table bd_opportunities (
  opportunity_id   uuid primary key default uuid_generate_v4(),
  company_id       uuid not null references companies(company_id) on delete cascade,
  name             text not null,          -- "Acme - Engineering retainer"
  stage            text not null default 'prospect'
                   check (stage in ('prospect','contacted','meeting',
                                    'proposal','negotiation','signed','lost')),
  fee_percent      numeric,                -- agency fee as % of first-year salary
  est_annual_value numeric,
  expected_close   date,
  owner_id         uuid references users(user_id),
  lost_reason      text,
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_opportunities_company on bd_opportunities (company_id);
create index idx_opportunities_stage   on bd_opportunities (stage);
```

Seven fixed stages. `signed` and `lost` are terminal and set `closed_at`.

### opportunity_contacts

Many people per deal — the asymmetry that distinguishes BD from
recruiting.

```sql
create table opportunity_contacts (
  opportunity_id uuid not null references bd_opportunities(opportunity_id) on delete cascade,
  person_id      uuid not null references people(person_id) on delete cascade,
  role           text check (role in ('champion','decision_maker','influencer','blocker','intro')),
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, person_id)
);
```

### pipeline_entries

Replaces `candidates` as the pipeline row. One row per person per pitch.

```sql
create table pipeline_entries (
  entry_id          uuid primary key default uuid_generate_v4(),
  person_id         uuid not null references people(person_id) on delete cascade,
  company_id        uuid not null references companies(company_id),
  job_id            uuid references job_requisitions(job_id),
  current_status_id uuid not null references status_config(status_id),
  recruiter_id      uuid not null references users(user_id),
  flags             jsonb not null default '[]'::jsonb,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index idx_entries_person_job on pipeline_entries (person_id, job_id)
  where job_id is not null;
create index idx_entries_company on pipeline_entries (company_id);
create index idx_entries_status  on pipeline_entries (current_status_id);
create index idx_entries_flags   on pipeline_entries using gin (flags);
```

`job_id` is nullable, preserving today's behaviour where a candidate can
be aimed at a company with no specific requisition. `company_id` is
required and is the destination, not the person's current employer.

`flags` sits here rather than on `people` because a flag describes this
pitch ("no-showed", "counter-offered"), not the human. Today's candidate
rows map one-to-one onto pipeline_entries, so this preserves existing
semantics exactly.

### activities

The shared spine. Every touch on either funnel.

```sql
create table activities (
  activity_id    uuid primary key default uuid_generate_v4(),
  person_id      uuid references people(person_id) on delete cascade,
  company_id     uuid references companies(company_id) on delete cascade,
  opportunity_id uuid references bd_opportunities(opportunity_id) on delete cascade,
  entry_id  uuid references pipeline_entries(entry_id) on delete cascade,
  channel        text not null
                 check (channel in ('li_message','li_inmail','li_connect',
                                    'email','call','meeting','note')),
  direction      text not null default 'outbound'
                 check (direction in ('outbound','inbound','internal')),
  occurred_at    timestamptz not null default now(),
  subject        text,
  body           text,
  created_by     uuid references users(user_id),
  created_at     timestamptz not null default now(),
  constraint activities_has_subject
    check (person_id is not null or company_id is not null)
);

create index idx_activities_person  on activities (person_id, occurred_at desc);
create index idx_activities_company on activities (company_id, occurred_at desc);
```

An activity must attach to a person or a company. The optional
`opportunity_id` and `entry_id` record which engagement the touch
belonged to, so a person page can show one unified timeline while a deal
page shows only its own.

### job_requisitions (altered)

```sql
alter table job_requisitions
  add column company_id     uuid references companies(company_id),
  add column opportunity_id uuid references bd_opportunities(opportunity_id);

create index idx_jobs_company on job_requisitions (company_id);
```

`opportunity_id` records which won deal produced this requisition —
attribution from BD effort through to placement revenue.

### Renamed

```sql
alter table candidate_status_history rename to entry_status_history;
alter table entry_status_history rename column candidate_id to entry_id;
```

## Migration

**The database holds only dummy data and can be flushed.** That removes
the data transform entirely — no email join, no primary-key reuse, no
backfill. `0010` drops the old tables and creates the new ones.

Single migration, `infra/db/migrations/0010_bd_funnel_and_people.sql`:

1. `drop table candidate_status_history, candidates, target_agency;` in
   that order — `candidate_status_history.candidate_id` references
   `candidates` with `on delete cascade`, so it goes first.
2. Create `companies`, `people`, `bd_opportunities`,
   `opportunity_contacts`, `pipeline_entries`, `entry_status_history`,
   `activities`, in that order — each references the ones above it.
3. Alter `job_requisitions` to add `company_id` and `opportunity_id`.

Written as a forward migration rather than a rewritten `0001`, so a clean
checkout still reproduces the schema by replaying the sequence.

### Seeding

Flushing creates a requirement that did not exist before: **there is no
seed script in this repo.** `infra/db/seeds/` does not exist, and the
five candidates in the local database were entered by hand. Flushing
without a seed means hand-entering data after every reset, across five
new screens.

P1 adds `infra/db/seed.sql`: an organisation, a user, the status ladder,
companies spanning every `relationship` value, people, open and won
opportunities with contacts attached, requisitions, pipeline entries, and
a scatter of activities across several dates. Enough to develop and
screenshot all five BD screens without touching a form.

## API

### Compatibility shim

`candidateSelect` in `apps/api/src/modules/candidate/candidate.service.ts`
is the single read path for every candidate query. It is rewritten to
join the new tables and alias columns back to their existing names:

```sql
select s.entry_id     as candidate_id,
       p.full_name         as name,
       p.email, p.phone, p.skills,
       s.company_id        as target_agency_id,
       s.job_id            as job_requisition_id,
       s.current_status_id, s.recruiter_id, s.flags, s.notes, s.created_at,
       st.name as status_name, st.order_index,
       co.name as agency_name,
       j.title as job_title, j.status as job_status
  from pipeline_entries s
  join people      p  on p.person_id = s.person_id
  join status_config st on st.status_id = s.current_status_id
  join companies   co on co.company_id = s.company_id
  left join job_requisitions j on j.job_id = s.job_id
```

The DTO is unchanged, so the entire web app keeps working on day one with
no edits. The same treatment applies to the `agency` module, which reads
`companies` while returning `agency_id` / `name` / `contact_email`.

**This shim is scheduled debt, not architecture.** It exists so the
migration and the UI can land in separate reviewable steps. It is removed
in P2 when the pipeline UI is rewritten to speak pipeline_entries directly. It
must not acquire new callers.

### New modules

Following the existing `modules/<name>/{routes,service,schema}.ts` layout.

| Module | Endpoints |
|---|---|
| `company` | `GET /companies`, `GET /companies/:id` (with contacts, opportunities, reqs, activity), `POST`, `PATCH`, `DELETE` |
| `person` | `GET /people` (search by name / email / linkedin_url), `GET /people/:id` (with pipeline_entries, opportunity roles, activity), `POST`, `PATCH` |
| `opportunity` | `GET /opportunities`, `GET /opportunities/:id`, `POST`, `PATCH`, `PATCH /:id/stage`, `POST /:id/contacts`, `DELETE /:id/contacts/:personId` |
| `activity` | `GET /activities?person_id=&company_id=`, `POST /activities` |

`job` gains `company_id` and `opportunity_id` on create and update.

`agency` is retired once the web app stops calling it.

## Web

### Navigation

The flat sidebar becomes grouped:

```
RECRUITING     Pipeline    /             pipeline_entries board (unchanged in P1)
               Jobs        /jobs         reqs and deal sheets

BUSINESS DEV   Deals       /deals        opportunity board
               Companies   /companies    accounts list -> /companies/:id

               People      /people       directory -> /people/:id
               Settings, User guide
```

### Screens

| Screen | Route | Notes |
|---|---|---|
| Deals board | `/deals` | Kanban of opportunities by stage. Generalises `PipelineBoard` rather than duplicating it. |
| Company detail | `/companies/:id` | Header with relationship, then contacts, open opportunities, requisitions, activity timeline. |
| Companies list | `/companies` | Replaces `AdminAgenciesPage`. Filter by relationship. |
| Person detail | `/people/:id` | Identity, current role, every pipeline entry, every deal they are a contact on, one unified timeline. The flywheel payoff. |
| Activity composer | shared component | Log a touch: channel, direction, date, note. Appears on person, company and opportunity pages. |

`PipelineBoard`, `StageDot`, `Chip`, `Card`, `Button`, `Field` and the
token system are reused. No new visual vocabulary.

### The join moment

Moving an opportunity to `signed` sets `closed_at`, flips the company's
`relationship` to `client`, and offers to create the first requisition
under it. This is a visible event in the UI, not a silent field update —
it is where BD work becomes recruiting work.

## Testing

Existing harness: vitest, @testing-library/react, jsdom. 95 tests
currently pass. Established pattern is extracting pure functions and
testing them directly (`pipelineSummary.ts`, `activeFilterCount.ts`).

**Pure functions to write and test:**

- `normalizeLinkedInUrl(raw)` — the dedupe primitive. LinkedIn serves
  `/in/jane-doe-8a72b1/`, `?originalSubdomain=uk`, `?miniProfileUrn=...`,
  `www.` and `m.` hosts, and trailing slashes, all for one person.
  Written in P1 because `people` stores the URL from day one; relied on
  heavily by P2's capture.
- `opportunityStage` rules — legal transitions, which stages are
  terminal, and the side effects of reaching `signed` or `lost`.
- `feeValue(salary, feePercent)` — Postgres `numeric` arrives over the
  wire as a string. Same trap `formatMoney` already handles; reuse it.
- `activitySubject(activity)` — resolving which entity a touch belongs to
  for timeline display.

**Migration and seed tests:**

- The migration applies cleanly against an empty database and against one
  already at `0009`.
- The seed script runs to completion and leaves at least one row in every
  new table, so no BD screen renders empty during development.
- No orphaned foreign keys after seeding.

## Failure modes

| Condition | Behaviour |
|---|---|
| Duplicate `linkedin_url` on create | 409 with the existing `person_id`, surfaced as "you already have this person — open them?" Never a 500. This is the exact affordance P2's capture inbox needs. |
| Duplicate `email` on create | Same. |
| Duplicate company name or domain | Same, returning the existing `company_id`. |
| Activity with neither person nor company | 400 from schema validation, before the check constraint fires. |
| Deleting a company with pipeline_entries | Blocked — `pipeline_entries.company_id` has no cascade. Explain rather than cascade-delete pipeline history. |
| Deleting a person | Cascades to their pipeline_entries, opportunity roles and activities. Deliberate: a person removed should not leave dangling pitches. |

## Out of scope

Deferred with intent, not forgotten:

- **Follow-up reminders and gone-cold views.** Need the activity log to
  have real data first. Building the nag box before the data exists
  produces a nag box that is wrong.
- **Enrichment** (resolving a profile to a work email). Paid dependency,
  own accuracy problems.
- **Multi-tenancy.** See Known Issues.
- **Configurable BD stages.**
- **Retiring the compatibility shim.** P2.

## Known issues surfaced during design

Recorded here because they were found while reading the schema, not
because this project fixes them.

1. **Multi-tenancy is decorative below the auth layer.** `organization_id`
   exists on `users`, `organizations`, `org_invite_codes` and
   `organization_skills` only. No business table carries it and no query
   filters by it, so any user of any organisation reads all candidates,
   agencies and requisitions. Harmless for a single user; a data breach
   the moment a second organisation exists. New tables in this project
   match the existing business tables and omit the column.
2. **Passwords are stored and compared in plaintext**
   (`auth.routes.ts:51`). Out of scope here; belongs to the deferred
   architecture review.

## Follow-on projects

- **P2 — Capture inbox.** A `captures` staging table (raw payload,
  `source_url`, kind, intent, status, duplicate hints), a review screen,
  and promotion into `people` / `companies`. Ships with a paste-a-URL
  path so the whole ingestion pipeline is testable with no browser
  involved. Also retires the compatibility shim.
- **P3 — Browser extension.** One page, one click, no crawling. Content
  script reads the DOM already on screen and posts to the capture
  endpoint. Carries a second brief worth as much as the first: logging a
  LinkedIn message as an activity at the moment it is sent. Activity logs
  die when logging means retyping, and every gone-cold view built on top
  inherits that lie.
- **P4 — Reminders and cold-lead surfacing**, once the activity log holds
  real data.
