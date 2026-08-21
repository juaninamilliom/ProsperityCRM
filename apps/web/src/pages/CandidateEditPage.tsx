import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchStatuses } from '../api/statuses';
import { fetchCompanies } from '../api/companies';
import { fetchJobs } from '../api/jobs';
import { fetchEntry, updateEntry } from '../api/entries';
import { updatePerson } from '../api/people';
import { fetchSkills, createSkill } from '../api/skills';
import Select, { type MultiValue } from 'react-select';
import { formatPhone, isPhoneValid } from '../utils/phone';
import { useTheme } from '../theme';
import { getSelectStyles, getMultiSelectStyles } from '../components/selectStyles';
import { Button, Card, SectionLabel } from '../components/ui';

type SelectOption = { value: string; label: string };

export function CandidateEditPage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [theme] = useTheme();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company_id: '',
    current_status_id: '',
    job_id: '',
    notes: '',
    flags: [] as string[],
    skills: [] as string[],
  });
  const [flagInput, setFlagInput] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [skillError, setSkillError] = useState<string | null>(null);

  const candidateQuery = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: () => fetchEntry(candidateId!),
    enabled: Boolean(candidateId),
  });
  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: fetchStatuses });
  const { data: agencies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => fetchCompanies() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: fetchJobs });
  const {
    data: orgSkills = [],
    isLoading: isSkillsLoading,
    error: skillsErrorState,
  } = useQuery({ queryKey: ['skills'], queryFn: fetchSkills });
  const skillsLoadFailed = Boolean(skillsErrorState);

  const agencyOptions = useMemo(
    () => agencies.map((a) => ({ value: a.company_id, label: a.name })),
    [agencies],
  );
  const jobOptions = useMemo(() => jobs.map((j) => ({ value: j.job_id, label: j.title })), [jobs]);
  const statusOptions = useMemo(
    () => statuses.map((s) => ({ value: s.status_id, label: s.name })),
    [statuses],
  );
  const skillOptions: SelectOption[] = useMemo(
    () => orgSkills.map((skill) => ({ value: skill.name, label: skill.name })),
    [orgSkills],
  );
  const selectedLibrarySkills = useMemo(
    () =>
      skillOptions.filter((option) =>
        form.skills.some((skill) => skill.toLowerCase() === option.value.toLowerCase()),
      ),
    [skillOptions, form.skills],
  );

  const selectStyles = getSelectStyles(theme);
  const multiSelectStyles = getMultiSelectStyles(theme);

  useEffect(() => {
    if (!candidateQuery.data) return;
    const candidate = candidateQuery.data;
    setForm({
      name: candidate.full_name,
      email: candidate.email ?? '',
      phone: candidate.phone ?? '',
      company_id: candidate.company_id,
      current_status_id: candidate.current_status_id,
      job_id: candidate.job_id ?? '',
      notes: candidate.notes ?? '',
      flags: candidate.flags ?? [],
      skills: candidate.skills ?? [],
    });
  }, [candidateQuery.data]);

  const updateMutation = useMutation({
    // Name, email, phone and skills belong to the person; the company, status,
    // requisition, flags and notes belong to this particular pitch.
    mutationFn: async () => {
      const personId = candidateQuery.data?.person_id;
      if (personId) {
        await updatePerson(personId, {
          full_name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          skills: form.skills,
        });
      }
      return updateEntry(candidateId!, {
        company_id: form.company_id,
        current_status_id: form.current_status_id,
        job_id: form.job_id || null,
        flags: form.flags,
        notes: form.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
      navigate('/');
    },
  });

  const addSkillMutation = useMutation({
    mutationFn: (name: string) => createSkill(name),
    onSuccess: (skill) => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      setForm((prev) => {
        if (prev.skills.includes(skill.name)) {
          return prev;
        }
        return { ...prev, skills: [...prev.skills, skill.name] };
      });
      setSkillInput('');
      setSkillError(null);
    },
    onError: () => {
      setSkillError('Failed to add skill. Please try again.');
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!candidateId) return;
    if (form.phone && !isPhoneValid(form.phone)) {
      setPhoneError('Enter a valid phone number.');
      return;
    }
    setPhoneError(null);
    updateMutation.mutate();
  }

  function addFlag() {
    if (!flagInput.trim()) return;
    setForm((prev) => ({ ...prev, flags: [...prev.flags, flagInput.trim()] }));
    setFlagInput('');
  }

  function removeFlag(flag: string) {
    setForm((prev) => ({ ...prev, flags: prev.flags.filter((item) => item !== flag) }));
  }

  function removeSkill(skill: string) {
    setForm((prev) => ({ ...prev, skills: prev.skills.filter((item) => item !== skill) }));
  }

  function handleSkillSelectChange(options: MultiValue<SelectOption>) {
    const selected = options.map((option) => option.value);
    setForm((prev) => ({ ...prev, skills: selected }));
  }

  function addSkillToLibrary() {
    if (!skillInput.trim()) return;
    setSkillError(null);
    addSkillMutation.mutate(skillInput.trim());
  }

  function handleSkillInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSkillToLibrary();
    }
  }

  if (candidateQuery.isLoading) {
    return <p className="text-sm text-ink-3">Loading candidate…</p>;
  }

  if (!candidateQuery.data) {
    return <p className="text-sm text-warn-fg">Candidate not found.</p>;
  }

  return (
    <section className="flex max-w-[860px] flex-col gap-5">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="focus-ring flex items-center gap-1.5 self-start text-sm text-ink-2 transition hover:text-ink"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-title">Edit candidate</h1>
        <p className="text-base text-ink-2">{candidateQuery.data.full_name}</p>
      </div>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <Card className="flex flex-col gap-4 p-5">
          <SectionLabel>Basics</SectionLabel>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
              Full Name
              <input
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                value={form.name}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const { value } = event.currentTarget;
                  setForm((prev) => ({ ...prev, name: value }));
                }}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
              Email
              <input
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                type="email"
                value={form.email}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const { value } = event.currentTarget;
                  setForm((prev) => ({ ...prev, email: value }));
                }}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
              Phone
              <input
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                value={form.phone}
                inputMode="tel"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const value = formatPhone(event.currentTarget.value);
                  setForm((prev) => ({ ...prev, phone: value }));
                  setPhoneError(
                    !value.trim() || isPhoneValid(value) ? null : 'Format as (555) 123-4567.',
                  );
                }}
              />
              {phoneError && <span className="text-xs text-warn-fg">{phoneError}</span>}
            </label>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <SectionLabel>Assignment</SectionLabel>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
              Target Agency
              <Select
                options={agencyOptions}
                value={agencyOptions.find((o) => o.value === form.company_id)}
                onChange={(option) =>
                  setForm((prev) => ({ ...prev, company_id: option?.value ?? '' }))
                }
                styles={selectStyles}
                classNamePrefix="skill-select"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
              Job Requisition
              <Select
                options={jobOptions}
                value={jobOptions.find((o) => o.value === form.job_id)}
                onChange={(option) =>
                  setForm((prev) => ({ ...prev, job_id: option?.value ?? '' }))
                }
                styles={selectStyles}
                classNamePrefix="skill-select"
                required
              />
              {!jobs.length && (
                <span className="text-xs text-warn-fg">Create a job in Settings → Jobs first.</span>
              )}
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
              Status
              <Select
                options={statusOptions}
                value={statusOptions.find((o) => o.value === form.current_status_id)}
                onChange={(option) =>
                  setForm((prev) => ({ ...prev, current_status_id: option?.value ?? '' }))
                }
                styles={selectStyles}
                classNamePrefix="skill-select"
                required
              />
            </label>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <SectionLabel>Notes</SectionLabel>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
            <textarea
              className="focus-ring min-h-[96px] w-full resize-none rounded-control border border-border bg-surface px-3 py-2.5 text-base leading-relaxed text-ink placeholder:text-ink-3"
              value={form.notes}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, notes: value }));
              }}
            />
          </label>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <SectionLabel>Skills</SectionLabel>
          <div className="space-y-3">
            {form.skills.length ? (
              <ul className="flex flex-wrap gap-2 text-xs">
                {form.skills.map((skill) => (
                  <li
                    key={skill}
                    className="inline-flex items-center gap-2 rounded-chip bg-accent-soft px-2.5 py-1 text-sm font-medium text-accent-ink"
                  >
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-3">No skills selected yet.</p>
            )}
            <div className="space-y-2 rounded-card bg-surface p-3 shadow-token">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                Select from library
              </p>
              {isSkillsLoading ? (
                <p className="text-xs text-ink-3">Loading available skills…</p>
              ) : skillsLoadFailed ? (
                <p className="text-xs text-warn-fg">Failed to load skills. Refresh to retry.</p>
              ) : skillOptions.length ? (
                <Select
                  isMulti
                  options={skillOptions}
                  value={selectedLibrarySkills}
                  classNamePrefix="skill-select"
                  onChange={handleSkillSelectChange}
                  placeholder="Search skills…"
                  isDisabled={skillsLoadFailed}
                  styles={multiSelectStyles}
                />
              ) : (
                <p className="text-xs text-ink-3">No saved skills. Add one below.</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                Add new skill
              </p>
              <div className="flex gap-2">
                <input
                  className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3 flex-1"
                  value={skillInput}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const { value } = event.currentTarget;
                    setSkillInput(value);
                  }}
                  onKeyDown={handleSkillInputKeyDown}
                  placeholder="React, sourcing, bilingual…"
                />
                <button
                  className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 font-medium text-ink transition hover:bg-surface-3 whitespace-nowrap"
                  type="button"
                  onClick={addSkillToLibrary}
                  disabled={addSkillMutation.isPending}
                >
                  <span>{addSkillMutation.isPending ? 'Adding…' : 'Add to Library'}</span>
                </button>
              </div>
              {skillError && <p className="text-xs text-warn-fg">{skillError}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Flags</label>
            <div className="flex gap-2">
              <input
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3 flex-1"
                value={flagInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const { value } = event.currentTarget;
                  setFlagInput(value);
                }}
                placeholder="Hot Prospect"
              />
              <button
                className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 font-medium text-ink transition hover:bg-surface-3"
                type="button"
                onClick={addFlag}
              >
                <span>Add Flag</span>
              </button>
            </div>
            <ul className="flex flex-wrap gap-2 text-xs">
              {form.flags.map((flag) => (
                <li
                  key={flag}
                  className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-brand dark:bg-brand/20"
                >
                  {flag}
                  <button type="button" onClick={() => removeFlag(flag)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={updateMutation.isPending || Boolean(phoneError) || !jobs.length}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </section>
  );
}
