import { describe, expect, it } from "vitest";
import { parseColor, pickReadableTextColor, relativeLuminance } from "../core/color-utils";

describe("parseColor", () => {
  it("parses 6-digit hex", () => {
    expect(parseColor("#ff0000")).toEqual([1, 0, 0]);
    expect(parseColor("#000000")).toEqual([0, 0, 0]);
  });

  it("parses 3-digit hex", () => {
    const [r, g, b] = parseColor("#fff") || [0, 0, 0];
    expect(r).toBeCloseTo(1);
    expect(g).toBeCloseTo(1);
    expect(b).toBeCloseTo(1);
  });

  it("parses rgb() and rgba()", () => {
    const rgb = parseColor("rgb(255, 128, 0)");
    expect(rgb?.[0]).toBeCloseTo(1);
    expect(rgb?.[1]).toBeCloseTo(128 / 255);
    expect(rgb?.[2]).toBeCloseTo(0);

    const rgba = parseColor("rgba(0, 0, 0, 0.5)");
    expect(rgba).toEqual([0, 0, 0]);
  });

  it("handles named colors black/white", () => {
    expect(parseColor("black")).toEqual([0, 0, 0]);
    expect(parseColor("white")).toEqual([1, 1, 1]);
  });

  it("returns null for unrecognized input", () => {
    expect(parseColor("not-a-color")).toBeNull();
    expect(parseColor("")).toBeNull();
    expect(parseColor("#xyz")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0);
    expect(relativeLuminance([1, 1, 1])).toBeCloseTo(1);
  });

  it("is higher for lighter colors", () => {
    expect(relativeLuminance([0.8, 0.8, 0.8])).toBeGreaterThan(relativeLuminance([0.3, 0.3, 0.3]));
  });
});

describe("pickReadableTextColor", () => {
  it("returns white on dark background", () => {
    expect(pickReadableTextColor("#000000")).toBe("#ffffff");
    expect(pickReadableTextColor("#131722")).toBe("#ffffff"); // DARK_THEME.background
  });

  it("returns black on light background", () => {
    expect(pickReadableTextColor("#ffffff")).toBe("#000000");
    expect(pickReadableTextColor("#eeeeee")).toBe("#000000");
  });

  it("returns fallback on unparseable input", () => {
    expect(pickReadableTextColor("oops", "#abc")).toBe("#abc");
  });
});
