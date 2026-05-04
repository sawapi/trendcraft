import { describe, expect, it } from "vitest";
import { backtestRegistry } from "../registry-backtest";

describe("ParamDef annotations on registered backtest conditions", () => {
  it("goldenCross periods are annotated as integer with UI-suggested max", () => {
    const entry = backtestRegistry.get("goldenCross");
    if (!entry) throw new Error("goldenCross not registered");
    expect(entry.params.shortPeriod.integer).toBe(true);
    // suggestedMax is a UI hint and does NOT trigger validateConditionSpec
    // rejection — the registry deliberately leaves `max` undefined for
    // periods so persisted strategies with longPeriod=750 still validate.
    expect(entry.params.shortPeriod.suggestedMax).toBeGreaterThan(0);
    expect(entry.params.shortPeriod.max).toBeUndefined();
    expect(entry.params.longPeriod.integer).toBe(true);
    expect(entry.params.longPeriod.max).toBeUndefined();
  });

  it("bollingerBreakout.stdDev keeps runtime validation min and adds UI suggestedMax", () => {
    const entry = backtestRegistry.get("bollingerBreakout");
    if (!entry) throw new Error("bollingerBreakout not registered");
    const stdDev = entry.params.stdDev;
    expect(stdDev.integer).toBeFalsy();
    expect(stdDev.precision).toBe(1);
    // bollingerBands() throws on stdDev <= 0, so the registry keeps a
    // hard `min` (matching main) to surface invalid JSON at validate
    // time. `suggestedMax` is a UI hint only — `bollingerBands()`
    // accepts any positive stdDev, so we deliberately leave `max`
    // undefined to keep persisted strategies with stdDev=8 valid.
    expect(stdDev.min).toBe(0.1);
    expect(stdDev.suggestedMax).toBeDefined();
    expect(stdDev.max).toBeUndefined();
    expect(entry.params.period.integer).toBe(true);
  });

  it("cmfAbove.threshold supports negative range via suggested UI hints", () => {
    const entry = backtestRegistry.get("cmfAbove");
    if (!entry) throw new Error("cmfAbove not registered");
    const threshold = entry.params.threshold;
    expect(threshold.integer).toBeFalsy();
    expect(threshold.precision).toBe(2);
    // CMF is mathematically bounded to [-1, 1] but we annotate the
    // bound as a UI hint, not a hard validation limit, so legacy JSON
    // with an out-of-range threshold still loads.
    expect(threshold.suggestedMin).toBeLessThanOrEqual(0);
    expect(threshold.suggestedMax).toBeGreaterThan(0);
    expect(threshold.min).toBeUndefined();
    expect(threshold.max).toBeUndefined();
  });

  it("integer:true and a non-zero precision aren't both set on any entry", () => {
    // Documented as mutually exclusive (integer wins, precision is ignored).
    // Catch accidental annotations that contradict each other.
    for (const entry of backtestRegistry.list()) {
      for (const [name, schema] of Object.entries(entry.params)) {
        if (schema.integer === true && schema.precision !== undefined && schema.precision > 0) {
          throw new Error(
            `${entry.name}.${name}: integer=true but precision=${schema.precision} (mutually exclusive)`,
          );
        }
      }
    }
  });
});
