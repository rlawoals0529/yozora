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
 *   node scripts/vendor.mjs ../streaming-markdown --picker --probe --dest demo
 *   node scripts/vendor.mjs ../tokenview --palette rain-lantern --type ink-study --js
 *   node scripts/vendor.mjs ../tokenview --list
 *   node scripts/vendor.mjs ../hikari --palettes-dir widgets/palettes
 *   node scripts/vendor.mjs ../secondread --picker --type night-terminal
 *   node scripts/vendor.mjs ../tokenview --picker --probe
 *
 * Two files are per-project and the rest are not:
 *   palette.css  one of css/pair-*.css, because a project picks a palette
 *   type.css     one of css/type-*.css, because a project picks a type pairing
 *
 * The others are the same in every project, which is checkable: run this and then diff.
 * They were byte-identical across four projects before this script existed, which is the
 * argument for it rather than against.
 *
 * `--picker` is the browser shape: one stylesheet holding every palette, each scoped to
 * `[data-theme="id"]`, plus a manifest so a picker can render the list without parsing CSS.
 * A web app cannot swap stylesheets the way a desktop host can reload a file, and a page that
 * vendored one `pair-*` can never offer a choice at all, which is the state every browser app
 * here was in. Singles rather than pairs, for the same reason `--palettes-dir` uses them: a
 * picker is the user saying which they want and a pair is the operating system saying it.
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
import { paletteFiles } from "./palettes.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Files that are identical everywhere, as [source, destination]. */
const SHARED_CSS = ["base.css", "layout-flat.css", "motion.css", "texture.css"];

/** The React helpers. Opt in, because a project that renders no React does not want them. */
const JS = ["motion.tsx", "motion.test.ts"];

/** The palette switcher. Vendored with --picker, since it is what drives the picker. */
const PICKER_JS = ["theme.ts", "theme.test.ts"];

/**
 * Arrow keys and one tab stop, for a picker built without a framework.
 *
 * The React component has this built in. Two pages here are plain TypeScript and cannot use
 * it, and the behaviour is the part worth sharing: how a page paints its swatches is its own
 * business, but fifteen tab stops to get past a preference is wrong everywhere.
 */
const PICKER_KEYS = ["palette-keys.ts", "palette-keys.test.ts"];

/**
 * The picker itself, for a React project.
 *
 * It used to be a file each project kept its own copy of, and five copies had drifted to
 * differing by one comment and a storage key - which is to say a fix to any of them reached
 * one page. Opt in, because a project that renders no React cannot use it.
 */
const PICKER_UI = "palette.tsx";
const PICKER_CSS = "palette.css";
/* The picker's own behaviour, tested where it is defined. Named for the component rather than
   for the subject, so a project's existing palette.spec.ts is not quietly replaced. */
const PICKER_SPEC = "palette.spec.ts";
/**
 * How the spec reaches the picker on THIS page.
 *
 * The one file in the set a project is meant to edit, so it is written once and never
 * overwritten: most pages put the picker behind its own disclosure, and a page that keeps it
 * in a settings tab replaces this and the vendored spec keeps working unchanged.
 */
const PICKER_SEAM = "palette-open.ts";

/** The text reveals. Opt in separately: nothing uses them yet, and a copy nothing imports
 *  is dead code that still has to be kept in step. */
const REVEAL = ["reveal.ts", "reveal.test.ts"];

/**
 * The contrast probe, for a project that drives its pages with Playwright.
 *
 * It lands in e2e/ rather than src/lib/, because it is a test helper and a bundler should
 * never see it. Opt in, since a project with no browser suite has nothing to call it from.
 */
const PROBE = "contrast-probe.ts";

const options = (argv) => {
  const out = { target: null, palette: null, type: null, js: false, reveal: false, list: false, palettesDir: null, picker: false, probe: false, pickerUi: false, pickerKeys: false, dest: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--js") out.js = true;
    else if (a === "--probe") out.probe = true;
    else if (a === "--picker-ui") out.pickerUi = true;
    else if (a === "--picker-keys") out.pickerKeys = true;
    else if (a === "--picker") out.picker = true;
    else if (a === "--reveal") out.reveal = true;
    else if (a === "--list") out.list = true;
    else if (a === "--dest") out.dest = argv[++i];
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

/** The single-scheme palettes. What counts as one lives in scripts/palettes.mjs. */
const singles = () => paletteFiles(join(HERE, "css"), { singles: true });

/**
 * Where the vendored files land, under the target.
 *
 * `src` for almost everything, and configurable because one consumer keeps its whole page in
 * `demo/`. Its theme files carried this repo's "refresh with vendor.mjs" header while the
 * script had no way to write them there, which makes the header a lie and the copy a fork.
 */
const lib = (target) => join(target, DEST, "lib");
let DEST = "src";

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
if (opts.dest) DEST = opts.dest;
// A project that does not have the destination directory is almost certainly the wrong path,
// and writing a theme directory into the wrong repo is worse than refusing.
if (!existsSync(join(target, DEST))) die(`${target} has no ${DEST}/, so it is probably not the project you meant`);

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

/**
 * Every palette in one stylesheet, scoped so an attribute switches them.
 *
 * The files in css/ are each written at `:root` because a desktop host loads exactly one. A
 * browser app has them all at once, so each is rescoped to `[data-theme="name"]` on the way
 * through. The manifest beside it carries what a picker has to draw: the accent to show as a
 * swatch, and whether the palette is light or dark, because `color-scheme` has to be set with
 * the palette or the browser keeps painting scrollbars and form controls for the other one.
 */
if (opts.picker) {
  // --type is OPTIONAL here, unlike the single-palette mode, and that is deliberate. Adding a
  // picker to an existing project should not silently restyle its text: decoder self-hosts the
  // two faces its pairing names, so switching the pairing left it asking for fonts it does not
  // have. Omit it and whatever type.css is already there is left alone.
  if (opts.type && !types.includes(opts.type)) die(`unknown type "${opts.type}". One of: ${types.join(", ")}`);

  const theme = join(target, DEST, "theme");
  const found = singles();
  if (found.length === 0) die("no single-scheme palettes found in css/, which cannot be right");

  const blocks = [];
  const manifest = [];
  for (const name of found) {
    const src = readFileSync(join(HERE, "css", `${name}.css`), "utf8");
    const body = src.slice(src.indexOf("{") + 1, src.lastIndexOf("}"));
    const read = (token) => (body.match(new RegExp(`--${token}:\\s*([^;]+)`)) ?? [])[1]?.trim() ?? null;
    const bg = read("bg");
    if (!bg) die(`${name}.css has no --bg, so its scheme cannot be determined`);
    blocks.push(`[data-theme="${name}"] {${body}}`);
    manifest.push({
      id: name,
      label: name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
      accent: read("accent"),
      // Lightness is the last number in the hsl(), and these are generated files so the shape
      // is reliable. Read rather than hardcoded, so a palette added later classifies itself.
      scheme: Number((bg.match(/([\d.]+)%\s*\)?\s*$/) ?? [])[1] ?? 0) > 50 ? "light" : "dark",
    });
  }

  mkdirSync(theme, { recursive: true });
  writeFileSync(
    join(theme, "palettes.css"),
    header("css/*.css", "css") + `
/* Every palette, rescoped from :root to [data-theme] so one attribute switches them. */

` + blocks.join("\n\n") + "\n",
  );
  writeFileSync(
    join(theme, "palettes.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(`  css/*.css -> ${join(theme, "palettes.css")} (${found.length} palettes)`);
  console.log(`  manifest  -> ${join(theme, "palettes.json")}`);
  if (opts.type) copy(`css/type-${opts.type}.css`, join(theme, "type.css"), "css");
  else console.log("  type.css left as it is; pass --type to change the pairing");
  for (const fl of SHARED_CSS) copy(`css/${fl}`, join(theme, fl), "css");
  for (const fl of PICKER_JS) copy(`js/${fl}`, join(lib(target), fl), "js");
  if (opts.js) for (const fl of JS) copy(`js/${fl}`, join(lib(target), fl), "js");
  if (opts.probe) copy(`js/${PROBE}`, join(target, "e2e", PROBE), "js");
  if (opts.pickerKeys) for (const fl of PICKER_KEYS) copy(`js/${fl}`, join(lib(target), fl), "js");
  if (opts.pickerUi) {
    copy(`js/${PICKER_UI}`, join(lib(target), PICKER_UI), "js");
    copy(`css/${PICKER_CSS}`, join(theme, PICKER_CSS), "css");
    copy(`js/${PICKER_SPEC}`, join(target, "e2e", "palette-picker.spec.ts"), "js");
    const seam = join(target, "e2e", PICKER_SEAM);
    if (existsSync(seam)) console.log(`  ${PICKER_SEAM} left as it is; it is yours to edit`);
    else copy(`js/${PICKER_SEAM}`, seam, "js");
  }
  console.log(`done. ${manifest.filter((m) => m.scheme === "dark").length} dark, ${manifest.filter((m) => m.scheme === "light").length} light.`);
  process.exit(0);
}

if (!opts.palette) die(`--palette is required. One of: ${palettes.join(", ")}`);
if (!palettes.includes(opts.palette)) die(`unknown palette "${opts.palette}". One of: ${palettes.join(", ")}`);
if (!opts.type) die(`--type is required. One of: ${types.join(", ")}`);
if (!types.includes(opts.type)) die(`unknown type "${opts.type}". One of: ${types.join(", ")}`);

const theme = join(target, DEST, "theme");

console.log(`vendoring into ${target}`);
copy(`css/pair-${opts.palette}.css`, join(theme, "palette.css"), "css");
copy(`css/type-${opts.type}.css`, join(theme, "type.css"), "css");
for (const f of SHARED_CSS) copy(`css/${f}`, join(theme, f), "css");
if (opts.js) for (const f of JS) copy(`js/${f}`, join(lib(target), f), "js");
if (opts.reveal) for (const f of REVEAL) copy(`js/${f}`, join(lib(target), f), "js");

console.log(
  `done. ${opts.js ? "" : "\nnothing under src/lib was touched; pass --js for the React helpers."}`,
);
