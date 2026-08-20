import type { CandidateWithMeta } from 'src/common';
import { Chip } from './ui';

interface CandidateCardProps {
  candidate: CandidateWithMeta;
  selected?: boolean;
  onSelect?: (candidateId: string) => void;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function CandidateCard({ candidate, selected = false, onSelect }: CandidateCardProps) {
  const skills = candidate.skills ?? [];
  const shown = skills.slice(0, 2);
  const overflow = skills.length - shown.length;

  return (
    <article
      data-selected={selected}
      onClick={onSelect ? () => onSelect(candidate.candidate_id) : undefined}
      className={[
        'flex w-full flex-col gap-2.5 rounded-[11px] border bg-surface p-3 text-left transition',
        selected ? 'border-accent shadow-pop' : 'border-border shadow-token',
        onSelect ? 'cursor-pointer' : '',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-ink">
          {initials(candidate.name)}
        </span>
        <span className="truncate text-sm font-semibold tracking-[-0.005em]">{candidate.name}</span>
      </div>

      {candidate.job_title && <p className="truncate text-xs text-ink-2">{candidate.job_title}</p>}

      {shown.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {shown.map((skill) => (
            <Chip key={skill}>{skill}</Chip>
          ))}
          {overflow > 0 && <Chip>{`+${overflow}`}</Chip>}
        </div>
      )}
    </article>
  );
}
