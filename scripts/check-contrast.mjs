#!/usr/bin/env node
/**
 * Every generated palette is legible on its own surfaces.
 *
 * This measures css/, not cli/, because css/ is where --bg and --panel exist: the source
 * palettes name colours for a terminal whose background nobody here controls, and the
 * grounds these colours are actually read on are invented by scripts/css.mjs. So this is
 * the only place the pairing can be checked at all.
 *
 * It reads the built files rather than recomputing them from the palettes, so a css/ that
 * somebody edited by hand is measured as it will ship. `node scripts/css.mjs` and the
 * generated-output check in CI are what keep the two in step.
 *
 *   node scripts/check-contrast.mjs              measure css/ and fail on any shortfall
 *   node scripts/check-contrast.mjs --self-test  prove the measurement can fail
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { contrast, toRgb } from "./colour.mjs";
import { TEXT_MIN, UI_MIN } from "./contrast-targets.mjs";

const DIR = "css";

/**
 * What has to be readable on what.
 *
 * Only pairs that really meet on a page. --edge is absent on purpose: it draws separators
 * and panel hairlines, which are decoration, and holding it to 3:1 would turn every
 * hairline into a rule. The border that is an affordance is --edge-strong, and that one is
 * checked.
 */
const RULES = [
  { fg: "fg", on: ["bg", "panel", "raised"], min: TEXT_MIN, why: "body text" },
  { fg: "dim", on: ["bg", "panel", "raised"], min: TEXT_MIN, why: "notes, captions, secondary headings" },
  { fg: "err", on: ["bg", "panel", "raised"], min: TEXT_MIN, why: "error text" },
  { fg: "warn", on: ["bg", "panel", "raised"], min: TEXT_MIN, why: "warning text" },
  { fg: "ok", on: ["bg", "panel", "raised"], min: TEXT_MIN, why: "success text" },
  { fg: "caution", on: ["bg", "panel", "raised"], min: TEXT_MIN, why: "caution text" },
  { fg: "accent-text", on: ["bg", "panel", "raised"], min: TEXT_MIN, why: "a word, or an outline, drawn in the accent" },
  { fg: "on-accent", on: ["accent"], min: TEXT_MIN, why: "the label inside a filled button" },
  { fg: "edge-strong", on: ["bg"], min: UI_MIN, why: "the underline that says a field is a field" },
];

/** The --token: value pairs of a generated palette's `:root` block. */
function tokensOf(css) {
  const out = {};
  for (const [, k, v] of css.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[k] = v.trim();
  return out;
}

/** Every shortfall in one palette, as readable lines. Empty means it passes. */
export function shortfalls(name, tokens) {
  const bad = [];
  for (const rule of RULES) {
    const fg = tokens[rule.fg];
    if (!fg) continue;
    for (const groundName of rule.on) {
      const ground = tokens[groundName];
      if (!ground) continue;
      const a = toRgb(fg), b = toRgb(ground);
      if (!a || !b) continue;
      const ratio = contrast(a, b);
      if (ratio + 1e-9 < rule.min) {
        bad.push(
          `${name}: --${rule.fg} on --${groundName} is ${ratio.toFixed(2)}:1, needs ${rule.min} (${rule.why})`,
        );
      }
    }
  }
  return bad;
}

/**
 * The check can fail.
 *
 * A contrast check that silently measured nothing - a renamed token, a regex that stopped
 * matching, an empty directory - would pass every run and read as a clean bill of health.
 * This plants a palette that must fail and refuses to go green unless it does, so the guard
 * is proven on the same run that uses it rather than the day somebody remembers to try.
 */
function selfTest() {
  const planted = {
    bg: "#101010", panel: "#141414", raised: "#181818",
    fg: "#2b2b2b", dim: "#2a2a2a", err: "#221111", warn: "#221a11", ok: "#112211", caution: "#221a11",
    accent: "#8b7cf6", "accent-text": "#1a1730", "on-accent": "#8f80f8", "edge-strong": "#151515",
  };
  const found = shortfalls("planted", planted);
  // One per rule, so a rule that stops measuring is caught rather than covered by its neighbour.
  const wanted = [
    "--fg on --raised", "--dim on --bg", "--dim on --panel", "--err on --bg", "--warn on --bg",
    "--ok on --bg", "--caution on --bg", "--accent-text on --bg", "--on-accent on --accent",
    "--edge-strong on --bg",
  ];
  const missed = wanted.filter((w) => !found.some((f) => f.includes(w)));
  if (missed.length) {
    console.error("self-test: the check did NOT catch " + missed.join(", "));
    process.exit(1);
  }
  // And the reverse: a palette that passes must not be reported, or the check is just noise.
  const clean = {
    bg: "#101010", panel: "#141414", raised: "#181818",
    fg: "#ffffff", dim: "#9a9a9a", err: "#ff8b8b", warn: "#e0a860", ok: "#6fcf97", caution: "#e0a860",
    accent: "#8b7cf6", "accent-text": "#a99bff", "on-accent": "#0c0a18", "edge-strong": "#6a6a6a",
  };
  if (shortfalls("clean", clean).length) {
    console.error("self-test: the check reported a palette that passes");
    process.exit(1);
  }
  console.log(`self-test: ${found.length} shortfalls found on the planted palette, none on the clean one`);
}

if (process.argv.includes("--self-test")) selfTest();

const files = readdirSync(DIR).filter((f) => f.endsWith(".css") && !f.startsWith("pair-") && !f.startsWith("type-"));
const palettes = files.filter((f) => !["base.css", "layout-flat.css", "motion.css", "texture.css"].includes(f));

// An empty run is the failure mode a threshold check cannot report on its own.
if (palettes.length < 10) {
  console.error(`only ${palettes.length} palettes found in ${DIR}/, which cannot be right`);
  process.exit(1);
}

let bad = [];
for (const f of palettes.sort()) {
  bad = bad.concat(shortfalls(f.replace(/\.css$/, ""), tokensOf(readFileSync(join(DIR, f), "utf8"))));
}

if (bad.length) {
  for (const line of bad) console.error(line);
  console.error(`\n${bad.length} shortfall(s). Fix the palette, or the correction in scripts/css.mjs.`);
  process.exit(1);
}
console.log(`${palettes.length} palettes, ${RULES.length} rules each, all clear.`);
