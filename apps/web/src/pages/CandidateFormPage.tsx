import { ChangeEvent, FormEvent, useState } from 'react';
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-700 dark:text-white">New Candidate</h2>
      <form className="glass-card flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Full Name
            <input
              className="pill-input"
              value={form.name}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, name: value }));
              }}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Email
            <input
              className="pill-input"
              type="email"
              value={form.email}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, email: value }));
              }}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Phone
            <input
              className="pill-input"
              value={form.phone}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, phone: value }));
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Recruiter ID
            <input
              className="pill-input"
              value={form.recruiter_id}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, recruiter_id: value }));
              }}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Target Agency
            <select
              className="pill-select w-auto min-w-[12rem]"
              value={form.target_agency_id}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, target_agency_id: value }));
              }}
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
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Status
            <select
              className="pill-select w-auto min-w-[12rem]"
              value={form.current_status_id}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, current_status_id: value }));
              }}
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
        </div>

        <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
          Notes
          <textarea
            className="pill-input"
            value={form.notes}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
              const { value } = event.currentTarget;
              setForm((prev) => ({ ...prev, notes: value }));
            }}
          />
        </label>

        <div className="space-y-2">
          <label className="text-sm font-medium">Flags</label>
          <div className="flex gap-2">
            <input
              className="pill-input flex-1"
              value={flagInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const { value } = event.currentTarget;
                setFlagInput(value);
              }}
              placeholder="Hot Prospect"
            />
            <button className="btn-outline" type="button" onClick={addFlag}>
              <span>Add Flag</span>
            </button>
          </div>
          <ul className="flex flex-wrap gap-2 text-xs">
            {form.flags.map((flag) => (
              <li
                key={flag}
                className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-brand dark:bg-brand/20"
              >
                {flag}
                <button type="button" onClick={() => removeFlag(flag)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button className="btn-outline w-full" type="submit" disabled={createMutation.isPending}>
          <span className="w-full">Create Candidate</span>
        </button>
      </form>
    </section>
  );
}
