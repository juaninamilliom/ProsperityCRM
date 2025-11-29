import type { AgencyDTO, JobRequisitionDTO, OrganizationSkillDTO, StatusDTO } from 'src/common';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Select, { type MultiValue, type StylesConfig } from 'react-select';
import { useFiltersStore } from '../store/filters';
import type { Theme } from '../theme';

interface FilterBarProps {
  agencies: AgencyDTO[];
  jobs: JobRequisitionDTO[];
  statuses: StatusDTO[];
  skills: OrganizationSkillDTO[];
  skillsLoading?: boolean;
  skillsError?: boolean;
  theme: Theme;
}

type SelectOption = { value: string; label: string };

export function FilterBar({
  agencies,
  jobs,
  statuses,
  skills,
  skillsLoading = false,
  skillsError = false,
  theme,
}: FilterBarProps) {
  const {
    selectedAgency,
    flagQuery,
    jobId,
    statusId,
    searchTerm,
    skillFilters,
    setAgency,
    setFlagQuery,
    setJobId,
    setStatusId,
    setSearchTerm,
    setSkillFilters,
  } = useFiltersStore();
  const [localSearch, setLocalSearch] = useState(searchTerm ?? '');

  const agencyOptions = useMemo(
    () => [
      { value: '', label: 'All' },
      ...agencies.map((a) => ({ value: a.agency_id, label: a.name })),
    ],
    [agencies],
  );
  const jobOptions = useMemo(
    () => [{ value: '', label: 'All' }, ...jobs.map((j) => ({ value: j.job_id, label: j.title }))],
    [jobs],
  );
  const statusOptions = useMemo(
    () => [
      { value: '', label: 'All' },
      ...statuses.map((s) => ({ value: s.status_id, label: s.name })),
    ],
    [statuses],
  );
  const skillOptions = useMemo(
    () => skills.map((skill) => ({ value: skill.name, label: skill.name })),
    [skills],
  );

  const singleSelectStyles: StylesConfig<SelectOption, false> = {
    control: (provided, state) => ({
      ...provided,
      borderRadius: 9999,
      minHeight: '2rem',
      fontSize: '0.875rem',
      borderColor: state.isFocused
        ? theme === 'dark'
          ? '#6366f1' // indigo-500
          : '#2563eb' // blue-600
        : theme === 'dark'
        ? '#475569' // slate-600
        : 'rgb(226 232 240 / var(--tw-border-opacity))', // slate-200
      boxShadow: 'none',
      ':hover': {
        borderColor: theme === 'dark' ? '#6366f1' : '#2563eb',
      },
      backgroundColor: 'transparent',
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: 16,
      // Removed marginTop: 8 to align dropdown directly under the control
      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', // slate-800 / white
      color: theme === 'dark' ? '#e2e8f0' : '#0f172a', // slate-200 / slate-900
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isFocused
        ? theme === 'dark'
          ? '#475569' // slate-600
          : '#e0f2fe' // blue-50
        : provided.backgroundColor,
      color: state.isSelected
        ? theme === 'dark'
          ? '#e2e8f0' // slate-200
          : '#1d4ed8' // blue-800
        : theme === 'dark'
        ? '#e2e8f0' // slate-200
        : '#0f172a', // slate-900
      ':active': {
        backgroundColor: theme === 'dark' ? '#334155' : '#bfdbfe', // slate-700 / blue-200
      },
    }),
  };

  const skillSelectStyles: StylesConfig<SelectOption, true> = {
    ...singleSelectStyles,
    multiValue: (provided) => ({
      ...provided,
      borderRadius: 9999,
      backgroundColor: theme === 'dark' ? '#334155' : 'rgba(59,130,246,0.15)', // slate-700 / blue-500/15
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: theme === 'dark' ? '#e2e8f0' : '#1d4ed8', // slate-200 / blue-800
      fontWeight: 600,
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      borderRadius: 9999,
      ':hover': {
        backgroundColor: theme === 'dark' ? '#475569' : '#2563eb', // slate-600 / blue-600
        color: '#fff',
      },
    }),
  };
  const selectSkillValue = skillOptions.filter((option) => skillFilters.includes(option.value));

  useEffect(() => {
    setLocalSearch(searchTerm ?? '');
  }, [searchTerm]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchTerm(localSearch || undefined);
    }, 250);
    return () => clearTimeout(handle);
  }, [localSearch, setSearchTerm]);

  function onAgencyChange(option: SelectOption | null) {
    setAgency(option?.value || undefined);
  }

  function onFlagChange(event: ChangeEvent<HTMLInputElement>) {
    setFlagQuery(event.currentTarget.value || undefined);
  }

  function onJobChange(option: SelectOption | null) {
    setJobId(option?.value || undefined);
  }

  function onStatusChange(option: SelectOption | null) {
    setStatusId(option?.value || undefined);
  }

  function onSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setLocalSearch(event.currentTarget.value);
  }

  function onSkillSelectChange(options: MultiValue<SelectOption>) {
    const selected = options.map((option) => option.value);
    setSkillFilters(selected);
  }

  return (
    <div className="space-y-4 rounded-card bg-brand-blue/5 p-4 shadow-soft ring-1 ring-white/40 dark:bg-slate-900/70">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          width="24"
          height="24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m19 19-3.5-3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="11"
            cy="11"
            r="6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <input
          className="w-full rounded-full bg-white/80 py-3 pl-10 pr-4 text-lg text-slate-800 shadow-soft focus:outline-none focus:ring-2 focus:ring-brand-blue/70 dark:bg-slate-800/80 dark:text-white"
          type="search"
          placeholder="Search candidates by name, email, job title…"
          value={localSearch}
          onChange={onSearchChange}
        />
      </div>

      <div className="flex flex-wrap gap-4 pb-4">
        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400 min-w-[200px]">
          <span className="font-medium pl-4">Agency</span>
          <Select
            options={agencyOptions}
            value={agencyOptions.find((o) => o.value === selectedAgency)}
            onChange={onAgencyChange}
            styles={singleSelectStyles}
            classNamePrefix="skill-select"
            isClearable
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400 min-w-[200px]">
          <span className="font-medium pl-4">Job</span>
          <Select
            options={jobOptions}
            value={jobOptions.find((o) => o.value === jobId)}
            onChange={onJobChange}
            styles={singleSelectStyles}
            classNamePrefix="skill-select"
            isClearable
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400 min-w-[200px]">
          <span className="font-medium pl-4">Status</span>
          <Select
            options={statusOptions}
            value={statusOptions.find((o) => o.value === statusId)}
            onChange={onStatusChange}
            styles={singleSelectStyles}
            classNamePrefix="skill-select"
            isClearable
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium pl-4">Flag</span>
          <input
            className="pill-input py-2 text-sm"
            type="search"
            placeholder="Hot Prospect"
            value={flagQuery ?? ''}
            onChange={onFlagChange}
          />
        </label>
        <div className="flex flex-col gap-1 flex-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium pl-4">Skills</span>
          {skillsLoading ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 pl-4">Loading skills…</p>
          ) : skillsError ? (
            <p className="text-xs text-red-500 pl-4">Skills failed to load.</p>
          ) : skillOptions.length ? (
            <Select
              isMulti
              options={skillOptions}
              value={selectSkillValue}
              classNamePrefix="skill-select"
              onChange={onSkillSelectChange}
              placeholder="Filter by skill…"
              isDisabled={skillsError}
              styles={skillSelectStyles}
              className="min-w-[200px] flex-1"
            />
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 pl-4">
              No skills yet. Add them from the candidate form.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
