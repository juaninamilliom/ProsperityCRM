import { useState } from 'react';
import type { CompanyDTO, Relationship } from 'src/common';
import { Button, Field, SectionLabel } from './ui';

const RELATIONSHIPS: { value: Relationship; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'client', label: 'Client' },
  { value: 'former', label: 'Former' },
  { value: 'do_not_contact', label: 'Do not contact' },
];

export interface CompanyFormValues {
  name: string;
  domain: string | null;
  industry: string | null;
  headcount: string | null;
  location: string | null;
  linkedin_url: string | null;
  contact_email: string | null;
  notes: string | null;
  relationship: Relationship;
}

interface CompanyFormProps {
  /** Absent means create. */
  company?: Partial<CompanyDTO> & { company_id?: string };
  onSubmit: (values: CompanyFormValues) => void;
  onClose: () => void;
  pending?: boolean;
  error?: string | null;
}

/** An empty optional field must go to the API as null, not ''. The partial
 *  unique indexes on domain and linkedin_url only skip NULL, so two companies
 *  saved with a blank domain would collide on the second one. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function CompanyForm({ company, onSubmit, onClose, pending, error }: CompanyFormProps) {
  const isEdit = Boolean(company?.company_id);
  const [name, setName] = useState(company?.name ?? '');
  const [domain, setDomain] = useState(company?.domain ?? '');
  const [industry, setIndustry] = useState(company?.industry ?? '');
  const [headcount, setHeadcount] = useState(company?.headcount ?? '');
  const [location, setLocation] = useState(company?.location ?? '');
  const [linkedin, setLinkedin] = useState(company?.linkedin_url ?? '');
  const [contactEmail, setContactEmail] = useState(company?.contact_email ?? '');
  const [notes, setNotes] = useState(company?.notes ?? '');
  const [relationship, setRelationship] = useState<Relationship>(
    (company?.relationship as Relationship) ?? 'prospect',
  );

  function submit() {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      domain: orNull(domain),
      industry: orNull(industry),
      headcount: orNull(headcount),
      location: orNull(location),
      linkedin_url: orNull(linkedin),
      contact_email: orNull(contactEmail),
      notes: orNull(notes),
      relationship,
    });
  }

  return (
    <div className="flex max-h-[86vh] w-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop">
      <header className="flex items-center justify-between gap-4 border-b border-border-soft px-5 pb-4 pt-4.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-serif text-[21px] tracking-[-0.01em]">
            {isEdit ? 'Edit company' : 'New company'}
          </h2>
          <span className="text-sm text-ink-3">
            {isEdit
              ? 'Winning a deal sets the relationship to client on its own.'
              : 'A new company starts as a prospect.'}
          </span>
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
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Northwind Robotics" />

        <div className="flex flex-col gap-2">
          <SectionLabel>Relationship</SectionLabel>
          <div className="flex items-center gap-0.5 rounded-control bg-surface-3 p-0.5">
            {RELATIONSHIPS.map((entry) => {
              const on = relationship === entry.value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRelationship(entry.value)}
                  className={[
                    'focus-ring h-[30px] flex-1 rounded-[7px] text-sm font-medium transition',
                    on ? 'bg-surface text-ink shadow-pop' : 'text-ink-2',
                  ].join(' ')}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="northwind-robotics.com" />
          <Field label="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Robotics" />
          <Field label="Headcount" value={headcount} onChange={(e) => setHeadcount(e.target.value)} placeholder="51-200" />
          <Field label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Pittsburgh, PA" />
        </div>

        <Field
          label="LinkedIn"
          hint="Normalised on save"
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          placeholder="linkedin.com/company/northwind-robotics"
        />
        <Field
          label="Contact email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="hiring@northwind-robotics.com"
        />
        <Field as="textarea" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

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
          disabled={!name.trim() || pending}
        >
          {isEdit ? 'Save changes' : 'Create company'}
        </Button>
      </footer>
    </div>
  );
}
