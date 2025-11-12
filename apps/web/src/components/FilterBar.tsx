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
    <div className="flex flex-wrap gap-4 rounded-card bg-brand-blue/5 p-4 shadow-soft ring-1 ring-white/40 dark:bg-slate-900/70">
      <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
        <span className="font-medium">Target Agency</span>
        <select className="pill-input" value={selectedAgency ?? ''} onChange={onAgencyChange}>
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
    </div>
  );
}
