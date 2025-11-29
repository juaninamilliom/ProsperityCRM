import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CandidateWithMeta, StatusDTO } from 'src/common';
import { CandidateDetailsModal } from './CandidateDetailsModal';
import { Icon } from './Icon';

interface PipelineListProps {
  statuses: StatusDTO[];
  candidates: CandidateWithMeta[];
}

export function PipelineList({ statuses, candidates }: PipelineListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateWithMeta | null>(null);
  const statusMap = new Map(statuses.map((s) => [s.status_id, s.name]));

  function openModal(candidate: CandidateWithMeta) {
    setSelectedCandidate(candidate);
    setIsModalOpen(true);
  }

  function closeModal() {
    setSelectedCandidate(null);
    setIsModalOpen(false);
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y-2 divide-slate-200 bg-white text-sm dark:divide-slate-800 dark:bg-slate-900">
          <thead className="text-left">
            <tr>
              <th className="whitespace-nowrap px-4 py-2 font-medium text-slate-900 dark:text-white">Name</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium text-slate-900 dark:text-white">Job</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium text-slate-900 dark:text-white">Status</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium text-slate-900 dark:text-white">Agency</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {candidates.map((candidate) => (
              <tr
                key={candidate.candidate_id}
                onClick={() => openModal(candidate)}
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-900 dark:text-white">
                  {candidate.name}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700 dark:text-slate-200">{candidate.job_title}</td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700 dark:text-slate-200">
                  {statusMap.get(candidate.current_status_id) ?? 'Unknown'}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700 dark:text-slate-200">
                  {candidate.agency_name}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right">
                  <Link
                    to={`/candidates/${candidate.candidate_id}/edit`}
                    className="inline-block rounded-full p-2 text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Icon icon="edit" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CandidateDetailsModal isOpen={isModalOpen} onClose={closeModal} candidate={selectedCandidate} />
    </>
  );
}
