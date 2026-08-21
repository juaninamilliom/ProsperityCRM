import { useState } from 'react';
import type { CompanyDTO, OpportunityDTO, OpportunityStage } from 'src/common';
import { Button, Field, SectionLabel, bdStageToken } from './ui';

const OPEN_STAGES: { value: OpportunityStage; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
];

/** On create the terminal stages are absent: a deal born signed would never
 *  promote its company or log the win, because only the stage route does
 *  either. On edit they are offered, and the caller routes the change there. */
const CLOSING_STAGES: { value: OpportunityStage; label: string }[] = [
  { value: 'signed', label: 'Signed' },
  { value: 'lost', label: 'Lost' },
];

export interface DealFormValues {
  company_id: string;
  name: string;
  stage: OpportunityStage;
  /** True when the stage actually moved, so the caller knows to send it to
   *  PATCH /:id/stage rather than the plain update, which refuses a stage. */
  stageChanged: boolean;
  fee_percent: number | null;
  est_annual_value: number | null;
  expected_close: string | null;
}

interface DealFormProps {
  companies: Pick<CompanyDTO, 'company_id' | 'name'>[];
  /** When the deal is being created from a company page there is nothing to pick. */
  companyId?: string;
  /** Absent means create. */
  deal?: Partial<OpportunityDTO> & { opportunity_id?: string };
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
  deal,
  onSubmit,
  onClose,
  pending,
  error,
}: DealFormProps) {
  const isEdit = Boolean(deal?.opportunity_id);
  const originalStage = (deal?.stage as OpportunityStage) ?? 'prospect';
  const [company, setCompany] = useState(companyId ?? deal?.company_id ?? '');
  const [name, setName] = useState(deal?.name ?? '');
  const [stage, setStage] = useState<OpportunityStage>(originalStage);
  const [fee, setFee] = useState(deal?.fee_percent != null ? String(deal.fee_percent) : '');
  const [value, setValue] = useState(
    deal?.est_annual_value != null ? String(deal.est_annual_value) : '',
  );
  const [close, setClose] = useState((deal?.expected_close ?? '').slice(0, 10));

  const resolvedCompany = companyId ?? company;
  const stages = isEdit ? [...OPEN_STAGES, ...CLOSING_STAGES] : OPEN_STAGES;

  function submit() {
    if (!name.trim() || !resolvedCompany) return;
    onSubmit({
      company_id: resolvedCompany,
      name: name.trim(),
      stage,
      stageChanged: isEdit && stage !== originalStage,
      fee_percent: orNullNumber(fee),
      est_annual_value: orNullNumber(value),
      expected_close: close.trim() || null,
    });
  }

  return (
    <div className="flex max-h-[86vh] w-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop">
      <header className="flex items-center justify-between gap-4 border-b border-border-soft px-5 pb-4 pt-4.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-serif text-[21px] tracking-[-0.01em]">
            {isEdit ? 'Edit deal' : 'New deal'}
          </h2>
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
        {!companyId && !isEdit && (
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
          <div className="flex flex-wrap items-center gap-0.5 rounded-control bg-surface-3 p-0.5">
            {stages.map((entry) => {
              const on = stage === entry.value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStage(entry.value)}
                  className={[
                    'focus-ring flex h-[30px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 text-sm font-medium transition',
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
          {isEdit ? 'Save changes' : 'Create deal'}
        </Button>
      </footer>
    </div>
  );
}
