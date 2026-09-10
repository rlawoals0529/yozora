/**
 * Two text reveals, both written here rather than installed.
 *
 * The idea for each is old and widely used; what matters is that the effect suits the
 * thing it is on. A fade suits nothing in particular, which is why it is everywhere.
 */

/** Characters a scramble draws from. Kept to shapes with even weight, so the line does
 *  not visibly darken and lighten while it resolves. */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&/<>";

/**
 * How far through a scramble each character is.
 *
 * Characters settle left to right rather than all at once, because a word that resolves
 * in reading order looks like it is being decoded and one that resolves together looks
 * like a glitch. `progress` runs 0 to 1.
 *
 * Deterministic: the glyph shown for a given index at a given step is a function of both,
 * never of Math.random, so a screenshot of a half-resolved line is reproducible and a
 * test can assert on it.
 */
export function scramble(text: string, progress: number, seed = 0): string {
  const p = Math.min(1, Math.max(0, progress));
  if (p >= 1) return text;

  const chars = [...text];
  // Every character needs a share of the timeline plus an overlap, or the last one only
  // starts moving as the animation ends.
  const per = 1 / Math.max(1, chars.length);
  const step = Math.floor(p * 60);

  return chars
    .map((c, i) => {
      if (c === " ") return c;
      const settled = p >= (i + 1) * per * 0.85;
      if (settled) return c;
      const n = Math.abs(Math.sin((i + 1) * 12.9898 + step * 7.233 + seed) * 43758.5453);
      return GLYPHS[Math.floor(n % GLYPHS.length)] ?? c;
    })
    .join("");
}

/**
 * The sequence of faces a split-flap shows on its way from one character to the next.
 *
 * A real board steps through the alphabet rather than cutting, and that stepping is the
 * whole appeal: you can read where a value is heading before it arrives. Digits step
 * through digits only, so a number never flickers through letters on its way to 7.
 */
const DIGITS = "0123456789";

export function flapSequence(from: string, to: string, max = 12): string[] {
  if (from === to) return [to];
  const isDigit = DIGITS.includes(from) && DIGITS.includes(to);
  const set = isDigit ? DIGITS : GLYPHS;

  const start = set.indexOf(from);
  const end = set.indexOf(to);
  // A character outside the set has nowhere to step from, so it simply lands.
  if (start < 0 || end < 0) return [to];

  const out: string[] = [];
  let at = start;
  while (at !== end && out.length < max) {
    at = (at + 1) % set.length;
    out.push(set[at]!);
  }
  // Always finish on the target, even if the step budget ran out on the way.
  if (out[out.length - 1] !== to) out.push(to);
  return out;
}

/**
 * The whole board at one step: each column stepping towards its target independently.
 *
 * Columns are padded from the left so a number growing a digit does not shove the ones
 * beside it sideways mid-flip.
 */
export function flapAt(from: string, to: string, step: number): string {
  const width = Math.max(from.length, to.length);
  const a = from.padStart(width, " ");
  const b = to.padStart(width, " ");
  return [...b]
    .map((target, i) => {
      const seq = flapSequence(a[i] ?? " ", target);
      return seq[Math.min(step, seq.length - 1)] ?? target;
    })
    .join("");
}

/** The longest any column will take, so a caller knows when the board has settled. */
export function flapSteps(from: string, to: string): number {
  const width = Math.max(from.length, to.length);
  const a = from.padStart(width, " ");
  const b = to.padStart(width, " ");
  return Math.max(1, ...[...b].map((t, i) => flapSequence(a[i] ?? " ", t).length));
}
