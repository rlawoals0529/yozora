/**
 * Which files in css/ are palettes.
 *
 * One answer, shared, because three scripts were each deciding it by elimination - everything
 * that is not a pair, a type pairing, or one of the shared stylesheets - and an exception list
 * is wrong in both directions. Adding palette.css made the vendor step refuse to run and the
 * contrast check measure a sixteenth palette that does not exist, neither of which is about
 * palette.css.
 *
 * A palette is a file that declares --bg. That is not a naming convention, it is the thing
 * every consumer reads out of one, so a file with it is a palette and a file without it
 * cannot be.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DECLARES_BG = /^\s*--bg:/m;

/** Every palette in `dir`, pairs included unless `singles` is set. Names, without `.css`. */
export function paletteFiles(dir, { singles = false } = {}) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".css"))
    .filter((f) => !(singles && f.startsWith("pair-")))
    .filter((f) => DECLARES_BG.test(readFileSync(join(dir, f), "utf8")))
    .map((f) => f.slice(0, -".css".length))
    .sort();
}
