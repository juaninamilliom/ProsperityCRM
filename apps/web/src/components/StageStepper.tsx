import type { StatusDTO } from 'src/common';
import { stageToken } from './ui';

type State = 'done' | 'current' | 'todo';

interface StageStepperProps {
  statuses: StatusDTO[];
  currentStatusId: string;
  orientation?: 'vertical' | 'horizontal';
}

export function StageStepper({
  statuses,
  currentStatusId,
  orientation = 'vertical',
}: StageStepperProps) {
  const ordered = [...statuses].sort((a, b) => a.order_index - b.order_index);
  const currentIndex = ordered.findIndex((s) => s.status_id === currentStatusId);

  return (
    <div className={orientation === 'vertical' ? 'flex flex-col gap-px' : 'flex items-center gap-2'}>
      {ordered.map((status, index) => {
        // currentIndex is -1 when the status is unknown, which leaves every
        // step 'todo' rather than marking the whole pipeline complete.
        const state: State =
          currentIndex >= 0 && index < currentIndex
            ? 'done'
            : index === currentIndex
              ? 'current'
              : 'todo';
        const colour = stageToken(status.name);

        return (
          <div
            key={status.status_id}
            data-testid={`step-${status.status_id}`}
            data-state={state}
            className={
              orientation === 'vertical'
                ? 'flex items-center gap-2.5 py-1'
                : 'flex flex-1 items-center gap-2'
            }
          >
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]"
              style={{
                background: state === 'todo' ? 'transparent' : colour,
                borderColor: state === 'todo' ? 'var(--border)' : colour,
              }}
            >
              {state === 'done' && (
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              )}
            </span>
            <span
              className={[
                'text-sm',
                state === 'current'
                  ? 'font-semibold text-ink'
                  : state === 'done'
                    ? 'text-ink-2'
                    : 'text-ink-3',
              ].join(' ')}
            >
              {status.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
