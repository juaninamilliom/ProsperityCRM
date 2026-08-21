import type { ActivityDTO } from 'src/common';
import { SectionLabel } from './ui';
import { ChannelIcon } from './ChannelIcon';
import { channelMeta } from './channelMeta';
import { touchLabel } from '../utils/presentation';

interface ActivityTimelineProps {
  activity: ActivityDTO[];
  /** Shown under the heading - "18 touches", or "across both funnels". */
  subtitle?: string;
  /** Which entity the timeline is on, so the tag names the other side. */
  perspective?: 'person' | 'company';
}

function tagFor(entry: ActivityDTO, perspective: 'person' | 'company'): string | null {
  if (entry.opportunity_name) return `${entry.opportunity_name} · BD`;
  if (perspective === 'person' && entry.company_name) return entry.company_name;
  if (perspective === 'company' && entry.person_name) return entry.person_name;
  if (entry.entry_id) return 'Pipeline';
  return null;
}

export function ActivityTimeline({
  activity,
  subtitle,
  perspective = 'company',
}: ActivityTimelineProps) {
  return (
    <aside className="flex w-[400px] shrink-0 flex-col overflow-hidden rounded-card border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border-soft px-4 py-3">
        <SectionLabel>Activity</SectionLabel>
        {subtitle && <span className="text-xs text-ink-3">{subtitle}</span>}
      </header>
      {activity.length === 0 ? (
        <p className="p-4 text-sm text-ink-3">
          Nothing logged yet. Every touch you record here is what keeps the follow-up view honest.
        </p>
      ) : (
        <div className="flex flex-col overflow-y-auto p-3">
          {activity.map((entry) => {
            const meta = channelMeta(entry.channel);
            const tag = tagFor(entry, perspective);
            const isWin = entry.subject === 'Deal won';
            return (
              <div key={entry.activity_id} className="flex gap-3 px-1.5 py-2">
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <span
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px]"
                    style={{
                      background: isWin ? 'var(--ok-bg)' : 'var(--surface-3)',
                      color: isWin ? 'var(--ok-fg)' : 'var(--ink-2)',
                    }}
                  >
                    <ChannelIcon channel={entry.channel} />
                  </span>
                  <span className="w-px flex-1 bg-border-soft" />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5 pb-1.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-medium">
                      {entry.subject ?? meta.label}
                    </span>
                    <span className="text-2xs text-ink-3">{touchLabel(entry.occurred_at)}</span>
                  </div>
                  {entry.body && (
                    <span className="text-sm leading-relaxed text-ink-2">{entry.body}</span>
                  )}
                  {tag && (
                    <span
                      className="mt-0.5 self-start rounded-chip px-[7px] py-px text-2xs font-medium"
                      style={{
                        background: isWin ? 'var(--ok-bg)' : 'var(--surface-3)',
                        color: isWin ? 'var(--ok-fg)' : 'var(--ink-2)',
                      }}
                    >
                      {tag}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
