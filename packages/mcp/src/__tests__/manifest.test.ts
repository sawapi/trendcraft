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
        calcSupported: expect.any(Boolean),
      });
      // Confirm we are not leaking the full manifest fields.
      expect(sample).not.toHaveProperty("whenToUse");
    });

    it("filters by category", () => {
      const momentum = listIndicatorsHandler({ category: "momentum" });
      expect(momentum.length).toBeGreaterThan(0);
      for (const m of momentum) expect(m.category).toBe("momentum");
    });

    it("filters by calcSupported=true to only computable kinds", () => {
      const all = listIndicatorsHandler({});
      const computable = listIndicatorsHandler({ calcSupported: true });
      const manifestOnly = listIndicatorsHandler({ calcSupported: false });
      expect(computable.length).toBeGreaterThan(0);
      expect(manifestOnly.length).toBeGreaterThan(0);
      expect(computable.length + manifestOnly.length).toBe(all.length);
      for (const s of computable) expect(s.calcSupported).toBe(true);
      for (const s of manifestOnly) expect(s.calcSupported).toBe(false);
    });

    it("marks well-known kinds as computable", () => {
      const all = listIndicatorsHandler({});
      const byKind = new Map(all.map((s) => [s.kind, s]));
      expect(byKind.get("rsi")?.calcSupported).toBe(true);
      expect(byKind.get("ema")?.calcSupported).toBe(true);
      expect(byKind.get("bollingerBands")?.calcSupported).toBe(true);
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
