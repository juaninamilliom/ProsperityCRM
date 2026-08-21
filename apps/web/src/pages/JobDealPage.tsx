import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import Select, { type SingleValue } from 'react-select';
import { fetchJobDetail, saveJobSplits, updateJob, type JobSplitInput } from '../api/jobs';
import type { JobRequisitionDTO } from 'src/common';
import type { CurrentUserResponse } from '../api/users';
import { fetchOrgUsers } from '../api/users';
import DatePicker from 'react-datepicker';
import { Icon } from '../components/Icon';
import { getSelectStyles } from '../components/selectStyles';
import { formatMoney } from './JobsPage';
import { Button, Card, Chip, SectionLabel, StageDot } from '../components/ui';

const STATUS_TONE = { open: 'ok', on_hold: 'warn', closed: 'off' } as const;
const STATUS_LABEL = { open: 'Open', on_hold: 'On hold', closed: 'Closed' } as const;

export function splitAmount(
  total: string | number | null | undefined,
  percent: string | number | null | undefined,
): string {
  if (total === null || total === undefined || total === '') return '—';
  if (percent === null || percent === undefined || percent === '') return '—';
  const t = Number(total);
  const p = Number(percent);
  if (!Number.isFinite(t) || !Number.isFinite(p)) return '—';
  return formatMoney((t * p) / 100);
}

function formatCurrency(value?: string | number | null) {
  return formatMoney(value);
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

type SelectOption = { value: string; label: string };

const statusOptions: SelectOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'closed', label: 'Closed' },
];

const roleOptions: SelectOption[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'secondary', label: 'Secondary' },
];

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
    weighted_deal_amount:
      data.weighted_deal_amount != null ? String(data.weighted_deal_amount) : '',
    owner_name: data.owner_name ?? '',
    stage: data.stage ?? '',
  });

  const detailQuery = useQuery({
    queryKey: ['job-detail', jobId],
    queryFn: () => fetchJobDetail(jobId!),
    enabled: Boolean(jobId),
  });
  const usersQuery = useQuery({ queryKey: ['org-users'], queryFn: fetchOrgUsers });
  const userOptions = useMemo(
    () => (usersQuery.data ?? []).map((u) => ({ value: u.name, label: u.name })),
    [usersQuery.data],
  );

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

  const totalSplit = useMemo(
    () => draftSplits.reduce((acc, split) => acc + (Number(split.split_percent ?? '0') || 0), 0),
    [draftSplits],
  );
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
        weighted_deal_amount: jobForm?.weighted_deal_amount
          ? Number(jobForm.weighted_deal_amount)
          : undefined,
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

  const selectStyles = getSelectStyles();

  if (detailQuery.isLoading || !job) {
    return (
      <p className="text-sm text-ink-3">
        {detailQuery.isLoading ? 'Loading deal sheet…' : 'Job not found.'}
      </p>
    );
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
          ],
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
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="focus-ring flex items-center gap-1.5 self-start text-sm text-ink-2 transition hover:text-ink"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Jobs
      </button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <SectionLabel>{job.department || 'General'}</SectionLabel>
          <h1 className="font-serif text-title">{job.title}</h1>
          <p className="text-sm text-ink-3">Close date: {formatDate(job.close_date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={STATUS_TONE[job.status] ?? 'off'}>
            {STATUS_LABEL[job.status] ?? job.status}
          </Chip>
          {job.stage && <Chip tone="accent">{job.stage}</Chip>}
          {canEdit && (
            <Button
              type="button"
              onClick={() => {
                setIsJobEditing((prev) => !prev);
                setJobMessage(null);
              }}
            >
              {isJobEditing ? 'Cancel' : 'Edit requisition'}
            </Button>
          )}
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Card as="article" className="flex flex-col gap-1 p-4">
          <SectionLabel>Deal value</SectionLabel>
          <p className="font-serif text-[25px] leading-tight">{formatCurrency(job.deal_amount)}</p>
        </Card>
        <Card as="article" className="flex flex-col gap-1 p-4">
          <SectionLabel>Weighted</SectionLabel>
          <p className="font-serif text-[25px] leading-tight">
            {formatCurrency(job.weighted_deal_amount)}
          </p>
        </Card>
        <Card as="article" className="flex flex-col gap-1 p-4">
          <SectionLabel>Owner</SectionLabel>
          <p className="truncate text-lg font-medium">{job.owner_name || 'Unassigned'}</p>
        </Card>
      </section>

      {isJobEditing && jobForm && (
        <section className="rounded-card border border-dashed border-border bg-surface-2 p-5">
          <div className="mb-3">
            <SectionLabel>Edit requisition</SectionLabel>
          </div>
          {jobMessage && <p className="text-xs text-emerald-600 mb-3">{jobMessage}</p>}
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              jobMutation.mutate();
            }}
          >
            <label className="flex flex-col gap-1 text-sm text-ink-2">
              Title
              <input
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                value={jobForm.title}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, title: value }));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-2">
              Department
              <input
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                value={jobForm.department ?? ''}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, department: value }));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-2">
              Location
              <input
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                value={jobForm.location ?? ''}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, location: value }));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-2">
              Status
              <Select
                options={statusOptions}
                value={statusOptions.find((o) => o.value === jobForm.status)}
                onChange={(option) =>
                  setJobForm((prev) => ({
                    ...prev!,
                    status: (option?.value as JobRequisitionDTO['status']) ?? 'open',
                  }))
                }
                styles={selectStyles}
                classNamePrefix="skill-select"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-2">
              Stage
              <input
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                value={jobForm.stage ?? ''}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, stage: value }));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-2">
              Close Date
              <DatePicker
                selected={jobForm.close_date ? new Date(jobForm.close_date) : null}
                onChange={(date: Date | null) => {
                  const value = date ? date.toISOString().split('T')[0] : '';
                  setJobForm((prev) => ({ ...prev!, close_date: value }));
                }}
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                placeholderText="Select date"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-2">
              Deal Amount
              <input
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                type="number"
                value={jobForm.deal_amount}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, deal_amount: value }));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-2">
              Weighted Deal
              <input
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                type="number"
                value={jobForm.weighted_deal_amount}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, weighted_deal_amount: value }));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-2">
              Owner
              <Select
                options={userOptions}
                value={userOptions.find((o) => o.value === jobForm.owner_name)}
                onChange={(option) =>
                  setJobForm((prev) => ({ ...prev!, owner_name: option?.value ?? '' }))
                }
                styles={selectStyles}
                classNamePrefix="skill-select"
                isClearable
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1 text-sm text-ink-2">
              Description
              <textarea
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3 rounded-lg"
                rows={3}
                value={jobForm.description}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setJobForm((prev) => ({ ...prev!, description: value }));
                }}
              />
            </label>
            <div className="md:col-span-2 flex gap-3">
              <button
                className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control bg-accent px-4 font-medium text-white transition hover:opacity-90"
                type="submit"
                disabled={jobMutation.isPending}
              >
                {jobMutation.isPending ? 'Saving…' : 'Save Job'}
              </button>
              <button
                className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 font-medium text-ink transition hover:bg-surface-3"
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

      <section className="rounded-card bg-surface p-5 shadow-token">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <SectionLabel>Deal split</SectionLabel>
            <p className="text-sm text-ink-3">Share payouts across the team.</p>
          </div>
          <div className="flex gap-2">
            {message && <p className="text-xs text-emerald-600">{message}</p>}
            {!isEditing ? (
              <button
                className="focus-ring inline-flex h-[30px] items-center justify-center gap-2 rounded-control border border-border bg-surface px-3 text-sm font-medium text-ink transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={beginEdit}
                disabled={!canEdit}
                title={canEdit ? 'Edit deal split' : 'Only org admins can edit the split'}
              >
                Edit split
              </button>
            ) : (
              <Fragment>
                <button
                  className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 font-medium text-ink transition hover:bg-surface-3"
                  type="button"
                  onClick={addSplitRow}
                >
                  <span>Add Row</span>
                </button>
                <button
                  className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control bg-accent px-4 font-medium text-white transition hover:opacity-90"
                  type="button"
                  onClick={saveSplits}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  className="inline-block rounded-full p-2 text-ink-3 hover:bg-surface-2 dark:text-ink-3 dark:hover:bg-surface-2"
                  type="button"
                  onClick={() => setIsEditing(false)}
                  title="Cancel"
                >
                  <Icon icon="close" />
                </button>
              </Fragment>
            )}
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ink-3">
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
                    <tr key={index} className="border-t border-border">
                      <td className="py-2">
                        <Select
                          options={userOptions}
                          value={userOptions.find((o) => o.value === split.teammate_name)}
                          onChange={(option: SingleValue<SelectOption>) =>
                            updateSplit(index, 'teammate_name', option?.value ?? '')
                          }
                          styles={selectStyles}
                          classNamePrefix="skill-select"
                        />
                      </td>
                      <td>
                        <Select
                          options={roleOptions}
                          value={roleOptions.find((o) => o.value === split.role)}
                          onChange={(option: SingleValue<SelectOption>) =>
                            updateSplit(index, 'role', option?.value ?? 'lead')
                          }
                          styles={selectStyles}
                          classNamePrefix="skill-select"
                        />
                      </td>
                      <td>
                        <input
                          className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                          type="number"
                          value={split.split_percent ?? '0'}
                          onChange={(event) =>
                            updateSplit(index, 'split_percent', event.currentTarget.value)
                          }
                        />
                      </td>
                      <td>{formatCurrency(dealTotals[index]?.total_deal ?? 0)}</td>
                      <td>{formatCurrency(dealTotals[index]?.weighted_deal ?? 0)}</td>
                      <td>
                        <button
                          className="text-xs text-warn-fg"
                          type="button"
                          onClick={() => removeSplitRow(index)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                : splits.map((split) => (
                    <tr key={split.split_id} className="border-t border-border">
                      <td className="py-2">
                        <span className="font-semibold text-ink">
                          {split.teammate_name || 'Unassigned'}
                        </span>
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
                  <td colSpan={5} className="pt-3 text-xs text-ink-3">
                    Total Split: {totalSplit}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          {!splits.length && !isEditing && (
            <p className="mt-3 text-sm text-ink-3">No deal split defined yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-card bg-surface p-5 shadow-token">
        <div className="mb-3">
          <SectionLabel>Related candidates</SectionLabel>
        </div>
        <ul className="flex flex-col">
          {candidates.length ? (
            candidates.map((candidate) => (
              <li
                key={candidate.entry_id}
                className="flex items-center justify-between gap-4 border-b border-border-soft py-3 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-base font-medium">{candidate.full_name}</span>
                  <span className="flex items-center gap-1.5 text-sm text-ink-2">
                    {candidate.status_name && <StageDot stage={candidate.status_name} size={6} />}
                    {candidate.status_name}
                  </span>
                </div>
                <div className="flex max-w-[60%] flex-wrap justify-end gap-1">
                  {candidate.skills?.slice(0, 3).map((skill) => (
                    <Chip key={skill} size="sm">
                      {skill}
                    </Chip>
                  ))}
                  {candidate.flags?.slice(0, 2).map((flag) => (
                    <Chip key={flag} size="sm" tone="warn">
                      {flag}
                    </Chip>
                  ))}
                  {!candidate.skills?.length && !candidate.flags?.length && (
                    <span className="text-sm text-ink-3">No tags yet</span>
                  )}
                </div>
              </li>
            ))
          ) : (
            <p className="text-sm text-ink-3">No candidates matched to this requisition yet.</p>
          )}
        </ul>
      </section>
    </section>
  );
}
