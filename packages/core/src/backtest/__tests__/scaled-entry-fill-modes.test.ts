import { describe, expect, it } from "vitest";
import type { NormalizedCandle, PresetCondition, Trade } from "../../types";
import { runBacktest } from "../engine";
import { runBacktestScaled } from "../scaled-entry";
import { at, makeCandles, never } from "./step-candles";

const DAY = 86_400_000;
/** Bar times must be epoch milliseconds, not a bare multiple of a day. */
const BASE = 1_700_000_000_000;

/**
 * Signal at i1; next-bar-open entry belongs at i2's open (105). The i3 wick
 * dips to 95 (through a 5% stop from 105 = 99.75) but closes at 101, so
 * close-only mode must NOT stop out. End of data exits at 101.
 */
function stopWickCandles(): NormalizedCandle[] {
  return makeCandles(
    [
      { o: 100, h: 100.5, l: 99.5, c: 100 }, // i0
      { o: 100, h: 100.5, l: 99.5, c: 100 }, // i1 <- entry signal
      { o: 105, h: 106, l: 104, c: 104 }, // i2 entry bar under next-bar-open
      { o: 104, h: 105, l: 95, c: 101 }, // i3 wick through the stop, closes above it
      { o: 101, h: 102, l: 100, c: 101 }, // i4 endOfData
    ],
    DAY,
    DAY,
  );
}

const periodicEnter: PresetCondition = {
  type: "preset",
  name: "periodicEnter",
  evaluate: (_indicators, _candle, index) => index % 17 === 3,
};

const periodicExit: PresetCondition = {
  type: "preset",
  name: "periodicExit",
  evaluate: (_indicators, _candle, index) => index % 13 === 7,
};

/** Trade fields that must match between the two engines (shares/notional differ) */
function comparable(t: Trade) {
  return {
    entryTime: t.entryTime,
    entryPrice: t.entryPrice,
    exitTime: t.exitTime,
    exitPrice: t.exitPrice,
    returnPercent: Number(t.returnPercent.toFixed(8)),
    exitReason: t.exitReason,
    isPartial: t.isPartial,
    exitPercent: t.exitPercent,
    holdingDays: t.holdingDays,
  };
}

const SCALED_TWO_TRANCHES = {
  tranches: 2,
  strategy: "equal",
  intervalType: "signal",
} as const;

describe("runBacktestScaled honors fillMode", () => {
  it("fills the first tranche at the next bar's open under next-bar-open (default)", () => {
    const result = runBacktestScaled(stopWickCandles(), at(1), never, {
      capital: 100_000,
      stopLoss: 5,
      scaledEntry: SCALED_TWO_TRANCHES,
    });

    expect(result.trades).toHaveLength(1);
    // Before the fix the tranche filled at the signal bar's own close (100).
    expect(result.trades[0].entryTime).toBe(DAY * 3);
    expect(result.trades[0].entryPrice).toBe(105);
  });

  it("fills the first tranche at the signal bar's close under same-bar-close", () => {
    const result = runBacktestScaled(stopWickCandles(), at(1), never, {
      capital: 100_000,
      fillMode: "same-bar-close",
      scaledEntry: SCALED_TWO_TRANCHES,
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].entryTime).toBe(DAY * 2);
    expect(result.trades[0].entryPrice).toBe(100);
  });
});

describe("runBacktestScaled honors slTpMode", () => {
  it("close-only (default): a wick through the stop does not exit", () => {
    const result = runBacktestScaled(stopWickCandles(), at(1), never, {
      capital: 100_000,
      stopLoss: 5,
      scaledEntry: SCALED_TWO_TRANCHES,
    });

    // Before the fix the i3 wick (low 95) always triggered the stop
    // intraday and exited at the stop price on a bar that closed at 101.
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitReason).toBe("endOfData");
    expect(result.trades[0].exitPrice).toBe(101);
  });

  it("intraday: the wick triggers the stop; the exit fills at the next bar's open", () => {
    const result = runBacktestScaled(stopWickCandles(), at(1), never, {
      capital: 100_000,
      stopLoss: 5,
      slTpMode: "intraday",
      scaledEntry: SCALED_TWO_TRANCHES,
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitReason).toBe("stopLoss");
    // Stop triggers at i3; next-bar-open closes at i4's open.
    expect(result.trades[0].exitTime).toBe(DAY * 5);
    expect(result.trades[0].exitPrice).toBe(101);
  });
});

describe("additional tranches carry no look-ahead", () => {
  /**
   * The i3 bar spikes to 109 before closing at 97.9, which triggers the
   * price-based second tranche (-2% from 100). With take profit 10%:
   * - vs the OLD average (100) the TP level is 110 — the 109 high must not exit;
   * - vs the NEW average (~98.94) the TP level is ~108.8 — the fix must not
   *   let the pre-tranche 109 high trigger it either (the tranche only
   *   exists from the close / next open).
   */
  const addTrancheCandles = makeCandles(
    [
      { o: 100, h: 100.5, l: 99.5, c: 100 }, // i0
      { o: 100, h: 100.5, l: 99.5, c: 100 }, // i1 <- entry signal
      { o: 100, h: 100.5, l: 99.5, c: 100 }, // i2
      { o: 100, h: 109, l: 97, c: 97.9 }, // i3 pre-tranche spike + add trigger (97.9 <= 98)
      { o: 98, h: 98.5, l: 97.5, c: 98 }, // i4
      { o: 98, h: 98.5, l: 97.5, c: 98 }, // i5 endOfData
    ],
    DAY,
    DAY,
  );

  const priceScaled = {
    tranches: 2,
    strategy: "equal",
    intervalType: "price",
    priceInterval: -2,
  } as const;

  it("same-bar-close: the add bar's pre-fill high does not fire TP off the new average", () => {
    const result = runBacktestScaled(addTrancheCandles, at(1), never, {
      capital: 100_000,
      takeProfit: 10,
      fillMode: "same-bar-close",
      slTpMode: "intraday",
      scaledEntry: priceScaled,
    });

    // Before the fix: tranche added at i3's close, average updated to ~98.94,
    // then the TP check consumed the whole bar's high (109 >= ~108.8) and
    // exited with a profit on a bar that closed at 97.9.
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitReason).toBe("endOfData");
    expect(result.trades[0].exitPrice).toBe(98);
    // Both tranches filled: average sits between the two fills
    expect(result.trades[0].entryPrice).toBeLessThan(100);
    expect(result.trades[0].entryPrice).toBeCloseTo(98.94, 1);
  });

  it("next-bar-open: the tranche fills at the next open and TP never fires", () => {
    const result = runBacktestScaled(addTrancheCandles, at(1), never, {
      capital: 100_000,
      takeProfit: 10,
      slTpMode: "intraday",
      scaledEntry: priceScaled,
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitReason).toBe("endOfData");
    // First tranche i2 open (100), second tranche i4 open (98)
    expect(result.trades[0].entryPrice).toBeLessThan(100);
  });
});

describe("partial take profit keeps the tranche cost basis in sync", () => {
  /**
   * 2 tranches fill -> partial TP sells 50% -> 3rd tranche fills.
   *
   * capital 90,000, 3 equal tranches (30,000 each), no commission,
   * same-bar-close fills for exact close-price entries:
   * - t1 @100 (300 sh), t2 @98 (~306.12 sh) -> avg 98.9899
   * - partial TP (threshold 3% -> 101.9596) fires at close 102, sells 50%
   *   (selling does not change the remaining shares' average)
   * - t3 @96 (312.5 sh): correct remaining-basis average is
   *   (150*100 + 153.06*98 + 312.5*96) / 615.56 = 97.4720
   *
   * Without scaling the sold shares out of the tranches, the recomputed
   * average counted them at full weight: 90,000 / 918.62 = 97.9728.
   */
  const candles = makeCandles(
    [
      { o: 100, h: 100.5, l: 99.5, c: 100 }, // i0
      { o: 100, h: 100.5, l: 99.5, c: 100 }, // i1 <- signal, tranche 1 @100
      { o: 98, h: 98.5, l: 97.5, c: 98 }, // i2 add trigger (98 <= 98): tranche 2 @98
      { o: 102, h: 102.5, l: 101.5, c: 102 }, // i3 partial TP (close 102 >= 101.9596)
      { o: 96, h: 96.5, l: 95.5, c: 96 }, // i4 add trigger (96 <= 96): tranche 3 @96
      { o: 96, h: 96.5, l: 95.5, c: 96 }, // i5
      { o: 96, h: 96.5, l: 95.5, c: 96 }, // i6 endOfData @96
    ],
    DAY,
    DAY,
  );

  it("a tranche added after a partial exit averages against the remaining shares", () => {
    const result = runBacktestScaled(candles, at(1), never, {
      capital: 90_000,
      fillMode: "same-bar-close",
      partialTakeProfit: { threshold: 3, sellPercent: 50 },
      scaledEntry: {
        tranches: 3,
        strategy: "equal",
        intervalType: "price",
        priceInterval: -2,
      },
    });

    expect(result.trades).toHaveLength(2);

    const partial = result.trades[0];
    expect(partial.isPartial).toBe(true);
    expect(partial.exitPercent).toBe(50);
    expect(partial.exitReason).toBe("partialTakeProfit");
    expect(partial.entryPrice).toBeCloseTo(98.9899, 3);
    expect(partial.exitPrice).toBe(102);

    const final = result.trades[1];
    expect(final.exitReason).toBe("endOfData");
    expect(final.exitPrice).toBe(96);
    // Remaining-cost-basis average; with the sold shares still weighted in
    // the tranches this came out as 97.9728 instead.
    expect(final.entryPrice).toBeCloseTo(97.472, 3);
    expect(final.returnPercent).toBeCloseTo(((96 - 97.472) / 97.472) * 100, 2);
  });
});

describe("runBacktestScaled matches runBacktest when only one tranche fills", () => {
  const optionGrid: Record<string, unknown>[] = [];
  // No-modes entry: both engines must resolve their DEFAULTS identically
  // (they currently restate the default literals independently)
  optionGrid.push({ stopLoss: 3, takeProfit: 4 });
  for (const fillMode of ["next-bar-open", "same-bar-close"] as const) {
    for (const slTpMode of ["close-only", "intraday"] as const) {
      optionGrid.push({ fillMode, slTpMode, stopLoss: 3 });
      optionGrid.push({ fillMode, slTpMode, takeProfit: 4 });
      optionGrid.push({ fillMode, slTpMode, trailingStop: 5 });
      optionGrid.push({
        fillMode,
        slTpMode,
        partialTakeProfit: { threshold: 2, sellPercent: 50 },
        takeProfit: 6,
      });
      optionGrid.push({
        fillMode,
        slTpMode,
        stopLoss: 4,
        takeProfit: 5,
        trailingStop: 6,
        slippage: 0.1,
        commissionRate: 0.1,
        taxRate: 20,
      });
    }
  }

  // Deterministic LCG so failures are reproducible
  let seed = 424242;
  function rand(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  function makeRandomSeries(len: number): NormalizedCandle[] {
    let price = 80 + rand() * 40;
    const out: NormalizedCandle[] = [];
    for (let i = 0; i < len; i++) {
      const open = price;
      const drift = (rand() - 0.49) * 0.02 * price;
      const close = Math.max(1, price + drift);
      const vol = price * (0.002 + rand() * 0.02);
      const high = Math.max(open, close) + rand() * vol;
      const low = Math.min(open, close) - rand() * vol;
      out.push({ time: BASE + DAY * (i + 1), open, high, low, close, volume: 1000 });
      price = close;
    }
    return out;
  }

  it("trade-for-trade parity across fillMode x slTpMode x exit-option grid", () => {
    let comparisons = 0;
    for (let s = 0; s < 15; s++) {
      const candles = makeRandomSeries(60 + Math.floor(rand() * 120));
      for (const opts of optionGrid) {
        // (a) one-shot entry; the second signal tranche never fires
        {
          const ref = runBacktest(candles, at(3), periodicExit, {
            capital: 100_000,
            ...opts,
          });
          const scaled = runBacktestScaled(candles, at(3), periodicExit, {
            capital: 100_000,
            ...opts,
            scaledEntry: SCALED_TWO_TRANCHES,
          });
          expect(scaled.trades.map(comparable)).toEqual(ref.trades.map(comparable));
          comparisons++;
        }
        // (b) repeated entries; the price-based second tranche never triggers
        {
          const ref = runBacktest(candles, periodicEnter, periodicExit, {
            capital: 100_000,
            ...opts,
          });
          const scaled = runBacktestScaled(candles, periodicEnter, periodicExit, {
            capital: 100_000,
            ...opts,
            scaledEntry: {
              tranches: 3,
              strategy: "equal",
              intervalType: "price",
              priceInterval: -90,
            },
          });
          expect(scaled.trades.map(comparable)).toEqual(ref.trades.map(comparable));
          comparisons++;
        }
      }
    }
    expect(comparisons).toBe(15 * optionGrid.length * 2);
  });
});
