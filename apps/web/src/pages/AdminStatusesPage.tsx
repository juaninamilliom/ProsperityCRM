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
      <h2 className="text-lg font-semibold">Status Configuration</h2>
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
          Order
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            type="number"
            value={form.order_index}
            min={0}
            onChange={(e) => setForm((prev) => ({ ...prev, order_index: Number(e.target.value) }))}
            required
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_terminal} onChange={(e) => setForm((prev) => ({ ...prev, is_terminal: e.target.checked }))} />
          Terminal stage
        </label>
        <button
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
          type="submit"
          disabled={createMutation.isLoading}
        >
          Add
        </button>
      </form>

      <ul className="space-y-3">
        {statuses.map((status) => (
          <li key={status.status_id} className="flex items-center justify-between rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div>
              <p className="font-medium">{status.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">order {status.order_index}</p>
            </div>
            {status.is_terminal && <span className="badge">terminal</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
