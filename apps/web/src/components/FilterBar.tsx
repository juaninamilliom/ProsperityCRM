import type { AgencyDTO, JobRequisitionDTO, OrganizationSkillDTO, StatusDTO } from 'src/common';
import type { ChangeEvent } from 'react';
import { useMemo } from 'react';
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
    skillFilters,
    setAgency,
    setFlagQuery,
    setJobId,
    setStatusId,
    setSkillFilters,
  } = useFiltersStore();

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

  function onSkillSelectChange(options: MultiValue<SelectOption>) {
    const selected = options.map((option) => option.value);
    setSkillFilters(selected);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[168px] flex-col gap-1.5 text-xs font-medium text-ink-3">
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
        <label className="flex min-w-[168px] flex-col gap-1.5 text-xs font-medium text-ink-3">
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
        <label className="flex min-w-[168px] flex-col gap-1.5 text-xs font-medium text-ink-3">
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
        <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-3">
          <span className="font-medium">Flag</span>
          <input
            className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
            type="search"
            placeholder="Hot Prospect"
            value={flagQuery ?? ''}
            onChange={onFlagChange}
          />
        </label>
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5 text-xs font-medium text-ink-3">
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
