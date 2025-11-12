import type { CandidateWithMeta } from '@prosperity/common';

interface CandidateCardProps {
  candidate: CandidateWithMeta;
}

export function CandidateCard({ candidate }: CandidateCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900/80">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{candidate.name}</h4>
        {candidate.agency_name && <span className="badge">{candidate.agency_name}</span>}
      </header>
      <p className="text-sm text-slate-600 dark:text-slate-300">{candidate.email}</p>
      {candidate.flags?.length ? (
        <ul className="mt-3 flex flex-wrap gap-1 text-xs text-slate-600 dark:text-slate-300">
          {candidate.flags.map((flag) => (
            <li key={flag} className="rounded-full bg-brand/10 px-2 py-0.5 text-brand dark:bg-brand/20">
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
