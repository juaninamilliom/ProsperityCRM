import type { ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'off';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-2',
  accent: 'bg-accent-soft text-accent-ink',
  ok: 'bg-ok-bg text-ok-fg',
  warn: 'bg-warn-bg text-warn-fg',
  off: 'bg-off-bg text-off-fg',
};

interface ChipProps {
  tone?: Tone;
  onRemove?: () => void;
  children: ReactNode;
}

export function Chip({ tone = 'neutral', onRemove, children }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-sm font-medium ${TONES[tone]}`}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${children}`}
          onClick={onRemove}
          className="focus-ring -mr-0.5 rounded-[4px] opacity-70 transition hover:opacity-100"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </span>
  );
}
