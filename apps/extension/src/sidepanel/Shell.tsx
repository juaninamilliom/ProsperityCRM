import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Theme } from './theme';
import type { User } from './api';
import { Button, Card, Icon, Spinner, initials } from './ui';

interface ShellProps {
  theme: Theme;
  onToggleTheme: () => void;
  user: User | null;
  onLogout: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="focus-ring flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-ink-2 transition hover:bg-surface-3 hover:text-ink disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** The sidebar's brand row, laid across the top of a 360px column. */
export function Shell({ theme, onToggleTheme, user, onLogout, onRefresh, refreshing, children, footer }: ShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-app text-ink">
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface-2 px-3">
        <div className="flex items-center gap-2.5 px-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent text-white">
            <Icon name="logo" size={16} strokeWidth={2.2} />
          </span>
          <span className="text-lg font-semibold tracking-[-0.01em]">Prosperity</span>
        </div>

        <div className="flex items-center gap-0.5">
          <IconButton label="Re-read this page" onClick={onRefresh} disabled={refreshing}>
            <Icon name="refresh" size={15} className={refreshing ? 'animate-spin' : ''} />
          </IconButton>
          <IconButton label={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={onToggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
          </IconButton>
          {user && (
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Account"
                title={user.name}
                className="focus-ring flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-2xs font-semibold text-accent-ink"
              >
                {initials(user.name)}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-30 flex w-[200px] flex-col gap-1 rounded-card border border-border bg-surface p-1.5 shadow-panel">
                  <div className="flex flex-col px-2 py-1.5 leading-tight">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                    <span className="truncate text-2xs text-ink-3">{user.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="focus-ring rounded-[8px] px-2 py-1.5 text-left text-sm text-ink-3 transition hover:bg-surface-3 hover:text-ink-2"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>

      {footer && (
        <footer className="sticky bottom-0 z-20 border-t border-border-soft bg-surface-2 px-4 py-3">{footer}</footer>
      )}
    </div>
  );
}

export function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className="my-auto flex flex-col items-center">
      <Card className="flex w-full flex-col items-center gap-4 p-6 text-center shadow-token">{children}</Card>
    </div>
  );
}

export function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <CenteredCard>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <Icon name="linkedin" size={20} />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-[21px] leading-tight tracking-[-0.01em]">Open a LinkedIn profile</h2>
        <p className="max-w-[240px] text-sm text-ink-2">
          Browse to any <span className="font-medium text-ink">linkedin.com/in/…</span> page and the candidate appears here, ready to import.
        </p>
      </div>
      <Button size="sm" onClick={onRefresh}>
        Check this tab
      </Button>
    </CenteredCard>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="my-auto flex flex-col items-center gap-3 py-12 text-center">
      <Spinner size={22} />
      <p className="text-sm text-ink-2">{label}</p>
    </div>
  );
}

export function FailureState({ onRetry, trace }: { onRetry: () => void; trace: string[] }) {
  return (
    <>
      <CenteredCard>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warn-bg text-warn-fg">
          <Icon name="alert" size={20} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-[21px] leading-tight tracking-[-0.01em]">Couldn't read this profile</h2>
          <p className="max-w-[250px] text-sm text-ink-2">
            LinkedIn may still be loading. Wait a moment and try again; if it keeps failing, copy the details below and send them along.
          </p>
        </div>
        <Button size="sm" onClick={onRetry}>
          <Icon name="refresh" size={13} />
          Try again
        </Button>
      </CenteredCard>
      <TracePanel trace={trace} />
    </>
  );
}

/** Every extraction decision, for the moment a profile parses badly. */
export function TracePanel({ trace }: { trace: string[] }) {
  const [copied, setCopied] = useState(false);
  if (trace.length === 0) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(trace.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable; the text is still selectable.
    }
  }

  return (
    <details className="group rounded-card border border-border-soft bg-surface-2 text-ink-3">
      <summary className="focus-ring flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-xs font-medium">
        <Icon name="chevron" size={12} className="transition group-open:rotate-90" />
        Extraction details
        <span className="ml-auto text-2xs text-ink-3">{trace.length} steps</span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-border-soft px-3 py-2.5">
        <ol className="flex list-decimal flex-col gap-0.5 pl-4 font-mono text-2xs leading-relaxed text-ink-2">
          {trace.map((line, index) => (
            <li key={index} className="break-words">
              {line}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={copy}
          className="focus-ring inline-flex items-center gap-1 self-start rounded-[6px] px-1.5 py-1 text-2xs font-medium text-ink-2 transition hover:bg-surface-3"
        >
          <Icon name={copied ? 'check' : 'copy'} size={11} />
          {copied ? 'Copied' : 'Copy details'}
        </button>
      </div>
    </details>
  );
}
