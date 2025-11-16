import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchJobs } from '../api/jobs';

export function JobsPage() {
  const jobsQuery = useQuery({ queryKey: ['jobs'], queryFn: fetchJobs });

  if (jobsQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading requisitions…</p>;
  }

  if (jobsQuery.error) {
    return <p className="text-sm text-red-500">Failed to load jobs.</p>;
  }

  const jobs = jobsQuery.data ?? [];

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-white">Requisitions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track every open role and hop into the deal sheet to review payouts.
          </p>
        </div>
        <Link className="btn-outline" to="/settings">
          <span>Manage Jobs</span>
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {jobs.map((job) => (
          <article key={job.job_id} className="rounded-3xl border border-white/30 bg-white/90 p-5 shadow-soft dark:border-slate-800/70 dark:bg-slate-900/70">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{job.department || 'General'}</p>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">{job.title}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-white">
                {job.status}
              </span>
            </header>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Location</dt>
                <dd>{job.location || 'Remote'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Candidates</dt>
                <dd>{job.total_candidates ?? 0}</dd>
              </div>
            </dl>
            <Link className="mt-5 inline-flex items-center text-sm font-semibold text-brand-fuchsia" to={`/jobs/${job.job_id}`}>
              View Deal Sheet →
            </Link>
          </article>
        ))}
      </div>
      {!jobs.length && <p className="text-sm text-slate-500">No jobs yet. Add one from Settings → Jobs.</p>}
    </section>
  );
}
