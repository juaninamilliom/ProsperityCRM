import type { PipelineEntryWithMeta } from 'src/common';
import { Modal } from './Modal';

interface CandidateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: PipelineEntryWithMeta | null;
}

export function CandidateDetailsModal({ isOpen, onClose, candidate }: CandidateDetailsModalProps) {
  if (!candidate) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={candidate.full_name}>
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-ink-3">Email</h4>
          <p className="text-ink">{candidate.email}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-ink-3">Job</h4>
          <p className="text-ink">{candidate.job_title}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-ink-3">Agency</h4>
          <p className="text-ink">{candidate.company_name}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-ink-3">Skills</h4>
          <div className="flex flex-wrap gap-2">
            {candidate.skills.map((skill: string) => (
              <span
                key={skill}
                className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
