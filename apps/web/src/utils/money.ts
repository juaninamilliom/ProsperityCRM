/** Postgres numeric arrives over the wire as a string even though the DTO
 *  types it as number, so accept both and never render NaN at the user.
 *  Returns the currency symbol too - never prefix another one. */
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
