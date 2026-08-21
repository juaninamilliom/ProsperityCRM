import type { CSSProperties } from 'react';
import type { PipelineEntryWithMeta } from 'src/common';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CandidateCard } from './CandidateCard';

interface Props {
  candidate: PipelineEntryWithMeta;
  selected?: boolean;
  onSelect?: (candidateId: string) => void;
}

export function DraggableCandidateCard({ candidate, selected, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.entry_id,
    data: { statusId: candidate.current_status_id },
  });

  const style: CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CandidateCard candidate={candidate} selected={selected} onSelect={onSelect} />
    </div>
  );
}
