import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..');
const config = readFileSync(resolve(__dirname, '../../tailwind.config.ts'), 'utf-8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Tailwind silently drops a class whose scale step is not declared, so a typo
 *  or a half-step like gap-4.5 produces no spacing and no warning. This walks
 *  the source for fractional spacing utilities and asserts the theme declares
 *  each one - it is the only thing standing between a missing gap and a
 *  screenshot nobody looks at. */
describe('fractional spacing utilities', () => {
  it('are all declared in the tailwind theme', () => {
    const used = new Set<string>();
    for (const file of walk(SRC)) {
      const source = readFileSync(file, 'utf-8');
      for (const match of source.matchAll(/\b(?:gap|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|space-[xy])-(\d+\.\d+)\b/g)) {
        used.add(match[1]);
      }
    }

    // Tailwind's default scale carries half-steps only up to 3.5; above that
    // every fractional step must be declared in the theme.
    const BUILT_IN = new Set(['0.5', '1.5', '2.5', '3.5']);
    const undeclared = [...used]
      .filter((step) => !BUILT_IN.has(step))
      .filter((step) => !config.includes(`'${step}':`))
      .sort();

    expect(undeclared).toEqual([]);
  });
});
