/**
 * Choosing a palette at runtime, and the two things that go wrong when you do not.
 *
 * The palettes are rescoped to `[data-theme]` by `vendor.mjs --picker`, so switching is one
 * attribute write. Everything below exists because of what has to happen *alongside* that write.
 *
 * **`color-scheme` is not optional.** It tells the browser which way to paint the things the
 * page does not own: scrollbars, form controls, and the canvas behind the document. Set the
 * attribute without it and a light palette gets a dark scrollbar down its side, which no amount
 * of CSS on your own elements will fix because none of those are your elements.
 *
 * **Storage throws, it does not just return null.** In a private window, or with site data
 * blocked, `localStorage` access raises rather than failing quietly. A theme is a convenience;
 * failing to read one is not a reason to fail to render, so every access is guarded.
 */

export type Theme = { id: string; label: string; accent: string; scheme: "light" | "dark" };

export type ThemeStore = {
  /** The palette to start on: the saved one if it is still real, otherwise the fallback. */
  initial(): string;
  /** Apply a palette to the document and remember it. Returns what was actually applied. */
  apply(id: string): string;
};

export function createThemeStore(
  themes: readonly Theme[],
  fallback: string,
  key = "yozora:theme",
): ThemeStore {
  if (themes.length === 0) throw new Error("createThemeStore needs at least one theme");
  const known = (id: string | null): Theme | undefined => themes.find((t) => t.id === id);
  const base = known(fallback) ?? themes[0];

  const read = (): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  return {
    initial: () => (known(read())?.id ?? base.id),
    apply(id) {
      const theme = known(id) ?? base;
      const root = document.documentElement;
      root.dataset.theme = theme.id;
      root.style.colorScheme = theme.scheme;
      try {
        localStorage.setItem(key, theme.id);
      } catch {
        // The page still works; the choice just will not survive a reload.
      }
      return theme.id;
    },
  };
}

/**
 * The palettes grouped for display, dark first.
 *
 * Dark first because every palette here started as a night theme and the light ones came after,
 * so that order matches what someone browsing them expects to find at the top.
 */
export function grouped(themes: readonly Theme[]): { scheme: "dark" | "light"; label: string; themes: Theme[] }[] {
  return [
    { scheme: "dark" as const, label: "Night" },
    { scheme: "light" as const, label: "Day" },
  ]
    .map((g) => ({ ...g, themes: themes.filter((t) => t.scheme === g.scheme) }))
    .filter((g) => g.themes.length > 0);
}
