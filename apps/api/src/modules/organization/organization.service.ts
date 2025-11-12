import type { Organization } from '../../types';
import { query } from '../../utils/sql';
import type { OrganizationInput } from './organization.schema';

export async function listOrganizations() {
  const result = await query<Organization>('select * from organizations order by created_at desc');
  return result.rows;
}

export async function createOrganization(input: OrganizationInput) {
  const result = await query<Organization>(
    `insert into organizations (name, slug)
     values ($1, $2)
     returning *`,
    [input.name, input.slug.toLowerCase()]
  );
  return result.rows[0];
}

export async function updateOrganization(id: string, input: OrganizationInput) {
  const result = await query<Organization>(
    `update organizations set name = $1, slug = $2 where organization_id = $3 returning *`,
    [input.name, input.slug.toLowerCase(), id]
  );
  return result.rows[0];
}
