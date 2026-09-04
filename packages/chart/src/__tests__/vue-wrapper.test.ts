/**
 * Vue Wrapper Tests
 *
 * Tests the Vue TrendChart component's module structure and type safety
 * without requiring a DOM environment. Full rendering tests (mount/unmount/
 * prop updates) require jsdom and are planned for P2.
 */

import { describe, expect, it } from "vitest";
import { Sparkline } from "../../vue/sparkline";
import { TrendChart } from "../../vue/TrendChart";

describe("Vue TrendChart wrapper", () => {
  it("is a valid Vue component definition", () => {
    expect(TrendChart).toBeDefined();
    // defineComponent returns an object with name, props, setup, emits
    expect(typeof TrendChart).toBe("object");
    expect((TrendChart as Record<string, unknown>).name).toBe("TrendChart");
  });

  it("declares expected props", () => {
    const props = (TrendChart as Record<string, unknown>).props as Record<string, unknown>;
    expect(props).toBeDefined();
    expect(props.candles).toBeDefined();
    expect(props.indicators).toBeDefined();
    expect(props.signals).toBeDefined();
    expect(props.trades).toBeDefined();
    expect(props.drawings).toBeDefined();
    expect(props.timeframes).toBeDefined();
    expect(props.backtest).toBeDefined();
    expect(props.patterns).toBeDefined();
    expect(props.scores).toBeDefined();
    expect(props.plugins).toBeDefined();
    expect(props.chartType).toBeDefined();
    expect(props.layout).toBeDefined();
    expect(props.theme).toBeDefined();
    expect(props.options).toBeDefined();
    expect(props.fitOnLoad).toBeDefined();
  });

  it("declares expected emits", () => {
    const emits = (TrendChart as Record<string, unknown>).emits as string[];
    expect(emits).toBeDefined();
    expect(emits).toContain("crosshairMove");
    expect(emits).toContain("seriesAdded");
    expect(emits).toContain("seriesRemoved");
    expect(emits).toContain("error");
  });

  it("has a setup function", () => {
    expect((TrendChart as Record<string, unknown>).setup).toBeDefined();
    expect(typeof (TrendChart as Record<string, unknown>).setup).toBe("function");
  });
});

describe("Vue Sparkline prop defaults", () => {
  it("does not restate a default the core owns", () => {
    const props = (Sparkline as unknown as { props: Record<string, { default?: unknown }> }).props;

    // `maxCandles` is not a plain constant: the core applies 60 in slot mode
    // and no cap at all when `session` is set. A literal 60 here made every Vue
    // sparkline pass the cap explicitly, so the core could never see "the
    // caller did not ask for a cap" and the session rule never applied.
    expect(props.maxCandles.default).toBeUndefined();

    // Anything else whose default depends on other options must stay undefined
    // here too; these are plain constants and may legitimately be mirrored.
    expect(props.totalSlots.default).toBeUndefined();
    expect(props.session.default).toBeUndefined();
    expect(props.breakGap.default).toBeUndefined();
  });
});
