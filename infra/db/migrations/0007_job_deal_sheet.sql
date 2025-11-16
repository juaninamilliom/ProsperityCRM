alter table job_requisitions
  add column if not exists close_date date,
  add column if not exists deal_amount numeric,
  add column if not exists weighted_deal_amount numeric,
  add column if not exists owner_name text,
  add column if not exists stage text;

create table if not exists job_deal_splits (
  split_id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references job_requisitions(job_id) on delete cascade,
  teammate_name text not null,
  teammate_status text default 'active',
  split_percent numeric not null,
  role text,
  total_deal numeric,
  weighted_deal numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_deal_splits_job on job_deal_splits(job_id);
