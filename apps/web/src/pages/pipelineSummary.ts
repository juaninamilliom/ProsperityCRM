import type { CandidateWithMeta, StatusDTO } from 'src/common';

/** "7 active candidates · 2 placed" - the line under the Pipeline title.
 *  Terminal statuses (Placed, Rejected) are not "active". */
export function pipelineSummary(candidates: CandidateWithMeta[], statuses: StatusDTO[]): string {
  const terminal = new Set(statuses.filter((s) => s.is_terminal).map((s) => s.status_id));
  const placedId = statuses.find((s) => s.name.trim().toLowerCase() === 'placed')?.status_id;

  const active = candidates.filter((c) => !terminal.has(c.current_status_id)).length;
  const placed = placedId ? candidates.filter((c) => c.current_status_id === placedId).length : 0;

  const label = active === 1 ? 'active candidate' : 'active candidates';
  return `${active} ${label} · ${placed} placed`;
}
