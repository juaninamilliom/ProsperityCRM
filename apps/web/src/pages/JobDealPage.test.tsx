import { describe, expect, it } from 'vitest';
import { splitAmount } from './JobDealPage';

describe('splitAmount', () => {
  it('computes a percentage of the deal', () => {
    expect(splitAmount('45000', '60')).toBe('$27,000');
  });

  it('handles numeric input', () => {
    expect(splitAmount(45000, 50)).toBe('$22,500');
  });

  it('returns an em dash when either side is missing', () => {
    expect(splitAmount(null, '60')).toBe('—');
    expect(splitAmount('45000', null)).toBe('—');
    expect(splitAmount('', '')).toBe('—');
  });

  it('returns an em dash for junk', () => {
    expect(splitAmount('abc', '60')).toBe('—');
  });

  it('handles a zero percent split without collapsing to a dash', () => {
    expect(splitAmount('45000', 0)).toBe('$0');
  });
});
