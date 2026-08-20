import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useFiltersStore } from '../store/filters';

/** Debounced search, lifted out of FilterBar so it can live in the page
 *  header where the design puts it, while still driving the same store. */
export function PipelineSearch() {
  const { searchTerm, setSearchTerm } = useFiltersStore();
  const [local, setLocal] = useState(searchTerm ?? '');

  useEffect(() => {
    setLocal(searchTerm ?? '');
  }, [searchTerm]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchTerm(local || undefined);
    }, 250);
    return () => clearTimeout(handle);
  }, [local, setSearchTerm]);

  return (
    <div className="relative w-[248px]">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.2-3.2" />
      </svg>
      <input
        className="focus-ring h-[34px] w-full rounded-control border border-border bg-surface pl-9 pr-3 text-base text-ink placeholder:text-ink-3"
        type="search"
        placeholder="Search candidates"
        aria-label="Search candidates"
        value={local}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setLocal(event.currentTarget.value)}
      />
    </div>
  );
}
