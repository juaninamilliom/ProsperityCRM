import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_SPACING_STEPS,
  declaredSpacingSteps,
  isScannableSource,
  spacingStepsUsed,
  tokensReferencedBy,
  varsInBlock,
} from './token-rules';

/** The two guards this repo already had scanned one narrow thing each and
 *  asserted only that the tree was clean. A guard written that way cannot tell
 *  a clean tree from a broken scanner, and reports success either way - which
 *  is how every finding in the design-system column stayed invisible.
 *
 *  So the rules are a module now, and this file is their positive control:
 *  each case is a violation the scanner must actually detect. The files that
 *  point these rules at the real tree are tokens.test.ts, spacing.test.ts and
 *  tokenContract.test.ts. */

describe('varsInBlock', () => {
  const flat = `:root {\n  --a: 1;\n  --b: 2;\n}\n:root.dark {\n  --a: 3;\n  --b: 4;\n}\n`;

  it('reads the variables declared in a block', () => {
    expect(varsInBlock(flat, ':root {')).toEqual(['--a', '--b']);
  });

  it('does not truncate at a nested closing brace', () => {
    // The latent bug: the old scanner took the FIRST '}' after the block
    // opened. That works only while tokens.css stays two flat blocks. Add one
    // nested at-rule and the variable set silently truncates to whatever
    // preceded it - and the parity assertion then passes vacuously, comparing
    // two short lists that happen to match.
    const nested = `:root {\n  --a: 1;\n  @supports (color: oklch(0 0 0)) {\n    --b: 2;\n  }\n  --c: 3;\n}\n`;
    expect(varsInBlock(nested, ':root {')).toEqual(['--a', '--b', '--c']);
  });

  it('does not end the block at a brace inside a comment', () => {
    // The second version counted brace depth but scanned raw text, so a stray
    // `}` in a comment truncated the list without throwing - and two blocks
    // truncated symmetrically still compare equal.
    const commented = `:root {\n  --a: 1;\n  /* closes } here */\n  --b: 2;\n}\n`;
    expect(varsInBlock(commented, ':root {')).toEqual(['--a', '--b']);
  });

  it('does not end the block at a brace inside a quoted value', () => {
    const quoted = `:root {\n  --a: 1;\n  --content: "}";\n  --b: 2;\n}\n`;
    expect(varsInBlock(quoted, ':root {')).toEqual(['--a', '--b', '--content']);
  });

  it('reads a custom property with capitals in its name', () => {
    expect(varsInBlock(':root {\n --brandFuchsia: 1;\n}', ':root {')).toEqual(['--brandFuchsia']);
  });

  it('throws when the block is missing, rather than returning nothing', () => {
    // Returning [] here would make the parity test pass against an empty set.
    expect(() => varsInBlock(flat, ':root.sepia')).toThrow(/missing block/);
  });
});

describe('spacingStepsUsed', () => {
  it('finds fractional steps', () => {
    expect(spacingStepsUsed('<div className="gap-4.5 pt-2.5" />')).toEqual(['2.5', '4.5']);
  });

  it('finds whole-number steps, which an ordinary typo produces', () => {
    // The old pattern was (\d+\.\d+), so `gap-97` - a slipped keystroke that
    // Tailwind silently drops - was invisible to it.
    expect(spacingStepsUsed('<div className="gap-97" />')).toContain('97');
  });

  it('ignores utilities that do not draw on the spacing scale', () => {
    expect(spacingStepsUsed('text-2xs rounded-card z-10 opacity-50')).toEqual([]);
  });

  it('reads the families that inherit theme.spacing, not just gap and padding', () => {
    // An earlier version of this test asserted that `w-1.5` was NOT a spacing
    // utility. It is: width, height, min/max, size, inset, translate, basis,
    // indent and the scroll families all inherit theme.spacing, verified with
    // tailwindcss/resolveConfig. `w-13` is dropped exactly like `gap-13`, and
    // that false assertion locked ~180 live call sites out of the guard.
    expect(spacingStepsUsed('w-13')).toEqual(['13']);
    expect(spacingStepsUsed('h-13 min-w-13 max-h-13 size-13')).toEqual(['13']);
    expect(spacingStepsUsed('inset-13 top-13 left-13 translate-x-13')).toEqual(['13']);
    expect(spacingStepsUsed('basis-13 indent-13 scroll-mt-13 scroll-p-13')).toEqual(['13']);
  });

  it('reads variants, negatives and important markers', () => {
    expect(spacingStepsUsed('md:gap-13')).toEqual(['13']);
    expect(spacingStepsUsed('-mt-13')).toEqual(['13']);
    expect(spacingStepsUsed('!gap-13')).toEqual(['13']);
    expect(spacingStepsUsed("clsx('gap-13', flag && 'pt-97')")).toEqual(['13', '97']);
  });

  it('reads every spacing prefix the theme can drop', () => {
    expect(spacingStepsUsed('mx-4.5 space-y-4.5 pb-4.5')).toEqual(['4.5']);
  });

  it('separates steps Tailwind ships from steps it would drop', () => {
    // The point of the built-in list: p-4 and gap-12 are real, gap-13 and
    // gap-97 are not, and the difference is invisible at runtime.
    expect(BUILT_IN_SPACING_STEPS.has('12')).toBe(true);
    expect(BUILT_IN_SPACING_STEPS.has('13')).toBe(false);
    expect(BUILT_IN_SPACING_STEPS.has('97')).toBe(false);
    expect(BUILT_IN_SPACING_STEPS.has('4.5')).toBe(false);
  });
});

describe('declaredSpacingSteps', () => {
  const config = `
    spacing: {
      '4.5': '1.125rem',
    },
    fontSize: {
      '2xs': ['11px', '1.4'],
      '13.5': ['13.5px', '1.4'],
    },
  `;

  it('reads the steps declared under spacing', () => {
    expect(declaredSpacingSteps(config).has('4.5')).toBe(true);
  });

  it('does not count a step declared under a different theme key', () => {
    // The old check was `config.includes("'13.5':")` against the whole config
    // text, so a value under fontSize or borderRadius satisfied the SPACING
    // guard. The assertion was not what its name said.
    expect(declaredSpacingSteps(config).has('13.5')).toBe(false);
  });

  it('returns nothing when there is no spacing block at all', () => {
    expect(declaredSpacingSteps('fontSize: { base: 1 }').size).toBe(0);
  });

  it('does not bind to a commented-out spacing block', () => {
    // The permissive failure: a comment such as "rejected: spacing: { '13' }"
    // would make the guard treat 13 as declared, after which gap-13 passes
    // while Tailwind silently drops it. The real config already carries a
    // four-line comment directly above its spacing block.
    const withComment = `
      // rejected: spacing: { '13': '3.25rem' } - use 12
      spacing: { '4.5': '1.125rem' },
    `;
    const steps = declaredSpacingSteps(withComment);
    expect(steps.has('4.5')).toBe(true);
    expect(steps.has('13')).toBe(false);
  });

  it('does not count a key from a nested object as a step', () => {
    const nested = `spacing: { '4.5': 'a', nested: { '13': 'b' } },`;
    const steps = declaredSpacingSteps(nested);
    expect(steps.has('4.5')).toBe(true);
    expect(steps.has('13')).toBe(false);
  });
});

describe('tokensReferencedBy', () => {
  it('reads a custom property with capitals in its name', () => {
    // The lowercase-only pattern truncated var(--brandFuchsia) to --brand,
    // which would report a contract failure naming a token nobody wrote.
    expect(tokensReferencedBy('color: var(--brandFuchsia);')).toEqual(['--brandFuchsia']);
  });
});

describe('tokensReferencedBy', () => {
  it('finds custom properties read through var()', () => {
    expect(tokensReferencedBy('background: var(--surface-3); color: var(--ink);')).toEqual([
      '--ink',
      '--surface-3',
    ]);
  });

  it('tolerates a fallback value', () => {
    expect(tokensReferencedBy('color: var(--ink, black);')).toEqual(['--ink']);
  });

  it('reports each token once', () => {
    expect(tokensReferencedBy('var(--ink) var(--ink)')).toEqual(['--ink']);
  });
});

describe('isScannableSource', () => {
  it('scans ordinary components and pages', () => {
    expect(isScannableSource('/w/src/components/Chip.tsx')).toBe(true);
    expect(isScannableSource('/w/src/pages/activeFilterCount.ts')).toBe(true);
  });

  it('skips test files, whose allowlists contain the literals they permit', () => {
    // tokens.test.ts carries '#fff'; Avatar.test.tsx carries 'brand-fuchsia'.
    expect(isScannableSource('/w/src/styles/tokens.test.ts')).toBe(false);
    expect(isScannableSource('/w/src/components/Avatar.test.tsx')).toBe(false);
    expect(isScannableSource('/w/src/test/setup.ts')).toBe(false);
  });

  it('skips this module, whose doc comments name the classes it rejects', () => {
    // Found the hard way: the widened spacing rule reported two violations,
    // and both were sentences in token-rules.ts explaining the rule.
    expect(isScannableSource('/w/src/styles/token-rules.ts')).toBe(false);
  });

  it('skips files that are not TypeScript', () => {
    expect(isScannableSource('/w/src/styles/tokens.css')).toBe(false);
  });
});
