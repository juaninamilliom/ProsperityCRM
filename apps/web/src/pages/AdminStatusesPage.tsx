import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStatus, fetchStatuses } from '../api/statuses';

export function AdminStatusesPage() {
  const queryClient = useQueryClient();
  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: fetchStatuses });
  const [form, setForm] = useState({ name: '', order_index: 0, is_terminal: false });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createStatus(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses'] });
      setForm({ name: '', order_index: 0, is_terminal: false });
      setSuccessMessage('Status added.');
      setErrorMessage(null);
    },
    onError: () => {
      setErrorMessage('Failed to add status. Please check the form and try again.');
      setSuccessMessage(null);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  useEffect(() => {
    if (!successMessage && !errorMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [successMessage, errorMessage]);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-ink-2">Status Configuration</h2>
      <form
        className="rounded-card border border-border bg-surface p-6 flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <label className="flex flex-col gap-1 text-sm text-ink-2">
          Name
          <input
            className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
            value={form.name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, name: value }));
            }}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-2">
          Order
          <input
            className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
            type="number"
            value={form.order_index}
            min={0}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = Number(event.currentTarget.value);
              setForm((prev) => ({ ...prev, order_index: value }));
            }}
            required
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input
            className="h-4 w-4 accent-accent"
            type="checkbox"
            checked={form.is_terminal}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setForm((prev) => ({ ...prev, is_terminal: event.currentTarget.checked }))
            }
          />
          Terminal stage
        </label>
        {successMessage && <p className="text-xs text-emerald-600">{successMessage}</p>}
        {errorMessage && <p className="text-xs text-warn-fg">{errorMessage}</p>}
        <button
          className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 font-medium text-ink transition hover:bg-surface-3"
          type="submit"
          disabled={createMutation.isPending}
        >
          <span className="w-full">{createMutation.isPending ? 'Adding…' : 'Add'}</span>
        </button>
      </form>

      <ul className="space-y-3">
        {statuses.map((status) => (
          <li
            key={status.status_id}
            className="rounded-card border border-border bg-surface p-6 flex items-center justify-between py-4"
          >
            <div>
              <p className="font-medium text-ink-2">{status.name}</p>
              <p className="text-xs text-ink-3">order {status.order_index}</p>
            </div>
            {status.is_terminal && <span className="badge">terminal</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
