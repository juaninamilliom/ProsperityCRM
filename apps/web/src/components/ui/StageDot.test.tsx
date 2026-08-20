import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StageDot, stageToken } from './StageDot';

describe('stageToken', () => {
  it('maps the seeded status names', () => {
    expect(stageToken('Sourced')).toBe('var(--stage-sourced)');
    expect(stageToken('Offer Extended')).toBe('var(--stage-offer)');
    expect(stageToken('Interviewing')).toBe('var(--stage-interviewing)');
  });

  it('is case and whitespace insensitive', () => {
    expect(stageToken('  placed ')).toBe('var(--stage-placed)');
  });

  it('falls back for a custom status name', () => {
    expect(stageToken('Second Interview')).toBe('var(--stage-sourced)');
  });
});

describe('StageDot', () => {
  it('paints itself with the stage colour', () => {
    const { container } = render(<StageDot stage="Placed" />);
    expect((container.firstChild as HTMLElement).style.background).toContain('--stage-placed');
  });
});
