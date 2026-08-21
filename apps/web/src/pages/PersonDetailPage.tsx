import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { fetchPerson } from '../api/people';
import { createActivity, type NewActivity } from '../api/activities';
import { ActivityComposer } from '../components/ActivityComposer';
import { Modal } from '../components/Modal';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { Button, Card, Chip, SectionLabel, StageDot, BdStageDot } from '../components/ui';
import { formatMoney } from '../utils/money';
import { initials, tintFor } from '../utils/presentation';
import { flywheelNote } from './flywheelNote';

const ROLE_LABEL: Record<string, string> = {
  champion: 'Champion',
  decision_maker: 'Decision maker',
  influencer: 'Influencer',
  blocker: 'Blocker',
  intro: 'Intro',
};

function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function PersonDetailPage() {
  const { personId } = useParams();
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const { data: person, isLoading } = useQuery({
    queryKey: ['people', personId],
    queryFn: () => fetchPerson(personId!),
    enabled: Boolean(personId),
  });

  const logActivity = useMutation({
    mutationFn: (activity: NewActivity) => createActivity(activity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people', personId] });
      setComposerOpen(false);
    },
  });

  if (isLoading) return <p className="p-8 text-base text-ink-2">Loading…</p>;
  if (!person) return <p className="p-8 text-base text-ink-2">Person not found.</p>;

  const tint = tintFor(person.full_name);
  const note = flywheelNote(person);
  const placed = person.entries.some((entry) => (entry.status_name ?? '').toLowerCase() === 'placed');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-4.5 border-b border-border px-8 pb-4.5 pt-5">
        <nav className="flex items-center gap-1.5 text-sm text-ink-3">
          <Link to="/people" className="hover:text-ink-2">People</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span className="text-ink-2">{person.full_name}</span>
        </nav>

        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-[17px] font-semibold"
              style={{ background: tint.bg, color: tint.fg }}
            >
              {initials(person.full_name)}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-serif text-title tracking-[-0.01em]">{person.full_name}</h1>
                {placed && <Chip tone="ok">Placed</Chip>}
                {person.deals.length > 0 && <Chip tone="accent">BD contact</Chip>}
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-sm text-ink-2">
                {person.current_title && person.company_name && (
                  <span>
                    {person.current_title} at{' '}
                    {person.current_company_id ? (
                      <Link to={`/companies/${person.current_company_id}`} className="text-accent hover:text-accent-ink">
                        {person.company_name}
                      </Link>
                    ) : (
                      person.company_name
                    )}
                  </span>
                )}
                {person.location && <><span className="text-ink-3">·</span><span>{person.location}</span></>}
                {person.email && <><span className="text-ink-3">·</span><span>{person.email}</span></>}
                {person.linkedin_url && (
                  <>
                    <span className="text-ink-3">·</span>
                    <a
                      href={person.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-accent hover:text-accent-ink"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4.98 3.5A2.5 2.5 0 102.5 6a2.5 2.5 0 002.48-2.5zM2.9 8.2h4.2V21H2.9zM9.6 8.2h4v1.75h.06a4.4 4.4 0 013.96-2.18c4.24 0 5.02 2.79 5.02 6.42V21h-4.18v-5.9c0-1.41-.03-3.22-1.96-3.22-1.97 0-2.27 1.53-2.27 3.11V21H9.6z" />
                      </svg>
                      LinkedIn
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button>Edit</Button>
            <Button variant="primary" onClick={() => setComposerOpen(true)}>
              Log activity
            </Button>
          </div>
        </div>

        {note && (
          <div
            className="flex items-center gap-3 rounded-card border p-3.5"
            style={{ background: 'var(--sel-bg)', borderColor: 'var(--sel-ring)' }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              className="shrink-0 text-accent"
            >
              <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
            </svg>
            <p className="text-sm leading-relaxed text-ink-2">
              You placed {person.full_name.split(' ')[0]} at{' '}
              <strong className="font-semibold text-ink">{note.placedAt}</strong> in {note.placedYear}. They are
              now a contact on{' '}
              <strong className="font-semibold text-ink">{note.companies.join(' and ')}</strong>.
            </p>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 gap-5 px-8 pb-7 pt-5">
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
          <Card as="section">
            <header className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <SectionLabel>In your pipeline</SectionLabel>
            </header>
            {person.entries.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-3">Never been in the pipeline.</p>
            ) : (
              person.entries.map((entry) => (
                <div
                  key={entry.entry_id}
                  className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-b-0"
                >
                  <StageDot stage={entry.status_name ?? ''} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    {/* Without a requisition the company is the only thing worth
                        leading with - "No requisition" as a headline buries it. */}
                    <span className="truncate text-base font-medium">
                      {entry.job_title ?? entry.company_name}
                    </span>
                    <span className="truncate text-xs text-ink-3">
                      {entry.job_title ? entry.company_name : 'No requisition'}
                    </span>
                  </span>
                  <Chip
                    size="sm"
                    tone={(entry.status_name ?? '').toLowerCase() === 'placed' ? 'ok' : 'neutral'}
                  >
                    {entry.status_name}
                  </Chip>
                  <span className="w-[92px] text-right text-xs text-ink-3">
                    {formatMonthYear(entry.created_at)}
                  </span>
                </div>
              ))
            )}
          </Card>

          <Card as="section">
            <header className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <SectionLabel>Business development</SectionLabel>
            </header>
            {person.deals.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-3">Not a contact on any deal.</p>
            ) : (
              person.deals.map((deal) => (
                <Link
                  key={deal.opportunity_id}
                  to={`/companies/${deal.company_id}`}
                  className="focus-ring flex items-center gap-3 border-b border-border-soft px-4 py-3 transition last:border-b-0 hover:bg-surface-2"
                >
                  <BdStageDot stage={deal.stage} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-medium">{deal.name}</span>
                    <span className="truncate text-xs text-ink-3">{deal.company_name}</span>
                  </span>
                  {deal.role && (
                    <Chip size="sm" tone={deal.role === 'champion' ? 'accent' : 'neutral'}>
                      {ROLE_LABEL[deal.role] ?? deal.role}
                    </Chip>
                  )}
                  <span className="w-[74px] text-right font-serif text-lg">
                    {formatMoney(deal.est_annual_value)}
                  </span>
                </Link>
              ))
            )}
          </Card>

          {person.skills.length > 0 && (
            <Card as="section" className="flex flex-col gap-3 px-4 py-3.5">
              <SectionLabel>Skills</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {person.skills.map((skill) => (
                  <Chip key={skill}>{skill}</Chip>
                ))}
              </div>
            </Card>
          )}
        </div>

        <ActivityTimeline
          activity={person.activity}
          subtitle="across both funnels"
          perspective="person"
        />
      </div>

      <Modal isOpen={composerOpen} onClose={() => setComposerOpen(false)} title="">
        <ActivityComposer
          person={person}
          companyId={person.current_company_id ?? undefined}
          onSubmit={(activity) => logActivity.mutate(activity)}
          onClose={() => setComposerOpen(false)}
        />
      </Modal>
    </div>
  );
}
