import type { StatusConfig } from '../../types';
import { query } from '../../utils/sql';
import type { StatusInput } from './status.schema';

export async function listStatuses() {
  const result = await query<StatusConfig>('select * from status_config order by order_index asc');
  return result.rows;
}

export async function createStatus(input: StatusInput) {
  const result = await query<StatusConfig>(
    `insert into status_config (name, order_index, is_terminal)
     values ($1,$2,$3) returning *`,
    [input.name, input.order_index, input.is_terminal]
  );
  return result.rows[0];
}

export async function updateStatus(id: string, input: StatusInput) {
  const result = await query<StatusConfig>(
    `update status_config set name=$1, order_index=$2, is_terminal=$3 where status_id=$4 returning *`,
    [input.name, input.order_index, input.is_terminal, id]
  );
  return result.rows[0];
}

export async function deleteStatus(id: string) {
  await query('delete from status_config where status_id = $1', [id]);
}
