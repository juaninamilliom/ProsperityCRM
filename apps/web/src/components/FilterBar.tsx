import type { AgencyDTO, JobRequisitionDTO, OrganizationSkillDTO, StatusDTO } from 'src/common';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Select, { type MultiValue } from 'react-select';
import { useFiltersStore } from '../store/filters';
import type { Theme } from '../theme';
import { getSelectStyles, getMultiSelectStyles } from './selectStyles';

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

  const selectStyles = getSelectStyles(theme);
  const multiSelectStyles = getMultiSelectStyles(theme);
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
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
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
          className="focus-ring h-9 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-base text-ink placeholder:text-ink-3"
          type="search"
          placeholder="Search candidates by name, email, job title…"
          value={localSearch}
          onChange={onSearchChange}
        />
      </div>

      <div className="flex flex-wrap gap-4 pb-4">
        <label className="flex min-w-[200px] flex-col gap-1.5 text-sm font-medium text-ink-2">
          <span className="font-medium">Agency</span>
          <Select
            options={agencyOptions}
            value={agencyOptions.find((o) => o.value === selectedAgency)}
            onChange={onAgencyChange}
            styles={selectStyles}
            classNamePrefix="skill-select"
            isClearable
          />
        </label>
        <label className="flex min-w-[200px] flex-col gap-1.5 text-sm font-medium text-ink-2">
          <span className="font-medium">Job</span>
          <Select
            options={jobOptions}
            value={jobOptions.find((o) => o.value === jobId)}
            onChange={onJobChange}
            styles={selectStyles}
            classNamePrefix="skill-select"
            isClearable
          />
        </label>
        <label className="flex min-w-[200px] flex-col gap-1.5 text-sm font-medium text-ink-2">
          <span className="font-medium">Status</span>
          <Select
            options={statusOptions}
            value={statusOptions.find((o) => o.value === statusId)}
            onChange={onStatusChange}
            styles={selectStyles}
            classNamePrefix="skill-select"
            isClearable
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
          <span className="font-medium">Flag</span>
          <input
            className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
            type="search"
            placeholder="Hot Prospect"
            value={flagQuery ?? ''}
            onChange={onFlagChange}
          />
        </label>
        <div className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-ink-2">
          <span className="font-medium">Skills</span>
          {skillsLoading ? (
            <p className="text-xs text-ink-3">Loading skills…</p>
          ) : skillsError ? (
            <p className="text-xs text-warn-fg">Skills failed to load.</p>
          ) : skillOptions.length ? (
            <Select
              isMulti
              options={skillOptions}
              value={selectSkillValue}
              classNamePrefix="skill-select"
              onChange={onSkillSelectChange}
              placeholder="Filter by skill…"
              isDisabled={skillsError}
              styles={multiSelectStyles}
              className="min-w-[200px] flex-1"
            />
          ) : (
            <p className="text-xs text-ink-3">No skills yet. Add them from the candidate form.</p>
          )}
        </div>
      </div>
    </div>
  );
}
