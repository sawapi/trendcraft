/**
 * Train a CandleFormer model on historical candle data
 *
 * Usage:
 *   pnpm train [symbol]              - single stock
 *   pnpm train aapl msft goog ...    - multi-stock (combined training)
 *   pnpm train --patterns aapl       - enable pattern-aware dual embedding
 *
 * Reads candles-<symbol>.json from data/ and outputs weights-<name>.json
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { trainCandleFormer } from "trendcraft";
import type { NormalizedCandle } from "trendcraft";

function loadCandles(symbol: string): NormalizedCandle[] {
  const candlePath = resolve(import.meta.dirname, `../data/candles-${symbol}.json`);
  if (!existsSync(candlePath)) {
    throw new Error(
      `Data file not found: ${candlePath}\nRun: pnpm fetch-data ${symbol.toUpperCase()}`,
    );
  }
  const candles: NormalizedCandle[] = JSON.parse(readFileSync(candlePath, "utf-8"));
  console.log(`  ${symbol.toUpperCase()}: ${candles.length} candles`);
  return candles;
}

function main() {
  const args = process.argv.slice(2);
  const enablePatterns = args.includes("--patterns");
  const symbols = args.filter((a) => !a.startsWith("--")).map((s) => s.toLowerCase());
  if (symbols.length === 0) symbols.push("aapl");
  const isMulti = symbols.length > 1;

  console.log("Loading candle data...");
  const datasets = symbols.map(loadCandles);
  const totalCandles = datasets.reduce((sum, d) => sum + d.length, 0);
  console.log(`Total: ${totalCandles} candles from ${symbols.length} symbol(s)\n`);

  const patternStr = enablePatterns ? ", patterns=dual" : "";
  console.log("Training CandleFormer...");
  console.log(`Config: seqLen=32, embedDim=32, heads=4, mlpDim=128, layers=2${patternStr}`);
  console.log("---");

  const input = isMulti ? datasets : datasets[0];

  const startTime = Date.now();
  const { weights, trainLoss, valLoss, accuracy, lossHistory } = trainCandleFormer(input, {
    epochs: 500,
    learningRate: 0.001,
    batchSize: 32,
    validationSplit: 0.1,
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
    enablePatterns,
    onEpoch: (epoch, tLoss, vLoss) => {
      if (epoch % 20 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const valStr = vLoss !== null ? ` val_loss=${vLoss.toFixed(4)}` : "";
        console.log(`Epoch ${epoch}: train_loss=${tLoss.toFixed(4)}${valStr}  (${elapsed}s)`);
      }
    },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("---");
  console.log(`Training complete! (stopped at epoch ${lossHistory.length}, ${elapsed}s)`);
  console.log(`  Train loss: ${trainLoss.toFixed(4)}`);
  if (valLoss !== null) console.log(`  Val loss:   ${valLoss.toFixed(4)}`);
  console.log(`  Accuracy:   ${(accuracy * 100).toFixed(1)}%`);

  const suffix = enablePatterns ? "-patterns" : "";
  const weightsName = isMulti ? symbols.join("-") : symbols[0];
  const weightsPath = resolve(import.meta.dirname, `../data/weights-${weightsName}${suffix}.json`);
  writeFileSync(weightsPath, JSON.stringify(weights));
  console.log(`\nWeights saved to ${weightsPath}`);
}

main();
