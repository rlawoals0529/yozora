/**
 * Checks that belong to the design system itself, rather than to anything vendoring it.
 *
 * Deliberately NOT named theme.test.ts or palette-keys.test.ts: vendor.mjs copies those two by
 * name into every consumer, and a check that reads this repo's css/ directory means nothing in
 * a project that has a generated stylesheet instead. Keeping it under a name the vendor list
 * does not carry is what lets it use the filesystem freely.
 */
import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { DEFAULT_THEME } from "./theme";

const palettes = readdirSync(new URL("../css", import.meta.url))
  .filter((f) => f.endsWith(".css"))
  .map((f) => f.slice(0, -".css".length));

describe("the default palette", () => {
  it("names a palette that has actually been generated", () => {
    // A default naming a palette nobody generated leaves every page painting in browser
    // defaults, and the failure looks like a broken stylesheet rather than a typo in a string.
    expect(palettes).toContain(DEFAULT_THEME);
  });

  it("is a single-scheme palette, not one of the pair- files", () => {
    // A pair-*.css follows the operating system. The default is the palette a visitor sees
    // before choosing anything, so it has to be a definite one.
    expect(DEFAULT_THEME.startsWith("pair-")).toBe(false);
  });

  it("read the palettes at all, rather than passing on an empty directory", () => {
    expect(palettes.length).toBeGreaterThan(10);
  });
});
