import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStatuses } from '../api/statuses';
import { fetchAgencies } from '../api/agencies';
import { createCandidate } from '../api/candidates';

const initialState = {
  name: '',
  email: '',
  phone: '',
  target_agency_id: '',
  current_status_id: '',
  recruiter_id: '',
  notes: '',
  flags: [] as string[],
};

export function CandidateFormPage() {
  const queryClient = useQueryClient();
  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: fetchStatuses });
  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: fetchAgencies });
  const [form, setForm] = useState(initialState);
  const [flagInput, setFlagInput] = useState('');

  const createMutation = useMutation({
    mutationFn: () => createCandidate(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setForm(initialState);
      setFlagInput('');
    },
  });

  function addFlag() {
    if (!flagInput.trim()) return;
    setForm((prev) => ({ ...prev, flags: [...prev.flags, flagInput.trim()] }));
    setFlagInput('');
  }

  function removeFlag(flag: string) {
    setForm((prev) => ({ ...prev, flags: prev.flags.filter((item) => item !== flag) }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">New Candidate</h2>
      <form className="card flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          Full Name
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Phone
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Target Agency
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.target_agency_id}
            onChange={(e) => setForm((prev) => ({ ...prev, target_agency_id: e.target.value }))}
            required
          >
            <option value="" disabled>
              Select agency
            </option>
            {agencies.map((agency) => (
              <option key={agency.agency_id} value={agency.agency_id}>
                {agency.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.current_status_id}
            onChange={(e) => setForm((prev) => ({ ...prev, current_status_id: e.target.value }))}
            required
          >
            <option value="" disabled>
              Select status
            </option>
            {statuses.map((status) => (
              <option key={status.status_id} value={status.status_id}>
                {status.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Recruiter ID
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.recruiter_id}
            onChange={(e) => setForm((prev) => ({ ...prev, recruiter_id: e.target.value }))}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Notes
          <textarea
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </label>

        <div className="space-y-2">
          <label className="text-sm font-medium">Flags</label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={flagInput}
              onChange={(e) => setFlagInput(e.target.value)}
              placeholder="Hot Prospect"
            />
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900"
              type="button"
              onClick={addFlag}
            >
              Add
            </button>
          </div>
          <ul className="flex flex-wrap gap-2 text-xs">
            {form.flags.map((flag) => (
              <li key={flag} className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-brand dark:bg-brand/20">
                {flag}
                <button type="button" onClick={() => removeFlag(flag)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
          type="submit"
          disabled={createMutation.isLoading}
        >
          Create Candidate
        </button>
      </form>
    </section>
  );
}
