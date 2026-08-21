const STAGE_TOKENS: Record<string, string> = {
  sourced: 'var(--stage-sourced)',
  screening: 'var(--stage-screening)',
  interviewing: 'var(--stage-interviewing)',
  'offer extended': 'var(--stage-offer)',
  offer: 'var(--stage-offer)',
  placed: 'var(--stage-placed)',
  rejected: 'var(--stage-rejected)',
};

/** Status names are user-editable (status_config), so map by name with a safe
 *  default rather than by index - a renamed or added stage must not throw. */
export function stageToken(name: string): string {
  return STAGE_TOKENS[name.trim().toLowerCase()] ?? 'var(--stage-sourced)';
}

export function StageDot({ stage, size = 7 }: { stage: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: stageToken(stage) }}
    />
  );
}

const BD_STAGE_TOKENS: Record<string, string> = {
  prospect: 'var(--bd-prospect)',
  contacted: 'var(--bd-contacted)',
  meeting: 'var(--bd-meeting)',
  proposal: 'var(--bd-proposal)',
  negotiation: 'var(--bd-negotiation)',
  signed: 'var(--bd-signed)',
  lost: 'var(--bd-lost)',
};

/** BD stages are fixed rather than user-editable, but map by name with a safe
 *  default for the same reason stageToken does - an unknown value must not throw. */
export function bdStageToken(stage: string): string {
  return BD_STAGE_TOKENS[stage.trim().toLowerCase()] ?? 'var(--bd-prospect)';
}

export function BdStageDot({ stage, size = 7 }: { stage: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: bdStageToken(stage) }}
    />
  );
}
