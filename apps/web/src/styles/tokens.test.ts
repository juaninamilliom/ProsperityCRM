import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf-8');

function varsInBlock(selector: string): string[] {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`missing block: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return [...css.slice(open, close).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]).sort();
}

describe('design tokens', () => {
  it('defines light and dark with an identical variable set', () => {
    expect(varsInBlock(':root.dark')).toEqual(varsInBlock(':root {'));
  });

  it('defines every stage colour', () => {
    const light = varsInBlock(':root {');
    for (const stage of ['sourced', 'screening', 'interviewing', 'offer', 'placed', 'rejected']) {
      expect(light).toContain(`--stage-${stage}`);
    }
  });

  it('defines every BD stage hue in both themes', () => {
    const light = varsInBlock(':root {');
    const dark = varsInBlock(':root.dark');
    for (const stage of [
      'prospect', 'contacted', 'meeting', 'proposal', 'negotiation', 'signed', 'lost',
    ]) {
      expect(light).toContain(`--bd-${stage}`);
      expect(dark).toContain(`--bd-${stage}`);
    }
  });

  it('ships no raw hex colours outside glyph white', () => {
    const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    expect(hexes.filter((h) => h !== '#fff' && h !== '#ffffff')).toEqual([]);
  });
});
