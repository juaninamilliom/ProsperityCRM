create table if not exists organizations (
  organization_id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

alter table users drop constraint if exists users_role_check;

alter table users
  add column if not exists organization_id uuid references organizations(organization_id),
  alter column role set default 'OrgEmployee',
  alter column role type text using role::text;

-- Satisfy the CHECK before adding it. 0001 seeded 'Recruiter' and 'Admin', and
-- ADD CONSTRAINT validates against every existing row, so adding it first
-- aborts the whole file on any database that has users.
update users
  set role = 'OrgEmployee'
  where role is null or role not in ('OrgAdmin', 'OrgEmployee');

alter table users
  add constraint users_role_check check (role in ('OrgAdmin', 'OrgEmployee'));

-- Satisfy the NOT NULL before setting it. The column was added nullable four
-- statements ago, so every pre-existing user holds null and nothing has
-- created an organization to point them at.
--
-- Both statements write nothing when users is empty, which is the only shape
-- of database this file can still run on: every database that has recorded
-- 0003_add_organizations.sql in schema_migrations skips it entirely.
insert into organizations (name, slug)
  select 'Default Organization', 'default'
  where exists (select 1 from users where organization_id is null)
  on conflict (slug) do nothing;

update users
  set organization_id = (
    select organization_id from organizations order by created_at, organization_id limit 1
  )
  where organization_id is null;

alter table users alter column organization_id set not null;

create index if not exists idx_users_org on users(organization_id);
