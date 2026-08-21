import { useState } from 'react';
import type { CompanyDTO, PersonDTO } from 'src/common';
import { Button, Field } from './ui';

export interface PersonFormValues {
  full_name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  headline: string | null;
  location: string | null;
  current_company_id: string | null;
  current_title: string | null;
  skills: string[];
}

interface PersonFormProps {
  person?: Partial<PersonDTO> & { person_id?: string };
  companies: Pick<CompanyDTO, 'company_id' | 'name'>[];
  onSubmit: (values: PersonFormValues) => void;
  onClose: () => void;
  pending?: boolean;
  error?: string | null;
}

/** people.email and people.linkedin_url carry partial unique indexes, which
 *  skip NULL but not ''. Two people saved with a blank field would collide. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function PersonForm({
  person,
  companies,
  onSubmit,
  onClose,
  pending,
  error,
}: PersonFormProps) {
  const isEdit = Boolean(person?.person_id);
  const [fullName, setFullName] = useState(person?.full_name ?? '');
  const [email, setEmail] = useState(person?.email ?? '');
  const [phone, setPhone] = useState(person?.phone ?? '');
  const [linkedin, setLinkedin] = useState(person?.linkedin_url ?? '');
  const [headline, setHeadline] = useState(person?.headline ?? '');
  const [location, setLocation] = useState(person?.location ?? '');
  const [companyId, setCompanyId] = useState(person?.current_company_id ?? '');
  const [title, setTitle] = useState(person?.current_title ?? '');
  const [skills, setSkills] = useState((person?.skills ?? []).join(', '));

  function submit() {
    if (!fullName.trim()) return;
    onSubmit({
      full_name: fullName.trim(),
      email: orNull(email),
      phone: orNull(phone),
      linkedin_url: orNull(linkedin),
      headline: orNull(headline),
      location: orNull(location),
      current_company_id: companyId || null,
      current_title: orNull(title),
      skills: skills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
    });
  }

  return (
    <div className="flex max-h-[86vh] w-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop">
      <header className="flex items-center justify-between gap-4 border-b border-border-soft px-5 pb-4 pt-4.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-serif text-[21px] tracking-[-0.01em]">
            {isEdit ? 'Edit person' : 'Add person'}
          </h2>
          <span className="text-sm text-ink-3">
            One record whether they are a candidate, a contact, or both.
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
        <Field label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nadia Brooks" />
        <Field
          label="LinkedIn"
          hint="Normalised on save"
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          placeholder="linkedin.com/in/nadiabrooks"
        />
        <Field label="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="VP Engineering at Meridian" />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" type="email" hint="Optional" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nadia@example.com" />
          <Field label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-0101" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="person-company" className="text-sm font-medium text-ink-2">
              Current company
            </label>
            <select
              id="person-company"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink"
            >
              <option value="">None</option>
              {companies.map((entry) => (
                <option key={entry.company_id} value={entry.company_id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
          <Field label="Current title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VP Engineering" />
        </div>

        <Field label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Austin, TX" />
        <Field
          label="Skills"
          hint="Comma separated"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="Go, Kubernetes, Postgres"
        />

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
          disabled={!fullName.trim() || pending}
        >
          {isEdit ? 'Save changes' : 'Add person'}
        </Button>
      </footer>
    </div>
  );
}
