/** Reading a `date` column, which has no time and no zone.
 *
 *  `new Date('2026-03-15')` parses as UTC midnight per spec, so every browser
 *  west of Greenwich renders the PREVIOUS DAY. Measured, Pacific browser:
 *
 *    "2026-03-15"                 new Date(...).toLocaleDateString()  3/14/2026
 *    "2026-03-15T00:00:00.000Z"   new Date(...).toLocaleDateString()  3/14/2026
 *
 *  The API sends the FIRST shape, today and after the Drizzle mirror is
 *  corrected from `text` to `date` - the mirror does not change the wire
 *  shape at all. Drizzle overrides pg's type parser per query and hands back
 *  the raw string for a DATE column (drizzle-orm/node-postgres/session.cjs
 *  :68-70, passed to client.query at :148 and :159), and the `text` and `date`
 *  mappers then both return that string verbatim. So this bug is entirely on
 *  the browser side, and it is live right now.
 *
 *  The second shape is tolerated anyway: it is what a raw `pool.query`
 *  outside Drizzle would produce, and accepting it costs nothing.
 *
 *  Both carry the calendar day in their first ten characters, so that is what
 *  this reads, and it builds a LOCAL date from those parts. */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;

  const match = DATE_ONLY.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  /** Rejects 2026-13-45, which the constructor would roll forward into a
   *  real but wrong date rather than refuse. */
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null;
  }

  return parsed;
}

/** Empty string rather than "Invalid Date", which is what the UI would
 *  otherwise print into a cell. */
export function formatDateOnly(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const parsed = parseDateOnly(value);
  return parsed ? parsed.toLocaleDateString('en-US', options) : '';
}

/** Writes a picked Date back as a `date` value.
 *
 *  `toISOString().split('T')[0]` is the mirror image of the read bug and was
 *  the previous implementation: it converts to UTC first, so the stored day
 *  is wrong whenever local midnight falls on a different UTC day. Measured,
 *  user clicks March 15:
 *
 *    Asia/Tokyo        stored 2026-03-14
 *    America/Los_Angeles, late evening   stored 2026-03-16
 *
 *  The calendar day the user clicked is in the LOCAL components, so it is
 *  read from those and never converted. */
export function toDateOnly(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return '';

  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
