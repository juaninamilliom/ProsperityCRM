import { describe, expect, it } from 'vitest';
import { dealSummary } from './dealSummary';

const deals = [
  { stage: 'prospect', est_annual_value: '38000', last_touch: '2026-08-18T00:00:00Z' },
  { stage: 'meeting', est_annual_value: 74000, last_touch: '2026-08-01T00:00:00Z' },
  { stage: 'signed', est_annual_value: '140000', last_touch: '2026-08-19T00:00:00Z' },
  { stage: 'lost', est_annual_value: '20000', last_touch: null },
];

const NOW = new Date('2026-08-20T00:00:00Z');

describe('dealSummary', () => {
  it('counts only open deals as open', () => {
    expect(dealSummary(deals, NOW).open).toBe(2);
  });

  it('sums value across open deals only, accepting numeric-as-string', () => {
    expect(dealSummary(deals, NOW).openValue).toBe(112000);
  });

  it('counts a deal untouched for more than seven days as cold', () => {
    expect(dealSummary(deals, NOW).cold).toBe(1);
  });

  it('never counts a terminal deal as cold, however stale', () => {
    expect(dealSummary([{ stage: 'lost', est_annual_value: null, last_touch: null }], NOW).cold).toBe(0);
  });

  it('counts signed deals separately', () => {
    expect(dealSummary(deals, NOW).signed).toBe(1);
  });
});
