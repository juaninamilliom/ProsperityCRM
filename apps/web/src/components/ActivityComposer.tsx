import { useMemo, useState } from 'react';
import type { Channel, Direction } from 'src/common';
import type { NewActivity } from '../api/activities';
import { Button, SectionLabel } from './ui';
import { ChannelIcon } from './ChannelIcon';
import { CHANNELS, channelMeta } from './channelMeta';
import { initials, tintFor } from '../utils/presentation';

interface ComposerPerson {
  person_id: string;
  full_name: string;
  current_title?: string | null;
}

interface ActivityComposerProps {
  person?: ComposerPerson;
  companyId?: string;
  opportunityId?: string;
  entryId?: string;
  /** Shown in the "Attach to" row so it is obvious what the touch lands on. */
  attachLabel?: string;
  onSubmit: (activity: NewActivity) => void;
  onClose: () => void;
}

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'outbound', label: 'Outbound' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'internal', label: 'Internal' },
];

export function ActivityComposer({
  person,
  companyId,
  opportunityId,
  entryId,
  attachLabel,
  onSubmit,
  onClose,
}: ActivityComposerProps) {
  const [channel, setChannel] = useState<Channel>('li_message');
  const [direction, setDirection] = useState<Direction>('outbound');
  const [body, setBody] = useState('');

  const meta = channelMeta(channel);
  const tint = useMemo(() => tintFor(person?.full_name ?? ''), [person?.full_name]);

  function pickChannel(next: Channel) {
    setChannel(next);
    // A note records a thought, not contact - it can only ever be internal.
    if (channelMeta(next).internalOnly) setDirection('internal');
    else if (direction === 'internal') setDirection('outbound');
  }

  function submit() {
    if (!body.trim()) return;
    onSubmit({
      person_id: person?.person_id ?? null,
      company_id: companyId ?? null,
      opportunity_id: opportunityId ?? null,
      entry_id: entryId ?? null,
      channel,
      direction,
      body: body.trim(),
    });
  }

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop">
      <header className="flex items-center justify-between gap-4 border-b border-border-soft px-5 pb-4 pt-4.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-serif text-[21px] tracking-[-0.01em]">Log activity</h2>
          <span className="text-sm text-ink-3">
            Recorded against the person, and optionally a deal
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="focus-ring flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-ink-3 hover:bg-surface-3"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="flex flex-col gap-4.5 px-5 py-4.5">
        {person && (
          <div className="flex items-center gap-3 rounded-control border border-border bg-surface-2 px-3.5 py-2.5">
            <span
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-2xs font-semibold"
              style={{ background: tint.bg, color: tint.fg }}
            >
              {initials(person.full_name)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-medium">{person.full_name}</span>
              <span className="truncate text-xs text-ink-3">{person.current_title ?? '—'}</span>
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <SectionLabel>Channel</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((entry) => {
              const on = channel === entry.value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickChannel(entry.value as Channel)}
                  className={[
                    'focus-ring flex h-[38px] flex-[1_1_calc(25%-6px)] items-center gap-2 rounded-control border px-3 text-sm transition',
                    on
                      ? 'border-accent bg-accent-soft font-semibold text-accent-ink'
                      : 'border-border text-ink-2 hover:bg-surface-3',
                  ].join(' ')}
                >
                  <ChannelIcon channel={entry.value} size={15} />
                  <span className="truncate">{entry.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>Direction</SectionLabel>
          <div className="flex items-center gap-0.5 rounded-control bg-surface-3 p-0.5">
            {DIRECTIONS.map((entry) => {
              const on = direction === entry.value;
              const disabled = meta.internalOnly && entry.value !== 'internal';
              return (
                <button
                  key={entry.value}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => setDirection(entry.value)}
                  className={[
                    'focus-ring h-[30px] flex-1 rounded-[7px] text-sm font-medium transition',
                    on ? 'bg-surface text-ink shadow-pop' : 'text-ink-2',
                    disabled ? 'cursor-not-allowed opacity-40' : '',
                  ].join(' ')}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="activity-body" className="contents">
            <SectionLabel>Note</SectionLabel>
          </label>
          <textarea
            id="activity-body"
            aria-label="Note"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What happened?"
            className="focus-ring min-h-[104px] w-full resize-none rounded-control border border-border bg-surface px-3 py-2.5 text-base leading-relaxed text-ink placeholder:text-ink-3"
          />
        </div>

        {attachLabel && (
          <div className="flex flex-col gap-2">
            <SectionLabel>Attached to</SectionLabel>
            <span className="flex h-9 items-center rounded-control border border-border bg-surface px-3 text-base text-ink-2">
              {attachLabel}
            </span>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border-soft bg-surface-2 px-5 py-3.5">
        <span className="max-w-[46%] text-xs leading-snug text-ink-3">
          {meta.capturable
            ? 'The extension can log this for you when you send it.'
            : meta.internalOnly
              ? 'Internal only — never counted as outreach.'
              : 'Logged against this person and anything it is attached to.'}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!body.trim()} className="whitespace-nowrap">
            Log activity
          </Button>
        </div>
      </footer>
    </div>
  );
}
