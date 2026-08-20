import type { ReactNode } from 'react';
import { Button, Card, SectionLabel } from './ui';

interface CandidateFormLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  preview: ReactNode;
  checklist: { label: string; done: boolean }[];
  saveHint: string;
  onCancel: () => void;
  submitting: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
}

export function CandidateFormLayout({
  title,
  subtitle,
  children,
  preview,
  checklist,
  saveHint,
  onCancel,
  submitting,
  submitDisabled = false,
  submitLabel = 'Save candidate',
}: CandidateFormLayoutProps) {
  const done = checklist.filter((c) => c.done).length;
  const pct = checklist.length ? (done / checklist.length) * 100 : 0;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 gap-6 pb-24">
        <div className="flex min-w-0 max-w-[680px] flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-[28px] tracking-[-0.012em]">{title}</h1>
            <p className="text-base text-ink-2">{subtitle}</p>
          </div>
          {children}
        </div>

        <div className="sticky top-8 hidden w-[320px] shrink-0 flex-col gap-4 self-start xl:flex">
          <Card className="flex flex-col gap-3 p-4">
            <SectionLabel>Board preview</SectionLabel>
            {preview}
          </Card>

          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>Ready to save</SectionLabel>
              <span data-testid="checklist-progress" className="text-xs font-semibold text-ink-2">
                {done} of {checklist.length}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-sm bg-surface-3">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <ul className="flex flex-col gap-1.5">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2.5">
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]"
                    style={{
                      background: item.done ? 'var(--accent)' : 'transparent',
                      borderColor: item.done ? 'var(--accent)' : 'var(--border)',
                    }}
                  >
                    {item.done && (
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 12.5l5 5L20 6.5" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm ${item.done ? 'text-ink-2' : 'text-ink-3'}`}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-8 flex items-center justify-between gap-4 border-t border-border bg-surface px-8 py-3.5">
        <span className="text-sm text-ink-3">{saveHint}</span>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || submitDisabled}>
            {submitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
