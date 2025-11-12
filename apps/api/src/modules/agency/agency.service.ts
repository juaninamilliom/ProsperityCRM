import type { TargetAgency } from '../../types';
import { query } from '../../utils/sql';
import type { AgencyInput } from './agency.schema';

export async function listAgencies() {
  const result = await query<TargetAgency>('select * from target_agency order by name asc');
  return result.rows;
}

export async function createAgency(input: AgencyInput) {
  const result = await query<TargetAgency>(
    `insert into target_agency (name, contact_email)
     values ($1,$2) returning *`,
    [input.name, input.contact_email ?? null]
  );
  return result.rows[0];
}

export async function updateAgency(id: string, input: AgencyInput) {
  const result = await query<TargetAgency>(
    `update target_agency set name=$1, contact_email=$2 where agency_id=$3 returning *`,
    [input.name, input.contact_email ?? null, id]
  );
  return result.rows[0];
}

export async function deleteAgency(id: string) {
  await query('delete from target_agency where agency_id=$1', [id]);
}
