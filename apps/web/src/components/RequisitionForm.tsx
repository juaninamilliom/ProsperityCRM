import { useState } from 'react';
import type { CompanyDTO, JobRequisitionDTO } from 'src/common';
import { Button, Field, SectionLabel } from './ui';

type JobStatus = 'open' | 'on_hold' | 'closed';

const STATUSES: { value: JobStatus; label: string; dot: string }[] = [
  { value: 'open', label: 'Open', dot: 'var(--ok-dot)' },
  { value: 'on_hold', label: 'On hold', dot: 'var(--warn-dot)' },
  { value: 'closed', label: 'Closed', dot: 'var(--off-dot)' },
];

export interface RequisitionFormValues {
  company_id: string | null;
  title: string;
  department: string | null;
  location: string | null;
  status: JobStatus;
  description: string | null;
  close_date: string | null;
  deal_amount: number | null;
}

interface RequisitionFormProps {
  job?: Partial<JobRequisitionDTO> & { job_id?: string };
  companies: Pick<CompanyDTO, 'company_id' | 'name'>[];
  /** Set when opened from a company page - there is nothing to pick. */
  companyId?: string;
  onSubmit: (values: RequisitionFormValues) => void;
  onClose: () => void;
  pending?: boolean;
  error?: string | null;
}

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/** deal_amount is numeric in Postgres and arrives as a string; the API wants a
 *  number back, and '' would be rejected. */
function orNullNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function RequisitionForm({
  job,
  companies,
  companyId,
  onSubmit,
  onClose,
  pending,
  error,
}: RequisitionFormProps) {
  const isEdit = Boolean(job?.job_id);
  const [company, setCompany] = useState(companyId ?? job?.company_id ?? '');
  const [title, setTitle] = useState(job?.title ?? '');
  const [department, setDepartment] = useState(job?.department ?? '');
  const [location, setLocation] = useState(job?.location ?? '');
  const [status, setStatus] = useState<JobStatus>((job?.status as JobStatus) ?? 'open');
  const [description, setDescription] = useState(job?.description ?? '');
  const [closeDate, setCloseDate] = useState((job?.close_date ?? '').slice(0, 10));
  const [fee, setFee] = useState(job?.deal_amount != null ? String(job.deal_amount) : '');

  const resolvedCompany = companyId ?? company;

  function submit() {
    if (!title.trim()) return;
    onSubmit({
      company_id: resolvedCompany || null,
      title: title.trim(),
      department: orNull(department),
      location: orNull(location),
      status,
      description: orNull(description),
      close_date: orNull(closeDate),
      deal_amount: orNullNumber(fee),
    });
  }

  return (
    <div className="flex max-h-[86vh] w-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop">
      <header className="flex items-center justify-between gap-4 border-b border-border-soft px-5 pb-4 pt-4.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-serif text-[21px] tracking-[-0.01em]">
            {isEdit ? 'Edit requisition' : 'New requisition'}
          </h2>
          <span className="text-sm text-ink-3">A requisition belongs to a client company.</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="focus-ring flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-ink-3 hover:bg-surface-3"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="flex flex-col gap-4.5 overflow-y-auto px-5 py-4.5">
        {!companyId && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="req-company" className="text-sm font-medium text-ink-2">
              Company
            </label>
            <select
              id="req-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink"
            >
              <option value="">Choose a company…</option>
              {companies.map((entry) => (
                <option key={entry.company_id} value={entry.company_id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Platform Engineer" />

        <div className="flex flex-col gap-2">
          <SectionLabel>Status</SectionLabel>
          <div className="flex items-center gap-0.5 rounded-control bg-surface-3 p-0.5">
            {STATUSES.map((entry) => {
              const on = status === entry.value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStatus(entry.value)}
                  className={[
                    'focus-ring flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-[7px] text-sm font-medium transition',
                    on ? 'bg-surface text-ink shadow-pop' : 'text-ink-2',
                  ].join(' ')}
                >
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: entry.dot }}
                  />
                  {entry.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Engineering" />
          <Field label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Austin, TX" />
          <Field label="Fee" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="42000" />
          <Field label="Close date" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
        </div>

        <Field as="textarea" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

        {error && (
          <p className="rounded-control border border-warn-dot bg-warn-bg px-3 py-2 text-sm text-warn-fg">
            {error}
          </p>
        )}
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-border-soft bg-surface-2 px-5 py-3.5">
        <Button onClick={onClose} className="h-[34px]">
          Cancel
        </Button>
        <Button
          variant="primary"
          className="h-[34px] whitespace-nowrap"
          onClick={submit}
          disabled={!title.trim() || pending}
        >
          {isEdit ? 'Save changes' : 'Create requisition'}
        </Button>
      </footer>
    </div>
  );
}
