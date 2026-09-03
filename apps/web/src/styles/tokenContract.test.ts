import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isScannableSource, tokensReferencedBy, varsInBlock } from './token-rules';

/** Every token anyone reads must exist in BOTH theme blocks.
 *
 *  This lives in the web workspace deliberately, even though most of what it
 *  protects is the extension. The rename happens here - tokens.css is a web
 *  file - so the guard has to fail in the suite the renamer runs.
 *
 *  Without it, renaming a token leaves the web suite green, the extension
 *  suite green, both type checks green and no build warning, while the side
 *  panel renders with unresolved var() references. The panel imports
 *  tokens.css directly (apps/extension/src/sidepanel/index.css) and inherits
 *  the whole Tailwind theme (apps/extension/tailwind.config.ts sets
 *  `theme: webConfig.theme`), so it CAN consume names nothing on this side
 *  mentions. Today it happens not to - all four tokens it reads directly are
 *  also read here - so this is forward insurance rather than a live gap. The
 *  rename it catches is real either way, because the web config is what
 *  fires it. */

const STYLES = __dirname;
const WEB_SRC = resolve(STYLES, '..');
const WEB_ROOT = resolve(STYLES, '../..');
const EXTENSION_ROOT = resolve(WEB_ROOT, '../extension');
const REPO = resolve(WEB_ROOT, '../..');

const css = readFileSync(resolve(STYLES, 'tokens.css'), 'utf-8');
const light = varsInBlock(css, ':root {');
const dark = varsInBlock(css, ':root.dark');

/** Stylesheets, plus any TypeScript that isScannableSource admits. That
 *  exclusion is load-bearing here: the positive control below reads
 *  `var(--no-such-token)`, and on the first run this guard reported its own
 *  fixture as a violation - the third time in this file's short history that a
 *  scanner tripped over its own examples. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = resolve(dir, entry);
    if (entry === 'node_modules' || entry === 'dist') return [];
    if (statSync(full).isDirectory()) return walk(full);
    if (/\.css$/.test(entry)) return [full];
    return isScannableSource(relative(REPO, full)) ? [full] : [];
  });
}

/** Files that read tokens, minus tokens.css itself, which declares them. */
function referencingFiles(): string[] {
  return [
    ...walk(WEB_SRC).filter((file) => file !== resolve(STYLES, 'tokens.css')),
    resolve(WEB_ROOT, 'tailwind.config.ts'),
    ...walk(resolve(EXTENSION_ROOT, 'src')),
    resolve(EXTENSION_ROOT, 'tailwind.config.ts'),
  ];
}

function referencedTokens(): Map<string, string[]> {
  const byToken = new Map<string, string[]>();
  for (const file of referencingFiles()) {
    for (const token of tokensReferencedBy(readFileSync(file, 'utf-8'))) {
      byToken.set(token, [...(byToken.get(token) ?? []), relative(REPO, file)]);
    }
  }
  return byToken;
}

describe('token contract', () => {
  it('declares every token that anything reads, in both themes', () => {
    const missing = [...referencedTokens().entries()]
      .filter(([token]) => !light.includes(token) || !dark.includes(token))
      .map(([token, files]) => `${token} (read by ${files[0]})`)
      .sort();

    expect(missing).toEqual([]);
  });

  it('reaches both workspaces, so a green result means something', () => {
    // A broken path would throw on readdirSync, but a SILENT narrowing would
    // not - isScannableSource getting stricter, or index.css being renamed.
    // Floor both sides so that shrinks loudly.
    const files = referencingFiles();
    expect(files.filter((file) => file.includes('/web/')).length).toBeGreaterThan(50);
    expect(files.filter((file) => file.includes('/extension/')).length).toBeGreaterThan(5);
    expect(files.some((file) => file.endsWith('sidepanel/index.css'))).toBe(true);

    const fromExtension = new Set<string>();
    for (const file of files.filter((f) => f.includes('/extension/'))) {
      for (const token of tokensReferencedBy(readFileSync(file, 'utf-8'))) fromExtension.add(token);
    }
    // The panel reads four directly today. `> 0` would survive losing three.
    expect(fromExtension.size).toBeGreaterThanOrEqual(4);
  });

  it('would notice a token that no theme block declares', () => {
    // The positive control. Without it, a walker that silently collected
    // nothing would report the same clean result as a healthy contract.
    const invented = tokensReferencedBy('color: var(--no-such-token);');
    expect(invented).toEqual(['--no-such-token']);
    expect(light).not.toContain('--no-such-token');
  });
});
