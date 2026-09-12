#!/usr/bin/env node
/**
 * Emit CSS custom properties from the palettes.
 *
 * Generated rather than hand-written for the same reason the swatch sheet is: a palette that
 * changes must not be able to disagree with the CSS built from it. Re-run after editing any
 * theme; CI checks the output is current.
 *
 * The source names every colour for what it MEANS -- success, error, warning -- rather than
 * for where it appears, which is why one palette can dress a terminal, an editor and a web
 * page without being re-picked for each.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { contrast, liftToContrast, toHex, toRgb } from "./colour.mjs";
import { TEXT_MIN, UI_MIN } from "./contrast-targets.mjs";

const SRC = "cli";
const OUT = "css";

/** Source key -> CSS custom property. Anything unmapped is deliberately not exported. */
const MAP = {
  claude: "accent",
  suggestion: "accent-2",
  text: "fg",
  inactive: "dim",
  subtle: "edge",
  success: "ok",
  warning: "warn",
  error: "err",
  permission: "caution",
};

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Surfaces are TINTED TOWARD THE PALETTE'S OWN ACCENT.
 *
 * A fixed set of greys was the first version and it was wrong: the ground is most of what
 * you see, so identical surfaces make every palette look like the same theme with different
 * trim. Pulling the hue from the accent and desaturating hard gives each palette its own
 * near-black, or its own off-white, which is the part the eye actually reads as "a theme".
 */
function hueOf(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 250;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 250;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
}

/**
 * How much tint a hue can carry before it looks dirty.
 *
 * Warm and cool hues do not take the same saturation at low lightness. A blue at 26% reads
 * as night; an orange at 26% reads as mud. Warmth peaks around hue 30 and bottoms out around
 * 210, so the tint is scaled down as a hue approaches orange.
 */
function tintCeiling(h) {
  const warmth = (Math.cos(((h - 30) * Math.PI) / 180) + 1) / 2; // 1 at orange, 0 at teal
  return 1 - 0.62 * warmth; // orange keeps ~38% of the tint, blue keeps all of it
}

function surfaces(base, accent) {
  const h = hueOf(accent);
  const k = tintCeiling(h);
  const s = (n) => `${(n * k).toFixed(1)}%`;
  return base === "light"
    ? { bg: `hsl(${h} ${s(34)} 97%)`, panel: `hsl(${h} ${s(46)} 99.5%)`, raised: `hsl(${h} ${s(30)} 94%)` }
    : { bg: `hsl(${h} ${s(26)} 6.5%)`, panel: `hsl(${h} ${s(22)} 10.5%)`, raised: `hsl(${h} ${s(20)} 15%)` };
}

/**
 * The label inside a filled accent button.
 *
 * Both candidates come from the palette itself rather than from black and white, so the
 * button still belongs to its theme. The better of the two wins outright: a tie-break on
 * "prefer --bg" would keep the unreadable one on exactly the palettes this is for.
 */
function onAccent(accent, bg, fg) {
  const a = toRgb(accent);
  const candidates = [bg, fg].filter(Boolean);
  // Whichever extreme is already further from the accent, then taken the rest of the way.
  // Starting from the nearer one and lifting it would cross the accent and come back out
  // the other side as a colour from neither end of the palette.
  const best = candidates.reduce((x, y) => (contrast(a, toRgb(y)) > contrast(a, toRgb(x)) ? y : x));
  return liftToContrast(best, [accent], TEXT_MIN);
}

mkdirSync(OUT, { recursive: true });

const themes = readdirSync(SRC)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(SRC, f), "utf8")))
  .sort((a, b) => a.name.localeCompare(b.name));

for (const t of themes) {
  const base = t.base === "light" ? "light" : "dark";
  const o = t.overrides ?? {};
  const surface = surfaces(base, o.claude ?? "#8b7cf6");
  const vars = Object.fromEntries(
    Object.entries(MAP).filter(([src]) => o[src]).map(([src, css]) => [css, o[src]]),
  );

  /*
   * Every text colour is corrected against the ground it will be read on, and only here.
   *
   * The source palettes name colours for a TERMINAL, where `inactive` sits on whatever
   * background the reader's terminal has. On a web page it sits on --bg and --panel, which
   * this file invents, so nothing upstream could have checked it against them - and it did
   * not pass. --dim carries every note, caption, legend and secondary heading on these
   * pages, and against --bg it was under 4.5:1 on twelve of the fifteen palettes, as low as
   * 2.24; a thirteenth cleared --bg and fell short on --panel.
   *
   * Corrected here rather than in cli/*.json so the terminal and editor themes keep the
   * colours they were picked with, and corrected by lightness alone so a palette does not
   * lose the hue that makes it that palette. A colour that already clears the threshold
   * comes back untouched, so a palette that was already legible is byte-identical.
   *
   * scripts/check-contrast.mjs measures the result. It is a separate pass on purpose: a
   * generator that also grades its own output has no way to catch the case where the
   * correction itself is what is wrong.
   */
  // Against all three surfaces, not just the page. --raised is where a chip, a track or a
  // token sits, and text goes on top of those: --dim on --raised was the one pairing left
  // failing after the first pass, at 4.04:1 under a tokenizer's ids.
  const grounds = [surface.bg, surface.panel, surface.raised];
  // --accent-2 is in this list and --accent is not, which looks inconsistent and is not.
  // The source calls it `suggestion`: it is a colour for WORDS, and it is used as words
  // everywhere it appears - a unit in a margin, a confidence band, a tag. It was under
  // 4.5:1 on nine of the fifteen palettes, as low as 2.11, on the one figure a notepad
  // exists to show. --accent is a fill and a brand mark, so it keeps its value and hands
  // the readable variant to --accent-text below.
  for (const token of ["dim", "accent-2", "err", "warn", "ok", "caution"]) {
    if (vars[token]) vars[token] = liftToContrast(vars[token], grounds, TEXT_MIN);
  }

  /*
   * --accent is NOT corrected, and the two tokens below are why.
   *
   * The accent is the colour the palette is recognised by. Lifting it until it passes as
   * text would repaint the brand to satisfy a caption, and on the two palettes that need the
   * most lift it would stop being the colour anyone picked. So the fill keeps its value and
   * the readable variants are separate: --accent-text is the same hue taken to text
   * contrast, for a word or an outline drawn IN the accent; --on-accent is whichever of the
   * palette's own two extremes is legible ON the accent, for the label inside a filled
   * button, which was --bg on every palette including the ones where --bg is unreadable there.
   */
  if (vars.accent) {
    vars["accent-text"] = liftToContrast(vars.accent, grounds, TEXT_MIN);
    vars["on-accent"] = onAccent(vars.accent, surface.bg, vars.fg);
  }

  /*
   * --edge draws separators AND the underline that is the only thing saying an input is an
   * input. At 1.42:1 on the worst palette that underline was invisible. Rather than make
   * every hairline on the page shout, the strengthened one is a second token, so a border
   * that is decoration and a border that is an affordance stop having to be one colour.
   */
  if (vars.edge) vars["edge-strong"] = liftToContrast(vars.edge, [surface.bg], UI_MIN);

  const lines = [
    ...Object.entries(surface).map(([k, v]) => `  --${k}: ${v};`),
    ...Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`),
  ];

  const css = `/* ${t.name} - generated by scripts/css.mjs. Do not edit by hand. */
:root {
${lines.join("\n")}
  --radius: 12px;
  color-scheme: ${base};
}
`;
  writeFileSync(join(OUT, `${slug(t.name)}.css`), css);
}

/**
 * Paired files, one dark palette and one light, switched by the reader's own preference.
 *
 * A page that only looks right in one theme is not finished, and shipping two separate
 * stylesheets to be chosen by hand is the version everyone forgets to update.
 */
const PAIRS = [
  ["twilight-comet", "wisteria-alley"],
  ["coral-horizon", "neko-lantern"],
  ["rain-lantern", "sakura-road"],
  ["amethyst-yokai", "cherry-blossom-dusk"],
  ["moonlit-village", "sakura-lake"],
];

const bodyOf = (slugName) => {
  const css = readFileSync(join(OUT, `${slugName}.css`), "utf8");
  const m = /:root \{([\s\S]*?)\}/.exec(css);
  if (!m) throw new Error(`No :root block in ${slugName}.css`);
  return m[1].replace(/\n\s*color-scheme:[^;]+;/, "").trimEnd();
};

for (const [dark, light] of PAIRS) {
  const out = `/* ${dark} + ${light} - generated by scripts/css.mjs. Do not edit by hand. */
:root {
  color-scheme: dark light;
${bodyOf(dark)}
}

@media (prefers-color-scheme: light) {
  :root {
${bodyOf(light).split("\n").map((l) => "  " + l).join("\n")}
  }
}
`;
  writeFileSync(join(OUT, `pair-${dark}.css`), out);
}

console.log(`Wrote ${themes.length} palettes and ${PAIRS.length} pairs to ${OUT}/`);
