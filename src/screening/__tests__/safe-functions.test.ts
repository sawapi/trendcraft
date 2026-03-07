/**
 * Tests for *Safe() function variants in screening module.
 */

import { describe, expect, it } from "vitest";
import type { Condition, NormalizedCandle } from "../../types";
import { screenStockSafe } from "../screen-stock";

const makeCandles = (count: number, basePrice = 100): NormalizedCandle[] =>
  Array.from({ length: count }, (_, i) => {
    const price = basePrice + Math.sin(i * 0.1) * 10 + i * 0.5;
    return {
      time: 1700000000000 + i * 86400000,
      open: price,
      high: price + 2,
      low: price - 2,
      close: price + (i % 2 === 0 ? 1 : -1),
      volume: 100000 + i * 100,
    };
  });

const alwaysTrue: Condition = () => true;
const alwaysFalse: Condition = () => false;

describe("screenStockSafe", () => {
  it("returns Ok with valid screening result", () => {
    const candles = makeCandles(100);

    const result = screenStockSafe("TEST.T", candles, {
      name: "Test Criteria",
      entry: alwaysTrue,
      exit: alwaysFalse,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ticker).toBe("TEST.T");
      expect(result.value.entrySignal).toBe(true);
      expect(result.value.exitSignal).toBe(false);
      expect(result.value.currentPrice).toBeDefined();
      expect(result.value.atrPercent).toBeDefined();
    }
  });

  it("returns Ok with exitSignal when exit triggers", () => {
    const candles = makeCandles(100);

    const result = screenStockSafe("TEST.T", candles, {
      entry: alwaysFalse,
      exit: alwaysTrue,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entrySignal).toBe(false);
      expect(result.value.exitSignal).toBe(true);
    }
  });

  it("returns Err with NO_DATA for empty candles", () => {
    const result = screenStockSafe("EMPTY.T", [], {
      entry: alwaysTrue,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_DATA");
      expect(result.error.context?.ticker).toBe("EMPTY.T");
    }
  });

  it("returns Err with SCREENING_FAILED when condition throws", () => {
    const candles = makeCandles(100);
    const throwingCondition: Condition = () => {
      throw new Error("Condition evaluation error");
    };

    const result = screenStockSafe("ERR.T", candles, {
      entry: throwingCondition,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SCREENING_FAILED");
      expect(result.error.context?.ticker).toBe("ERR.T");
      expect(result.error.cause).toBeInstanceOf(Error);
    }
  });
});
