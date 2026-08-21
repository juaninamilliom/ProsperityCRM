import { describe, expect, it } from 'vitest';
import { STAGES, isTerminal, stageTransition } from './stage.js';

const NOW = '2026-08-20T16:00:00.000Z';

describe('STAGES', () => {
  it('is the seven fixed stages in funnel order', () => {
    expect(STAGES).toEqual([
      'prospect', 'contacted', 'meeting', 'proposal', 'negotiation', 'signed', 'lost',
    ]);
  });

  it('treats only signed and lost as terminal', () => {
    expect(STAGES.filter(isTerminal)).toEqual(['signed', 'lost']);
  });
});

describe('stageTransition', () => {
  it('does nothing special moving between open stages', () => {
    expect(stageTransition('contacted', 'meeting', NOW)).toEqual({
      closed_at: null,
      promoteCompanyToClient: false,
      requiresLostReason: false,
    });
  });

  it('stamps closed_at and promotes the company on signed', () => {
    expect(stageTransition('negotiation', 'signed', NOW)).toEqual({
      closed_at: NOW,
      promoteCompanyToClient: true,
      requiresLostReason: false,
    });
  });

  it('stamps closed_at and asks for a reason on lost', () => {
    expect(stageTransition('proposal', 'lost', NOW)).toEqual({
      closed_at: NOW,
      promoteCompanyToClient: false,
      requiresLostReason: true,
    });
  });

  it('clears closed_at when a closed deal is reopened', () => {
    expect(stageTransition('lost', 'contacted', NOW)).toEqual({
      closed_at: null,
      promoteCompanyToClient: false,
      requiresLostReason: false,
    });
  });

  it('does not re-promote a company when signed is re-saved', () => {
    expect(stageTransition('signed', 'signed', NOW).promoteCompanyToClient).toBe(false);
  });

  it('promotes on a jump straight from prospect to signed', () => {
    expect(stageTransition('prospect', 'signed', NOW).promoteCompanyToClient).toBe(true);
  });
});

describe('updateOpportunitySchema', () => {
  it('refuses to update stage, which must go through the stage route', async () => {
    const { updateOpportunitySchema } = await import('./opportunity.schema.js');
    const result = updateOpportunitySchema.safeParse({ name: 'Renamed', stage: 'signed' });
    // Setting stage here would skip stageTransition entirely: the company would
    // never be promoted and no "deal won" activity would be written.
    expect(result.success).toBe(true);
    expect(result.success && 'stage' in result.data).toBe(false);
  });
});
