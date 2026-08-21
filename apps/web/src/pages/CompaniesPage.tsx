import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { Relationship } from 'src/common';
import { fetchCompanies } from '../api/companies';
import { RelationshipChip } from '../components/RelationshipChip';
import { Button, Card, SectionLabel } from '../components/ui';
import { touchLabel, isCold, initials, tintFor } from '../utils/presentation';

type Filter = 'all' | Relationship;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'prospect', label: 'Prospects' },
  { key: 'client', label: 'Clients' },
  { key: 'former', label: 'Former' },
  { key: 'do_not_contact', label: 'Do not contact' },
];

const GRID = 'grid grid-cols-[2.4fr_1.1fr_0.85fr_0.85fr_0.7fr_1fr] gap-4';

export function CompaniesPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => fetchCompanies(),
  });

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: companies.length };
    for (const company of companies) {
      base[company.relationship] = (base[company.relationship] ?? 0) + 1;
    }
    return base;
  }, [companies]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return companies.filter((company) => {
      if (filter !== 'all' && company.relationship !== filter) return false;
      if (!term) return true;
      return (
        company.name.toLowerCase().includes(term) ||
        (company.domain ?? '').toLowerCase().includes(term)
      );
    });
  }, [companies, filter, search]);

  const prospects = counts.prospect ?? 0;
  const clients = counts.client ?? 0;
  const openDeals = companies.reduce((total, company) => total + (company.open_deals ?? 0), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-4.5 px-8 pt-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-serif text-title tracking-[-0.01em]">Companies</h1>
            <p className="text-base text-ink-2">
              {prospects} prospects · {clients} clients · {openDeals} open deals across the book
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search companies"
              aria-label="Search companies"
              className="focus-ring h-[34px] w-[214px] rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
            />
            <Button variant="primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New company
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 border-b border-border pb-4">
          {FILTERS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              aria-pressed={filter === entry.key}
              className={[
                'focus-ring flex h-[30px] items-center gap-1.5 rounded-[8px] border px-3 text-sm transition',
                filter === entry.key
                  ? 'border-border bg-surface font-semibold text-ink'
                  : 'border-transparent text-ink-2 hover:bg-surface-3',
              ].join(' ')}
            >
              {entry.label}
              <span
                className={[
                  'rounded-full px-1.5 text-2xs',
                  filter === entry.key ? 'bg-surface-3 text-ink-2' : 'text-ink-3',
                ].join(' ')}
              >
                {counts[entry.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-7 pt-5">
        {visible.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <SectionLabel>No companies</SectionLabel>
            <p className="text-base text-ink-2">Nothing matches that filter.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className={`${GRID} border-b border-border bg-surface-2 px-4.5 py-2.5`}>
              <SectionLabel>Company</SectionLabel>
              <SectionLabel>Relationship</SectionLabel>
              <SectionLabel>Contacts</SectionLabel>
              <SectionLabel>Open deals</SectionLabel>
              <SectionLabel>Reqs</SectionLabel>
              <SectionLabel>Last touch</SectionLabel>
            </div>
            {visible.map((company) => {
              const tint = tintFor(company.name);
              return (
                <Link
                  key={company.company_id}
                  to={`/companies/${company.company_id}`}
                  className={`${GRID} focus-ring items-center border-b border-border-soft px-4.5 py-3 transition last:border-b-0 hover:bg-surface-2`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] text-2xs font-semibold"
                      style={{ background: tint.bg, color: tint.fg }}
                    >
                      {initials(company.name)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-base font-medium">{company.name}</span>
                      <span className="truncate text-xs text-ink-3">{company.domain ?? '—'}</span>
                    </span>
                  </span>
                  <span className="justify-self-start">
                    <RelationshipChip relationship={company.relationship} />
                  </span>
                  <span className="text-sm text-ink-2">{company.contact_count ?? 0}</span>
                  <span className="text-sm text-ink-2">{company.open_deals || '—'}</span>
                  <span className="text-sm text-ink-2">{company.open_reqs || '—'}</span>
                  <span
                    className={isCold(company.last_touch) ? 'text-sm text-warn-fg' : 'text-sm text-ink-2'}
                  >
                    {touchLabel(company.last_touch)}
                  </span>
                </Link>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
