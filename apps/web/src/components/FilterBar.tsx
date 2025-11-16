import type { AgencyDTO, JobRequisitionDTO, OrganizationSkillDTO, StatusDTO } from 'src/common';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Select, { type MultiValue, type StylesConfig } from 'react-select';
import { useFiltersStore } from '../store/filters';

interface FilterBarProps {
  agencies: AgencyDTO[];
  jobs: JobRequisitionDTO[];
  statuses: StatusDTO[];
  skills: OrganizationSkillDTO[];
  skillsLoading?: boolean;
  skillsError?: boolean;
}

export function FilterBar({ agencies, jobs, statuses, skills, skillsLoading = false, skillsError = false }: FilterBarProps) {
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
  const skillOptions = useMemo(
    () => skills.map((skill) => ({ value: skill.name, label: skill.name })),
    [skills]
  );
  const skillSelectStyles: StylesConfig<{ value: string; label: string }, true> = {
    control: (provided, state) => ({
      ...provided,
      borderRadius: 9999,
      minHeight: '2.5rem',
      borderColor: state.isFocused ? '#2563eb' : provided.borderColor,
      boxShadow: 'none',
      ':hover': {
        borderColor: '#2563eb',
      },
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: 16,
    }),
    multiValue: (provided) => ({
      ...provided,
      borderRadius: 9999,
      backgroundColor: 'rgba(59,130,246,0.15)',
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: '#1d4ed8',
      fontWeight: 600,
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      borderRadius: 9999,
      ':hover': {
        backgroundColor: '#2563eb',
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

  function onAgencyChange(event: ChangeEvent<HTMLSelectElement>) {
    setAgency(event.currentTarget.value || undefined);
  }

  function onFlagChange(event: ChangeEvent<HTMLInputElement>) {
    setFlagQuery(event.currentTarget.value || undefined);
  }

  function onJobChange(event: ChangeEvent<HTMLSelectElement>) {
    setJobId(event.currentTarget.value || undefined);
  }

  function onStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    setStatusId(event.currentTarget.value || undefined);
  }

  function onSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setLocalSearch(event.currentTarget.value);
  }

  function onSkillSelectChange(options: MultiValue<{ value: string; label: string }>) {
    const selected = options.map((option) => option.value);
    setSkillFilters(selected);
  }

  return (
    <div className="flex flex-wrap gap-4 rounded-card bg-brand-blue/5 p-4 shadow-soft ring-1 ring-white/40 dark:bg-slate-900/70">
      <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
        <span className="font-medium">Target Agency</span>
        <select className="pill-select" value={selectedAgency ?? ''} onChange={onAgencyChange}>
          <option value="">All</option>
          {agencies.map((agency) => (
            <option key={agency.agency_id} value={agency.agency_id}>
              {agency.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
        <span className="font-medium">Flag</span>
        <input className="pill-input" type="search" placeholder="Hot Prospect" value={flagQuery ?? ''} onChange={onFlagChange} />
      </label>
      <div className="flex flex-1 flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
        <span className="font-medium">Skills</span>
        {skillsLoading ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading skills…</p>
        ) : skillsError ? (
          <p className="text-xs text-red-500">Skills failed to load.</p>
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
          />
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">No skills yet. Add them from the candidate form.</p>
        )}
        {skillFilters.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {skillFilters.map((skill) => (
              <li key={skill} className="rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-semibold text-brand-blue">
                {skill}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">Selected skills show here.</p>
        )}
      </div>
      <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
        <span className="font-medium">Job</span>
        <select className="pill-select" value={jobId ?? ''} onChange={onJobChange}>
          <option value="">All</option>
          {jobs.map((job) => (
            <option key={job.job_id} value={job.job_id}>
              {job.title}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
        <span className="font-medium">Status</span>
        <select className="pill-select" value={statusId ?? ''} onChange={onStatusChange}>
          <option value="">All</option>
          {statuses.map((status) => (
            <option key={status.status_id} value={status.status_id}>
              {status.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
        <span className="font-medium">Search</span>
        <input className="pill-input" type="search" placeholder="Name, email, job…" value={localSearch} onChange={onSearchChange} />
      </label>
    </div>
  );
}
