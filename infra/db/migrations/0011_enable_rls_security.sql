-- Enable Row-Level Security (RLS) on all public schema tables
-- This blocks unauthorized public access via Supabase's auto-generated PostgREST REST API
-- while allowing the Express backend (connecting as postgres / service_role) full access.

ALTER TABLE IF EXISTS organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS status_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS people ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bd_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS opportunity_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS job_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS job_deal_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pipeline_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS entry_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organization_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS org_invite_codes ENABLE ROW LEVEL SECURITY;

-- If schema_migrations table exists, secure it as well
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'schema_migrations') THEN
    ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Revoke all table, sequence, and routine privileges in public from anon and authenticated roles
-- to prevent any sensitive column exposure or direct PostgREST REST query bypass.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
  END IF;

  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM authenticated;
  END IF;
END $$;
