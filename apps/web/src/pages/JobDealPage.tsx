import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchJobDetail, saveJobSplits, updateJob, type JobSplitInput } from '../api/jobs';
import type { JobDealSplitDTO, JobRequisitionDTO } from 'src/common';
import type { CurrentUserResponse } from '../api/users';
import { fetchOrgUsers } from '../api/users';
import DatePicker from 'react-datepicker';

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString();
}

function formatRoleLabel(role?: string | null) {
  if (!role) return '—';
  if (role === 'lead') return 'Lead';
  if (role === 'secondary') return 'Secondary';
  return role;
}

export function JobDealPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isJobEditing, setIsJobEditing] = useState(false);
  const [draftSplits, setDraftSplits] = useState<JobSplitInput[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
  type JobFormDraft = {
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

  const [jobForm, setJobForm] = useState<JobFormDraft | null>(null);

  const toDraft = (data: JobRequisitionDTO): JobFormDraft => ({
    title: data.title,
    department: data.department ?? '',
    location: data.location ?? '',
    status: data.status,
    description: data.description ?? '',
    close_date: data.close_date ?? '',
    deal_amount: data.deal_amount != null ? String(data.deal_amount) : '',
    weighted_deal_amount: data.weighted_deal_amount != null ? String(data.weighted_deal_amount) : '',
    owner_name: data.owner_name ?? '',
    stage: data.stage ?? '',
  });

  const detailQuery = useQuery({ queryKey: ['job-detail', jobId], queryFn: () => fetchJobDetail(jobId!), enabled: Boolean(jobId) });
  const usersQuery = useQuery({ queryKey: ['org-users'], queryFn: fetchOrgUsers });

  const saveMutation = useMutation({
    mutationFn: (splits: JobSplitInput[]) => saveJobSplits(jobId!, splits),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] });
      setIsEditing(false);
      setMessage('Deal split updated.');
    },
  });

  const detail = detailQuery.data;
  const job = detail?.job;
  const splits = detail?.splits ?? [];
  const candidates = detail?.candidates ?? [];

  const totalSplit = useMemo(() => draftSplits.reduce((acc, split) => acc + (Number(split.split_percent ?? '0') || 0), 0), [draftSplits]);
  const dealTotals = useMemo(() => {
    const base = Number(job?.deal_amount ?? 0);
    const weighted = Number(job?.weighted_deal_amount ?? 0);
    let leadAccumulated = 0;
    let leadWeightedAccumulated = 0;
    return draftSplits.map((split) => {
      const percent = Number(split.split_percent ?? '0') / 100;
      const role = split.role ?? 'lead';
      let totalDeal: number;
      let weightedDeal: number;
      if (role === 'secondary' && leadAccumulated > 0) {
        totalDeal = leadAccumulated * percent;
        weightedDeal = leadWeightedAccumulated * percent;
      } else {
        totalDeal = base * percent;
        weightedDeal = weighted * percent;
        if (role === 'lead') {
          leadAccumulated += totalDeal;
          leadWeightedAccumulated += weightedDeal;
        }
      }
      return { total_deal: totalDeal, weighted_deal: weightedDeal };
    });
  }, [draftSplits, job?.deal_amount, job?.weighted_deal_amount]);

  useEffect(() => {
    if (!job) return;
    setJobForm(toDraft(job));
  }, [job]);

  const currentUser = queryClient.getQueryData<CurrentUserResponse>(['me']);
  const canEdit = currentUser?.dbUser?.role === 'OrgAdmin';

  const jobMutation = useMutation({
    mutationFn: () =>
      updateJob(jobId!, {
        title: jobForm?.title ?? '',
        department: jobForm?.department || undefined,
        location: jobForm?.location || undefined,
        status: jobForm?.status ?? 'open',
        description: jobForm?.description || undefined,
        close_date: jobForm?.close_date || undefined,
        deal_amount: jobForm?.deal_amount ? Number(jobForm.deal_amount) : undefined,
        weighted_deal_amount: jobForm?.weighted_deal_amount ? Number(jobForm.weighted_deal_amount) : undefined,
        owner_name: jobForm?.owner_name || undefined,
        stage: jobForm?.stage || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setIsJobEditing(false);
      setJobMessage('Job updated.');
    },
  });

  if (detailQuery.isLoading || !job) {
    return <p className="text-sm text-slate-500">{detailQuery.isLoading ? 'Loading deal sheet…' : 'Job not found.'}</p>;
  }

  function beginEdit() {
    if (!canEdit) return;
    setDraftSplits(
      splits.length
        ? splits.map((split) => ({
            teammate_name: split.teammate_name,
            teammate_status: split.teammate_status ?? undefined,
            role: (split.role as 'lead' | 'secondary') ?? 'lead',
            split_percent: split.split_percent != null ? String(split.split_percent) : '',
          }))
        : [
            {
              teammate_name: '',
              split_percent: '0',
              role: 'lead',
            },
          ]
    );
    setIsEditing(true);
    setMessage(null);
  }

  function updateSplit(index: number, field: keyof JobSplitInput, value: string) {
    setDraftSplits((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };
      next[index] = target;
      return next;
    });
  }

  function addSplitRow() {
    setDraftSplits((prev) => [...prev, { teammate_name: '', split_percent: '0', role: 'lead' }]);
  }

  function removeSplitRow(index: number) {
    setDraftSplits((prev) => prev.filter((_, idx) => idx !== index));
  }

  function saveSplits() {
    saveMutation.mutate(draftSplits);
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Req • {job.department || 'General'}</p>
          <h1 className="text-3xl font-semibold text-slate-800 dark:text-white">{job.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Close Date: {formatDate(job.close_date)}</p>
        </div>
        <div className="flex gap-3">
          {canEdit && (
            <button
              className="btn-outline"
              type="button"
              onClick={() => {
                setIsJobEditing((prev) => !prev);
                setJobMessage(null);
              }}
            >
              <span>{isJobEditing ? 'Cancel Edit' : 'Edit Job'}</span>
            </button>
          )}
          <span className="rounded-full bg-slate-100 px-4 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-white">
            {job.status}
          </span>
          {job.stage && <span className="rounded-full bg-brand-blue/10 px-4 py-1 text-sm font-semibold text-brand-blue">{job.stage}</span>}
          <button className="btn-outline" type="button" onClick={() => navigate(-1)}>
            <span>Back</span>
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-white/30 bg-white/90 p-4 shadow-soft dark:border-slate-800/70 dark:bg-slate-900/70">
          <p className="text-xs uppercase tracking-wide text-slate-400">Deal Amount</p>
          <p className="text-2xl font-semibold text-slate-800 dark:text-white">{formatCurrency(job.deal_amount)}</p>
        </article>
        <article className="rounded-3xl border border-white/30 bg-white/90 p-4 shadow-soft dark:border-slate-800/70 dark:bg-slate-900/70">
          <p className="text-xs uppercase tracking-wide text-slate-400">Weighted Deal</p>
          <p className="text-2xl font-semibold text-slate-800 dark:text-white">{formatCurrency(job.weighted_deal_amount)}</p>
        </article>
        <article className="rounded-3xl border border-white/30 bg-white/90 p-4 shadow-soft dark:border-slate-800/70 dark:bg-slate-900/70">
          <p className="text-xs uppercase tracking-wide text-slate-400">Owner</p>
          <p className="text-2xl font-semibold text-slate-800 dark:text-white">{job.owner_name || 'Unassigned'}</p>
        </article>
      </section>

      {isJobEditing && jobForm && (
        <section className="rounded-3xl border border-dashed border-brand-blue/40 bg-white/90 p-5 shadow-soft dark:border-slate-800/70 dark:bg-slate-900/70">
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">Edit Requisition</h2>
          {jobMessage && <p className="text-xs text-emerald-600 mb-3">{jobMessage}</p>}
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              jobMutation.mutate();
            }}
          >
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
              Title
              <input
                className="pill-input"
                value={jobForm.title}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, title: value }));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
              Department
              <input
                className="pill-input"
                value={jobForm.department ?? ''}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, department: value }));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
              Location
              <input
                className="pill-input"
                value={jobForm.location ?? ''}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, location: value }));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
              Status
              <select
                className="pill-select"
                value={jobForm.status}
                onChange={(event) => {
                  const value = event.currentTarget.value as JobRequisitionDTO['status'];
                  setJobForm((prev) => ({ ...prev!, status: value }));
                }}
              >
                <option value="open">Open</option>
                <option value="on_hold">On Hold</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
              Stage
              <input
                className="pill-input"
                value={jobForm.stage ?? ''}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, stage: value }));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
              Close Date
              <DatePicker
                selected={jobForm.close_date ? new Date(jobForm.close_date) : null}
                onChange={(date: Date | null) => {
                  const value = date ? date.toISOString().split('T')[0] : '';
                  setJobForm((prev) => ({ ...prev!, close_date: value }));
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
                value={jobForm.deal_amount}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, deal_amount: value }));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
              Weighted Deal
              <input
                className="pill-input"
                type="number"
                value={jobForm.weighted_deal_amount}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, weighted_deal_amount: value }));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
              Owner
              <select
                className="pill-select"
                value={jobForm.owner_name ?? ''}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, owner_name: value }));
                }}
              >
                <option value="">Unassigned</option>
                {(usersQuery.data ?? []).map((user) => (
                  <option key={user.user_id} value={user.name}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="md:col-span-2 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
              Description
              <textarea
                className="pill-input rounded-lg"
                rows={3}
                value={jobForm.description}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, description: value }));
                }}
              />
            </label>
            <div className="md:col-span-2 flex gap-3">
              <button className="btn-fuchsia" type="submit" disabled={jobMutation.isPending}>
                {jobMutation.isPending ? 'Saving…' : 'Save Job'}
              </button>
              <button
                className="btn-outline"
                type="button"
                onClick={() => {
                  setIsJobEditing(false);
                  setJobMessage(null);
                  setJobForm(toDraft(job));
                }}
              >
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-3xl border border-white/30 bg-white/90 p-5 shadow-soft dark:border-slate-800/70 dark:bg-slate-900/70">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Deal Split</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Share payouts across the team.</p>
          </div>
          <div className="flex gap-2">
            {message && <p className="text-xs text-emerald-600">{message}</p>}
            {!isEditing ? (
              <button className="btn-outline" type="button" onClick={beginEdit} disabled={!canEdit}>
                <span>{canEdit ? 'Edit Deal Split' : 'View Only'}</span>
              </button>
            ) : (
              <Fragment>
                <button className="btn-outline" type="button" onClick={addSplitRow}>
                  <span>Add Row</span>
                </button>
                <button className="btn-fuchsia" type="button" onClick={saveSplits} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving…' : 'Save' }
                </button>
                <button className="btn-outline" type="button" onClick={() => setIsEditing(false)}>
                  <span>Cancel</span>
                </button>
              </Fragment>
            )}
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2">Teammate</th>
                <th>Role</th>
                <th>Split %</th>
                <th>Total Deal</th>
                <th>Weighted Deal</th>
                {isEditing && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {isEditing
                ? draftSplits.map((split, index) => (
                    <tr key={index} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-2">
                        <select className="pill-select" value={split.teammate_name ?? ''} onChange={(event) => updateSplit(index, 'teammate_name', event.currentTarget.value)}>
                          <option value="">Select teammate</option>
                          {(usersQuery.data ?? []).map((user) => (
                            <option key={user.user_id} value={user.name}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select className="pill-select" value={split.role ?? 'lead'} onChange={(event) => updateSplit(index, 'role', event.currentTarget.value as 'lead' | 'secondary')}>
                          <option value="lead">Lead</option>
                          <option value="secondary">Secondary</option>
                        </select>
                      </td>
                      <td>
                        <input className="pill-input" type="number" value={split.split_percent ?? '0'} onChange={(event) => updateSplit(index, 'split_percent', event.currentTarget.value)} />
                      </td>
                      <td>{formatCurrency(dealTotals[index]?.total_deal ?? 0)}</td>
                      <td>{formatCurrency(dealTotals[index]?.weighted_deal ?? 0)}</td>
                      <td>
                        <button className="text-xs text-red-500" type="button" onClick={() => removeSplitRow(index)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                : splits.map((split) => (
                    <tr key={split.split_id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-2">
                        <span className="font-semibold text-slate-800 dark:text-white">{split.teammate_name || 'Unassigned'}</span>
                      </td>
                      <td>{formatRoleLabel(split.role)}</td>
                      <td>{`${split.split_percent ?? 0}%`}</td>
                      <td>{formatCurrency(split.total_deal)}</td>
                      <td>{formatCurrency(split.weighted_deal)}</td>
                    </tr>
                  ))}
            </tbody>
            {isEditing && (
              <tfoot>
                <tr>
                  <td colSpan={5} className="pt-3 text-xs text-slate-500">
                    Total Split: {totalSplit}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          {!splits.length && !isEditing && <p className="mt-3 text-sm text-slate-500">No deal split defined yet.</p>}
        </div>
      </section>

      <section className="rounded-3xl border border-white/30 bg-white/90 p-5 shadow-soft dark:border-slate-800/70 dark:bg-slate-900/70">
        <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">Related Candidates</h2>
        <ul className="space-y-3">
          {candidates.length ? (
            candidates.map((candidate) => (
              <li key={candidate.candidate_id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white">{candidate.name}</p>
                  <p className="text-xs text-slate-500">{candidate.status_name}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {candidate.skills?.length ? <p>Skills: {candidate.skills.join(', ')}</p> : null}
                  {candidate.flags?.length ? <p>Flags: {candidate.flags.join(', ')}</p> : null}
                  {!candidate.skills?.length && !candidate.flags?.length && <p>No tags yet</p>}
                </div>
              </li>
            ))
          ) : (
            <p className="text-sm text-slate-500">No candidates matched to this requisition yet.</p>
          )}
        </ul>
      </section>
    </section>
  );
}
