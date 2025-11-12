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
  alter column role type text using role::text,
  add constraint users_role_check check (role in ('OrgAdmin', 'OrgEmployee'));

update users set role = 'OrgEmployee' where role not in ('OrgAdmin', 'OrgEmployee');

alter table users alter column organization_id set not null;

create index if not exists idx_users_org on users(organization_id);
