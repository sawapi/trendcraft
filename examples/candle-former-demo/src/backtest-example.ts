/**
 * Backtest using CandleFormer predictions as entry/exit signals
 *
 * Splits data into train (first 70%) and test (last 30%) to avoid data leakage.
 *
 * Usage: pnpm backtest [symbol]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  candleFormerBearish,
  candleFormerBullish,
  runBacktest,
  trainCandleFormer,
} from "trendcraft";
import type { NormalizedCandle } from "trendcraft";

function main() {
  const symbol = (process.argv[2] ?? "AAPL").toLowerCase();

  const candlePath = resolve(import.meta.dirname, `../data/candles-${symbol}.json`);
  const candles: NormalizedCandle[] = JSON.parse(readFileSync(candlePath, "utf-8"));

  // Split: 70% train, 30% test (out-of-sample)
  const splitIdx = Math.floor(candles.length * 0.7);
  const trainCandles = candles.slice(0, splitIdx);
  const testCandles = candles.slice(splitIdx);

  console.log(`CandleFormer backtest on ${symbol.toUpperCase()}`);
  console.log(
    `Total: ${candles.length} candles → Train: ${trainCandles.length}, Test: ${testCandles.length}\n`,
  );

  // Train on first 70%
  console.log("Training on in-sample data...");
  const { weights, accuracy, trainLoss, lossHistory } = trainCandleFormer(trainCandles, {
    epochs: 500,
    seqLen: 32,
    embedDim: 32,
    mlpDim: 128,
    numLayers: 2,
    patience: 25,
    dropoutRate: 0.1,
    weightDecay: 0.01,
    warmupEpochs: 20,
    labelSmoothing: 0.1,
    gradClipNorm: 1.0,
    seed: 42,
    onEpoch: (epoch, loss, vLoss) => {
      if (epoch % 50 === 0) {
        const valStr = vLoss !== null ? ` val_loss=${vLoss.toFixed(4)}` : "";
        console.log(`  Epoch ${epoch}: loss=${loss.toFixed(4)}${valStr}`);
      }
    },
  });
  console.log(`  Stopped at epoch ${lossHistory.length}`);
  console.log(`  Train accuracy: ${(accuracy * 100).toFixed(1)}%, loss: ${trainLoss.toFixed(4)}\n`);

  // Backtest on last 30% (out-of-sample)
  const entry = candleFormerBullish(weights, 50);
  const exit = candleFormerBearish(weights, 40);

  const result = runBacktest(testCandles, entry, exit, { capital: 10000 });

  console.log("=== Out-of-Sample Backtest Results ===");
  console.log(`Total trades:    ${result.tradeCount}`);
  console.log(`Total return:    ${result.totalReturnPercent.toFixed(2)}%`);
  console.log(`Win rate:        ${result.winRate.toFixed(1)}%`);
  console.log(`Max drawdown:    ${result.maxDrawdown.toFixed(2)}%`);
  console.log(`Sharpe ratio:    ${result.sharpeRatio.toFixed(2)}`);
  console.log(`Profit factor:   ${result.profitFactor.toFixed(2)}`);

  if (result.trades.length > 0) {
    console.log("\n=== Recent Trades ===");
    const recentTrades = result.trades.slice(-5);
    for (const trade of recentTrades) {
      const entryDate = new Date(trade.entryTime).toISOString().split("T")[0];
      const exitDate = new Date(trade.exitTime).toISOString().split("T")[0];
      const returnPct = trade.returnPercent.toFixed(2);
      const icon = trade.returnPercent >= 0 ? "+" : "";
      console.log(`  ${entryDate} → ${exitDate}: ${icon}${returnPct}%`);
    }
  }
}

main();
