import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { CompanyDetailDTO } from 'src/common';
import { fetchCompany, updateCompany } from '../api/companies';
import { CompanyForm, type CompanyFormValues } from '../components/CompanyForm';
import { DealForm, type DealFormValues } from '../components/DealForm';
import { createOpportunity, updateOpportunity, moveStage } from '../api/opportunities';
import { createJob, updateJob } from '../api/jobs';
import { RequisitionForm, type RequisitionFormValues } from '../components/RequisitionForm';
import { PersonForm, type PersonFormValues } from '../components/PersonForm';
import { updatePerson } from '../api/people';
import { RowEditButton } from '../components/RowEditButton';
import { createActivity, type NewActivity } from '../api/activities';
import { ActivityComposer } from '../components/ActivityComposer';
import { Overlay } from '../components/Overlay';
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
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<CompanyDetailDTO['deals'][number] | null>(null);
  const [editingContact, setEditingContact] = useState<CompanyDetailDTO['contacts'][number] | null>(null);
  const [editingReq, setEditingReq] = useState<CompanyDetailDTO['requisitions'][number] | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const { data: company, isLoading } = useQuery({
    queryKey: ['companies', companyId],
    queryFn: () => fetchCompany(companyId!),
    enabled: Boolean(companyId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['companies', companyId] });
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const saveDeal = useMutation({
    mutationFn: async (values: DealFormValues) => {
      const id = editingDeal!.opportunity_id;
      // The plain update refuses a stage on purpose, so a stage move goes to
      // its own route - that is what promotes the company and logs the win.
      await updateOpportunity(id, {
        name: values.name,
        fee_percent: values.fee_percent,
        est_annual_value: values.est_annual_value,
        expected_close: values.expected_close,
      });
      if (values.stageChanged) await moveStage(id, values.stage, 'Closed from the company page');
    },
    onSuccess: () => {
      refresh();
      setEditingDeal(null);
    },
  });

  const saveContact = useMutation({
    mutationFn: (values: PersonFormValues) => updatePerson(editingContact!.person_id, values),
    onSuccess: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setEditingContact(null);
    },
  });

  const saveReq = useMutation({
    mutationFn: (values: RequisitionFormValues) =>
      editingReq ? updateJob(editingReq.job_id, values) : createJob(values),
    onSuccess: () => {
      refresh();
      setEditingReq(null);
      setReqOpen(false);
    },
  });

  const createDeal = useMutation({
    mutationFn: (values: DealFormValues) => createOpportunity(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', companyId] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setDealOpen(false);
    },
  });

  const saveCompany = useMutation({
    mutationFn: (values: CompanyFormValues) => updateCompany(companyId!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setEditOpen(false);
    },
  });

  const logActivity = useMutation({
    mutationFn: (activity: NewActivity) => createActivity(activity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', companyId] });
      setComposerOpen(false);
    },
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
            <Button className="h-[34px]" onClick={() => setDealOpen(true)}>
              New deal
            </Button>
            <Button className="h-[34px]" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="primary" className="h-[34px]" onClick={() => setComposerOpen(true)}>
              Log activity
            </Button>
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
                  <div
                    key={contact.person_id}
                    className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-b-0 hover:bg-surface-2"
                  >
                    <Link
                      to={`/people/${contact.person_id}`}
                      className="focus-ring flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span
                        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-2xs font-semibold"
                        style={{ background: contactTint.bg, color: contactTint.fg }}
                      >
                        {initials(contact.full_name)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-base font-medium">{contact.full_name}</span>
                        <span className="truncate text-xs text-ink-3">
                          {contact.current_title ?? '—'}
                        </span>
                      </span>
                    </Link>
                    {contact.role && (
                      <Chip size="sm" tone={contact.role === 'champion' ? 'accent' : 'neutral'}>
                        {ROLE_LABEL[contact.role] ?? contact.role}
                      </Chip>
                    )}
                    <span className="w-[92px] text-right text-xs text-ink-3">
                      {touchLabel(contact.last_touch)}
                    </span>
                    <RowEditButton
                      label={`Edit ${contact.full_name}`}
                      onClick={() => setEditingContact(contact)}
                    />
                  </div>
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
                  <RowEditButton label={`Edit ${deal.name}`} onClick={() => setEditingDeal(deal)} />
                </div>
              ))
            )}
          </Card>

          <Card as="section">
            <header className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <SectionLabel>Requisitions</SectionLabel>
              <button
                type="button"
                onClick={() => setReqOpen(true)}
                className="focus-ring rounded-[6px] text-sm font-medium text-accent hover:text-accent-ink"
              >
                New requisition
              </button>
            </header>
            {company.requisitions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-3">
                {company.relationship === 'client'
                  ? 'No requisitions yet.'
                  : 'Requisitions appear once a deal is signed.'}
              </p>
            ) : (
              company.requisitions.map((req) => (
                <div
                  key={req.job_id}
                  className="flex items-center gap-3.5 border-b border-border-soft px-4 py-3 last:border-b-0 hover:bg-surface-2"
                >
                  <Link
                    to={`/jobs/${req.job_id}`}
                    className="focus-ring flex min-w-0 flex-1 items-center gap-3.5"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-base font-medium">{req.title}</span>
                      <span className="truncate text-xs text-ink-3">
                        {[req.location, req.department].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                  </Link>
                  <span className="w-[104px] text-right text-sm text-ink-2">
                    {req.entry_count ?? 0} in pipeline
                  </span>
                  <RowEditButton label={`Edit ${req.title}`} onClick={() => setEditingReq(req)} />
                </div>
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

      <Overlay isOpen={Boolean(editingDeal)} onClose={() => setEditingDeal(null)} width={620}>
        {editingDeal && (
          <DealForm
            companies={[]}
            companyId={company.company_id}
            deal={editingDeal}
            pending={saveDeal.isPending}
            error={saveDeal.isError ? 'Could not save the deal. Try again.' : null}
            onSubmit={(values) => saveDeal.mutate(values)}
            onClose={() => setEditingDeal(null)}
          />
        )}
      </Overlay>

      <Overlay isOpen={Boolean(editingContact)} onClose={() => setEditingContact(null)} width={620}>
        {editingContact && (
          <PersonForm
            person={editingContact}
            companies={[{ company_id: company.company_id, name: company.name }]}
            pending={saveContact.isPending}
            error={saveContact.isError ? 'Could not save. Check the fields and try again.' : null}
            onSubmit={(values) => saveContact.mutate(values)}
            onClose={() => setEditingContact(null)}
          />
        )}
      </Overlay>

      <Overlay
        isOpen={reqOpen || Boolean(editingReq)}
        onClose={() => {
          setReqOpen(false);
          setEditingReq(null);
        }}
        width={620}
      >
        <RequisitionForm
          job={editingReq ?? undefined}
          companies={[]}
          companyId={company.company_id}
          pending={saveReq.isPending}
          error={saveReq.isError ? 'Could not save the requisition. Try again.' : null}
          onSubmit={(values) => saveReq.mutate(values)}
          onClose={() => {
            setReqOpen(false);
            setEditingReq(null);
          }}
        />
      </Overlay>

      <Overlay isOpen={dealOpen} onClose={() => setDealOpen(false)} width={620}>
        <DealForm
          companies={[]}
          companyId={company.company_id}
          pending={createDeal.isPending}
          error={createDeal.isError ? 'Could not create the deal. Check the fields and try again.' : null}
          onSubmit={(values) => createDeal.mutate(values)}
          onClose={() => setDealOpen(false)}
        />
      </Overlay>

      <Overlay isOpen={editOpen} onClose={() => setEditOpen(false)} width={620}>
        <CompanyForm
          company={company}
          pending={saveCompany.isPending}
          error={saveCompany.isError ? 'Could not save. Check the fields and try again.' : null}
          onSubmit={(values) => saveCompany.mutate(values)}
          onClose={() => setEditOpen(false)}
        />
      </Overlay>

      <Overlay isOpen={composerOpen} onClose={() => setComposerOpen(false)}>
        <ActivityComposer
          companyId={company.company_id}
          attachLabel={company.name}
          onSubmit={(activity) => logActivity.mutate(activity)}
          onClose={() => setComposerOpen(false)}
        />
      </Overlay>
    </div>
  );
}
