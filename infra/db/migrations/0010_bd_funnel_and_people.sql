-- Two funnels joined at the company: business development wins the contract,
-- recruiting fills the requisitions it produces.
--
-- The runner has no tracking table and replays every file on every migrate,
-- so every statement here must be a no-op the second time it runs.

drop table if exists candidate_status_history;
drop table if exists candidates;
drop table if exists target_agency;

create table if not exists companies (
  company_id      uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(organization_id),
  name            text not null,
  linkedin_url    text,
  domain          text,
  industry        text,
  headcount       text,
  location        text,
  relationship    text not null default 'prospect'
                  check (relationship in ('prospect','client','former','do_not_contact')),
  contact_email   text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists idx_companies_name
  on companies (organization_id, lower(name));
create unique index if not exists idx_companies_domain
  on companies (organization_id, lower(domain)) where domain is not null;
create unique index if not exists idx_companies_linkedin
  on companies (organization_id, linkedin_url) where linkedin_url is not null;

create table if not exists people (
  person_id          uuid primary key default uuid_generate_v4(),
  organization_id    uuid not null references organizations(organization_id),
  full_name          text not null,
  email              text,
  phone              text,
  linkedin_url       text,
  headline           text,
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

create unique index if not exists idx_people_email
  on people (organization_id, lower(email)) where email is not null;
create unique index if not exists idx_people_linkedin
  on people (organization_id, linkedin_url) where linkedin_url is not null;
create index if not exists idx_people_skills on people using gin (skills);
create index if not exists idx_people_company on people (current_company_id);

create table if not exists bd_opportunities (
  opportunity_id   uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references organizations(organization_id),
  company_id       uuid not null references companies(company_id) on delete cascade,
  name             text not null,
  stage            text not null default 'prospect'
                   check (stage in ('prospect','contacted','meeting',
                                    'proposal','negotiation','signed','lost')),
  fee_percent      numeric,
  est_annual_value numeric,
  expected_close   date,
  owner_id         uuid references users(user_id),
  lost_reason      text,
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_opportunities_company on bd_opportunities (company_id);
create index if not exists idx_opportunities_stage on bd_opportunities (stage);

create table if not exists opportunity_contacts (
  opportunity_id uuid not null references bd_opportunities(opportunity_id) on delete cascade,
  person_id      uuid not null references people(person_id) on delete cascade,
  role           text check (role in ('champion','decision_maker','influencer','blocker','intro')),
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, person_id)
);

create table if not exists pipeline_entries (
  entry_id          uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(organization_id),
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

create unique index if not exists idx_entries_person_job
  on pipeline_entries (person_id, job_id) where job_id is not null;
create index if not exists idx_entries_company on pipeline_entries (company_id);
create index if not exists idx_entries_status on pipeline_entries (current_status_id);
create index if not exists idx_entries_flags on pipeline_entries using gin (flags);

create table if not exists entry_status_history (
  history_id     uuid primary key default uuid_generate_v4(),
  entry_id       uuid not null references pipeline_entries(entry_id) on delete cascade,
  from_status_id uuid references status_config(status_id),
  to_status_id   uuid not null references status_config(status_id),
  change_date    timestamptz not null default now(),
  changed_by     uuid references users(user_id)
);

create index if not exists idx_history_entry on entry_status_history (entry_id);

create table if not exists activities (
  activity_id     uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(organization_id),
  person_id       uuid references people(person_id) on delete cascade,
  company_id      uuid references companies(company_id) on delete cascade,
  opportunity_id  uuid references bd_opportunities(opportunity_id) on delete cascade,
  entry_id        uuid references pipeline_entries(entry_id) on delete cascade,
  channel         text not null
                  check (channel in ('li_message','li_inmail','li_connect',
                                     'email','call','meeting','note')),
  direction       text not null default 'outbound'
                  check (direction in ('outbound','inbound','internal')),
  occurred_at     timestamptz not null default now(),
  subject         text,
  body            text,
  created_by      uuid references users(user_id),
  created_at      timestamptz not null default now(),
  constraint activities_has_subject
    check (person_id is not null or company_id is not null)
);

create index if not exists idx_activities_person on activities (person_id, occurred_at desc);
create index if not exists idx_activities_company on activities (company_id, occurred_at desc);

alter table job_requisitions
  add column if not exists company_id     uuid references companies(company_id),
  add column if not exists opportunity_id uuid references bd_opportunities(opportunity_id);

create index if not exists idx_jobs_company on job_requisitions (company_id);
