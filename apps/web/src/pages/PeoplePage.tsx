import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPeople, createPerson } from '../api/people';
import { fetchCompanies } from '../api/companies';
import { PersonForm, type PersonFormValues } from '../components/PersonForm';
import { Overlay } from '../components/Overlay';
import { Button, Card, SectionLabel } from '../components/ui';
import { initials, isCold, tintFor, touchLabel } from '../utils/presentation';

const GRID = 'grid grid-cols-[2.4fr_1.6fr_0.85fr_0.7fr_1fr] gap-4';

export function PeoplePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => fetchPeople() });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => fetchCompanies() });

  const create = useMutation({
    mutationFn: (values: PersonFormValues) => createPerson(values),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setCreateOpen(false);
      setCreateError(null);
      navigate(`/people/${created.person_id}`);
    },
    onError: (error: { response?: { status?: number; data?: { message?: string } } }) => {
      setCreateError(
        error?.response?.status === 409
          ? (error.response.data?.message ?? 'You already have this person.')
          : 'Could not add the person. Check the fields and try again.',
      );
    },
  });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return people;
    return people.filter(
      (person) =>
        person.full_name.toLowerCase().includes(term) ||
        (person.email ?? '').toLowerCase().includes(term) ||
        (person.linkedin_url ?? '').toLowerCase().includes(term),
    );
  }, [people, search]);

  const bothSides = people.filter((p) => (p.entry_count ?? 0) > 0 && (p.deal_count ?? 0) > 0).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-4.5 px-8 pt-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-serif text-title tracking-[-0.01em]">People</h1>
            <p className="text-base text-ink-2">
              {people.length} people · {bothSides} on both sides of the business
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className="focus-ring h-[34px] w-[214px] rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
            />
            <Button variant="primary" className="h-[34px]" onClick={() => setCreateOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add person
            </Button>
          </div>
        </div>
        <div className="border-b border-border" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-7 pt-5">
        <Card className="overflow-hidden">
          <div className={`${GRID} border-b border-border bg-surface-2 px-4.5 py-2.5`}>
            <SectionLabel>Person</SectionLabel>
            <SectionLabel>Company</SectionLabel>
            <SectionLabel>Pipeline</SectionLabel>
            <SectionLabel>Deals</SectionLabel>
            <SectionLabel>Last touch</SectionLabel>
          </div>
          {visible.map((person) => {
            const tint = tintFor(person.full_name);
            return (
              <Link
                key={person.person_id}
                to={`/people/${person.person_id}`}
                className={`${GRID} focus-ring items-center border-b border-border-soft px-4.5 py-3 transition last:border-b-0 hover:bg-surface-2`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-2xs font-semibold"
                    style={{ background: tint.bg, color: tint.fg }}
                  >
                    {initials(person.full_name)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-base font-medium">{person.full_name}</span>
                    <span className="truncate text-xs text-ink-3">{person.headline ?? '—'}</span>
                  </span>
                </span>
                <span className="truncate text-sm text-ink-2">{person.company_name ?? '—'}</span>
                <span className="text-sm text-ink-2">{person.entry_count || '—'}</span>
                <span className="text-sm text-ink-2">{person.deal_count || '—'}</span>
                <span className={isCold(person.last_touch) ? 'text-sm text-warn-fg' : 'text-sm text-ink-2'}>
                  {touchLabel(person.last_touch)}
                </span>
              </Link>
            );
          })}
        </Card>
      </div>

      <Overlay isOpen={createOpen} onClose={() => setCreateOpen(false)} width={620}>
        <PersonForm
          companies={companies}
          pending={create.isPending}
          error={createError}
          onSubmit={(values) => create.mutate(values)}
          onClose={() => {
            setCreateOpen(false);
            setCreateError(null);
          }}
        />
      </Overlay>
    </div>
  );
}
