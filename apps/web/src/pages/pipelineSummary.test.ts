import { describe, expect, it } from 'vitest';
import { pipelineSummary } from './pipelineSummary';
import type { PipelineEntryWithMeta, StatusDTO } from 'src/common';

const statuses = [
  { status_id: 's1', name: 'Sourced', order_index: 0, is_terminal: false },
  { status_id: 's2', name: 'Placed', order_index: 1, is_terminal: true },
  { status_id: 's3', name: 'Rejected', order_index: 2, is_terminal: true },
] as StatusDTO[];

const at = (id: string) => ({ current_status_id: id }) as PipelineEntryWithMeta;

describe('pipelineSummary', () => {
  it('excludes terminal statuses from the active count', () => {
    expect(pipelineSummary([at('s1'), at('s1'), at('s2'), at('s3')], statuses)).toBe(
      '2 active candidates · 1 placed',
    );
  });

  it('singularises a single active candidate', () => {
    expect(pipelineSummary([at('s1')], statuses)).toBe('1 active candidate · 0 placed');
  });

  it('handles an empty board', () => {
    expect(pipelineSummary([], statuses)).toBe('0 active candidates · 0 placed');
  });

  it('reports zero placed when no Placed status exists', () => {
    const custom = [
      { status_id: 'x', name: 'Lead', order_index: 0, is_terminal: false },
    ] as StatusDTO[];
    expect(pipelineSummary([at('x')], custom)).toBe('1 active candidate · 0 placed');
  });
});
