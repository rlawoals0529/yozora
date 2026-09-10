import { describe, expect, it } from "vitest";
import { scramble, flapSequence, flapAt, flapSteps } from "./reveal.js";

describe("scramble", () => {
  it("is the finished text at the end and never longer than it", () => {
    expect(scramble("tokenview", 1)).toBe("tokenview");
    expect(scramble("tokenview", 2)).toBe("tokenview");
    for (let p = 0; p <= 1; p += 0.05) {
      expect(scramble("tokenview", p)).toHaveLength(9);
    }
  });

  it("settles left to right, so it reads as decoding rather than glitching", () => {
    const mid = scramble("abcdefghij", 0.5);
    // The front has arrived and the back has not.
    expect(mid.slice(0, 3)).toBe("abc");
    expect(mid.slice(-3)).not.toBe("hij");
  });

  it("keeps spaces, so word shapes stay readable while it resolves", () => {
    const mid = scramble("two words here", 0.3);
    expect(mid[3]).toBe(" ");
    expect(mid[9]).toBe(" ");
  });

  it("is deterministic, so a screenshot of it half-resolved is reproducible", () => {
    expect(scramble("hello", 0.4)).toBe(scramble("hello", 0.4));
    // And a different seed gives a different line, which is what lets two labels on one
    // screen resolve out of step instead of in lockstep.
    expect(scramble("hello", 0.4, 1)).not.toBe(scramble("hello", 0.4, 99));
  });

  it("handles an empty string without dividing by zero", () => {
    expect(scramble("", 0.5)).toBe("");
  });
});

describe("flapSequence", () => {
  it("steps through the digits to reach its target", () => {
    expect(flapSequence("0", "3")).toEqual(["1", "2", "3"]);
  });

  it("wraps around the end rather than running backwards", () => {
    // A real board only turns one way.
    expect(flapSequence("8", "1")).toEqual(["9", "0", "1"]);
  });

  it("a digit never flickers through letters on its way", () => {
    for (const c of flapSequence("1", "9")) expect(c).toMatch(/[0-9]/);
  });

  it("a character already on target does not move", () => {
    expect(flapSequence("7", "7")).toEqual(["7"]);
  });

  it("always finishes on the target, even when the step budget runs out", () => {
    const seq = flapSequence("a", "Z", 3);
    expect(seq.length).toBeLessThanOrEqual(4);
    expect(seq[seq.length - 1]).toBe("Z");
  });

  it("a character outside the set lands rather than stepping nowhere", () => {
    expect(flapSequence(" ", "5")).toEqual(["5"]);
    expect(flapSequence("!", "?")).toEqual(["?"]);
  });
});

describe("flapAt", () => {
  it("lands on the target once every column has finished", () => {
    expect(flapAt("0", "42", flapSteps("0", "42"))).toBe("42");
  });

  it("keeps a constant width, so a growing number does not shove its neighbours", () => {
    const steps = flapSteps("9", "100");
    for (let s = 0; s <= steps; s++) expect(flapAt("9", "100", s)).toHaveLength(3);
  });

  it("columns move independently, so the board does not flip in unison", () => {
    // "11" to "19" leaves the first column alone and turns only the second.
    expect(flapAt("11", "19", 0)[0]).toBe("1");
  });

  it("a step past the end is the settled value, not an overrun", () => {
    expect(flapAt("0", "5", 999)).toBe("5");
  });
});

describe("flapSteps", () => {
  it("is the longest column, since the board is done when the slowest one is", () => {
    expect(flapSteps("00", "09")).toBe(9);
    expect(flapSteps("5", "5")).toBe(1);
  });
});
