-- Three plain btree indexes that duplicate the index PostgreSQL already built
-- for a UNIQUE constraint on the same single column. Each cost a second index
-- write on every insert and served no lookup the unique index could not.
--
-- The unique constraints themselves are untouched, so no uniqueness and no
-- lookup path is lost. Prove it after deploying:
--   select i.indexrelid::regclass, i.indisunique, pg_get_indexdef(i.indexrelid)
--   from pg_index i
--   where i.indrelid in ('org_invite_codes'::regclass, 'passkeys'::regclass,
--                        'magic_links'::regclass)
--   order by 1;

-- Duplicates org_invite_codes_code_key, from `code text not null unique` (0004:4).
drop index if exists idx_invite_codes_code;

-- Duplicates passkeys_credential_id_key, from `credential_id text NOT NULL UNIQUE` (0014:6).
drop index if exists idx_passkeys_credential_id;

-- Duplicates magic_links_token_hash_key, from `token_hash text NOT NULL UNIQUE` (0014:21).
drop index if exists idx_magic_links_token_hash;
