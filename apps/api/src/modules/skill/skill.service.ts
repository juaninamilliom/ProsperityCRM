import type { OrganizationSkill } from '../../types.js';
import { query } from '../../utils/sql.js';

export function normalizeSkillNames(skills: string[] = []) {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const raw of skills) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }
  return normalized;
}

export async function listOrganizationSkills(organizationId: string) {
  const result = await query<OrganizationSkill>(
    `select skill_id, organization_id, name, created_at
     from organization_skills
     where organization_id = $1
     order by lower(name) asc`,
    [organizationId]
  );
  return result.rows;
}

export async function createOrganizationSkill(organizationId: string, name: string) {
  const [normalized] = normalizeSkillNames([name]);
  if (!normalized) {
    throw new Error('Skill name is required');
  }
  const result = await query<OrganizationSkill>(
    `insert into organization_skills (organization_id, name)
     values ($1,$2)
     on conflict (organization_id, lower(name)) do update set name = excluded.name
     returning *`,
    [organizationId, normalized]
  );
  return result.rows[0];
}

export async function ensureOrganizationSkills(organizationId: string, skills: string[]) {
  const normalized = normalizeSkillNames(skills);
  if (!normalized.length) {
    return;
  }
  await query(
    `insert into organization_skills (organization_id, name)
     select $1, skill from unnest($2::text[]) as skill
     on conflict (organization_id, lower(name)) do nothing`,
    [organizationId, normalized]
  );
}
