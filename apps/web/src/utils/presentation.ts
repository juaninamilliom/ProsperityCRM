const COLD_AFTER_DAYS = 7;

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

export function touchLabel(iso: string | null | undefined): string {
  const days = daysSince(iso);
  if (days === null) return 'never';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Never touched counts as cold: a record nobody has contacted is exactly the
 *  one the follow-up view exists to surface. */
export function isCold(iso: string | null | undefined): boolean {
  const days = daysSince(iso);
  return days === null || days > COLD_AFTER_DAYS;
}

export function initials(name: string): string {
  return (
    name
      .replace(/&/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

const TINTS = [
  { bg: 'var(--tint-eng-bg)', fg: 'var(--tint-eng-fg)' },
  { bg: 'var(--tint-design-bg)', fg: 'var(--tint-design-fg)' },
  { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)' },
  { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' },
];

/** Derived from the name so a record keeps the same tint on every screen -
 *  an index-based tint changes when the list is filtered. */
export function tintFor(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  return TINTS[hash % TINTS.length];
}
