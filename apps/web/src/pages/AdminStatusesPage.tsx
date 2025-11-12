import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStatus, fetchStatuses } from '../api/statuses';

export function AdminStatusesPage() {
  const queryClient = useQueryClient();
  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: fetchStatuses });
  const [form, setForm] = useState({ name: '', order_index: 0, is_terminal: false });

  const createMutation = useMutation({
    mutationFn: () => createStatus(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses'] });
      setForm({ name: '', order_index: 0, is_terminal: false });
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-700 dark:text-white">Status Configuration</h2>
      <form className="glass-card flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Name
          <input className="pill-input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Order
          <input className="pill-input" type="number" value={form.order_index} min={0} onChange={(e) => setForm((prev) => ({ ...prev, order_index: Number(e.target.value) }))} required />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
          <input className="h-4 w-4 accent-brand-fuchsia" type="checkbox" checked={form.is_terminal} onChange={(e) => setForm((prev) => ({ ...prev, is_terminal: e.target.checked }))} />
          Terminal stage
        </label>
        <button className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-soft disabled:opacity-50" type="submit" disabled={createMutation.isLoading}>
          Add
        </button>
      </form>

      <ul className="space-y-3">
        {statuses.map((status) => (
          <li key={status.status_id} className="glass-card flex items-center justify-between py-4">
            <div>
              <p className="font-medium text-slate-700 dark:text-white">{status.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">order {status.order_index}</p>
            </div>
            {status.is_terminal && <span className="badge">terminal</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
