import type { CandidateWithMeta } from 'src/common';
import { Link } from 'react-router-dom';

interface CandidateCardProps {
  candidate: CandidateWithMeta;
}

export function CandidateCard({ candidate }: CandidateCardProps) {
  return (
    <article className="rounded-3xl border border-white/30 bg-white/90 p-4 shadow-soft ring-1 ring-slate-100 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-white">{candidate.name}</h4>
        <div className="flex items-center gap-2">
          {candidate.agency_name && <span className="badge">{candidate.agency_name}</span>}
          <Link className="text-xs font-semibold text-brand-fuchsia hover:underline" to={`/candidates/${candidate.candidate_id}/edit`}>
            Edit
          </Link>
        </div>
      </header>
      <p className="text-sm text-slate-600 dark:text-slate-300">{candidate.email}</p>
      {candidate.job_title && (
        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Job: {candidate.job_title}</p>
      )}
      <div className="mt-3 space-y-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Skills</p>
          {candidate.skills?.length ? (
            <ul className="mt-1 flex flex-wrap gap-1 text-xs text-slate-600 dark:text-slate-300">
              {candidate.skills.map((skill: string) => (
                <li key={skill} className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-500">No skills tagged</p>
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Flags</p>
          {candidate.flags?.length ? (
            <ul className="mt-1 flex flex-wrap gap-1 text-xs text-slate-600 dark:text-slate-300">
              {candidate.flags.map((flag: string) => (
                <li key={flag} className="rounded-full bg-brand-fuchsia/15 px-3 py-0.5 text-xs font-semibold text-brand-fuchsia">
                  {flag}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-500">No flags yet</p>
          )}
        </div>
      </div>
    </article>
  );
}
