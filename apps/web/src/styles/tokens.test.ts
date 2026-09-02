import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { varsInBlock } from './token-rules';

/** Colour is declared here and nowhere else, so the light and dark blocks must
 *  carry the identical set of names. The brace-matching that finds those
 *  blocks is exercised against a nested at-rule in token-rules.test.ts - the
 *  earlier version stopped at the first closing brace, which would have made
 *  this comparison pass against two truncated lists. */

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf-8');
const light = () => varsInBlock(css, ':root {');
const dark = () => varsInBlock(css, ':root.dark');

describe('design tokens', () => {
  it('defines light and dark with an identical variable set', () => {
    expect(dark()).toEqual(light());
  });

  it('defines enough variables that an empty parse cannot pass as parity', () => {
    expect(light().length).toBeGreaterThan(30);
  });

  it('defines every stage colour', () => {
    for (const stage of ['sourced', 'screening', 'interviewing', 'offer', 'placed', 'rejected']) {
      expect(light()).toContain(`--stage-${stage}`);
    }
  });

  it('defines every BD stage hue in both themes', () => {
    for (const stage of [
      'prospect', 'contacted', 'meeting', 'proposal', 'negotiation', 'signed', 'lost',
    ]) {
      expect(light()).toContain(`--bd-${stage}`);
      expect(dark()).toContain(`--bd-${stage}`);
    }
  });

  it('ships no raw hex colours outside glyph white', () => {
    const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    expect(hexes.filter((h) => h !== '#fff' && h !== '#ffffff')).toEqual([]);
  });
});
