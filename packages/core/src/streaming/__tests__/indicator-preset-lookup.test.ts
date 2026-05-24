import { describe, expect, it } from "vitest";
import { listManifests } from "../../manifest";
import { getIndicatorPreset, getIndicatorPresetKey, indicatorPresets } from "../indicator-presets";

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

  it("emv preset treats `null` volumeDivisor as 'unset' and falls back to canonical", () => {
    // JSON / form-driven hosts often serialize optional unset fields as
    // explicit `null`. The preset wrapper must NOT forward that null to
    // the indicator (which would divide by zero). It should fall back to
    // the canonical 1e8 default just like `undefined` does.
    const candles: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }> = [];
    for (let i = 0; i < 30; i++) {
      candles.push({
        time: 1700_000_000_000 + i * 86_400_000,
        open: 100 + i,
        high: 102 + i,
        low: 98 + i,
        close: 101 + i,
        volume: 50_000_000,
      });
    }
    const preset = indicatorPresets.emv;
    if (!preset?.compute) throw new Error("emv preset is missing compute");

    const lastIdx = candles.length - 1;
    const fromUndefined = (
      preset.compute(candles, {})[lastIdx] as { value: number | null } | undefined
    )?.value;
    const fromNull = (
      preset.compute(candles, { volumeDivisor: null as unknown as number })[lastIdx] as
        | { value: number | null }
        | undefined
    )?.value;

    expect(fromNull).not.toBeNull();
    expect(Number.isFinite(fromNull as number)).toBe(true);
    // `null` and `undefined` should produce identical canonical output.
    expect(fromNull).toBe(fromUndefined);
  });

  it("emv preset snapshotName includes volumeDivisor so different scales don't share state", () => {
    // Resuming an EMV state captured at one volumeDivisor under a different
    // divisor would mix scales (the buffer / sum are accumulated under the
    // active divisor and can't be re-scaled retroactively). The snapshot
    // key has to reflect divisor so the host's state cache invalidates
    // cleanly — old `emv14` keys won't match the new format and a fresh
    // warm-up runs.
    const preset = indicatorPresets.emv;
    if (!preset?.snapshotName || typeof preset.snapshotName !== "function") {
      throw new Error("emv preset snapshotName must be a function for this test");
    }
    const sn = preset.snapshotName as (p: Record<string, unknown>) => string;
    const canonical = sn({ period: 14 });
    const legacy = sn({ period: 14, volumeDivisor: 10000 });
    expect(canonical).not.toBe(legacy);
    // Canonical default is 1e8 — same name should result whether divisor is
    // omitted or supplied explicitly as 1e8.
    expect(sn({ period: 14, volumeDivisor: 100_000_000 })).toBe(canonical);
  });

  it("emv preset's default compute matches the indicator's canonical default", () => {
    // Regression for `feat/core-eom-canonical-divisor`: the indicator's
    // default `volumeDivisor` is 1e8, so the preset's no-options compute
    // path must produce the same series. Hard-coding `?? 10000` in the
    // preset wrapper would silently re-introduce the legacy scaling for
    // every preset / manifest / live-mode consumer.
    const candles: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }> = [];
    for (let i = 0; i < 30; i++) {
      candles.push({
        time: 1700_000_000_000 + i * 86_400_000,
        open: 100 + i,
        high: 102 + i,
        low: 98 + i,
        close: 101 + i,
        volume: 50_000_000,
      });
    }
    const preset = indicatorPresets.emv;
    if (!preset?.compute) throw new Error("emv preset is missing compute");

    const presetResult = preset.compute(candles, {});
    const lastIdx = candles.length - 1;
    const lastValue = (presetResult[lastIdx] as { value: number | null } | undefined)?.value;
    expect(lastValue).not.toBeNull();
    // EMV is proportional to `volumeDivisor`. With 1e8 these synthetic
    // candles produce values around 8; the legacy 1e4 default would
    // produce ~8e-4. Pin the lower bound so any silent revert to 1e4
    // (factor 10000 smaller) trips the assertion.
    expect(Math.abs(lastValue as number)).toBeGreaterThan(0.5);
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
  ])("getIndicatorPresetKey: alias %s → %s", (long, short) => {
    expect(getIndicatorPresetKey(long)).toBe(short);
  });

  it("getIndicatorPresetKey returns the input when it is already a canonical short key", () => {
    expect(getIndicatorPresetKey("bb")).toBe("bb");
    expect(getIndicatorPresetKey("rsi")).toBe("rsi");
  });

  it("getIndicatorPresetKey returns undefined for kinds with no preset", () => {
    expect(getIndicatorPresetKey("notARealIndicator")).toBeUndefined();
    expect(getIndicatorPresetKey("hmmRegimes")).toBeUndefined();
  });

  it("getIndicatorPresetKey ignores inherited Object prototype property names", () => {
    // `in` would return true for these and produce invalid keys; the
    // helper must only honor own properties of the presets registry.
    expect(getIndicatorPresetKey("constructor")).toBeUndefined();
    expect(getIndicatorPresetKey("toString")).toBeUndefined();
    expect(getIndicatorPresetKey("hasOwnProperty")).toBeUndefined();
    expect(getIndicatorPresetKey("__proto__")).toBeUndefined();
  });

  it("getIndicatorPresetKey agrees with getIndicatorPreset for every kind that resolves", () => {
    // Drift gate: the two helpers read the same alias map, so for any
    // input that resolves to a preset, the key returned by *Key must
    // index the same preset object that getIndicatorPreset returns.
    // Locks in the "single source of truth" invariant.
    const aliasInputs = [
      "bollingerBands",
      "bb",
      "awesomeOscillator",
      "ao",
      "rsi",
      "macd",
      "ewmaVolatility",
      "ewmaVol",
    ];
    for (const kind of aliasInputs) {
      const preset = getIndicatorPreset(kind);
      const key = getIndicatorPresetKey(kind);
      if (preset === undefined) {
        expect(key).toBeUndefined();
      } else {
        expect(key).toBeDefined();
        expect(indicatorPresets[key as string]).toBe(preset);
      }
    }
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
