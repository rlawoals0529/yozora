import { beforeEach, describe, expect, it, vi } from "vitest";
import { createThemeStore, grouped, type Theme } from "./theme";

const THEMES: Theme[] = [
  { id: "rain-lantern", label: "Rain Lantern", accent: "#ff7a4d", scheme: "dark" },
  { id: "sakura-lake", label: "Sakura Lake", accent: "#e0932c", scheme: "light" },
];

describe("createThemeStore", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  it("writes color-scheme alongside the palette, not instead of it", () => {
    const store = createThemeStore(THEMES, "rain-lantern");
    store.apply("sakura-lake");
    expect(document.documentElement.dataset.theme).toBe("sakura-lake");
    // Without this the browser paints scrollbars and form controls for the wrong scheme.
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("remembers the choice", () => {
    const store = createThemeStore(THEMES, "rain-lantern");
    store.apply("sakura-lake");
    expect(createThemeStore(THEMES, "rain-lantern").initial()).toBe("sakura-lake");
  });

  it("ignores a stored palette that no longer exists", () => {
    localStorage.setItem("yozora:theme", "a-palette-that-was-deleted");
    expect(createThemeStore(THEMES, "rain-lantern").initial()).toBe("rain-lantern");
  });

  it("falls back to the first theme when the named fallback is not real either", () => {
    expect(createThemeStore(THEMES, "not-a-palette").initial()).toBe("rain-lantern");
  });

  it("renders even when storage throws, which is what a private window does", () => {
    const boom = () => {
      throw new DOMException("denied", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);

    const store = createThemeStore(THEMES, "rain-lantern");
    expect(store.initial()).toBe("rain-lantern");
    expect(store.apply("sakura-lake")).toBe("sakura-lake");
    expect(document.documentElement.dataset.theme).toBe("sakura-lake");
    vi.restoreAllMocks();
  });

  it("refuses an empty theme list rather than rendering an unthemed page", () => {
    expect(() => createThemeStore([], "x")).toThrow();
  });
});

describe("grouped", () => {
  it("puts night first and drops a group with nothing in it", () => {
    expect(grouped(THEMES).map((g) => g.scheme)).toEqual(["dark", "light"]);
    expect(grouped([THEMES[1]]).map((g) => g.scheme)).toEqual(["light"]);
  });
});
