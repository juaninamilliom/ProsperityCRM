import { and, asc, eq, sql } from 'drizzle-orm';
import { db, organizationSkills } from '../../db/drizzle.js';
import type { OrganizationSkill } from '../../types.js';

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

export async function listOrganizationSkills(organizationId: string): Promise<OrganizationSkill[]> {
  const rows = await db
    .select()
    .from(organizationSkills)
    .where(eq(organizationSkills.organization_id, organizationId))
    .orderBy(asc(sql`lower(${organizationSkills.name})`));

  return rows as unknown as OrganizationSkill[];
}

export async function createOrganizationSkill(
  organizationId: string,
  name: string
): Promise<OrganizationSkill> {
  const [normalized] = normalizeSkillNames([name]);
  if (!normalized) {
    throw new Error('Skill name is required');
  }

  const [existing] = await db
    .select()
    .from(organizationSkills)
    .where(
      and(
        eq(organizationSkills.organization_id, organizationId),
        sql`lower(${organizationSkills.name}) = lower(${normalized})`
      )
    );

  if (existing) {
    const [updated] = await db
      .update(organizationSkills)
      .set({ name: normalized })
      .where(eq(organizationSkills.skill_id, existing.skill_id))
      .returning();
    return updated as unknown as OrganizationSkill;
  }

  const [row] = await db
    .insert(organizationSkills)
    .values({
      organization_id: organizationId,
      name: normalized,
    })
    .returning();

  return row as unknown as OrganizationSkill;
}

export async function ensureOrganizationSkills(
  organizationId: string,
  skills: string[]
): Promise<void> {
  const normalized = normalizeSkillNames(skills);
  if (!normalized.length) {
    return;
  }

  const existingSkills = await listOrganizationSkills(organizationId);
  const existingSet = new Set(existingSkills.map((s) => s.name.toLowerCase()));

  const toInsert = normalized.filter((s) => !existingSet.has(s.toLowerCase()));
  if (toInsert.length > 0) {
    await db.insert(organizationSkills).values(
      toInsert.map((skillName) => ({
        organization_id: organizationId,
        name: skillName,
      }))
    );
  }
}
