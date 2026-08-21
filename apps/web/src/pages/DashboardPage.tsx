import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCompanies } from '../api/companies';
import { fetchEntries, moveEntry } from '../api/entries';
import { fetchStatuses } from '../api/statuses';
import { fetchJobs } from '../api/jobs';
import { fetchSkills } from '../api/skills';
import { FilterBar } from '../components/FilterBar';
import { PipelineBoard } from '../components/PipelineBoard';
import { useFiltersStore } from '../store/filters';
import { PipelineList } from '../components/PipelineList';
import { DetailRail } from '../components/DetailRail';
import { PipelineSearch } from '../components/PipelineSearch';
import { pipelineSummary } from './pipelineSummary';
import { activeFilterCount } from './activeFilterCount';
import { Button } from '../components/ui';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const queryClient = useQueryClient();
  const { selectedAgency, flagQuery, jobId, statusId, searchTerm, skillFilters } =
    useFiltersStore();

  const filters = useMemo(
    () => ({
      company_id: selectedAgency,
      flag: flagQuery,
      job_id: jobId,
      status_id: statusId,
      search: searchTerm,
      skills: skillFilters,
    }),
    [selectedAgency, flagQuery, jobId, statusId, searchTerm, skillFilters],
  );

  const agenciesQuery = useQuery({ queryKey: ['companies'], queryFn: () => fetchCompanies() });
  const statusesQuery = useQuery({ queryKey: ['statuses'], queryFn: fetchStatuses });
  const jobsQuery = useQuery({ queryKey: ['jobs'], queryFn: fetchJobs });
  const skillsQuery = useQuery({ queryKey: ['skills'], queryFn: fetchSkills });
  const candidatesQuery = useQuery({
    queryKey: ['entries', filters],
    queryFn: () => fetchEntries(filters),
    enabled: statusesQuery.isSuccess,
    placeholderData: (previousData) => previousData,
  });

  const moveMutation = useMutation({
    mutationFn: ({ entryId, toStatusId }: { entryId: string; toStatusId: string }) =>
      moveEntry(entryId, toStatusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });

  if (statusesQuery.isLoading) {
    return <p className="text-sm text-ink-3">Loading pipeline…</p>;
  }

  if (statusesQuery.error || candidatesQuery.error) {
    return <p className="text-sm text-warn-fg">Failed to load data. Check API connection.</p>;
  }

  const isInitialCandidatesLoad = candidatesQuery.isLoading && !candidatesQuery.data;
  if (isInitialCandidatesLoad) {
    return <p className="text-sm text-ink-3">Loading pipeline…</p>;
  }

  const isRefreshing = candidatesQuery.isFetching && !isInitialCandidatesLoad;

  const filterCount = activeFilterCount({
    selectedAgency,
    flagQuery,
    jobId,
    statusId,
    skillFilters,
  });

  const candidates = candidatesQuery.data ?? [];
  const selected = candidates.find((c) => c.entry_id === selectedId) ?? null;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-title">Pipeline</h1>
          <p className="text-base text-ink-2">
            {pipelineSummary(candidates, statusesQuery.data ?? [])}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PipelineSearch />
          <Link to="/candidates/new">
            <Button variant="primary" className="h-[34px]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add candidate
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-4 border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className={[
              'focus-ring flex h-[30px] items-center gap-2 rounded-[8px] border px-3 text-sm font-medium transition',
              filtersOpen || filterCount > 0
                ? 'border-border bg-surface text-ink'
                : 'border-transparent text-ink-2 hover:bg-surface-3',
            ].join(' ')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M3 6h18M7 12h10M10 18h4" />
            </svg>
            Filters
            {filterCount > 0 && (
              <span className="rounded-full bg-accent-soft px-1.5 text-2xs font-semibold text-accent-ink">
                {filterCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2">
            {isRefreshing && <span className="text-xs text-ink-3">Updating…</span>}
            <div className="flex items-center gap-1 rounded-control bg-surface-3 p-[3px]">
              {(['board', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={[
                    'focus-ring h-[26px] rounded-[7px] px-3 text-sm font-medium capitalize transition',
                    viewMode === mode ? 'bg-surface text-ink shadow-pop' : 'text-ink-2',
                  ].join(' ')}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtersOpen && (
          <FilterBar
            agencies={agenciesQuery.data ?? []}
            jobs={jobsQuery.data ?? []}
            statuses={statusesQuery.data ?? []}
            skills={skillsQuery.data ?? []}
            skillsLoading={skillsQuery.isLoading}
            skillsError={Boolean(skillsQuery.error)}
          />
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="min-w-0 flex-1">
          {viewMode === 'board' ? (
            <PipelineBoard
              statuses={statusesQuery.data ?? []}
              candidates={candidates}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={async (entryId, toStatusId) => {
                await moveMutation.mutateAsync({ entryId, toStatusId });
              }}
            />
          ) : (
            <PipelineList statuses={statusesQuery.data ?? []} candidates={candidates} />
          )}
        </div>
        {selected && (
          <DetailRail
            candidate={selected}
            statuses={statusesQuery.data ?? []}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </section>
  );
}
