import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import Select, { type MultiValue, type StylesConfig } from 'react-select';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStatuses } from '../api/statuses';
import { fetchAgencies } from '../api/agencies';
import { fetchJobs } from '../api/jobs';
import { createCandidate } from '../api/candidates';
import { fetchCurrentUser } from '../api/users';
import { fetchSkills, createSkill } from '../api/skills';
import { formatPhone, isPhoneValid } from '../utils/phone';

type SkillOption = { value: string; label: string };

const skillSelectStyles: StylesConfig<SkillOption, true> = {
  control: (provided, state) => ({
    ...provided,
    borderRadius: 9999,
    minHeight: '2.75rem',
    borderColor: state.isFocused ? '#7c3aed' : provided.borderColor,
    boxShadow: 'none',
    ':hover': {
      borderColor: '#7c3aed',
    },
  }),
  valueContainer: (provided) => ({
    ...provided,
    paddingTop: '4px',
    paddingBottom: '4px',
  }),
  menu: (provided) => ({
    ...provided,
    borderRadius: 16,
  }),
  multiValue: (provided) => ({
    ...provided,
    borderRadius: 9999,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  }),
  multiValueLabel: (provided) => ({
    ...provided,
    color: '#047857',
    fontWeight: 600,
  }),
  multiValueRemove: (provided) => ({
    ...provided,
    borderRadius: 9999,
    ':hover': {
      backgroundColor: '#10b981',
      color: '#fff',
    },
  }),
};

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
  const skillOptions: SkillOption[] = useMemo(
    () => orgSkills.map((skill) => ({ value: skill.name, label: skill.name })),
    [orgSkills]
  );
  const selectedLibrarySkills = useMemo(
    () =>
      skillOptions.filter((option) =>
        form.skills.some((skill) => skill.toLowerCase() === option.value.toLowerCase())
      ),
    [skillOptions, form.skills]
  );
  const recruiterId = currentUser?.dbUser?.user_id ?? '';

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

  function handleSkillSelectChange(options: MultiValue<SkillOption>) {
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

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-700 dark:text-white">New Candidate</h2>
      <form className="glass-card flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Full Name
            <input
              className="pill-input"
              value={form.name}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, name: value }));
              }}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Email
            <input
              className="pill-input"
              type="email"
              value={form.email}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, email: value }));
              }}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Phone
            <input
              className="pill-input"
              value={form.phone}
              inputMode="tel"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const value = formatPhone(event.currentTarget.value);
                setForm((prev) => ({ ...prev, phone: value }));
                setPhoneError(!value.trim() || isPhoneValid(value) ? null : 'Format as (555) 123-4567.');
              }}
            />
            {phoneError && <span className="text-xs text-red-500">{phoneError}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Target Agency
            <select
              className="pill-select w-auto min-w-[12rem]"
              value={form.target_agency_id}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, target_agency_id: value }));
              }}
              required
            >
              <option value="" disabled>
                Select agency
              </option>
              {agencies.map((agency) => (
                <option key={agency.agency_id} value={agency.agency_id}>
                  {agency.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Job Requisition
            <select
              className="pill-select w-auto min-w-[12rem]"
              value={form.job_requisition_id}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, job_requisition_id: value }));
              }}
              required
            >
              <option value="" disabled>
                Select job
              </option>
              {jobs.map((job) => (
                <option key={job.job_id} value={job.job_id}>
                  {job.title}
                </option>
              ))}
            </select>
            {!jobs.length && <span className="text-xs text-amber-600">Create a job in Settings → Jobs first.</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Status
            <select
              className="pill-select w-auto min-w-[12rem]"
              value={form.current_status_id}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, current_status_id: value }));
              }}
              required
            >
              <option value="" disabled>
                Select status
              </option>
              {statuses.map((status) => (
                <option key={status.status_id} value={status.status_id}>
                  {status.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
          Notes
          <textarea
            className="pill-input rounded-lg"
            value={form.notes}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
              const { value } = event.currentTarget;
              setForm((prev) => ({ ...prev, notes: value }));
            }}
          />
        </label>

        <div className="space-y-3">
          <label className="text-sm font-medium">Skills</label>
          {form.skills.length ? (
            <ul className="flex flex-wrap gap-2 text-xs">
              {form.skills.map((skill) => (
                <li key={skill} className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:text-emerald-300">
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">No skills selected yet.</p>
          )}
          <div className="space-y-2 rounded-2xl bg-white/70 p-3 shadow-inner dark:bg-slate-900/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Select from library</p>
            {isSkillsLoading ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading available skills…</p>
            ) : skillsLoadFailed ? (
              <p className="text-xs text-red-500">Failed to load skills. Refresh to retry.</p>
            ) : skillOptions.length ? (
              <Select
                isMulti
                options={skillOptions}
                value={selectedLibrarySkills}
                classNamePrefix="skill-select"
                onChange={handleSkillSelectChange}
                placeholder="Search skills…"
                isDisabled={skillsLoadFailed}
                styles={skillSelectStyles}
              />
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">No saved skills. Add a new one below to get started.</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Add new skill</p>
            <div className="flex gap-2">
              <input
                className="pill-input flex-1"
                value={skillInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const { value } = event.currentTarget;
                  setSkillInput(value);
                }}
                onKeyDown={handleSkillInputKeyDown}
                placeholder="React, sourcing, bilingual…"
              />
              <button className="btn-outline whitespace-nowrap" type="button" onClick={addSkillToLibrary} disabled={addSkillMutation.isPending}>
                <span>{addSkillMutation.isPending ? 'Adding…' : 'Add to Library'}</span>
              </button>
            </div>
            {skillError && <p className="text-xs text-red-500">{skillError}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Flags</label>
          <div className="flex gap-2">
            <input
              className="pill-input flex-1"
              value={flagInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const { value } = event.currentTarget;
                setFlagInput(value);
              }}
              placeholder="Hot Prospect"
            />
            <button className="btn-outline" type="button" onClick={addFlag}>
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

        {successMessage && <p className="text-sm text-emerald-600">{successMessage}</p>}
        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

        <button className="btn-outline w-full" type="submit" disabled={isSubmitDisabled}>
          <span className="w-full">
            {!recruiterId ? 'Loading your account…' : 'Create Candidate'}
          </span>
        </button>
      </form>
    </section>
  );
}
