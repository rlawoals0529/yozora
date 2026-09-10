#!/usr/bin/env node
/**
 * Copy this design system into a project, stamped so nobody edits the copy.
 *
 * There is no package to install and no git dependency, on purpose. A git dependency is
 * how a sibling repo ended up with CI that cannot run `npm install` at all, because the
 * dependency is private. A copy with a header naming where it came from has none of that
 * problem, and the only thing it needs is a way to refresh it that is not a person
 * remembering six paths.
 *
 * Usage:
 *   node scripts/vendor.mjs ../tokenview --palette rain-lantern --type ink-study --js
 *   node scripts/vendor.mjs ../tokenview --list
 *   node scripts/vendor.mjs ../hikari --palettes-dir widgets/palettes
 *
 * Two files are per-project and the rest are not:
 *   palette.css  one of css/pair-*.css, because a project picks a palette
 *   type.css     one of css/type-*.css, because a project picks a type pairing
 *
 * The others are the same in every project, which is checkable: run this and then diff.
 * They were byte-identical across four projects before this script existed, which is the
 * argument for it rather than against.
 *
 * `--palettes-dir` is the other shape a consumer can want, and it exists because one of
 * them does: a desktop app that lets you pick a palette while it is running needs all of
 * them on disk, not one chosen at vendor time. It copies the single-scheme palettes rather
 * than the pairs, because a picker is the user saying which they want and a pair is the
 * operating system saying it. Both modes can be used together.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Files that are identical everywhere, as [source, destination]. */
const SHARED_CSS = ["base.css", "layout-flat.css", "motion.css", "texture.css"];

/** The React helpers. Opt in, because a project that renders no React does not want them. */
const JS = ["motion.tsx", "motion.test.ts"];

/** The text reveals. Opt in separately: nothing uses them yet, and a copy nothing imports
 *  is dead code that still has to be kept in step. */
const REVEAL = ["reveal.ts", "reveal.test.ts"];

const options = (argv) => {
  const out = { target: null, palette: null, type: null, js: false, reveal: false, list: false, palettesDir: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--js") out.js = true;
    else if (a === "--reveal") out.reveal = true;
    else if (a === "--list") out.list = true;
    else if (a === "--palette") out.palette = argv[++i];
    else if (a === "--palettes-dir") out.palettesDir = argv[++i];
    else if (a === "--type") out.type = argv[++i];
    else if (a.startsWith("--")) die(`unknown option ${a}`);
    else rest.push(a);
  }
  out.target = rest[0] ?? null;
  return out;
};

function die(msg) {
  console.error(`vendor: ${msg}`);
  process.exit(1);
}

const names = (prefix) =>
  readdirSync(join(HERE, "css"))
    .filter((f) => f.startsWith(prefix) && f.endsWith(".css"))
    .map((f) => f.slice(prefix.length, -".css".length))
    .sort();

/**
 * The header, which is the whole point of copying rather than importing.
 *
 * It names the file it came from, so refreshing it is a command rather than a search, and
 * it says not to edit here, because an edit to a copy is lost the moment anyone refreshes.
 */
const header = (source, comment) =>
  comment === "css"
    ? `/* Vendored from yozora/${source}. Refresh with \`node scripts/vendor.mjs\` there,\n   never edit here. */\n`
    : `// Vendored from yozora/${source}. Refresh with \`node scripts/vendor.mjs\` there,\n// never edit here.\n`;

function copy(source, dest, kind) {
  const from = join(HERE, source);
  if (!existsSync(from)) die(`${source} does not exist`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, header(source, kind) + readFileSync(from, "utf8"));
  console.log(`  ${source} -> ${dest}`);
}

/**
 * The single-scheme palettes, by elimination rather than by a hand-kept list.
 *
 * A list here would go stale the moment a palette is added, and the failure would be a
 * palette that exists and cannot be picked, which nobody notices. Everything in css/ is a
 * palette unless it is one of the shared files, a pair, or a type pairing.
 */
const singles = () =>
  readdirSync(join(HERE, "css"))
    .filter((f) => f.endsWith(".css"))
    .filter((f) => !SHARED_CSS.includes(f) && !f.startsWith("pair-") && !f.startsWith("type-"))
    .map((f) => f.slice(0, -".css".length))
    .sort();

const opts = options(process.argv.slice(2));
const palettes = names("pair-");
const types = names("type-");

if (opts.list) {
  console.log(`pairs:    ${palettes.join(", ")}`);
  console.log(`types:    ${types.join(", ")}`);
  console.log(`singles:  ${singles().join(", ")}`);
  process.exit(0);
}

if (!opts.target) die("give a target project directory, or --list to see the choices");
const target = resolve(opts.target);
if (!existsSync(target)) die(`${target} does not exist`);
// A project that does not have src/ is almost certainly the wrong path, and writing a
// theme directory into the wrong repo is worse than refusing.
if (!existsSync(join(target, "src"))) die(`${target} has no src/, so it is probably not the project you meant`);

// --palettes-dir is a whole mode of its own, so it does not want --palette or --type.
if (opts.palettesDir) {
  const dir = join(target, opts.palettesDir);
  const found = singles();
  if (found.length === 0) die("no single-scheme palettes found in css/, which cannot be right");
  console.log(`vendoring ${found.length} palettes into ${dir}`);
  for (const name of found) copy(`css/${name}.css`, join(dir, `${name}.css`), "css");
  console.log("done.");
  process.exit(0);
}

if (!opts.palette) die(`--palette is required. One of: ${palettes.join(", ")}`);
if (!palettes.includes(opts.palette)) die(`unknown palette "${opts.palette}". One of: ${palettes.join(", ")}`);
if (!opts.type) die(`--type is required. One of: ${types.join(", ")}`);
if (!types.includes(opts.type)) die(`unknown type "${opts.type}". One of: ${types.join(", ")}`);

const theme = join(target, "src", "theme");
const lib = join(target, "src", "lib");

console.log(`vendoring into ${target}`);
copy(`css/pair-${opts.palette}.css`, join(theme, "palette.css"), "css");
copy(`css/type-${opts.type}.css`, join(theme, "type.css"), "css");
for (const f of SHARED_CSS) copy(`css/${f}`, join(theme, f), "css");
if (opts.js) for (const f of JS) copy(`js/${f}`, join(lib, f), "js");
if (opts.reveal) for (const f of REVEAL) copy(`js/${f}`, join(lib, f), "js");

console.log(
  `done. ${opts.js ? "" : "\nnothing under src/lib was touched; pass --js for the React helpers."}`,
);
