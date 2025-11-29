import type { CandidateWithMeta } from 'src/common';
import { Modal } from './Modal';

interface CandidateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: CandidateWithMeta | null;
}

export function CandidateDetailsModal({ isOpen, onClose, candidate }: CandidateDetailsModalProps) {
  if (!candidate) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={candidate.name}>
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Email</h4>
          <p className="text-slate-900 dark:text-white">{candidate.email}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Job</h4>
          <p className="text-slate-900 dark:text-white">{candidate.job_title}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Agency</h4>
          <p className="text-slate-900 dark:text-white">{candidate.agency_name}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Skills</h4>
          <div className="flex flex-wrap gap-2">
            {candidate.skills.map((skill) => (
              <span key={skill.skill_id} className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {skill.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
