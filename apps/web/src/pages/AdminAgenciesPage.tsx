import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAgency, fetchAgencies } from '../api/agencies';

export function AdminAgenciesPage() {
  const queryClient = useQueryClient();
  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: fetchAgencies });
  const [form, setForm] = useState({ name: '', contact_email: '' });

  const createMutation = useMutation({
    mutationFn: () => createAgency({ name: form.name, contact_email: form.contact_email || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
      setForm({ name: '', contact_email: '' });
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Target Agencies</h2>
      <form className="card flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Contact Email
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm((prev) => ({ ...prev, contact_email: e.target.value }))}
            placeholder="talent@agency.com"
          />
        </label>
        <button
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
          type="submit"
          disabled={createMutation.isLoading}
        >
          Add Agency
        </button>
      </form>

      <ul className="space-y-3">
        {agencies.map((agency) => (
          <li key={agency.agency_id} className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="font-medium">{agency.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{agency.contact_email ?? 'No contact'}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
