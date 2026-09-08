-- Index every foreign key column a live DELETE route traverses.
--
-- PostgreSQL indexes the REFERENCED side of a foreign key automatically and
-- the REFERENCING side never. Deleting a parent runs an implicit
-- `select 1 from <child> where <fk> = $1 for key share` per constraint, so an
-- unindexed referencing column turns every parent delete into a sequential
-- scan of the child, and the 409 guards that count the same rows scan twice.
--
-- Delete behaviour is unchanged here. Nothing below adds, drops or alters a
-- constraint; these are read paths for constraints 0004, 0010 and 0014
-- already declare.

-- people -> pipeline_entries is ON DELETE CASCADE (0010:93), and the person
-- detail page reads the same shape (person.service.ts:118). The only index
-- leading with person_id is UNIQUE ... WHERE job_id IS NOT NULL (0010:104-105),
-- which the planner cannot use for a predicate that does not exclude nulls.
create index if not exists idx_entries_person on pipeline_entries (person_id);

-- job_requisitions -> pipeline_entries is NO ACTION (0010:95): the delete at
-- job.service.ts:93 raises 23503 and surfaces as a bare 500.
create index if not exists idx_entries_job on pipeline_entries (job_id);

-- users -> pipeline_entries is NOT NULL, NO ACTION (0010:97).
create index if not exists idx_entries_recruiter on pipeline_entries (recruiter_id);

-- status_config -> entry_status_history, both directions, NO ACTION
-- (0010:113-114). The status delete at status.service.ts:40 traverses both.
create index if not exists idx_history_from_status on entry_status_history (from_status_id);
create index if not exists idx_history_to_status on entry_status_history (to_status_id);

-- users -> entry_status_history is NO ACTION (0010:116).
create index if not exists idx_history_changed_by on entry_status_history (changed_by);

-- bd_opportunities -> activities is ON DELETE CASCADE (0010:126). Two columns
-- to match idx_activities_person and idx_activities_company (0010:142-143):
-- listActivities filters on opportunity_id and orders by occurred_at desc
-- (activity.service.ts:25,:54).
create index if not exists idx_activities_opportunity
  on activities (opportunity_id, occurred_at desc);

-- pipeline_entries -> activities is ON DELETE CASCADE (0010:127). One column,
-- because no query filters activities by entry_id; this serves the cascade.
create index if not exists idx_activities_entry on activities (entry_id);

-- users -> activities is NO ACTION (0010:136).
create index if not exists idx_activities_created_by on activities (created_by);

-- users -> bd_opportunities is NO ACTION (0010:72).
create index if not exists idx_opportunities_owner on bd_opportunities (owner_id);

-- bd_opportunities -> job_requisitions is NO ACTION (0010:147): deleting a deal
-- that produced a requisition raises 23503 today.
create index if not exists idx_jobs_opportunity on job_requisitions (opportunity_id);

-- users -> org_invite_codes, both audit columns, NO ACTION (0004:9,:11).
create index if not exists idx_invite_codes_created_by on org_invite_codes (created_by);
create index if not exists idx_invite_codes_revoked_by on org_invite_codes (revoked_by);

-- users -> auth_challenges is ON DELETE CASCADE (0014:33).
create index if not exists idx_auth_challenges_user on auth_challenges (user_id);
