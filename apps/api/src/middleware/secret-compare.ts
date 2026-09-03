import crypto from 'node:crypto';

/** Compares two secrets in time that does not depend on where they diverge.
 *
 *  Both sides are hashed first, which is what avoids the two traps of using
 *  crypto.timingSafeEqual directly: it throws on mismatched buffer lengths -
 *  which would become a 500 telling the caller their guess was the wrong size -
 *  and comparing the raw strings would leak the length through that throw.
 *  SHA-256 digests are always 32 bytes, so the comparison is always defined
 *  and always the same width. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const left = crypto.createHash('sha256').update(a, 'utf8').digest();
  const right = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(left, right);
}
