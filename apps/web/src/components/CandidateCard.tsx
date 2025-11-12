import type { CandidateWithMeta } from '@prosperity/common';

interface CandidateCardProps {
  candidate: CandidateWithMeta;
}

export function CandidateCard({ candidate }: CandidateCardProps) {
  return (
    <article className="rounded-3xl border border-white/30 bg-white/90 p-4 shadow-soft ring-1 ring-slate-100 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-white">{candidate.name}</h4>
        {candidate.agency_name && <span className="badge">{candidate.agency_name}</span>}
      </header>
      <p className="text-sm text-slate-600 dark:text-slate-300">{candidate.email}</p>
      {candidate.flags?.length ? (
        <ul className="mt-3 flex flex-wrap gap-1 text-xs text-slate-600 dark:text-slate-300">
          {candidate.flags.map((flag) => (
            <li key={flag} className="rounded-full bg-brand-fuchsia/15 px-3 py-0.5 text-xs font-semibold text-brand-fuchsia">
              {flag}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted mt-3 text-xs">No flags yet</p>
      )}
    </article>
  );
}
