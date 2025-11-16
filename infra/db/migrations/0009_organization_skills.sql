create table if not exists organization_skills (
  skill_id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(organization_id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_org_skills_unique on organization_skills (organization_id, lower(name));

insert into organization_skills (organization_id, name)
select distinct u.organization_id, trim(skill_name)
from candidates c
join users u on c.recruiter_id = u.user_id
cross join lateral jsonb_array_elements_text(coalesce(c.skills, '[]'::jsonb)) as skill_name
where trim(skill_name) <> ''
on conflict (organization_id, lower(name)) do nothing;
