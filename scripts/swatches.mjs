#!/usr/bin/env node
/**
 * Render every palette as one SVG.
 *
 * Generated from the theme files rather than drawn by hand, so a palette that changes
 * cannot disagree with the picture of it. Re-run after editing any theme.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "cli";
const KEYS = ["claude", "text", "success", "warning", "error", "suggestion", "permission", "subtle"];

const themes = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")))
  .sort((a, b) => a.name.localeCompare(b.name));

const COLS = 3;
const CW = 320, CH = 96, PAD = 14;
const rows = Math.ceil(themes.length / COLS);
const W = COLS * CW + PAD * (COLS + 1);
const H = rows * CH + PAD * (rows + 1);

const cell = (t, i) => {
  const x = PAD + (i % COLS) * (CW + PAD);
  const y = PAD + Math.floor(i / COLS) * (CH + PAD);
  const o = t.overrides ?? {};
  const dark = (t.base ?? "dark") === "dark";
  const bg = dark ? "#12121a" : "#f6f3f7";
  const fg = o.text ?? (dark ? "#e8e8f0" : "#1a1a22");
  const sw = KEYS.map((k, n) => {
    const c = o[k];
    if (!c) return "";
    return `<rect x="${x + 16 + n * 30}" y="${y + 50}" width="24" height="24" rx="6" fill="${c}"/>`;
  }).join("");
  return `
    <g>
      <rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="12" fill="${bg}" stroke="${o.subtle ?? "#333"}" stroke-opacity=".45"/>
      <circle cx="${x + 26}" cy="${y + 28}" r="7" fill="${o.claude ?? fg}"/>
      <text x="${x + 44}" y="${y + 33}" font-family="system-ui,sans-serif" font-size="14.5" font-weight="600" fill="${fg}">${t.name}</text>
      <text x="${x + CW - 16}" y="${y + 33}" text-anchor="end" font-family="ui-monospace,monospace" font-size="10.5" fill="${o.inactive ?? o.subtle ?? fg}" opacity=".8">${t.base ?? "dark"}</text>
      ${sw}
    </g>`;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="All ${themes.length} palettes">
  <rect width="${W}" height="${H}" fill="#0b0b11"/>
  ${themes.map(cell).join("")}
</svg>`;

writeFileSync("docs/palettes.svg", svg);
console.log(`Rendered ${themes.length} palettes to docs/palettes.svg`);
