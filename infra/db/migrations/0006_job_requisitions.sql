create table if not exists job_requisitions (
  job_id uuid primary key default uuid_generate_v4(),
  title text not null,
  department text,
  location text,
  status text not null default 'open',
  description text,
  created_at timestamptz not null default now()
);

alter table candidates
  add column if not exists job_requisition_id uuid references job_requisitions(job_id);

create index if not exists idx_job_requisitions_status on job_requisitions(status);
create index if not exists idx_candidates_job on candidates(job_requisition_id);
