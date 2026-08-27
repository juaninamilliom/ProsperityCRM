-- Add support for WebAuthn/Passkeys (Apple Touch ID / Face ID) and Email Magic Links

CREATE TABLE IF NOT EXISTS passkeys (
  passkey_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  device_name text,
  transports jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id ON passkeys(credential_id);

CREATE TABLE IF NOT EXISTS magic_links (
  link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  invite_code text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magic_links_token_hash ON magic_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);

CREATE TABLE IF NOT EXISTS auth_challenges (
  challenge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_challenge ON auth_challenges(challenge);

-- Enable RLS
ALTER TABLE IF EXISTS passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_challenges ENABLE ROW LEVEL SECURITY;

-- Apply backend full access policies
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'passkeys') THEN
    DROP POLICY IF EXISTS "backend_full_access" ON passkeys;
    CREATE POLICY "backend_full_access" ON passkeys FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'magic_links') THEN
    DROP POLICY IF EXISTS "backend_full_access" ON magic_links;
    CREATE POLICY "backend_full_access" ON magic_links FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_challenges') THEN
    DROP POLICY IF EXISTS "backend_full_access" ON auth_challenges;
    CREATE POLICY "backend_full_access" ON auth_challenges FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
