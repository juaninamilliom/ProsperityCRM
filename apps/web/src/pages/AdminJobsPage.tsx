import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createJob, deleteJob, fetchJobs } from '../api/jobs';
import { fetchOrgUsers } from '../api/users';
import DatePicker from 'react-datepicker';
import type { JobRequisitionDTO } from 'src/common';

type JobFormState = {
  title: string;
  department: string;
  location: string;
  status: JobRequisitionDTO['status'];
  description: string;
  close_date: string;
  deal_amount: string;
  weighted_deal_amount: string;
  owner_name: string;
  stage: string;
};

const defaultForm: JobFormState = {
  title: '',
  department: '',
  location: '',
  status: 'open',
  description: '',
  close_date: '',
  deal_amount: '',
  weighted_deal_amount: '',
  owner_name: '',
  stage: '',
};

export function AdminJobsPage() {
  const queryClient = useQueryClient();
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: fetchJobs });
  const { data: orgUsers = [] } = useQuery({ queryKey: ['org-users'], queryFn: fetchOrgUsers });
  const [form, setForm] = useState<JobFormState>(defaultForm);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createJob({
        ...form,
        deal_amount: form.deal_amount ? Number(form.deal_amount) : undefined,
        weighted_deal_amount: form.weighted_deal_amount ? Number(form.weighted_deal_amount) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setForm(defaultForm);
      setSuccessMessage('Job added.');
      setErrorMessage(null);
    },
    onError: () => {
      setErrorMessage('Failed to create job. Please check the form and try again.');
      setSuccessMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => deleteJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setDeleteMessage('Job removed.');
    },
    onError: () => setDeleteMessage('Failed to remove job. Please try again.'),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  useEffect(() => {
    if (!successMessage && !errorMessage && !deleteMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
      setDeleteMessage(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [successMessage, errorMessage, deleteMessage]);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-700 dark:text-white">Job Requisitions</h2>
      <form className="glass-card grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Title
          <input
            className="pill-input"
            value={form.title}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, title: value }));
            }}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Department
          <input
            className="pill-input"
            value={form.department}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, department: value }));
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Location
          <input
            className="pill-input"
            value={form.location}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, location: value }));
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Status
          <select
            className="pill-select"
            value={form.status}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              const value = event.currentTarget.value as JobRequisitionDTO['status'];
              setForm((prev) => ({ ...prev, status: value }));
            }}
          >
            <option value="open">Open</option>
            <option value="on_hold">On Hold</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Close Date
          <DatePicker
            selected={form.close_date ? new Date(form.close_date) : null}
            onChange={(date: Date | null) => {
              setForm((prev) => ({ ...prev, close_date: date ? date.toISOString().split('T')[0] : '' }));
            }}
            className="pill-input"
            placeholderText="Select date"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Deal Amount
          <input
            className="pill-input"
            type="number"
            value={form.deal_amount}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, deal_amount: value }));
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Weighted Deal Amount
          <input
            className="pill-input"
            type="number"
            value={form.weighted_deal_amount}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, weighted_deal_amount: value }));
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Owner
          <select
            className="pill-select"
            value={form.owner_name}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, owner_name: value }));
            }}
          >
            <option value="">Unassigned</option>
            {orgUsers.map((user) => (
              <option key={user.user_id} value={user.name}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Stage
          <input
            className="pill-input"
            value={form.stage}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, stage: value }));
            }}
          />
        </label>
        <label className="md:col-span-2">
          <textarea
            className="pill-input rounded-lg"
            placeholder="Notes about requirements, hiring manager, etc."
            rows={3}
            value={form.description}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, description: value }));
            }}
          />
        </label>
        {successMessage && <p className="text-xs text-emerald-600 md:col-span-2">{successMessage}</p>}
        {errorMessage && <p className="text-xs text-red-500 md:col-span-2">{errorMessage}</p>}
        <button className="btn-outline md:col-span-2" type="submit" disabled={createMutation.isPending}>
          <span>{createMutation.isPending ? 'Creating…' : 'Add Job'}</span>
        </button>
      </form>

      <ul className="space-y-3">
        {jobs.map((job) => (
          <li
            key={job.job_id}
            className="glass-card flex flex-col gap-1 border border-white/30 p-4 text-sm dark:border-slate-800/70 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-semibold text-slate-700 dark:text-white">{job.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {job.department || 'General'} • {job.location || 'Remote'} • {job.status}
              </p>
              {job.description && <p className="text-xs text-slate-500 dark:text-slate-400">{job.description}</p>}
            </div>
            <button className="text-xs font-semibold text-red-500" type="button" onClick={() => deleteMutation.mutate(job.job_id)}>
              Remove
            </button>
          </li>
        ))}
        {!jobs.length && <p className="text-sm text-slate-500">No jobs yet. Use the form above to create one.</p>}
        {deleteMessage && <p className="text-xs text-emerald-600">{deleteMessage}</p>}
      </ul>
    </section>
  );
}
