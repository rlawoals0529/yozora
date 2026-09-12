/**
 * The specimen page. Data comes from data.json, which scripts/site.mjs generates out of css/,
 * so nothing here is a second copy of the palette list.
 */
const { palettes, pairings } = await fetch("./data.json").then((r) => r.json());

const KEY = "yozora:site-theme";
const byId = (id) => palettes.find((p) => p.id === id);

function apply(id) {
  const t = byId(id) ?? palettes[0];
  document.documentElement.dataset.theme = t.id;
  // Alongside the attribute, not instead of it: without this the browser keeps painting
  // scrollbars and form controls for the other scheme.
  document.documentElement.style.colorScheme = t.scheme;
  try {
    localStorage.setItem(KEY, t.id);
  } catch {
    // A private window throws rather than returning null. The page still works.
  }
  for (const b of document.querySelectorAll(".swatch")) {
    b.setAttribute("aria-pressed", String(b.dataset.theme === t.id));
  }
  return t.id;
}

const stored = (() => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
})();

document.getElementById("palette-count").textContent =
  `${palettes.length}, ${palettes.filter((p) => p.scheme === "dark").length} night and ${palettes.filter((p) => p.scheme === "light").length} day`;

document.getElementById("swatch-grid").innerHTML = palettes
  .map(
    (p) => `
  <button class="swatch" type="button" data-theme="${p.id}" aria-pressed="false">
    <span class="swatch-name">${p.label}</span>
    <span class="bars" aria-hidden="true">
      <i style="background:${p.accent}"></i>
      <i style="background:${p.accent2 ?? p.accent}"></i>
      <i style="background:${p.ok ?? p.accent}"></i>
      <i style="background:${p.warn ?? p.accent}"></i>
      <i style="background:${p.err ?? p.accent}"></i>
    </span>
    <span class="swatch-scheme">${p.scheme === "dark" ? "night" : "day"}</span>
  </button>`,
  )
  .join("");

for (const b of document.querySelectorAll(".swatch")) {
  b.addEventListener("click", () => apply(b.dataset.theme));
}

document.getElementById("pairings").innerHTML = pairings
  .map(
    (t) => `
  <article class="pairing">
    <h3>${t.title.split(" - ")[0]}</h3>
    <p class="faces">${[t.display, t.body, t.mono].filter(Boolean).join(" · ")}</p>
    <p>${t.why || t.title}</p>
  </article>`,
  )
  .join("");

apply(stored ?? "rain-lantern");
