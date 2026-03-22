/**
 * Optimization Performance Benchmarks
 *
 * Compares grid search with and without IndicatorCache.
 */

import { bench, describe } from "vitest";
import { runBacktest } from "../backtest";
import {
  deadCross,
  goldenCross,
  macdCrossDown,
  macdCrossUp,
  rsiAbove,
  rsiBelow,
} from "../backtest/conditions";
import { and } from "../backtest/conditions";
import { IndicatorCache } from "../core/indicator-cache";
import { generateCandles } from "./helpers";

const candles = generateCandles(500);

const strategies = [
  { entry: goldenCross(5, 25), exit: deadCross(5, 25) },
  { entry: and(goldenCross(5, 25), rsiBelow(30)), exit: rsiAbove(70) },
  { entry: macdCrossUp(), exit: macdCrossDown() },
  { entry: and(goldenCross(5, 25), macdCrossUp()), exit: and(deadCross(5, 25), macdCrossDown()) },
  { entry: rsiBelow(30), exit: rsiAbove(70) },
];

describe("Optimization - 5 strategies x 500 candles", () => {
  bench("without cache", () => {
    for (const s of strategies) {
      runBacktest(candles, s.entry, s.exit, { capital: 100000 });
    }
  });

  bench("with cache", () => {
    const cache = new IndicatorCache();
    for (const s of strategies) {
      runBacktest(candles, s.entry, s.exit, { capital: 100000 }, cache);
    }
  });
});
