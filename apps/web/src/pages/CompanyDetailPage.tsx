import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { fetchCompany } from '../api/companies';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { RelationshipChip } from '../components/RelationshipChip';
import { Button, Card, Chip, SectionLabel, BdStageDot } from '../components/ui';
import { formatMoney } from '../utils/money';
import { initials, tintFor, touchLabel } from '../utils/presentation';

const ROLE_LABEL: Record<string, string> = {
  champion: 'Champion',
  decision_maker: 'Decision maker',
  influencer: 'Influencer',
  blocker: 'Blocker',
  intro: 'Intro',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-0.5 px-3.5 py-3">
      <SectionLabel>{label}</SectionLabel>
      <span className="font-serif text-[25px] leading-[1.1]">{value}</span>
    </Card>
  );
}

export function CompanyDetailPage() {
  const { companyId } = useParams();
  const { data: company, isLoading } = useQuery({
    queryKey: ['companies', companyId],
    queryFn: () => fetchCompany(companyId!),
    enabled: Boolean(companyId),
  });

  if (isLoading) return <p className="p-8 text-base text-ink-2">Loading…</p>;
  if (!company) return <p className="p-8 text-base text-ink-2">Company not found.</p>;

  const tint = tintFor(company.name);
  const openDeals = company.deals.filter((deal) => !['signed', 'lost'].includes(deal.stage));
  const inPipeline = company.requisitions.reduce((total, req) => total + (req.entry_count ?? 0), 0);
  const agreedFee = company.deals.find((deal) => deal.stage === 'signed')?.fee_percent;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-5 border-b border-border px-8 pb-4.5 pt-5">
        <nav className="flex items-center gap-1.5 text-sm text-ink-3">
          <Link to="/companies" className="hover:text-ink-2">Companies</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span className="text-ink-2">{company.name}</span>
        </nav>

        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[13px] text-[17px] font-semibold"
              style={{ background: tint.bg, color: tint.fg }}
            >
              {initials(company.name)}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <h1 className="font-serif text-title tracking-[-0.01em]">{company.name}</h1>
                <RelationshipChip relationship={company.relationship} />
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-sm text-ink-2">
                {company.domain && (
                  <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-ink">
                    {company.domain}
                  </a>
                )}
                {company.industry && <><span className="text-ink-3">·</span><span>{company.industry}</span></>}
                {company.headcount && <><span className="text-ink-3">·</span><span>{company.headcount}</span></>}
                {company.location && <><span className="text-ink-3">·</span><span>{company.location}</span></>}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button>New deal</Button>
            <Button>Edit</Button>
            <Button variant="primary">Log activity</Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Stat label="Open reqs" value={String(company.requisitions.filter((r) => r.status === 'open').length)} />
          <Stat label="In pipeline" value={String(inPipeline)} />
          <Stat label="Open deals" value={String(openDeals.length)} />
          <Stat label="Agreed fee" value={agreedFee != null ? `${agreedFee}%` : '—'} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-5 px-8 pb-7 pt-5">
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
          <Card as="section">
            <header className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <SectionLabel>Contacts</SectionLabel>
            </header>
            {company.contacts.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-3">No contacts yet.</p>
            ) : (
              company.contacts.map((contact) => {
                const contactTint = tintFor(contact.full_name);
                return (
                  <Link
                    key={contact.person_id}
                    to={`/people/${contact.person_id}`}
                    className="focus-ring flex items-center gap-3 border-b border-border-soft px-4 py-3 transition last:border-b-0 hover:bg-surface-2"
                  >
                    <span
                      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-2xs font-semibold"
                      style={{ background: contactTint.bg, color: contactTint.fg }}
                    >
                      {initials(contact.full_name)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-base font-medium">{contact.full_name}</span>
                      <span className="truncate text-xs text-ink-3">{contact.current_title ?? '—'}</span>
                    </span>
                    {contact.role && (
                      <Chip size="sm" tone={contact.role === 'champion' ? 'accent' : 'neutral'}>
                        {ROLE_LABEL[contact.role] ?? contact.role}
                      </Chip>
                    )}
                    <span className="w-[92px] text-right text-xs text-ink-3">
                      {touchLabel(contact.last_touch)}
                    </span>
                  </Link>
                );
              })
            )}
          </Card>

          <Card as="section">
            <header className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <SectionLabel>Deals</SectionLabel>
            </header>
            {company.deals.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-3">No deals yet.</p>
            ) : (
              company.deals.map((deal) => (
                <div
                  key={deal.opportunity_id}
                  className="flex items-center gap-3.5 border-b border-border-soft px-4 py-3 last:border-b-0"
                >
                  <BdStageDot stage={deal.stage} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-medium">{deal.name}</span>
                    <span className="truncate text-xs text-ink-3">
                      {deal.closed_at
                        ? `Signed ${new Date(deal.closed_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : deal.expected_close
                          ? `Expected ${new Date(deal.expected_close).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : 'No close date'}
                      {deal.fee_percent != null && ` · ${deal.fee_percent}% fee`}
                    </span>
                  </span>
                  <span className="text-sm capitalize text-ink-2">{deal.stage}</span>
                  <span className="w-[74px] text-right font-serif text-lg">
                    {formatMoney(deal.est_annual_value)}
                  </span>
                </div>
              ))
            )}
          </Card>

          <Card as="section">
            <header className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <SectionLabel>Requisitions</SectionLabel>
            </header>
            {company.requisitions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-3">
                {company.relationship === 'client'
                  ? 'No requisitions yet.'
                  : 'Requisitions appear once a deal is signed.'}
              </p>
            ) : (
              company.requisitions.map((req) => (
                <Link
                  key={req.job_id}
                  to={`/jobs/${req.job_id}`}
                  className="focus-ring flex items-center gap-3.5 border-b border-border-soft px-4 py-3 transition last:border-b-0 hover:bg-surface-2"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-medium">{req.title}</span>
                    <span className="truncate text-xs text-ink-3">
                      {[req.location, req.department].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                  <span className="w-[104px] text-right text-sm text-ink-2">
                    {req.entry_count ?? 0} in pipeline
                  </span>
                </Link>
              ))
            )}
          </Card>
        </div>

        <ActivityTimeline
          activity={company.activity}
          subtitle={`${company.activity.length} touches`}
          perspective="company"
        />
      </div>
    </div>
  );
}
