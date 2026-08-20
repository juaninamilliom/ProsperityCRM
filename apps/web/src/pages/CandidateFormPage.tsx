import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import Select, { type MultiValue } from 'react-select';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStatuses } from '../api/statuses';
import { fetchAgencies } from '../api/agencies';
import { fetchJobs } from '../api/jobs';
import { createCandidate } from '../api/candidates';
import { fetchCurrentUser } from '../api/users';
import { fetchSkills, createSkill } from '../api/skills';
import { formatPhone, isPhoneValid } from '../utils/phone';
import { useTheme } from '../theme';
import { getSelectStyles, getMultiSelectStyles } from '../components/selectStyles';
import { useNavigate } from 'react-router-dom';
import { CandidateFormLayout } from '../components/CandidateFormLayout';
import { Card, Chip, SectionLabel } from '../components/ui';

type SelectOption = { value: string; label: string };

const initialState = {
  name: '',
  email: '',
  phone: '',
  target_agency_id: '',
  current_status_id: '',
  job_requisition_id: '',
  notes: '',
  flags: [] as string[],
  skills: [] as string[],
};

export function CandidateFormPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [theme] = useTheme();
  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: fetchStatuses });
  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: fetchAgencies });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: fetchJobs });
  const {
    data: orgSkills = [],
    isLoading: isSkillsLoading,
    error: skillsErrorState,
  } = useQuery({ queryKey: ['skills'], queryFn: fetchSkills });
  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: fetchCurrentUser });
  const [form, setForm] = useState(initialState);
  const [flagInput, setFlagInput] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [skillError, setSkillError] = useState<string | null>(null);
  const skillsLoadFailed = Boolean(skillsErrorState);
  const agencyOptions = useMemo(
    () => agencies.map((a) => ({ value: a.agency_id, label: a.name })),
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
  const recruiterId = currentUser?.dbUser?.user_id ?? '';

  const selectStyles = getSelectStyles(theme);
  const multiSelectStyles = getMultiSelectStyles(theme);

  const createMutation = useMutation({
    mutationFn: () =>
      createCandidate({
        ...form,
        recruiter_id: recruiterId,
        job_requisition_id: form.job_requisition_id || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setForm(initialState);
      setFlagInput('');
      setSkillInput('');
      setPhoneError(null);
      setSuccessMessage('Candidate created successfully.');
      setErrorMessage(null);
    },
    onError: () => {
      setErrorMessage('Failed to create candidate. Please check the form and try again.');
      setSuccessMessage(null);
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

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  const isSubmitDisabled =
    createMutation.isPending ||
    !recruiterId ||
    !jobs.length ||
    !form.name.trim() ||
    !form.email.trim() ||
    !form.target_agency_id ||
    !form.current_status_id ||
    !form.job_requisition_id ||
    Boolean(phoneError) ||
    (form.phone.trim() ? !isPhoneValid(form.phone) : false);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recruiterId) {
      return;
    }
    if (form.phone && !isPhoneValid(form.phone)) {
      setPhoneError('Enter a valid phone number.');
      return;
    }
    setPhoneError(null);
    createMutation.mutate();
  }

  const checklist = [
    { label: 'Name and email', done: Boolean(form.name && form.email) },
    { label: 'Assigned to a job', done: Boolean(form.job_requisition_id) },
    { label: 'At least one skill', done: form.skills.length > 0 },
    { label: 'Screening note', done: Boolean(form.notes.trim()) },
  ];

  const previewInitials =
    form.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?';

  const previewJob =
    jobOptions.find((option) => option.value === form.job_requisition_id)?.label ??
    'No job assigned yet';

  const previewStage =
    statusOptions.find((option) => option.value === form.current_status_id)?.label ?? 'the board';

  const saveHint = form.name
    ? `Saving adds ${form.name} to ${previewStage}.`
    : 'Add a name and email to save this candidate.';

  return (
    <form onSubmit={handleSubmit}>
      <CandidateFormLayout
        title="New candidate"
        subtitle="Only a name and email are required — everything else can wait until after the screen."
        checklist={checklist}
        saveHint={saveHint}
        submitting={createMutation.isPending}
        submitDisabled={isSubmitDisabled}
        submitLabel={!recruiterId ? 'Loading your account…' : 'Save candidate'}
        onCancel={() => navigate('/')}
        preview={
          <div className="flex flex-col gap-2 rounded-[11px] border border-border bg-surface p-3 shadow-token">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-ink">
                {previewInitials}
              </span>
              <span className="truncate text-sm font-semibold">{form.name || 'New candidate'}</span>
            </div>
            <span className="truncate text-xs text-ink-2">{previewJob}</span>
            <div className="flex flex-wrap gap-1">
              {form.skills.slice(0, 2).map((skill) => (
                <Chip key={skill} size="sm">
                  {skill}
                </Chip>
              ))}
            </div>
          </div>
        }
      >
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
                value={agencyOptions.find((o) => o.value === form.target_agency_id)}
                onChange={(option) =>
                  setForm((prev) => ({ ...prev, target_agency_id: option?.value ?? '' }))
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
                value={jobOptions.find((o) => o.value === form.job_requisition_id)}
                onChange={(option) =>
                  setForm((prev) => ({ ...prev, job_requisition_id: option?.value ?? '' }))
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
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-ok-fg dark:text-ok-fg"
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
            <div className="space-y-2 rounded-2xl bg-surface p-3 shadow-token dark:bg-surface-2">
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
                <p className="text-xs text-ink-3">
                  No saved skills. Add a new one below to get started.
                </p>
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
            <span className="text-sm font-medium text-ink-2">Flags</span>
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

        {successMessage && <p className="text-sm text-ok-fg">{successMessage}</p>}
        {errorMessage && <p className="text-sm text-warn-fg">{errorMessage}</p>}
      </CandidateFormLayout>
    </form>
  );
}
