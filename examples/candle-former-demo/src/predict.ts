/**
 * Run predictions using a trained CandleFormer model
 *
 * Usage:
 *   pnpm predict [symbol] [count]
 *   pnpm predict --patterns [symbol] [count]
 *
 * Shows the last N predictions from the candle data.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { candleFormer } from "trendcraft";
import type { CandleFormerWeights, NormalizedCandle } from "trendcraft";

function main() {
  const args = process.argv.slice(2);
  const usePatterns = args.includes("--patterns");
  const positional = args.filter((a) => !a.startsWith("--"));

  const symbol = (positional[0] ?? "AAPL").toLowerCase();
  const count = Number.parseInt(positional[1] ?? "10", 10);

  const candlePath = resolve(import.meta.dirname, `../data/candles-${symbol}.json`);
  const suffix = usePatterns ? "-patterns" : "";
  const weightsPath = resolve(import.meta.dirname, `../data/weights-${symbol}${suffix}.json`);

  if (!existsSync(weightsPath)) {
    // Fallback: try without suffix
    const fallback = resolve(import.meta.dirname, `../data/weights-${symbol}.json`);
    if (!existsSync(fallback)) {
      throw new Error(
        `Weights not found: ${weightsPath}\nRun: pnpm train ${usePatterns ? "--patterns " : ""}${symbol}`,
      );
    }
    console.log("Note: pattern weights not found, using standard weights\n");
  }

  const candles: NormalizedCandle[] = JSON.parse(readFileSync(candlePath, "utf-8"));
  const actualWeightsPath = existsSync(weightsPath)
    ? weightsPath
    : resolve(import.meta.dirname, `../data/weights-${symbol}.json`);
  const weights: CandleFormerWeights = JSON.parse(readFileSync(actualWeightsPath, "utf-8"));

  const hasPatterns = (weights.config.patternVocabSize ?? 0) > 0;
  const modeStr = hasPatterns ? " (dual embedding)" : "";
  console.log(
    `Running predictions on ${symbol.toUpperCase()} (${candles.length} candles)${modeStr}...\n`,
  );

  const predictions = candleFormer(candles, { weights });
  const lastN = predictions.slice(-count);

  console.log("Date           | Direction | Confidence | Bull%  Bear%  Neut%");
  console.log("-------------- | --------- | ---------- | -----  -----  -----");

  for (const p of lastN) {
    const date = new Date(p.time).toISOString().split("T")[0];
    const dir = p.value.direction.padEnd(9);
    const conf = `${p.value.confidence}%`.padStart(4);
    const { bullish, bearish, neutral } = p.value.probabilities;
    console.log(
      `${date} | ${dir} | ${conf}       | ${(bullish * 100).toFixed(1)}%  ${(bearish * 100).toFixed(1)}%  ${(neutral * 100).toFixed(1)}%`,
    );
  }

  // Summary
  const bullCount = predictions.filter((p) => p.value.direction === "bullish").length;
  const bearCount = predictions.filter((p) => p.value.direction === "bearish").length;
  const neutCount = predictions.filter((p) => p.value.direction === "neutral").length;

  console.log(
    `\nSummary: ${bullCount} bullish, ${bearCount} bearish, ${neutCount} neutral out of ${predictions.length}`,
  );
}

main();
