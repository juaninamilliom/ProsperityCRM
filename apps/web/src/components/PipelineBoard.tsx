import type { CandidateWithMeta, StatusDTO } from 'src/common';
import type { ReactNode } from 'react';
import { DndContext, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { DraggableCandidateCard } from './DraggableCandidateCard';

interface PipelineBoardProps {
  statuses: StatusDTO[];
  candidates: CandidateWithMeta[];
  onMove: (candidateId: string, toStatusId: string) => Promise<void>;
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
      className={`flex min-h-[240px] flex-col rounded-[28px] border border-white/30 bg-white/80 p-4 shadow-soft transition dark:border-slate-800/70 dark:bg-slate-900/70 ${
        isOver ? 'ring-2 ring-brand-fuchsia/60' : ''
      }`}
      data-terminal={status.is_terminal}
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-white">{status.name}</h3>
          {status.is_terminal && <p className="text-xs text-amber-500">Terminal</p>}
        </div>
        <span className="rounded-full bg-gradient-to-r from-brand-fuchsia to-brand-blue px-3 py-0.5 text-xs font-semibold text-white shadow-inner">
          {count}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
    </section>
  );
}

export function PipelineBoard({ statuses, candidates, onMove }: PipelineBoardProps) {
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statuses.map((status) => {
          const columnCandidates = candidates.filter((candidate) => candidate.current_status_id === status.status_id);
          return (
            <PipelineColumn key={status.status_id} status={status} count={columnCandidates.length}>
              {columnCandidates.map((candidate) => (
                <DraggableCandidateCard key={candidate.candidate_id} candidate={candidate} />
              ))}
            </PipelineColumn>
          );
        })}
      </div>
    </DndContext>
  );
}
