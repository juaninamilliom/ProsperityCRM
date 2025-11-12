create extension if not exists "uuid-ossp";

create table if not exists users (
  user_id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  name text not null,
  role text not null check (role in ('Recruiter', 'Admin')) default 'Recruiter',
  sso_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists target_agency (
  agency_id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  contact_email text,
  created_at timestamptz not null default now()
);

create table if not exists status_config (
  status_id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  order_index integer not null,
  is_terminal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists candidates (
  candidate_id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null unique,
  phone text,
  current_status_id uuid not null references status_config(status_id),
  target_agency_id uuid not null references target_agency(agency_id),
  recruiter_id uuid not null references users(user_id),
  flags jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists candidate_status_history (
  history_id uuid primary key default uuid_generate_v4(),
  candidate_id uuid not null references candidates(candidate_id) on delete cascade,
  from_status_id uuid references status_config(status_id),
  to_status_id uuid not null references status_config(status_id),
  change_date timestamptz not null default now(),
  changed_by uuid references users(user_id)
);

create index if not exists idx_candidates_flags on candidates using gin (flags);
create index if not exists idx_candidates_agency on candidates(target_agency_id);
create index if not exists idx_history_candidate on candidate_status_history(candidate_id);
