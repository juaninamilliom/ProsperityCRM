import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { OpportunityDTO, OpportunityStage } from 'src/common';
import { fetchOpportunities, moveStage } from '../api/opportunities';
import { StageBoard, type StageColumn } from '../components/StageBoard';
import { Button, Card, SectionLabel, bdStageToken } from '../components/ui';
import { formatMoney } from '../utils/money';
import { dealSummary } from './dealSummary';

/** lost is terminal and gets no permanent column - it is reachable by filter.
 *  Six columns is also exactly what the pipeline board already lays out. */
const BOARD_STAGES: { key: OpportunityStage; label: string }[] = [
  { key: 'prospect', label: 'Prospect' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'signed', label: 'Signed' },
];

const COLD_AFTER_DAYS = 7;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

function touchLabel(iso: string | null | undefined): string {
  const days = daysSince(iso);
  if (days === null) return 'never';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function initials(name: string): string {
  return name
    .replace(/&/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

type Filter = 'all' | 'closing' | 'lost';

export function DealsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const { data: deals = [] } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => fetchOpportunities(),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: OpportunityStage }) => moveStage(id, stage),
    onSuccess: () => {
      // Winning promotes the company, so the companies list is stale too.
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deals.filter((deal) => {
      if (filter === 'closing' && !['proposal', 'negotiation'].includes(deal.stage)) return false;
      if (filter === 'lost' && deal.stage !== 'lost') return false;
      if (filter !== 'lost' && deal.stage === 'lost') return false;
      if (!term) return true;
      return (
        deal.name.toLowerCase().includes(term) ||
        (deal.company_name ?? '').toLowerCase().includes(term)
      );
    });
  }, [deals, filter, search]);

  const summary = useMemo(() => dealSummary(deals.filter((d) => d.stage !== 'lost')), [deals]);

  const columns: StageColumn[] = BOARD_STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    token: bdStageToken(stage.key),
  }));

  const columnValue = (stageKey: string) => {
    const total = visible
      .filter((deal) => deal.stage === stageKey)
      .reduce((sum, deal) => sum + Number(deal.est_annual_value ?? 0), 0);
    return total ? formatMoney(total) : 'no deals';
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All deals' },
    { key: 'closing', label: 'Closing soon' },
    { key: 'lost', label: 'Lost' },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-4.5 px-8 pt-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-serif text-title tracking-[-0.01em]">Deals</h1>
            <p className="text-base text-ink-2">
              {summary.open} open deals · {formatMoney(summary.openValue)} in play ·{' '}
              {summary.signed} signed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search deals"
              aria-label="Search deals"
              className="focus-ring h-[34px] w-[214px] rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
            />
            <Button variant="primary">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              New deal
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-1.5">
            {FILTERS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setFilter(entry.key)}
                aria-pressed={filter === entry.key}
                className={[
                  'focus-ring h-[30px] rounded-[8px] border px-3 text-sm transition',
                  filter === entry.key
                    ? 'border-border bg-surface font-semibold text-ink'
                    : 'border-transparent text-ink-2 hover:bg-surface-3',
                ].join(' ')}
              >
                {entry.label}
              </button>
            ))}
            <span className="mx-1 h-[18px] w-px bg-border" />
            <span className="flex items-center gap-1.5 rounded-[8px] border border-border px-2.5 py-1 text-sm text-ink-2">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--warn-dot)' }}
              />
              {summary.cold} need a follow-up
            </span>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden px-8 pb-7 pt-5">
        {visible.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <SectionLabel>No deals</SectionLabel>
            <p className="text-base text-ink-2">
              {filter === 'lost' ? 'Nothing lost yet.' : 'Nothing here. Start one from a company.'}
            </p>
          </Card>
        ) : (
          <StageBoard
            columns={columns}
            items={visible}
            itemKey={(deal) => deal.opportunity_id}
            itemStage={(deal) => deal.stage}
            columnSubtitle={columnValue}
            onMove={(id, stage) => moveMutation.mutate({ id, stage: stage as OpportunityStage })}
            renderCard={(deal: OpportunityDTO) => {
              const days = daysSince(deal.last_touch);
              const cold = days === null || days > COLD_AFTER_DAYS;
              return (
                <Link
                  to={`/companies/${deal.company_id}`}
                  className="focus-ring flex w-full flex-col gap-2.5 rounded-[11px] border border-border bg-surface p-3 text-left transition hover:shadow-pop"
                >
                  <span className="truncate text-sm font-semibold tracking-[-0.005em]">
                    {deal.company_name}
                  </span>
                  <span className="truncate text-xs text-ink-2">{deal.name}</span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-serif text-lg leading-none">
                      {formatMoney(deal.est_annual_value)}
                    </span>
                    {deal.fee_percent != null && (
                      <span className="text-2xs text-ink-3">{deal.fee_percent}% fee</span>
                    )}
                  </span>
                  <span className="flex items-center justify-between gap-2 border-t border-border-soft pt-2">
                    <span className="flex items-center">
                      {(deal.contacts ?? []).slice(0, 3).map((contact) => (
                        <span
                          key={contact.person_id}
                          title={contact.full_name}
                          className="-mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-surface bg-accent-soft text-[9px] font-semibold text-accent-ink"
                        >
                          {initials(contact.full_name)}
                        </span>
                      ))}
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        aria-hidden
                        className="inline-block h-[5px] w-[5px] rounded-full"
                        style={{ background: cold ? 'var(--warn-dot)' : 'var(--ok-dot)' }}
                      />
                      <span className={cold ? 'text-2xs text-warn-fg' : 'text-2xs text-ink-2'}>
                        {touchLabel(deal.last_touch)}
                      </span>
                    </span>
                  </span>
                </Link>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
