import type { ReactNode } from 'react';

export interface StageColumn {
  key: string;
  label: string;
  /** A CSS custom property reference from stageToken or bdStageToken. */
  token: string;
}

interface StageBoardProps<T> {
  columns: StageColumn[];
  items: T[];
  itemKey: (item: T) => string;
  itemStage: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove: (itemId: string, stageKey: string) => void;
  /** Optional second line in the column header - the deals board puts the
   *  column's total value there; the pipeline board has nothing to show. */
  columnSubtitle?: (stageKey: string) => string;
}

/** The candidate pipeline and the BD deals board are the same board with
 *  different data: columns keyed by a stage, cards that drag between them.
 *  Generalised rather than duplicated. */
export function StageBoard<T>({
  columns,
  items,
  itemKey,
  itemStage,
  renderCard,
  onMove,
  columnSubtitle,
}: StageBoardProps<T>) {
  return (
    // xl, not 2xl: a 1440px laptop never reaches 2xl, which is why the pipeline
    // columns once failed to appear at all.
    <div className="grid h-full gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {columns.map((column) => {
        const inColumn = items.filter((item) => itemStage(item) === column.key);
        return (
          <section
            key={column.key}
            className="flex min-h-0 flex-col rounded-card border border-border bg-surface-2"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData('text/plain');
              if (id) onMove(id, column.key);
            }}
          >
            <header className="flex flex-col gap-1.5 px-3 pb-2.5 pt-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ background: column.token }}
                  />
                  <span className="truncate text-sm font-semibold">{column.label}</span>
                </div>
                <span
                  data-testid={`column-count-${column.key}`}
                  className="rounded-full bg-surface-3 px-[7px] py-px text-2xs font-semibold text-ink-2"
                >
                  {inColumn.length}
                </span>
              </div>
              {columnSubtitle && (
                <span className="text-2xs text-ink-3">{columnSubtitle(column.key)}</span>
              )}
            </header>
            <div className="flex flex-col gap-2 overflow-y-auto px-2.5 pb-3">
              {inColumn.map((item) => (
                <div
                  key={itemKey(item)}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', itemKey(item))}
                >
                  {renderCard(item)}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
