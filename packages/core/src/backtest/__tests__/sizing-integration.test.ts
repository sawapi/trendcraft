import { describe, expect, it } from "vitest";
import type { BacktestSizingContext, ConditionFn, NormalizedCandle } from "../../types";
import { runBacktest } from "../engine";

/**
 * Step-price candles: a flat segment per step, with open=close=price and a
 * ±1 high/low band. Flat segments keep ATR exactly 2 (TR = high-low = 2),
 * making ATR-based sizing arithmetic exact.
 */
function stepCandles(
  steps: { price: number; bars: number }[],
  volume = 1_000_000,
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let t = 1_700_000_000_000;
  for (const s of steps) {
    for (let i = 0; i < s.bars; i++) {
      candles.push({
        time: t,
        open: s.price,
        high: s.price + 1,
        low: s.price - 1,
        close: s.price,
        volume,
      });
      t += 86_400_000;
    }
  }
  return candles;
}

const at =
  (...indices: number[]): ConditionFn =>
  (_ind, _candle, i) =>
    indices.includes(i);
const never: ConditionFn = () => false;

/**
 * Layout A: 30 bars at 100, then 10 bars at 120. Entry signal at bar 20
 * fills at bar 21's open (100, ATR warmed up); exit signal at bar 32 fills
 * at bar 33's open (120) → every trade is an exact +20% move.
 */
const UP_20 = stepCandles([
  { price: 100, bars: 30 },
  { price: 120, bars: 10 },
]);
const ENTRY = at(20);
const EXIT = at(32);
const CAPITAL = 1_000_000;

describe("backtest position sizing", () => {
  it("omitting sizing and { method: 'full-capital' } behave identically (legacy default)", () => {
    const base = runBacktest(UP_20, ENTRY, EXIT, { capital: CAPITAL });
    const explicit = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      sizing: { method: "full-capital" },
    });
    expect(explicit.finalCapital).toBe(base.finalCapital);
    expect(explicit.trades.length).toBe(base.trades.length);
    // Full capital on a +20% move: 1M → 1.2M
    expect(base.finalCapital).toBeCloseTo(1_200_000, 6);
    expect(base.settings.sizing).toBeUndefined();
  });

  it("fixed-fractional deploys only the configured fraction of equity", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      sizing: { method: "fixed-fractional", fractionPercent: 10 },
    });
    // 10% of 1M = 100k deployed at 100 → 1000 shares → +20 each = +20k
    expect(result.trades.length).toBe(1);
    expect(result.finalCapital).toBeCloseTo(1_020_000, 6);
    // Full config recorded for reproducibility, not just the method name
    expect(result.settings.sizing).toEqual({ method: "fixed-fractional", fractionPercent: 10 });
  });

  it("sizes on compounding equity across sequential trades", () => {
    const candles = stepCandles([
      { price: 100, bars: 10 },
      { price: 120, bars: 10 },
      { price: 144, bars: 10 },
    ]);
    const result = runBacktest(candles, at(2, 15), at(12, 25), {
      capital: CAPITAL,
      sizing: { method: "fixed-fractional", fractionPercent: 50 },
    });
    // Trade 1: 500k @100 → 600k (equity 1.1M). Trade 2: 550k @120 → 660k.
    // Final = 550k cash + 660k = 1.21M — only correct if trade 2 sized on
    // the *updated* equity, not the initial capital.
    expect(result.trades.length).toBe(2);
    expect(result.finalCapital).toBeCloseTo(1_210_000, 6);
  });

  it("risk-based sizes off the configured stopLoss distance", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      stopLoss: 5,
      sizing: { method: "risk-based", riskPercent: 1 },
    });
    // Risk 1% of 1M = 10k against a 5-point stop (5% of 100) → 2000 shares
    // → +20 each = +40k
    expect(result.trades.length).toBe(1);
    expect(result.finalCapital).toBeCloseTo(1_040_000, 6);
  });

  it("risk-based sizing can deploy leveraged buying power when margin is configured", () => {
    // Risk 2% of 1M equity against a 1-point stop (1% of 100) → 20,000 shares
    // = 2M notional = exactly the 2x buying power. The sizing layer must not
    // pre-cap at 100% of cash equity, or leverage is silently disabled.
    const base = {
      capital: CAPITAL,
      stopLoss: 1,
      margin: { leverage: 2, maintenanceMargin: 0.25, marginCallAction: "liquidate" as const },
    };
    const sized = runBacktest(UP_20, ENTRY, EXIT, {
      ...base,
      sizing: { method: "risk-based", riskPercent: 2 },
    });
    const fullCapital = runBacktest(UP_20, ENTRY, EXIT, base);
    expect(sized.trades.length).toBe(1);
    // Same deployment as a full-capital margin entry → identical outcome
    expect(sized.finalCapital).toBeCloseTo(fullCapital.finalCapital, 6);
  });

  it("risk-based sizing is still clamped to cash buying power without margin", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      stopLoss: 1,
      sizing: { method: "risk-based", riskPercent: 2 },
    });
    // The 1-point stop asks for 20,000 shares (2M notional) but no margin is
    // configured → clamped to the 10,000-share full-capital fill
    expect(result.trades.length).toBe(1);
    expect(result.finalCapital).toBeCloseTo(1_200_000, 6);
  });

  it("risk-based falls back to full-capital when no stop is configured", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      sizing: { method: "risk-based", riskPercent: 1 },
    });
    expect(result.finalCapital).toBeCloseTo(1_200_000, 6);
  });

  it("atr-based sizes off the ATR-implied stop distance", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      sizing: { method: "atr-based", riskPercent: 1, atrMultiplier: 2 },
    });
    // ATR is exactly 2 on the flat segment → stop distance 4. Risk 1% of 1M
    // = 10k → 2500 shares → +20 each = +50k
    expect(result.trades.length).toBe(1);
    expect(result.finalCapital).toBeCloseTo(1_050_000, 6);
  });

  it("atr-based skips entries while ATR is still warming up", () => {
    // Entry signal at bar 2 → fill attempt at bar 3, where ATR(14) is null
    const result = runBacktest(UP_20, at(2), never, {
      capital: CAPITAL,
      sizing: { method: "atr-based", riskPercent: 1 },
    });
    expect(result.trades.length).toBe(0);
    expect(result.finalCapital).toBe(CAPITAL);
  });

  it("kelly sizes by the (fractional) Kelly percentage", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      sizing: { method: "kelly", winRate: 0.6, winLossRatio: 1.5 },
    });
    // Full Kelly = 0.6 - 0.4/1.5 = 33.33%; default half-Kelly → 16.67% of 1M
    // = 166,666.67 @100 → 1666.67 shares → +20 each = +33,333.33
    expect(result.trades.length).toBe(1);
    expect(result.finalCapital).toBeCloseTo(1_033_333.33, 1);
  });

  it("kelly with no edge (negative Kelly) skips all entries", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      sizing: { method: "kelly", winRate: 0.3, winLossRatio: 1 },
    });
    expect(result.trades.length).toBe(0);
    expect(result.finalCapital).toBe(CAPITAL);
  });

  it("custom callback receives the entry context and its share count is honored", () => {
    let captured: BacktestSizingContext | null = null;
    // ctx.closedTrades is a live view of the trade log — record its length
    // at call time, since it grows once this very trade closes.
    let closedTradesAtEntry = -1;
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      sizing: {
        method: "custom",
        calculate: (ctx) => {
          captured = ctx;
          closedTradesAtEntry = ctx.closedTrades.length;
          return 500;
        },
      },
    });
    expect(result.trades.length).toBe(1);
    // 500 shares × +20 = +10k
    expect(result.finalCapital).toBeCloseTo(1_010_000, 6);
    // Callbacks are not serializable — recorded as method-only
    expect(result.settings.sizing).toEqual({ method: "custom" });

    const ctx = captured as unknown as BacktestSizingContext;
    expect(ctx).not.toBeNull();
    expect(ctx.equity).toBe(CAPITAL);
    expect(ctx.entryPrice).toBe(100);
    expect(ctx.proposedShares).toBeCloseTo(10_000, 6);
    expect(ctx.direction).toBe("long");
    expect(ctx.index).toBe(21);
    expect(ctx.atr).toBeCloseTo(2, 6);
    expect(closedTradesAtEntry).toBe(0);
  });

  it("custom callback returning 0 skips the entry", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      sizing: { method: "custom", calculate: () => 0 },
    });
    expect(result.trades.length).toBe(0);
    expect(result.finalCapital).toBe(CAPITAL);
  });

  it("custom callback result is clamped to available buying power", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      sizing: { method: "custom", calculate: () => 1e9 },
    });
    // Clamped to a full-capital fill → same as the default policy
    expect(result.finalCapital).toBeCloseTo(1_200_000, 6);
  });

  it("volume constraint still caps a sized order (and capital is conserved)", () => {
    const flat = stepCandles([{ price: 100, bars: 30 }], 100);
    const result = runBacktest(flat, at(2), never, {
      capital: CAPITAL,
      sizing: { method: "fixed-fractional", fractionPercent: 10 },
      // 10% of bar volume 100 = 10 shares, far below the sized 1000 shares
      volumeConstraint: { maxVolumePercent: 10 },
    });
    expect(result.trades.length).toBe(1);
    // Flat market, no fees → conservation regardless of how the order shrank
    expect(result.finalCapital).toBeCloseTo(CAPITAL, 6);
  });

  it("works for short positions", () => {
    const down20 = stepCandles([
      { price: 100, bars: 30 },
      { price: 80, bars: 10 },
    ]);
    const result = runBacktest(down20, ENTRY, EXIT, {
      capital: CAPITAL,
      direction: "short",
      sizing: { method: "fixed-fractional", fractionPercent: 10 },
    });
    // 1000 shares short from 100 to 80 → +20 each = +20k
    expect(result.trades.length).toBe(1);
    expect(result.finalCapital).toBeCloseTo(1_020_000, 6);
  });
});
