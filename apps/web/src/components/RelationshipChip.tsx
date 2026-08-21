import { Chip } from './ui';

type Tone = 'accent' | 'ok' | 'off' | 'warn';

const RELATIONSHIPS: Record<string, { label: string; tone: Tone; dot: string }> = {
  prospect: { label: 'Prospect', tone: 'accent', dot: 'var(--accent)' },
  client: { label: 'Client', tone: 'ok', dot: 'var(--ok-dot)' },
  former: { label: 'Former', tone: 'off', dot: 'var(--off-dot)' },
  do_not_contact: { label: 'Do not contact', tone: 'warn', dot: 'var(--warn-dot)' },
};

/** Relationship is stored, not derived: a client inherited without a BD deal,
 *  or a company marked do-not-contact, must be representable. */
export function RelationshipChip({ relationship }: { relationship: string }) {
  const entry = RELATIONSHIPS[relationship] ?? RELATIONSHIPS.prospect;
  return (
    <Chip tone={entry.tone}>
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: entry.dot }}
      />
      {entry.label}
    </Chip>
  );
}
