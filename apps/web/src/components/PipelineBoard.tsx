import type { CandidateWithMeta, StatusDTO } from 'src/common';
import type { ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { DraggableCandidateCard } from './DraggableCandidateCard';
import { StageDot } from './ui';

interface PipelineBoardProps {
  statuses: StatusDTO[];
  candidates: CandidateWithMeta[];
  onMove: (candidateId: string, toStatusId: string) => Promise<void>;
  selectedId?: string | null;
  onSelect?: (candidateId: string) => void;
}

function PipelineColumn({
  status,
  children,
  count,
}: {
  status: StatusDTO;
  children: ReactNode;
  count: number;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status.status_id });

  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${status.status_id}`}
      data-terminal={status.is_terminal}
      className={[
        'flex min-h-[132px] min-w-0 flex-col rounded-card border bg-surface-2 transition',
        isOver ? 'border-accent' : 'border-border',
      ].join(' ')}
    >
      <header className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <StageDot stage={status.name} />
          <h3 className="truncate text-sm font-semibold">{status.name}</h3>
        </div>
        <span
          data-testid={`column-count-${status.status_id}`}
          className="rounded-full bg-surface-3 px-1.5 py-px text-2xs font-semibold text-ink-2"
        >
          {count}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2 px-2.5 pb-3">{children}</div>
    </section>
  );
}

export function PipelineBoard({
  statuses,
  candidates,
  onMove,
  selectedId,
  onSelect,
}: PipelineBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !active) {
      return;
    }
    if (active.data.current?.statusId === over.id) {
      return;
    }

    await onMove(String(active.id), String(over.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statuses.map((status) => {
          const columnCandidates = candidates.filter(
            (candidate) => candidate.current_status_id === status.status_id,
          );
          return (
            <PipelineColumn key={status.status_id} status={status} count={columnCandidates.length}>
              {columnCandidates.map((candidate) => (
                <DraggableCandidateCard
                  key={candidate.candidate_id}
                  candidate={candidate}
                  selected={candidate.candidate_id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </PipelineColumn>
          );
        })}
      </div>
    </DndContext>
  );
}
