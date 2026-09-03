import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_SPACING_STEPS,
  declaredSpacingSteps,
  isScannableSource,
  spacingStepsUsed,
} from './token-rules';

/** Tailwind silently drops a class whose scale step is not declared, so a typo
 *  like gap-13 produces no spacing and no warning.
 *
 *  This points the rule at the real tree; the rule itself is exercised against
 *  known violations in token-rules.test.ts, which is what stops this file
 *  passing because the scanner is broken rather than because the tree is clean.
 *
 *  It covers the extension as well as the web app, for the same reason
 *  tokenContract.test.ts does: apps/extension/tailwind.config.ts sets
 *  `theme: webConfig.theme`, so the panel already uses 4.5 - a step that
 *  exists only because of this workspace's extend.spacing. A gap-5.5 in the
 *  side panel is dropped just as silently, and nothing else in the repo looks. */

const WEB_SRC = resolve(__dirname, '..');
const WEB_ROOT = resolve(__dirname, '../..');
const REPO = resolve(WEB_ROOT, '../..');
const EXTENSION_SRC = resolve(WEB_ROOT, '../extension/src');
const config = readFileSync(resolve(WEB_ROOT, 'tailwind.config.ts'), 'utf-8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = resolve(dir, entry);
    if (entry === 'node_modules' || entry === 'dist') return [];
    if (statSync(full).isDirectory()) return walk(full);
    return isScannableSource(relative(REPO, full)) ? [full] : [];
  });
}

const files = [...walk(WEB_SRC), ...walk(EXTENSION_SRC)];

describe('spacing utilities', () => {
  it('are all steps Tailwind ships or the theme declares', () => {
    const declared = declaredSpacingSteps(config);
    const offenders: string[] = [];

    for (const file of files) {
      for (const step of spacingStepsUsed(readFileSync(file, 'utf-8'))) {
        if (BUILT_IN_SPACING_STEPS.has(step) || declared.has(step)) continue;
        offenders.push(`${step} in ${relative(REPO, file)}`);
      }
    }

    // Named, not just counted: the rule now matches whole numbers, so a step
    // can come from prose rather than a class. A bare "13" is a mystery; a
    // file path is a five-second read.
    expect(offenders.sort()).toEqual([]);
  });

  it('reads the theme, so a broken config parse cannot pass as no violations', () => {
    expect(declaredSpacingSteps(config).has('4.5')).toBe(true);
  });

  it('reaches both workspaces, so a broken walker cannot pass as a clean tree', () => {
    expect(files.filter((f) => f.includes('/web/')).length).toBeGreaterThan(50);
    expect(files.filter((f) => f.includes('/extension/')).length).toBeGreaterThan(5);

    const used = new Set<string>();
    for (const file of files) for (const s of spacingStepsUsed(readFileSync(file, 'utf-8'))) used.add(s);
    expect(used.size).toBeGreaterThan(5);
  });
});
