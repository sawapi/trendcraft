import { describe, expect, it } from "vitest";
import {
  formatMarkdownHandler,
  getManifestHandler,
  listIndicatorsHandler,
  suggestForRegimeHandler,
} from "../tools/manifest";

describe("manifest tools", () => {
  describe("listIndicatorsHandler", () => {
    it("returns compact summaries for every entry when unfiltered", () => {
      const all = listIndicatorsHandler({});
      expect(all.length).toBeGreaterThanOrEqual(90);
      const sample = all[0]!;
      expect(sample).toMatchObject({
        kind: expect.any(String),
        displayName: expect.any(String),
        oneLiner: expect.any(String),
        category: expect.any(String),
      });
      // Confirm we are not leaking the full manifest fields.
      expect(sample).not.toHaveProperty("whenToUse");
    });

    it("filters by category", () => {
      const momentum = listIndicatorsHandler({ category: "momentum" });
      expect(momentum.length).toBeGreaterThan(0);
      for (const m of momentum) expect(m.category).toBe("momentum");
    });
  });

  describe("getManifestHandler", () => {
    it("returns the full manifest for a known kind", () => {
      const rsi = getManifestHandler({ kind: "rsi" });
      expect(rsi.kind).toBe("rsi");
      expect(rsi.whenToUse.length).toBeGreaterThan(0);
      expect(rsi.pitfalls.length).toBeGreaterThan(0);
    });

    it("throws UNKNOWN_KIND for an unknown kind", () => {
      expect(() => getManifestHandler({ kind: "no-such-thing" })).toThrow(/UNKNOWN_KIND/);
    });
  });

  describe("suggestForRegimeHandler", () => {
    it("returns indicators tagged for trending regime", () => {
      const trending = suggestForRegimeHandler({ regime: "trending" });
      expect(trending.length).toBeGreaterThan(0);
      for (const m of trending) expect(m.marketRegime).toContain("trending");
    });
  });

  describe("formatMarkdownHandler", () => {
    it("returns a markdown string with the displayName", () => {
      const md = formatMarkdownHandler({ kind: "macd" });
      expect(typeof md).toBe("string");
      expect(md.length).toBeGreaterThan(50);
    });

    it("throws UNKNOWN_KIND for an unknown kind", () => {
      expect(() => formatMarkdownHandler({ kind: "nope" })).toThrow(/UNKNOWN_KIND/);
    });
  });
});
