/**
 * Colour maths shared by the generator and the contrast check.
 *
 * One copy, because a checker that measures contrast differently from the generator that
 * produced the colour is a checker that can pass a file the generator could never emit.
 */

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** sRGB 0-255 triple from a hex string or an `hsl(H S% L%)` string. Null if neither. */
export function toRgb(value) {
  const v = String(value).trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const hsl = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i.exec(v);
  if (hsl) return hslToRgb(+hsl[1], +hsl[2], +hsl[3]);
  return null;
}

export function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((x) => Math.round(255 * x));
}

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [((h * 60) + 360) % 360, s * 100, l * 100];
}

export const toHex = ([r, g, b]) =>
  "#" + [r, g, b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")).join("");

const channel = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance. */
export const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast ratio, 1 to 21. Order of the arguments does not matter. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The nearest colour to `start` that clears `target` against every ground given.
 *
 * Lightness only, in HSL, so the hue and saturation a palette was picked for survive: a
 * "lift it until it passes" that also desaturates would hand back a grey and quietly undo
 * the reason fifteen palettes exist.
 *
 * The direction is decided by which side of the ground the colour already sits on, so this
 * works unchanged for a light palette, where passing means going darker rather than lighter.
 * Returns the input untouched when it already passes, which is what keeps the three palettes
 * that were already legible byte-identical.
 */
export function liftToContrast(start, grounds, target) {
  const rgb = toRgb(start);
  if (!rgb) throw new Error(`not a colour: ${start}`);
  const worst = (c) => Math.min(...grounds.map((g) => contrast(c, toRgb(g))));
  if (worst(rgb) >= target) return toHex(rgb);

  const [h, s, l0] = rgbToHsl(rgb);
  const ground = toRgb(grounds[0]);
  // Away from the ground it has to be read against, not simply toward white.
  const up = luminance(rgb) >= luminance(ground);

  let best = null;
  for (let step = 0; step <= 1000; step++) {
    const l = clamp(up ? l0 + step * 0.1 : l0 - step * 0.1, 0, 100);
    const candidate = hslToRgb(h, s, l);
    if (worst(candidate) >= target) { best = candidate; break; }
    if (l === 0 || l === 100) break;
  }
  // Pinned to pure white or pure black and still short: the ground itself is the problem,
  // and silently returning something that fails is how a guard gets to pass on a lie.
  if (!best) throw new Error(`cannot reach ${target}:1 from ${start} on ${grounds.join(", ")}`);
  return toHex(best);
}
