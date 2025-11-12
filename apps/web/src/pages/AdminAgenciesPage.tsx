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
      <h2 className="text-lg font-semibold text-slate-700 dark:text-white">Target Agencies</h2>
      <form className="glass-card flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Name
          <input className="pill-input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Contact Email
          <input className="pill-input" type="email" value={form.contact_email} onChange={(e) => setForm((prev) => ({ ...prev, contact_email: e.target.value }))} placeholder="talent@agency.com" />
        </label>
        <button className="btn-gradient justify-center disabled:opacity-50" type="submit" disabled={createMutation.isLoading}>
          Add Agency
        </button>
      </form>

      <ul className="space-y-3">
        {agencies.map((agency) => (
          <li key={agency.agency_id} className="glass-card">
            <p className="font-medium text-slate-700 dark:text-white">{agency.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{agency.contact_email ?? 'No contact'}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
