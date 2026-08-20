import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAgency, fetchAgencies } from '../api/agencies';

export function AdminAgenciesPage() {
  const queryClient = useQueryClient();
  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: fetchAgencies });
  const [form, setForm] = useState({ name: '', contact_email: '' });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createAgency({ name: form.name, contact_email: form.contact_email || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
      setForm({ name: '', contact_email: '' });
      setSuccessMessage('Agency added.');
      setErrorMessage(null);
    },
    onError: () => {
      setErrorMessage('Failed to add agency. Please try again.');
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
      <h2 className="text-lg font-semibold text-ink-2">Target Agencies</h2>
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
          Contact Email
          <input
            className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
            type="email"
            value={form.contact_email}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, contact_email: value }));
            }}
            placeholder="talent@agency.com"
          />
        </label>
        {successMessage && <p className="text-xs text-emerald-600">{successMessage}</p>}
        {errorMessage && <p className="text-xs text-warn-fg">{errorMessage}</p>}
        <button
          className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 font-medium text-ink transition hover:bg-surface-3"
          type="submit"
          disabled={createMutation.isPending}
        >
          <span className="w-full">{createMutation.isPending ? 'Adding…' : 'Add Agency'}</span>
        </button>
      </form>

      <ul className="space-y-3">
        {agencies.map((agency) => (
          <li key={agency.agency_id} className="rounded-card border border-border bg-surface p-6">
            <p className="font-medium text-ink-2">{agency.name}</p>
            <p className="text-xs text-ink-3">{agency.contact_email ?? 'No contact'}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
