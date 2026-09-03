import { describe, expect, it } from 'vitest';
import { timingSafeEqualString } from './secret-compare.js';

/** The root-admin token was compared with `!==`, which returns as soon as two
 *  bytes differ. Against `generateValue: true` on Render a network-side timing
 *  attack is not realistically exploitable and brute force is infeasible - so
 *  this is hardening, not a live bypass, and the rate limiter is the half of
 *  T4 that actually matters. It is still one function and worth having right.
 *
 *  Hashing both sides first is what avoids the two traps: crypto.timingSafeEqual
 *  throws on mismatched lengths, and comparing raw strings leaks the length. */

describe('timingSafeEqualString', () => {
  it('accepts identical secrets', () => {
    expect(timingSafeEqualString('correct-horse-battery', 'correct-horse-battery')).toBe(true);
  });

  it('rejects a different secret of the same length', () => {
    expect(timingSafeEqualString('correct-horse-battery', 'correct-horse-batterX')).toBe(false);
  });

  it('rejects a different length without throwing', () => {
    // crypto.timingSafeEqual throws on mismatched buffer lengths, which would
    // become a 500 and tell the caller their guess was the wrong size.
    expect(() => timingSafeEqualString('short', 'a-much-longer-secret')).not.toThrow();
    expect(timingSafeEqualString('short', 'a-much-longer-secret')).toBe(false);
  });

  it('treats two empty strings as equal, and leaves the caller to reject empty', () => {
    // requireRootAdmin refuses an unconfigured token before it ever compares,
    // so this function does not need to special-case it - but it must not
    // pretend two empties differ either.
    expect(timingSafeEqualString('', '')).toBe(true);
  });

  it('rejects an empty guess against a real secret', () => {
    expect(timingSafeEqualString('', 'a-real-secret')).toBe(false);
  });

  it('does not collide on unicode that normalises differently', () => {
    expect(timingSafeEqualString('café', 'café')).toBe(false);
  });
});
