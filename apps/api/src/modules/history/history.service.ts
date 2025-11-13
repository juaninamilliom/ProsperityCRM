import { query } from '../../utils/sql.js';

export async function getCandidateHistory(candidateId: string) {
  const result = await query(
    `select h.*, s_from.name as from_status_name, s_to.name as to_status_name
     from candidate_status_history h
     left join status_config s_from on h.from_status_id = s_from.status_id
     left join status_config s_to on h.to_status_id = s_to.status_id
     where h.candidate_id = $1
     order by h.change_date desc`,
    [candidateId]
  );
  return result.rows;
}

export async function getPlacementMetrics() {
  const result = await query(
    `select date_trunc('month', change_date) as month, count(*) as placements
     from candidate_status_history h
     join status_config s on h.to_status_id = s.status_id
     where s.is_terminal = true
     group by 1 order by 1 desc`
  );
  return result.rows;
}
