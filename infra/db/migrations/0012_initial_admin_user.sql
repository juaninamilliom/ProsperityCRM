-- Guarantee an initial organization and default admin users exist for login

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  -- 1. Ensure at least one organization exists
  SELECT organization_id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name, slug)
    VALUES ('Prosperity Recruiting', 'prosperity-recruiting')
    RETURNING organization_id INTO v_org_id;
  END IF;

  -- 2. Insert or update the default dev admin user (dev@prosperity.test / password)
  INSERT INTO users (organization_id, email, name, role, password, is_active)
  VALUES (
    v_org_id,
    'dev@prosperity.test',
    'Dev Admin',
    'OrgAdmin',
    'password',
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    role = 'OrgAdmin',
    password = COALESCE(users.password, EXCLUDED.password),
    is_active = true;

  -- 3. Insert or update the standard admin@prosperity.test user (admin@prosperity.test / password)
  INSERT INTO users (organization_id, email, name, role, password, is_active)
  VALUES (
    v_org_id,
    'admin@prosperity.test',
    'Prosperity Admin',
    'OrgAdmin',
    'password',
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    role = 'OrgAdmin',
    password = COALESCE(users.password, EXCLUDED.password),
    is_active = true;

END $$;
