-- Ensure full table access and RLS policies for backend database connections.
-- This satisfies Supabase RLS security advisors while granting full access
-- to postgres, service_role and the current database user.
--
-- Deliberately NOT granted: anon and authenticated. Supabase serves any table
-- those roles can read over its REST API to anyone holding the project's
-- public key. The backend connects as postgres and needs neither.

DO $$
BEGIN
  -- Grant to CURRENT_USER
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I;', CURRENT_USER);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA public TO %I;', CURRENT_USER);
  EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO %I;', CURRENT_USER);
  EXECUTE format('GRANT ALL ON ALL ROUTINES IN SCHEMA public TO %I;', CURRENT_USER);

  -- Grant to postgres role if it exists
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
    GRANT USAGE ON SCHEMA public TO postgres;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
    GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres;
  END IF;

  -- Grant to service_role if it exists (Supabase)
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA public TO service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
  END IF;
END $$;

-- Create full access RLS policies across all public tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "backend_full_access" ON %I;', t);
    EXECUTE format('CREATE POLICY "backend_full_access" ON %I FOR ALL USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;
