import { useState } from 'react';
import type { CompanyDTO, OpportunityStage } from 'src/common';
import { Button, Field, SectionLabel, bdStageToken } from './ui';

/** signed and lost are deliberately absent: reaching signed promotes the
 *  company and logs the win, which only the stage route does. */
const OPENING_STAGES: { value: OpportunityStage; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
];

export interface DealFormValues {
  company_id: string;
  name: string;
  stage: OpportunityStage;
  fee_percent: number | null;
  est_annual_value: number | null;
  expected_close: string | null;
}

interface DealFormProps {
  companies: Pick<CompanyDTO, 'company_id' | 'name'>[];
  /** When the deal is being created from a company page there is nothing to pick. */
  companyId?: string;
  onSubmit: (values: DealFormValues) => void;
  onClose: () => void;
  pending?: boolean;
  error?: string | null;
}

/** The API types these as numbers; sending '' or a string fails validation
 *  with a 400 the user cannot act on. */
function orNullNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function DealForm({
  companies,
  companyId,
  onSubmit,
  onClose,
  pending,
  error,
}: DealFormProps) {
  const [company, setCompany] = useState(companyId ?? '');
  const [name, setName] = useState('');
  const [stage, setStage] = useState<OpportunityStage>('prospect');
  const [fee, setFee] = useState('');
  const [value, setValue] = useState('');
  const [close, setClose] = useState('');

  const resolvedCompany = companyId ?? company;

  function submit() {
    if (!name.trim() || !resolvedCompany) return;
    onSubmit({
      company_id: resolvedCompany,
      name: name.trim(),
      stage,
      fee_percent: orNullNumber(fee),
      est_annual_value: orNullNumber(value),
      expected_close: close.trim() || null,
    });
  }

  return (
    <div className="flex max-h-[86vh] w-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop">
      <header className="flex items-center justify-between gap-4 border-b border-border-soft px-5 pb-4 pt-4.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-serif text-[21px] tracking-[-0.01em]">New deal</h2>
          <span className="text-sm text-ink-3">Winning it turns the company into a client.</span>
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
            <label htmlFor="deal-company" className="text-sm font-medium text-ink-2">
              Company
            </label>
            <select
              id="deal-company"
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

        <Field
          label="Deal name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Engineering retainer"
        />

        <div className="flex flex-col gap-2">
          <SectionLabel>Stage</SectionLabel>
          <div className="flex items-center gap-0.5 rounded-control bg-surface-3 p-0.5">
            {OPENING_STAGES.map((entry) => {
              const on = stage === entry.value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStage(entry.value)}
                  className={[
                    'focus-ring flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-[7px] text-sm font-medium transition',
                    on ? 'bg-surface text-ink shadow-pop' : 'text-ink-2',
                  ].join(' ')}
                >
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: bdStageToken(entry.value) }}
                  />
                  {entry.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Fee %" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="22" />
          <Field label="Est. annual value" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="96000" />
          <Field label="Expected close" type="date" value={close} onChange={(e) => setClose(e.target.value)} />
        </div>

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
          disabled={!name.trim() || !resolvedCompany || pending}
        >
          Create deal
        </Button>
      </footer>
    </div>
  );
}
