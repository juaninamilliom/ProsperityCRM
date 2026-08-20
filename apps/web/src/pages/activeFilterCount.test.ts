import { describe, expect, it } from 'vitest';
import { activeFilterCount } from './activeFilterCount';

const none = {
  selectedAgency: undefined,
  flagQuery: undefined,
  jobId: undefined,
  statusId: undefined,
  skillFilters: [] as string[],
};

describe('activeFilterCount', () => {
  it('is zero when nothing is set', () => {
    expect(activeFilterCount(none)).toBe(0);
  });

  it('counts each set filter', () => {
    expect(activeFilterCount({ ...none, selectedAgency: 'a1', jobId: 'j1' })).toBe(2);
  });

  it('counts each selected skill separately', () => {
    expect(activeFilterCount({ ...none, skillFilters: ['Go', 'Redis'] })).toBe(2);
  });

  it('ignores a whitespace-only flag query', () => {
    expect(activeFilterCount({ ...none, flagQuery: '   ' })).toBe(0);
  });

  it('counts a real flag query', () => {
    expect(activeFilterCount({ ...none, flagQuery: 'Hot Prospect' })).toBe(1);
  });
});
