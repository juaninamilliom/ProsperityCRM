import { Link } from 'react-router-dom';
import type { PipelineEntryWithMeta, StatusDTO } from 'src/common';
import { Button, Chip, SectionLabel } from './ui';
import { StageStepper } from './StageStepper';

interface DetailRailProps {
  candidate: PipelineEntryWithMeta;
  statuses: StatusDTO[];
  onClose: () => void;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function DetailRail({ candidate, statuses, onClose }: DetailRailProps) {
  const fields: [string, string | null | undefined][] = [
    ['Email', candidate.email],
    ['Phone', candidate.phone],
    ['Agency', candidate.company_name],
    ['Job', candidate.job_title],
  ];
  const skills = candidate.skills ?? [];
  const flags = candidate.flags ?? [];

  return (
    <aside className="flex w-[344px] shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-base font-semibold text-accent-ink">
            {initials(candidate.full_name)}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-lg font-semibold tracking-[-0.01em]">
              {candidate.full_name}
            </span>
            {candidate.job_title && (
              <span className="truncate text-sm text-ink-2">{candidate.job_title}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-surface-3 text-ink-2"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-5 overflow-y-auto p-5">
        <div className="flex flex-col gap-2">
          <SectionLabel>Stage</SectionLabel>
          <StageStepper statuses={statuses} currentStatusId={candidate.current_status_id} />
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>Details</SectionLabel>
          {fields
            .filter(([, value]) => Boolean(value))
            .map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-3 border-b border-border-soft py-1.5"
              >
                <span className="shrink-0 text-sm text-ink-2">{label}</span>
                <span className="break-words text-right text-sm">{value}</span>
              </div>
            ))}
        </div>

        {skills.length > 0 && (
          <div className="flex flex-col gap-2">
            <SectionLabel>Skills</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <Chip key={skill} tone="accent">
                  {skill}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {flags.length > 0 && (
          <div className="flex flex-col gap-2">
            <SectionLabel>Flags</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {flags.map((flag) => (
                <Chip key={flag} tone="warn">
                  {flag}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto flex gap-2 border-t border-border p-4">
        <Link to={`/candidates/${candidate.entry_id}/edit`} className="flex-1">
          <Button variant="primary" className="w-full">
            Open
          </Button>
        </Link>
      </div>
    </aside>
  );
}
