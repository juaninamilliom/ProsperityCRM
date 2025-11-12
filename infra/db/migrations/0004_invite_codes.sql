create table if not exists org_invite_codes (
  code_id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(organization_id) on delete cascade,
  code text not null unique,
  role text not null check (role in ('OrgAdmin','OrgEmployee')),
  max_uses integer not null default 1,
  used_count integer not null default 0,
  status text not null default 'active' check (status in ('active','used','revoked')),
  created_by uuid references users(user_id),
  created_at timestamptz not null default now(),
  revoked_by uuid references users(user_id),
  revoked_at timestamptz,
  metadata jsonb default '{}'::jsonb
);

create index if not exists idx_invite_codes_org on org_invite_codes(organization_id);
create index if not exists idx_invite_codes_code on org_invite_codes(code);
