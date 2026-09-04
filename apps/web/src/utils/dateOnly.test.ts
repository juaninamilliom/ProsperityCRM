import { describe, expect, it } from 'vitest';
import { formatDateOnly, parseDateOnly, toDateOnly } from './dateOnly';

/** A `date` column carries no time and no zone. Passing one to `new Date()`
 *  invents both: the string form is parsed as UTC midnight, so every browser
 *  west of Greenwich renders the PREVIOUS DAY.
 *
 *  The API sends "2026-03-15" - today, and unchanged after the Drizzle mirror
 *  is corrected, because Drizzle overrides pg's DATE parser and returns the
 *  raw string either way. So this is a browser-side bug, live right now, and
 *  the mirror fix is fidelity rather than the cure:
 *
 *    "2026-03-15"                 -> new Date(...) renders 3/14/2026
 *    "2026-03-15T00:00:00.000Z"   -> new Date(...) renders 3/14/2026
 *
 *  The second shape is covered because a raw pool.query outside Drizzle would
 *  produce it, not because the API sends it.
 *
 *  These assertions only BITE in a zone behind UTC: in UTC itself, parsing a
 *  date-only string as UTC midnight IS local midnight, so the broken
 *  implementation passes every one of them. CI runs UTC.
 *
 *  So the zone is pinned by the `test` script in package.json, and it has to
 *  be there. Assigning process.env.TZ in a beforeAll does nothing - Node has
 *  already resolved the zone by then - and vitest's `env` option is applied
 *  too late as well. Both were tried here, both looked like they worked, and
 *  under an ambient TZ=UTC both left the broken implementation green.
 *  Measured: with the zone set on the script, TZ=UTC npm test fails 6 of
 *  these; without it, 0. */

describe('parseDateOnly', () => {
  it('reads a date-only string as that calendar day, locally', () => {
    const parsed = parseDateOnly('2026-03-15');

    expect(parsed).not.toBeNull();
    // Local components, not UTC ones: getUTCDate() would be 15 only by luck.
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(2); // March
    expect(parsed?.getDate()).toBe(15);
  });

  it('reads the timestamp shape the API sends today as the same day', () => {
    // What pg gives for a `date` column on a UTC server, before the mirror
    // is corrected. The calendar day is the date part, not the local
    // rendering of the instant.
    const parsed = parseDateOnly('2026-03-15T00:00:00.000Z');

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(15);
  });

  it('returns null for nothing, rather than the epoch or Invalid Date', () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly('')).toBeNull();
  });

  it('returns null for a value it cannot read, rather than Invalid Date', () => {
    // An Invalid Date renders as "Invalid Date" in the UI, which is worse
    // than an empty cell.
    expect(parseDateOnly('not a date')).toBeNull();
    expect(parseDateOnly('2026-13-45')).toBeNull();
  });
});

describe('formatDateOnly', () => {
  it('renders the stored day, not the day before it', () => {
    // The regression, stated as plainly as it can be. Both shapes.
    expect(formatDateOnly('2026-03-15')).toBe('3/15/2026');
    expect(formatDateOnly('2026-03-15T00:00:00.000Z')).toBe('3/15/2026');
  });

  it('renders a January first without slipping into the previous year', () => {
    // The worst version of this bug: the year is wrong too, on the one date
    // where anyone would notice.
    expect(formatDateOnly('2026-01-01')).toBe('1/1/2026');
  });

  it('accepts the same options toLocaleDateString takes', () => {
    expect(formatDateOnly('2026-03-15', { day: 'numeric', month: 'short', year: 'numeric' })).toBe(
      'Mar 15, 2026'
    );
  });

  it('renders nothing it cannot read as an empty string', () => {
    expect(formatDateOnly(null)).toBe('');
    expect(formatDateOnly(undefined)).toBe('');
    expect(formatDateOnly('not a date')).toBe('');
  });
});

describe('toDateOnly', () => {
  it('stores the day the user clicked, whatever the hour', () => {
    // Two times on purpose, because the write bug and the read bug show up in
    // OPPOSITE zones. Converting to UTC first moves the day backwards in a
    // zone ahead of UTC (early morning) and forwards in a zone behind it
    // (late evening), so asserting both catches the old implementation in any
    // zone that is not UTC itself.
    expect(toDateOnly(new Date(2026, 2, 15, 0, 30))).toBe('2026-03-15');
    expect(toDateOnly(new Date(2026, 2, 15, 23, 30))).toBe('2026-03-15');
  });

  it('pads a single-digit month and day', () => {
    expect(toDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('round-trips through parseDateOnly', () => {
    expect(toDateOnly(parseDateOnly('2026-03-15'))).toBe('2026-03-15');
  });

  it('writes nothing for nothing, so the field clears', () => {
    expect(toDateOnly(null)).toBe('');
    expect(toDateOnly(undefined)).toBe('');
    expect(toDateOnly(new Date('nonsense'))).toBe('');
  });
});
