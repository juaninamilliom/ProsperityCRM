import type { OpportunityStage } from '../../types.js';

/** Fixed, not configurable. status_config already exists for the candidate
 *  ladder; a second config surface is not worth it for one user. */
export const STAGES: OpportunityStage[] = [
  'prospect', 'contacted', 'meeting', 'proposal', 'negotiation', 'signed', 'lost',
];

const TERMINAL: OpportunityStage[] = ['signed', 'lost'];

export function isTerminal(stage: OpportunityStage): boolean {
  return TERMINAL.includes(stage);
}

export interface StageTransition {
  closed_at: string | null;
  /** Reaching signed is where BD work becomes recruiting work: the company
   *  stops being a prospect and requisitions become possible under it. */
  promoteCompanyToClient: boolean;
  requiresLostReason: boolean;
}

export function stageTransition(
  from: OpportunityStage,
  to: OpportunityStage,
  now: string,
): StageTransition {
  const changed = from !== to;
  return {
    closed_at: isTerminal(to) ? now : null,
    // Only on an actual change: re-saving a signed deal must not log a second
    // "deal won" activity.
    promoteCompanyToClient: changed && to === 'signed',
    requiresLostReason: changed && to === 'lost',
  };
}
