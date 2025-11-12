import type { CandidateWithMeta } from '@prosperity/common';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CandidateCard } from './CandidateCard';

interface Props {
  candidate: CandidateWithMeta;
}

export function DraggableCandidateCard({ candidate }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.candidate_id,
    data: { statusId: candidate.current_status_id },
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CandidateCard candidate={candidate} />
    </div>
  );
}
