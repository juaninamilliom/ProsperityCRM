import type { AgencyDTO } from '@prosperity/common';
import type { ChangeEvent } from 'react';
import { useFiltersStore } from '../store/filters';

interface FilterBarProps {
  agencies: AgencyDTO[];
}

export function FilterBar({ agencies }: FilterBarProps) {
  const { selectedAgency, flagQuery, setAgency, setFlagQuery } = useFiltersStore();

  function onAgencyChange(event: ChangeEvent<HTMLSelectElement>) {
    setAgency(event.target.value || undefined);
  }

  function onFlagChange(event: ChangeEvent<HTMLInputElement>) {
    setFlagQuery(event.target.value || undefined);
  }

  return (
    <div className="flex flex-wrap gap-4 rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600 dark:text-slate-300">Target Agency</span>
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={selectedAgency ?? ''}
          onChange={onAgencyChange}
        >
          <option value="">All</option>
          {agencies.map((agency) => (
            <option key={agency.agency_id} value={agency.agency_id}>
              {agency.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600 dark:text-slate-300">Flag</span>
        <input
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          type="search"
          placeholder="Hot Prospect"
          value={flagQuery ?? ''}
          onChange={onFlagChange}
        />
      </label>
    </div>
  );
}
