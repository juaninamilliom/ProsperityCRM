alter table candidates
  add column if not exists skills jsonb not null default '[]'::jsonb;

create index if not exists idx_candidates_skills on candidates using gin (skills);
