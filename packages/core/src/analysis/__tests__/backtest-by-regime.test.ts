import { describe, expect, it } from "vitest";
import { at, never, stepCandles } from "../../backtest/__tests__/step-candles";
import { runBacktest } from "../../backtest/engine";
import { hmmRegimes } from "../../indicators/regime";
import type { NormalizedCandle, Series } from "../../types";
import { backtestByRegime, type RegimeLabel } from "../backtest-by-regime";

/** Build a per-bar regime series aligned to `candles` from a state-index list. */
function regimesFrom(candles: NormalizedCandle[], states: number[]): Series<RegimeLabel> {
  return candles.map((c, i) => ({
    time: c.time,
    value: { regime: states[i], label: `s${states[i]}` },
  }));
}

describe("backtestByRegime — attribution", () => {
  // Flat at 100 then a single jump to 110: one held position captures +10%,
  // concentrated on the bar where the close steps up.
  const CANDLES = stepCandles([
    { price: 100, bars: 5 },
    { price: 110, bars: 5 },
  ]);
  // Entry signal at bar 1 fills at bar 2 open (100); exit signal at bar 8 fills
  // at bar 9 open (110) -> a single +10% trade. The MTM step from 100 to 110
  // lands as returns[4] (moving into bar 5).
  const result = runBacktest(CANDLES, at(1), at(8), { capital: 100_000 });

  it("attributes each return to the regime of the bar it is realised on", () => {
    // Bars 0-4 -> regime 0, bars 5-9 -> regime 1. The +10% step is realised
    // moving into bar 5 (return index 4 -> regimes[5] = regime 1).
    const regimes = regimesFrom(CANDLES, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    const { regimes: table } = backtestByRegime(result, { candles: CANDLES, regimes });

    expect(table).toHaveLength(2);
    const calm = table[0];
    const rally = table[1];

    expect(calm.regime).toBe(0);
    expect(rally.regime).toBe(1);
    // returns[0..3] -> regimes[1..4] (regime 0); returns[4..8] -> regimes[5..9] (regime 1).
    expect(calm.bars).toBe(4);
    expect(rally.bars).toBe(5);
    expect(calm.bars + rally.bars).toBe(CANDLES.length - 1);

    expect(calm.totalReturnPercent).toBeCloseTo(0, 9);
    expect(rally.totalReturnPercent).toBeCloseTo(10, 6);

    // fractionOfPeriod partitions the return series.
    expect(calm.fractionOfPeriod + rally.fractionOfPeriod).toBeCloseTo(1, 12);
  });

  it("counts trades by their entry regime (trade-level view)", () => {
    // Entry fills on bar 2 (regime 0), so the trade is attributed to regime 0.
    const regimes = regimesFrom(CANDLES, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    const { regimes: table } = backtestByRegime(result, { candles: CANDLES, regimes });
    expect(table[0].tradeCount).toBe(1);
    expect(table[1].tradeCount).toBe(0);
    expect(table.reduce((a, r) => a + r.tradeCount, 0)).toBe(result.trades.length);
  });

  it("yields NaN Sharpe for a regime with fewer than two bars", () => {
    // Only one bar lands in regime 1 (regimes[9]); the rest are regime 0.
    const regimes = regimesFrom(CANDLES, [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    const { regimes: table } = backtestByRegime(result, { candles: CANDLES, regimes });
    const single = table.find((r) => r.regime === 1);
    expect(single?.bars).toBe(1);
    expect(Number.isNaN(single?.sharpeRatio ?? 0)).toBe(true);
  });

  it("throws when regimes are not aligned with candles", () => {
    const regimes = regimesFrom(CANDLES, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]).slice(0, 5);
    expect(() => backtestByRegime(result, { candles: CANDLES, regimes })).toThrow(/aligned/);
  });

  it("attributes a profitable short to the regime it falls in", () => {
    // Flat at 100, then down to 90: a short captures +10%, realised on the
    // step into bar 5 (return index 4 -> regimes[5] = regime 1).
    const down = stepCandles([
      { price: 100, bars: 5 },
      { price: 90, bars: 5 },
    ]);
    const short = runBacktest(down, at(1), at(8), { capital: 100_000, direction: "short" });
    expect(short.trades).toHaveLength(1);

    const regimes = regimesFrom(down, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    const { regimes: table } = backtestByRegime(short, { candles: down, regimes });
    expect(table[0].totalReturnPercent).toBeCloseTo(0, 9);
    expect(table[1].totalReturnPercent).toBeCloseTo(10, 6);
  });

  it("attributes the full P&L of a scaled-out position (all partials counted)", () => {
    // Entry at 100, climbing through three scale-out levels. A from-trades
    // reconstruction that stopped at the first partial would under-count the
    // later legs; the engine's equity curve keeps every leg.
    const rising = stepCandles([
      { price: 100, bars: 2 },
      { price: 106, bars: 2 },
      { price: 111, bars: 2 },
      { price: 121, bars: 2 },
    ]);
    const scaled = runBacktest(rising, at(1), () => false, {
      capital: 1_000_000,
      scaleOut: {
        levels: [
          { threshold: 5, sellPercent: 33 },
          { threshold: 10, sellPercent: 50 },
          { threshold: 20, sellPercent: 100 },
        ],
      },
      fillMode: "same-bar-close",
      slTpMode: "intraday",
    });
    expect(scaled.trades.length).toBeGreaterThan(1);

    // One regime over the whole window: its total return must match the run.
    const regimes = rising.map((c) => ({ time: c.time, value: { regime: 0, label: "s0" } }));
    const { regimes: table } = backtestByRegime(scaled, { candles: rising, regimes });
    expect(table).toHaveLength(1);
    expect(table[0].totalReturnPercent).toBeCloseTo(scaled.totalReturnPercent, 4);
  });

  it("keeps a no-trade report flat across every regime", () => {
    const flat = runBacktest(CANDLES, never, never, { capital: 100_000 });
    expect(flat.tradeCount).toBe(0);

    const regimes = regimesFrom(CANDLES, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    const { regimes: table } = backtestByRegime(flat, { candles: CANDLES, regimes });
    expect(table.reduce((a, r) => a + r.bars, 0)).toBe(CANDLES.length - 1);
    for (const r of table) {
      expect(r.totalReturnPercent).toBeCloseTo(0, 12);
      expect(r.maxDrawdownPercent).toBeCloseTo(0, 12);
      expect(r.tradeCount).toBe(0);
    }
  });
});

describe("backtestByRegime — transition matrix", () => {
  it("counts bar-to-bar transitions and normalises each row to 1", () => {
    const candles = stepCandles([{ price: 100, bars: 6 }]);
    const flat = runBacktest(candles, never, never, { capital: 100_000 });
    // Sequence 0,0,1,1,0,1 -> transitions 0->0, 0->1, 1->1, 1->0, 0->1.
    const regimes = regimesFrom(candles, [0, 0, 1, 1, 0, 1]);

    const { transition } = backtestByRegime(flat, { candles, regimes });
    expect(transition.states).toEqual([0, 1]);
    expect(transition.labels).toEqual(["s0", "s1"]);
    // from 0: to0=1, to1=2 ; from 1: to0=1, to1=1
    expect(transition.counts).toEqual([
      [1, 2],
      [1, 1],
    ]);
    expect(transition.matrix[0]).toEqual([1 / 3, 2 / 3]);
    expect(transition.matrix[1]).toEqual([1 / 2, 1 / 2]);
    // Counts total the number of bar-to-bar steps.
    const totalCounts = transition.counts.flat().reduce((a, c) => a + c, 0);
    expect(totalCounts).toBe(candles.length - 1);
  });

  it("emits an all-zero row for a state with no outgoing transitions", () => {
    const candles = stepCandles([{ price: 100, bars: 4 }]);
    const flat = runBacktest(candles, never, never, { capital: 100_000 });
    // State 1 appears only as the final bar, so it never transitions out.
    const regimes = regimesFrom(candles, [0, 0, 0, 1]);
    const { transition } = backtestByRegime(flat, { candles, regimes });
    expect(transition.states).toEqual([0, 1]);
    expect(transition.matrix[1]).toEqual([0, 0]);
  });
});

describe("backtestByRegime — integration with hmmRegimes", () => {
  // Three distinct segments: up-trend, down-trend, choppy — so the HMM has
  // real structure to separate.
  function trendCandles(): NormalizedCandle[] {
    const candles: NormalizedCandle[] = [];
    let t = 1_700_000_000_000;
    let price = 100;
    const push = (p: number) => {
      candles.push({ time: t, open: p, high: p + 1, low: p - 1, close: p, volume: 1_000_000 });
      t += 86_400_000;
    };
    for (let i = 0; i < 60; i++) {
      price += 0.8; // up-trend
      push(price);
    }
    for (let i = 0; i < 60; i++) {
      price -= 0.7; // down-trend
      push(price);
    }
    for (let i = 0; i < 60; i++) {
      price += i % 2 === 0 ? 0.5 : -0.5; // choppy
      push(price);
    }
    return candles;
  }

  const candles = trendCandles();
  const result = runBacktest(candles, at(10), at(80), { capital: 100_000 });
  const regimes = hmmRegimes(candles, { numStates: 3 });

  it("accepts hmmRegimes output and preserves the structural invariants", () => {
    const { regimes: table, transition } = backtestByRegime(result, { candles, regimes });

    // One row per observed state, ascending, matching the transition labels.
    const observed = [...new Set(regimes.map((r) => r.value.regime))].sort((a, b) => a - b);
    expect(table.map((r) => r.regime)).toEqual(observed);
    expect(transition.states).toEqual(observed);

    // Bars partition the return series; fractions sum to 1.
    expect(table.reduce((a, r) => a + r.bars, 0)).toBe(candles.length - 1);
    expect(table.reduce((a, r) => a + r.fractionOfPeriod, 0)).toBeCloseTo(1, 9);

    // Every transition row is a probability distribution (sum 1) or all-zero.
    for (const row of transition.matrix) {
      const s = row.reduce((a, c) => a + c, 0);
      expect(s === 0 || Math.abs(s - 1) < 1e-12).toBe(true);
    }
    expect(transition.counts.flat().reduce((a, c) => a + c, 0)).toBe(candles.length - 1);

    // Trade attribution stays within the realised trades.
    expect(table.reduce((a, r) => a + r.tradeCount, 0)).toBeLessThanOrEqual(result.trades.length);
  });
});
