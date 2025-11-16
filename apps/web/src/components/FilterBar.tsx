import type { AgencyDTO, JobRequisitionDTO, StatusDTO } from 'src/common';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import { useFiltersStore } from '../store/filters';

interface FilterBarProps {
  agencies: AgencyDTO[];
  jobs: JobRequisitionDTO[];
  statuses: StatusDTO[];
}

export function FilterBar({ agencies, jobs, statuses }: FilterBarProps) {
  const { selectedAgency, flagQuery, jobId, statusId, searchTerm, setAgency, setFlagQuery, setJobId, setStatusId, setSearchTerm } =
    useFiltersStore();
  const [localSearch, setLocalSearch] = useState(searchTerm ?? '');

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
