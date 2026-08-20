import { describe, expect, it } from 'vitest';
import { formatMoney } from './JobsPage';

describe('formatMoney', () => {
  it('formats a numeric string as whole dollars', () => {
    expect(formatMoney('45000')).toBe('$45,000');
  });

  it('formats a number', () => {
    expect(formatMoney(45000)).toBe('$45,000');
  });

  it('rounds rather than showing cents', () => {
    expect(formatMoney('45000.49')).toBe('$45,000');
  });

  it('renders an em dash for empty values', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney('')).toBe('—');
  });

  it('renders an em dash for junk', () => {
    expect(formatMoney('not a number')).toBe('—');
  });
});
