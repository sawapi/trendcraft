// @vitest-environment happy-dom
/**
 * `cssColor` round-trips caller-supplied colours through the canvas colour
 * parser (ops #121). The real parser is exercised in
 * e2e/specs/css-injection.e2e.ts; here a stub that accepts only `#rrggbb`
 * stands in for it, since happy-dom has no canvas.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { cssColor } from "../core/html";

beforeAll(() => {
  let fill = "#000000";
  const ctx = {
    get fillStyle() {
      return fill;
    },
    set fillStyle(v: string) {
      if (/^#[0-9a-f]{6}$/i.test(v)) fill = v.toLowerCase();
      else if (v === "#000" || v === "#fff") fill = v === "#000" ? "#000000" : "#ffffff";
    },
  };
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ctx;
});

describe("cssColor", () => {
  it("returns the parser's canonical form of a colour", () => {
    expect(cssColor("#ABCDEF")).toBe("#abcdef");
  });

  it("returns the fallback for a value the parser rejects", () => {
    expect(cssColor("red;background:url(https://x/y)")).toBe("");
    expect(cssColor("var(--x, url(https://x/y))", "#111111")).toBe("#111111");
  });
});
