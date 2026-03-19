/**
 * 02 — Backtest a Golden Cross Strategy
 *
 * Run a simple SMA golden cross / dead cross backtest with stop-loss.
 * Run: npx tsx examples/quick-start/02-backtest.ts
 */
import {
  type NormalizedCandle,
  TrendCraft,
  and,
  deadCrossCondition,
  goldenCrossCondition,
  rsiBelow,
} from "../../src";

// Generate 200 days of trending + mean-reverting data
function generateCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = 100;
  const baseTime = Date.now() - count * 86_400_000;

  for (let i = 0; i < count; i++) {
    // Create a trend cycle: up for first half, down for last quarter, recover
    const phase = i / count;
    let drift = 0;
    if (phase < 0.4) drift = 0.3;
    else if (phase < 0.6) drift = -0.2;
    else if (phase < 0.8) drift = 0.4;
    else drift = -0.1;

    const change = drift + (Math.random() - 0.5) * 3;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const volume = Math.floor(500_000 + Math.random() * 500_000);

    candles.push({ time: baseTime + i * 86_400_000, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

const candles = generateCandles(200);

// --- Backtest: Golden Cross + RSI filter ---
const result = TrendCraft.from(candles)
  .strategy()
  .entry(and(goldenCrossCondition(), rsiBelow(50)))
  .exit(deadCrossCondition())
  .backtest({
    capital: 1_000_000,
    stopLoss: 5,
    takeProfit: 15,
    commission: 0,
    commissionRate: 0.1,
  });

console.log("=== Backtest Results ===\n");
console.log(`Total Return:   ${result.totalReturnPercent.toFixed(2)}%`);
console.log(`Win Rate:       ${result.winRate.toFixed(1)}%`);
console.log(`Max Drawdown:   ${result.maxDrawdown.toFixed(2)}%`);
console.log(`Sharpe Ratio:   ${result.sharpeRatio.toFixed(3)}`);
console.log(`Profit Factor:  ${result.profitFactor.toFixed(2)}`);
console.log(`Total Trades:   ${result.tradeCount}`);
const avgRet = result.tradeCount > 0 ? result.totalReturnPercent / result.tradeCount : 0;
console.log(`Avg Return:     ${avgRet.toFixed(2)}%`);
console.log(
  `\nEquity: ¥${(1_000_000).toLocaleString()} → ¥${(1_000_000 * (1 + result.totalReturnPercent / 100)).toFixed(0)}`,
);
