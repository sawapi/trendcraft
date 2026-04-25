import { describe, expect, it } from "vitest";
import * as indicatorMeta from "../../indicators/indicator-meta";
import type { SeriesMeta } from "../../types/candle";
import {
  formatManifestMarkdown,
  getManifest,
  indicatorManifests,
  listManifests,
  suggestForRegime,
} from "../index";

const KNOWN_KINDS = new Set(
  Object.values(indicatorMeta)
    .filter((v): v is SeriesMeta => typeof v === "object" && v !== null && "kind" in v)
    .map((v) => v.kind),
);

describe("indicator manifest", () => {
  it("has at least one manifest entry", () => {
    expect(indicatorManifests.length).toBeGreaterThan(0);
  });

  it("every manifest kind matches a known SeriesMeta kind", () => {
    const orphans = indicatorManifests.filter((m) => !KNOWN_KINDS.has(m.kind));
    expect(orphans.map((o) => o.kind)).toEqual([]);
  });

  it("manifest kinds are unique", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const m of indicatorManifests) {
      if (seen.has(m.kind)) dupes.push(m.kind);
      seen.add(m.kind);
    }
    expect(dupes).toEqual([]);
  });

  it("every entry populates required fields", () => {
    for (const m of indicatorManifests) {
      expect(m.kind, m.kind).toBeTruthy();
      expect(m.displayName, m.kind).toBeTruthy();
      expect(m.category, m.kind).toBeTruthy();
      expect(m.oneLiner, m.kind).toBeTruthy();
      expect(m.whenToUse.length, `${m.kind} whenToUse`).toBeGreaterThan(0);
      expect(m.signals.length, `${m.kind} signals`).toBeGreaterThan(0);
      expect(m.pitfalls.length, `${m.kind} pitfalls`).toBeGreaterThan(0);
      expect(m.marketRegime.length, `${m.kind} marketRegime`).toBeGreaterThan(0);
      expect(m.timeframe.length, `${m.kind} timeframe`).toBeGreaterThan(0);
    }
  });

  it("getManifest returns a known entry", () => {
    const rsi = getManifest("rsi");
    expect(rsi).toBeDefined();
    expect(rsi?.kind).toBe("rsi");
    expect(rsi?.category).toBe("momentum");
  });

  it("getManifest returns undefined for unknown kind", () => {
    expect(getManifest("does-not-exist")).toBeUndefined();
  });

  it("listManifests filters by category", () => {
    const ma = listManifests({ category: "moving-average" });
    expect(ma.length).toBeGreaterThan(0);
    expect(ma.every((m) => m.category === "moving-average")).toBe(true);
  });

  it("suggestForRegime returns regime-tagged entries only", () => {
    const ranging = suggestForRegime("ranging");
    expect(ranging.length).toBeGreaterThan(0);
    expect(ranging.every((m) => m.marketRegime.includes("ranging"))).toBe(true);
  });

  it("formatManifestMarkdown produces non-empty markdown", () => {
    const rsi = getManifest("rsi");
    expect(rsi).toBeDefined();
    const md = formatManifestMarkdown(rsi as NonNullable<typeof rsi>);
    expect(md).toContain("Relative Strength Index");
    expect(md).toContain("When to use");
    expect(md).toContain("Pitfalls");
  });
});
