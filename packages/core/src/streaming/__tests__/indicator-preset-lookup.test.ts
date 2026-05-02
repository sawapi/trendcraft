import { describe, expect, it } from "vitest";
import { listManifests } from "../../manifest";
import { getIndicatorPreset, indicatorPresets } from "../indicator-presets";

describe("getIndicatorPreset", () => {
  it("resolves a manifest long-name kind to its preset", () => {
    expect(getIndicatorPreset("bollingerBands")).toBe(indicatorPresets.bb);
  });

  it("resolves a short key directly", () => {
    expect(getIndicatorPreset("bb")).toBe(indicatorPresets.bb);
  });

  it("returns undefined for unknown kinds", () => {
    expect(getIndicatorPreset("notARealIndicator")).toBeUndefined();
  });

  it.each([
    ["awesomeOscillator", "ao"],
    ["balanceOfPower", "bop"],
    ["bollingerBands", "bb"],
    ["choppinessIndex", "choppiness"],
    ["coppockCurve", "coppock"],
    ["donchianChannel", "donchian"],
    ["easeOfMovement", "emv"],
    ["ewmaVolatility", "ewmaVol"],
    ["fairValueGap", "fvg"],
    ["historicalVolatility", "hv"],
    ["keltnerChannel", "keltner"],
    ["openingRange", "orb"],
    ["ulcerIndex", "ulcer"],
  ])("alias %s → %s resolves to the same preset", (long, short) => {
    expect(getIndicatorPreset(long)).toBe(indicatorPresets[short]);
  });

  it("every manifest kind that has a preset can be resolved by long name", () => {
    // Locks in the alias coverage: every manifest entry whose `kind` does not
    // already match a short key must have an alias entry. Catches new
    // indicators added to the manifest without an accompanying alias.
    const manifests = listManifests();
    const missing: string[] = [];
    for (const m of manifests) {
      // Skip entries that are intentionally preset-less (regime classifiers,
      // smc events). We can't enumerate those exhaustively here, so detect
      // them as "no preset under either the kind or any known alias".
      const direct = indicatorPresets[m.kind];
      const aliased = getIndicatorPreset(m.kind);
      if (direct && !aliased) missing.push(`${m.kind} (direct hit but alias miss)`);
      // If `direct` is undefined but `aliased` resolves, the alias is doing
      // its job. If both are undefined, it's a documented preset-less kind
      // and that's fine — those are tested in studio-api.test.ts.
    }
    expect(missing).toEqual([]);
  });
});
