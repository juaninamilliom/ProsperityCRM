import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchStatuses } from '../api/statuses';
import { fetchAgencies } from '../api/agencies';
import { fetchJobs } from '../api/jobs';
import { fetchCandidate, updateCandidate } from '../api/candidates';
import { formatPhone, isPhoneValid } from '../utils/phone';

export function CandidateEditPage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    target_agency_id: '',
    current_status_id: '',
    job_requisition_id: '',
    notes: '',
    flags: [] as string[],
  });
  const [flagInput, setFlagInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const candidateQuery = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: () => fetchCandidate(candidateId!),
    enabled: Boolean(candidateId),
  });
  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: fetchStatuses });
  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: fetchAgencies });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: fetchJobs });

  useEffect(() => {
    if (!candidateQuery.data) return;
    const candidate = candidateQuery.data;
    setForm({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone ?? '',
      target_agency_id: candidate.target_agency_id,
      current_status_id: candidate.current_status_id,
      job_requisition_id: candidate.job_requisition_id ?? '',
      notes: candidate.notes ?? '',
      flags: candidate.flags ?? [],
    });
  }, [candidateQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateCandidate(candidateId!, {
        ...form,
        phone: form.phone || undefined,
        job_requisition_id: form.job_requisition_id || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
      navigate('/');
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!candidateId) return;
    if (form.phone && !isPhoneValid(form.phone)) {
      setPhoneError('Enter a valid phone number.');
      return;
    }
    setPhoneError(null);
    updateMutation.mutate();
  }

  function addFlag() {
    if (!flagInput.trim()) return;
    setForm((prev) => ({ ...prev, flags: [...prev.flags, flagInput.trim()] }));
    setFlagInput('');
  }

  function removeFlag(flag: string) {
    setForm((prev) => ({ ...prev, flags: prev.flags.filter((item) => item !== flag) }));
  }

  if (candidateQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading candidate…</p>;
  }

  if (!candidateQuery.data) {
    return <p className="text-sm text-red-500">Candidate not found.</p>;
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-700 dark:text-white">Edit Candidate</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{candidateQuery.data.name}</p>
        </div>
        <button className="btn-outline" type="button" onClick={() => navigate(-1)}>
          <span>Back</span>
        </button>
      </header>

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
              inputMode="tel"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const value = formatPhone(event.currentTarget.value);
                setForm((prev) => ({ ...prev, phone: value }));
                setPhoneError(!value.trim() || isPhoneValid(value) ? null : 'Format as (555) 123-4567.');
              }}
            />
            {phoneError && <span className="text-xs text-red-500">{phoneError}</span>}
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
            Job Requisition
            <select
              className="pill-select w-auto min-w-[12rem]"
              value={form.job_requisition_id}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const { value } = event.currentTarget;
                setForm((prev) => ({ ...prev, job_requisition_id: value }));
              }}
              required
            >
              <option value="" disabled>
                Select job
              </option>
              {jobs.map((job) => (
                <option key={job.job_id} value={job.job_id}>
                  {job.title}
                </option>
              ))}
            </select>
            {!jobs.length && <span className="text-xs text-amber-600">Create a job in Settings → Jobs first.</span>}
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

        <button className="btn-outline w-full" type="submit" disabled={updateMutation.isPending || Boolean(phoneError) || !jobs.length}>
          <span className="w-full">{updateMutation.isPending ? 'Saving…' : 'Save Changes'}</span>
        </button>
      </form>
    </section>
  );
}
