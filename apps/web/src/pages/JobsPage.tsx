import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { JobRequisitionDTO } from 'src/common';
import { fetchJobs } from '../api/jobs';
import { Button, Card, Chip, SectionLabel } from '../components/ui';

import { formatMoney } from '../utils/money';

export { formatMoney };

type StatusFilter = 'all' | 'open' | 'on_hold' | 'closed';


const STATUS_TONE = {
  open: 'ok',
  on_hold: 'warn',
  closed: 'off',
} as const;

const STATUS_LABEL = {
  open: 'Open',
  on_hold: 'On hold',
  closed: 'Closed',
} as const;

const TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'closed', label: 'Closed' },
];

function sumBy(jobs: JobRequisitionDTO[], key: 'deal_amount' | 'weighted_deal_amount') {
  return jobs.reduce((total, job) => {
    const n = Number(job[key]);
    return Number.isFinite(n) ? total + n : total;
  }, 0);
}

export function JobsPage() {
  const [tab, setTab] = useState<StatusFilter>('all');
  const jobsQuery = useQuery({ queryKey: ['jobs'], queryFn: fetchJobs });

  const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data]);
  const openJobs = useMemo(() => jobs.filter((j) => j.status === 'open'), [jobs]);
  const visible = useMemo(
    () => (tab === 'all' ? jobs : jobs.filter((j) => j.status === tab)),
    [jobs, tab],
  );

  if (jobsQuery.isLoading) {
    return <p className="text-sm text-ink-3">Loading requisitions…</p>;
  }

  if (jobsQuery.error) {
    return <p className="text-sm text-warn-fg">Failed to load jobs.</p>;
  }

  const inPlay = openJobs.reduce((total, job) => total + (job.total_entries ?? 0), 0);

  const tiles = [
    { label: 'Open roles', value: String(openJobs.length), note: `${jobs.length} total` },
    {
      label: 'Pipeline value',
      value: formatMoney(sumBy(openJobs, 'deal_amount')),
      note: 'across open roles',
    },
    {
      label: 'Weighted',
      value: formatMoney(sumBy(openJobs, 'weighted_deal_amount')),
      note: 'probability adjusted',
    },
    { label: 'In play', value: String(inPlay), note: 'candidates on open roles' },
  ];

  return (
    <section className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-title">Jobs</h1>
          <p className="text-base text-ink-2">
            {openJobs.length} open {openJobs.length === 1 ? 'role' : 'roles'} ·{' '}
            {formatMoney(sumBy(openJobs, 'weighted_deal_amount'))} weighted pipeline
          </p>
        </div>
        <Link to="/settings">
          <Button>Manage jobs</Button>
        </Link>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="flex flex-col gap-1 p-4">
            <SectionLabel>{tile.label}</SectionLabel>
            <span className="font-serif text-[25px] leading-tight">{tile.value}</span>
            <span className="text-xs text-ink-3">{tile.note}</span>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-1.5 border-b border-border pb-3.5">
        {TABS.map((t) => {
          const count = t.id === 'all' ? jobs.length : jobs.filter((j) => j.status === t.id).length;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'focus-ring flex h-[30px] items-center gap-1.5 rounded-[8px] border px-3 text-sm transition',
                active
                  ? 'border-border bg-surface font-semibold text-ink'
                  : 'border-transparent text-ink-2 hover:bg-surface-3',
              ].join(' ')}
            >
              {t.label}
              <span className="rounded-full bg-surface-3 px-1.5 text-2xs font-semibold text-ink-2">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-ink-3">
          {jobs.length === 0
            ? 'No jobs yet. Add one from Settings → Jobs.'
            : 'No jobs with this status.'}
        </p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="min-w-full text-base">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                {['Role', 'Department', 'Location', 'Candidates', 'Deal value', 'Status'].map(
                  (h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.04em] text-ink-3"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {visible.map((job) => (
                <tr key={job.job_id} className="transition hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link to={`/jobs/${job.job_id}`} className="flex flex-col">
                      <span className="font-semibold tracking-[-0.005em] text-ink">
                        {job.title}
                      </span>
                      {job.owner_name && (
                        <span className="text-xs text-ink-3">{job.owner_name}</span>
                      )}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-2">
                    {job.department || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-2">
                    {job.location || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-2">
                    {job.total_entries ?? 0}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="block text-sm font-semibold">
                      {formatMoney(job.deal_amount)}
                    </span>
                    <span className="block text-2xs text-ink-3">
                      {formatMoney(job.weighted_deal_amount)} weighted
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Chip tone={STATUS_TONE[job.status] ?? 'off'}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
