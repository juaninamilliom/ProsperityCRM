/** The checks behind the design-system guards, as pure functions.
 *
 *  They live here rather than inside the test files so they can be exercised
 *  against known violations. The guards this replaces asserted only that the
 *  tree was clean, which a broken scanner satisfies exactly as well as a clean
 *  tree - and both of them were quietly broken. See token-rules.test.ts. */

/** Replaces comment bodies and quoted-string bodies with spaces of equal
 *  length, so indices into the masked copy stay valid against the original.
 *
 *  Both scanners below need this, and both failed silently without it, in the
 *  permissive direction: a `}` inside a CSS comment or a quoted value ended a
 *  block early, and a commented-out `spacing: {` bound the spacing lookup to
 *  prose. */
export function maskNonCode(text: string): string {
  const out = text.split('');
  let i = 0;
  const blank = (from: number, to: number) => {
    for (let j = from; j < to && j < out.length; j++) if (out[j] !== '\n') out[j] = ' ';
  };

  while (i < text.length) {
    const pair = text.slice(i, i + 2);
    if (pair === '/*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (pair === '//') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      blank(i, stop);
      i = stop;
    } else if (text[i] === '"' || text[i] === "'" || text[i] === '`') {
      const quote = text[i];
      let j = i + 1;
      while (j < text.length && text[j] !== quote) {
        if (text[j] === '\\') j++;
        j++;
      }
      blank(i + 1, j);
      i = j + 1;
    } else {
      i++;
    }
  }
  return out.join('');
}

function matchingBrace(masked: string, open: number): number {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '{') depth++;
    else if (masked[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Custom properties declared in a CSS block.
 *
 *  The first version took the first `}` after the block opened, which held
 *  only while tokens.css stayed two flat blocks. The second counted depth but
 *  scanned raw text, so a `}` inside a comment or a quoted value still ended
 *  the block early. Either way the variable set truncates and the light/dark
 *  parity assertion compares two short lists and passes vacuously. */
export function varsInBlock(css: string, selector: string): string[] {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`missing block: ${selector}`);

  const masked = maskNonCode(css);
  const open = masked.indexOf('{', start);
  if (open === -1) throw new Error(`missing block body: ${selector}`);

  const close = matchingBrace(masked, open);
  if (close === -1) throw new Error(`unterminated block: ${selector}`);

  return [...css.slice(open, close).matchAll(/(--[A-Za-z0-9-]+)\s*:/g)]
    .map((match) => match[1])
    .sort();
}

/** Every utility family that draws its scale from `theme.spacing`.
 *
 *  Not just gap and padding. Verified with `tailwindcss/resolveConfig` against
 *  this project's own config: width, height, min/max, size, inset, translate,
 *  flex-basis, indent, scroll-margin and scroll-padding all inherit the
 *  spacing scale, so `w-13` is dropped exactly as silently as `gap-13`.
 *
 *  An earlier version covered only gap, padding, margin and space - and its
 *  own test asserted that `w-1.5` was "not a spacing utility", which locked
 *  roughly 180 live call sites out of the guard under a false label. */
const SPACING_UTILITY = new RegExp(
  String.raw`\b(?:` +
    [
      'gap-x', 'gap-y', 'gap',
      'px', 'py', 'pt', 'pb', 'pl', 'pr', 'ps', 'pe', 'p',
      'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'ms', 'me', 'm',
      'space-x', 'space-y',
      'min-w', 'max-w', 'min-h', 'max-h', 'w', 'h', 'size',
      'inset-x', 'inset-y', 'inset', 'top', 'right', 'bottom', 'left', 'start', 'end',
      'translate-x', 'translate-y', 'basis', 'indent',
      'scroll-mx', 'scroll-my', 'scroll-mt', 'scroll-mb', 'scroll-ml', 'scroll-mr', 'scroll-m',
      'scroll-px', 'scroll-py', 'scroll-pt', 'scroll-pb', 'scroll-pl', 'scroll-pr', 'scroll-p',
    ].join('|') +
    String.raw`)-(\d+(?:\.\d+)?)\b`,
  'g',
);

/** Spacing steps used in a source file.
 *
 *  Matches whole numbers as well as fractions: the earlier pattern required a
 *  decimal point, so `gap-13` - a slipped keystroke that Tailwind drops in
 *  silence - was invisible to it.
 *
 *  Two limits, both deliberate. It scans comments and string literals, so
 *  prose such as a URL path can report a step; callers report which file, so a
 *  false positive is a five-second read rather than a mystery. And a class
 *  built by template literal is invisible - but Tailwind's own content scanner
 *  cannot see those either, so such a class is already broken by a different
 *  mechanism, and nothing in this repo builds one. */
export function spacingStepsUsed(source: string): string[] {
  const steps = new Set<string>();
  for (const match of source.matchAll(SPACING_UTILITY)) steps.add(match[1]);
  return [...steps].sort();
}

/** Steps declared under the theme's `spacing` key, and only that key.
 *
 *  The earlier check was a substring search across the whole config text, so a
 *  value declared under `fontSize` or `borderRadius` satisfied the *spacing*
 *  guard - the assertion was not what its name said. Comments are masked
 *  first, because a commented-out `spacing: { '13': ... }` would otherwise
 *  bind the lookup to prose and mark an undeclared step as declared. Nested
 *  objects are dropped, so a key inside one is not counted as a step. */
export function declaredSpacingSteps(configText: string): Set<string> {
  const masked = maskNonCode(configText);
  const start = masked.search(/\bspacing\s*:\s*\{/);
  if (start === -1) return new Set();

  const open = masked.indexOf('{', start);
  const close = matchingBrace(masked, open);
  if (close === -1) return new Set();

  // Find nested objects on the masked slice, where braces cannot hide inside a
  // comment or a string, then blank those ranges in the ORIGINAL slice - the
  // mask has already blanked the quoted keys this needs to read.
  const maskedBlock = masked.slice(open + 1, close);
  const block = configText.slice(open + 1, close).split('');
  let depth = 0;
  for (let i = 0; i < maskedBlock.length; i++) {
    if (maskedBlock[i] === '{') depth++;
    if (depth > 0) block[i] = ' ';
    if (maskedBlock[i] === '}') depth--;
  }

  return new Set([...block.join('').matchAll(/['"]([\d.]+)['"]\s*:/g)].map((match) => match[1]));
}

/** Custom properties read through `var()` in a source file. */
export function tokensReferencedBy(source: string): string[] {
  const tokens = new Set<string>();
  for (const match of source.matchAll(/var\(\s*(--[A-Za-z0-9-]+)/g)) tokens.add(match[1]);
  return [...tokens].sort();
}

/** Whether a file's contents should be scanned by these guards.
 *
 *  A scanner must not scan its own examples. This module's doc comments name
 *  the very classes it exists to reject, and the existing guards' allowlists
 *  contain the literals they permit - `tokens.test.ts` carries '#fff',
 *  `Avatar.test.tsx` carries 'brand-fuchsia'. A walker that reads those
 *  reports its own documentation as a violation, which happened three times
 *  while this file was being written.
 *
 *  Callers pass a workspace-relative path, so a checkout living under a
 *  directory named `test` does not exclude the entire tree. */
export function isScannableSource(path: string): boolean {
  if (/\.test\.tsx?$/.test(path)) return false;
  if (/(^|[/\\])test[/\\]/.test(path)) return false;
  if (/(^|[/\\])token-rules\.ts$/.test(path)) return false;
  return /\.tsx?$/.test(path);
}

/** Tailwind v3's default spacing scale, verbatim, minus `px` - which the
 *  numeric capture above can never produce. Checked against
 *  `require('tailwindcss/defaultTheme').spacing` on tailwindcss 3.4.18.
 *
 *  Listing it in full is what lets the guard see a whole-number typo; checking
 *  only fractions meant `gap-13` and `gap-97` both passed.
 *
 *  Correct for v3 ONLY. v4 replaces the fixed scale with a `--spacing`
 *  multiplier under which `gap-13` is legitimate, so a v4 upgrade turns this
 *  list from a guard into a false-positive generator. Nothing here pins the
 *  version; re-check it when the dependency moves. */
export const BUILT_IN_SPACING_STEPS = new Set([
  '0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8', '9',
  '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40', '44', '48',
  '52', '56', '60', '64', '72', '80', '96',
]);
