alter table users
  alter column sso_id drop not null,
  add column if not exists password text,
  add column if not exists is_active boolean not null default true;
