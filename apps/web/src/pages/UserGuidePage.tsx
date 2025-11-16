export function UserGuidePage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-white">User Guide</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Quick tips for running Prosperity CRM day to day.</p>
      </header>

      <article className="glass-card space-y-4">
        <h2 className="text-lg font-semibold text-slate-700 dark:text-white">1. Build Your Workspace</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-200">
          <li>Head to <strong>Settings → Agencies</strong> to add every target agency you work with.</li>
          <li>Add <strong>Statuses</strong> to match your recruiting funnel (drag cards between them on the Pipeline view).</li>
          <li>Create <strong>Job Requisitions</strong> so every candidate can be tied to an active or historical role.</li>
          <li>Invite teammates from the <strong>Invites</strong> tab. Only Org Admins can create agencies, jobs, or statuses.</li>
        </ol>
      </article>

      <article className="glass-card space-y-4">
        <h2 className="text-lg font-semibold text-slate-700 dark:text-white">2. Working the Pipeline</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-200">
          <li>Use the <strong>filters</strong> above the Pipeline to narrow by agency, job, status, flag, or free-text search.</li>
          <li><strong>Add Candidates</strong> from the “New Candidate” page. Phone numbers auto-format and job ties are required.</li>
          <li><strong>Edit Candidates</strong> via the “Edit” link on each card to refresh notes, flags, or switch job assignments.</li>
          <li>Drag-and-drop cards between status columns to record progress. Moves are logged automatically.</li>
        </ul>
      </article>

      <article className="glass-card space-y-4">
        <h2 className="text-lg font-semibold text-slate-700 dark:text-white">3. Tips & Troubleshooting</h2>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-200">
          <li>
            <strong>Searching:</strong> The search box matches candidate name, email, and job title. Combine it with status or agency filters
            for pinpoint lists.
          </li>
          <li>
            <strong>Job Coverage:</strong> When a candidate rolls onto a new requisition, edit the candidate and swap the job field to keep
            reporting clean.
          </li>
          <li>
            <strong>Data Hygiene:</strong> Delete unused agencies or jobs from Settings to prevent stale options; archived jobs can keep
            their historical candidates.
          </li>
          <li>
            <strong>Need Help?</strong> Ping your Org Admin—they can reset invites, create new jobs, or update statuses without waiting on
            engineering.
          </li>
        </ul>
      </article>
    </section>
  );
}
