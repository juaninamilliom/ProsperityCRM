import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAgencies } from '../api/agencies';
import { fetchCandidates, moveCandidate } from '../api/candidates';
import { fetchStatuses } from '../api/statuses';
import { fetchJobs } from '../api/jobs';
import { FilterBar } from '../components/FilterBar';
import { PipelineBoard } from '../components/PipelineBoard';
import { useFiltersStore } from '../store/filters';

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { selectedAgency, flagQuery, jobId, statusId, searchTerm } = useFiltersStore();

  const filters = useMemo(
    () => ({
      agency_id: selectedAgency,
      flag: flagQuery,
      job_id: jobId,
      status_id: statusId,
      search: searchTerm,
    }),
    [selectedAgency, flagQuery, jobId, statusId, searchTerm]
  );

  const agenciesQuery = useQuery({ queryKey: ['agencies'], queryFn: fetchAgencies });
  const statusesQuery = useQuery({ queryKey: ['statuses'], queryFn: fetchStatuses });
  const jobsQuery = useQuery({ queryKey: ['jobs'], queryFn: fetchJobs });
  const candidatesQuery = useQuery({
    queryKey: ['candidates', filters],
    queryFn: () => fetchCandidates(filters),
    enabled: Boolean(statusesQuery.data?.length),
  });

  const moveMutation = useMutation({
    mutationFn: ({ candidateId, toStatusId }: { candidateId: string; toStatusId: string }) => moveCandidate(candidateId, toStatusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });

  if (statusesQuery.isLoading || candidatesQuery.isLoading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading pipeline…</p>;
  }

  if (statusesQuery.error || candidatesQuery.error) {
    return <p className="text-sm text-red-500">Failed to load data. Check API connection.</p>;
  }

  return (
    <section className="space-y-4">
      <FilterBar agencies={agenciesQuery.data ?? []} jobs={jobsQuery.data ?? []} statuses={statusesQuery.data ?? []} />
      <PipelineBoard
        statuses={statusesQuery.data ?? []}
        candidates={candidatesQuery.data ?? []}
        onMove={async (candidateId, toStatusId) => {
          await moveMutation.mutateAsync({ candidateId, toStatusId });
        }}
      />
    </section>
  );
}
