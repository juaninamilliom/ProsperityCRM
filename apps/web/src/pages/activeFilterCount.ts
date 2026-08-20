/** How many filters are narrowing the board right now. Drives the count badge
 *  on the Filters toggle: with the panel collapsed, an active filter would
 *  otherwise silently hide candidates with nothing on screen to explain it.
 *  The free-text search is deliberately excluded - it has its own visible input. */
export interface ActiveFilters {
  selectedAgency?: string;
  flagQuery?: string;
  jobId?: string;
  statusId?: string;
  skillFilters?: string[];
}

export function activeFilterCount(filters: ActiveFilters): number {
  let count = 0;
  if (filters.selectedAgency) count += 1;
  if (filters.jobId) count += 1;
  if (filters.statusId) count += 1;
  if (filters.flagQuery?.trim()) count += 1;
  count += filters.skillFilters?.length ?? 0;
  return count;
}
