/**
 * Multi-Stock Backtest Analysis
 *
 * Run: npx tsx examples/multi-stock-analysis.ts
 */

import { readFileSync, readdirSync } from "fs";
import { resolve, basename, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import {
  TrendCraft,
  goldenCrossCondition,
  deadCrossCondition,
  rsiBelow,
  rsiAbove,
  macdCrossUp,
  macdCrossDown,
  perfectOrderBullish,
  perfectOrderCollapsed,
  validatedGoldenCross,
  validatedDeadCross,
  and,
  or,
} from "../src/index.js";
import type { Candle, BacktestResult } from "../src/index.js";

// Load CSV data
function loadCSV(filePath: string): Candle[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").slice(1);

  const candles: Candle[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split(",");
    if (parts.length < 7) continue;

    const [dateStr, open, high, low, close, volume, adjClose] = parts;

    const dateParts = dateStr.includes("-") ? dateStr.split("-") : dateStr.split("/");
    const [year, month, day] = dateParts.map(Number);
    const time = new Date(year, month - 1, day).getTime();

    const closeNum = parseFloat(close);
    const adjCloseNum = parseFloat(adjClose);
    const adjRatio = adjCloseNum / closeNum;

    candles.push({
      time,
      open: parseFloat(open) * adjRatio,
      high: parseFloat(high) * adjRatio,
      low: parseFloat(low) * adjRatio,
      close: adjCloseNum,
      volume: parseFloat(volume),
    });
  }

  return candles.sort((a, b) => (a.time as number) - (b.time as number));
}

// Strategy definitions
type StrategyDef = {
  name: string;
  shortName: string;
  run: (candles: Candle[]) => BacktestResult;
};

const capital = 1000000;
const stopLoss = 5;
const commissionRate = 0.1;
const taxRate = 20.315;

const strategies: StrategyDef[] = [
  {
    name: "GC/DC (5/25)",
    shortName: "GC/DC",
    run: (candles) =>
      TrendCraft.from(candles)
        .strategy()
        .entry(goldenCrossCondition(5, 25))
        .exit(deadCrossCondition(5, 25))
        .backtest({ capital, stopLoss, commissionRate, taxRate }),
  },
  {
    name: "騙し検出GC/DC",
    shortName: "騙し検出",
    run: (candles) =>
      TrendCraft.from(candles)
        .strategy()
        .entry(validatedGoldenCross({ minScore: 50 }))
        .exit(validatedDeadCross({ minScore: 50 }))
        .backtest({ capital, stopLoss, commissionRate, taxRate }),
  },
  {
    name: "RSI (30/70)",
    shortName: "RSI",
    run: (candles) =>
      TrendCraft.from(candles)
        .strategy()
        .entry(rsiBelow(30))
        .exit(rsiAbove(70))
        .backtest({ capital, stopLoss, commissionRate, taxRate }),
  },
  {
    name: "MACDクロス",
    shortName: "MACD",
    run: (candles) =>
      TrendCraft.from(candles)
        .strategy()
        .entry(macdCrossUp())
        .exit(macdCrossDown())
        .backtest({ capital, stopLoss, commissionRate, taxRate }),
  },
  {
    name: "GC + RSIフィルター",
    shortName: "GC+RSI",
    run: (candles) =>
      TrendCraft.from(candles)
        .strategy()
        .entry(and(goldenCrossCondition(5, 25), rsiBelow(50)))
        .exit(or(deadCrossCondition(5, 25), rsiAbove(70)))
        .backtest({ capital, stopLoss, commissionRate, taxRate }),
  },
  {
    name: "パーフェクトオーダー基本",
    shortName: "PO基本",
    run: (candles) =>
      TrendCraft.from(candles)
        .strategy()
        .entry(perfectOrderBullish({ periods: [5, 25, 75] }))
        .exit(perfectOrderCollapsed({ periods: [5, 25, 75] }))
        .backtest({ capital, stopLoss, commissionRate, taxRate }),
  },
  {
    name: "PO + 5%部分利確",
    shortName: "PO+部利",
    run: (candles) =>
      TrendCraft.from(candles)
        .strategy()
        .entry(perfectOrderBullish({ periods: [5, 25, 75] }))
        .exit(perfectOrderCollapsed({ periods: [5, 25, 75] }))
        .backtest({
          capital,
          stopLoss,
          commissionRate,
          taxRate,
          partialTakeProfit: { threshold: 5, sellPercent: 50 },
        }),
  },
  {
    name: "PO + トレイリング8%",
    shortName: "PO+トレ",
    run: (candles) =>
      TrendCraft.from(candles)
        .strategy()
        .entry(perfectOrderBullish({ periods: [5, 25, 75] }))
        .exit(perfectOrderCollapsed({ periods: [5, 25, 75] }))
        .backtest({
          capital,
          stopLoss,
          commissionRate,
          taxRate,
          trailingStop: 8,
        }),
  },
  {
    name: "PO + 部分利確 + トレイリング",
    shortName: "PO全部",
    run: (candles) =>
      TrendCraft.from(candles)
        .strategy()
        .entry(perfectOrderBullish({ periods: [5, 25, 75] }))
        .exit(perfectOrderCollapsed({ periods: [5, 25, 75] }))
        .backtest({
          capital,
          stopLoss,
          commissionRate,
          taxRate,
          partialTakeProfit: { threshold: 5, sellPercent: 50 },
          trailingStop: 8,
        }),
  },
];

// Main
const dataDir = resolve(__dirname, "data");
const csvFiles = readdirSync(dataDir)
  .filter((f) => f.endsWith(".csv"))
  .sort();

console.log(`\n${"=".repeat(80)}`);
console.log("📊 複数銘柄バックテスト分析");
console.log("=".repeat(80));
console.log(`対象銘柄: ${csvFiles.length}銘柄`);
console.log(`期間: 2015年以降`);
console.log(`初期資金: ${capital.toLocaleString()}円`);
console.log(`損切り: ${stopLoss}%`);

// Results storage
type StockResult = {
  symbol: string;
  results: Map<string, BacktestResult>;
};

const allResults: StockResult[] = [];

// Run backtests
const startDate = new Date(2015, 0, 1).getTime();

for (const csvFile of csvFiles) {
  const symbol = basename(csvFile, ".csv");
  const filePath = resolve(dataDir, csvFile);

  const allCandles = loadCSV(filePath);
  const candles = allCandles.filter((c) => (c.time as number) >= startDate);

  if (candles.length < 100) {
    console.log(`\n⚠️ ${symbol}: データ不足 (${candles.length}日分)`);
    continue;
  }

  const stockResult: StockResult = {
    symbol,
    results: new Map(),
  };

  for (const strategy of strategies) {
    try {
      const result = strategy.run(candles);
      stockResult.results.set(strategy.shortName, result);
    } catch (e) {
      console.error(`❌ ${symbol} - ${strategy.name}: エラー`);
    }
  }

  allResults.push(stockResult);
}

// Print per-stock results
console.log(`\n${"=".repeat(80)}`);
console.log("📈 銘柄別結果");
console.log("=".repeat(80));

for (const stock of allResults) {
  console.log(`\n【${stock.symbol}】`);
  console.log("-".repeat(70));
  console.log("戦略          | リターン | 勝率  | 取引数 | DD    | PF   | シャープ");
  console.log("-".repeat(70));

  for (const strategy of strategies) {
    const result = stock.results.get(strategy.shortName);
    if (!result) continue;

    const ret = result.totalReturnPercent.toFixed(1).padStart(7);
    const win = result.winRate.toFixed(0).padStart(4);
    const trades = String(result.tradeCount).padStart(4);
    const dd = result.maxDrawdown.toFixed(1).padStart(5);
    const pf = result.profitFactor.toFixed(2).padStart(5);
    const sharpe = result.sharpeRatio.toFixed(2).padStart(6);
    console.log(
      `${strategy.shortName.padEnd(14)}| ${ret}% | ${win}% | ${trades}   | ${dd}% | ${pf} | ${sharpe}`
    );
  }
}

// Aggregate analysis
console.log(`\n${"=".repeat(80)}`);
console.log("📊 戦略別集計分析");
console.log("=".repeat(80));

type StrategyStats = {
  name: string;
  avgReturn: number;
  avgWinRate: number;
  avgDrawdown: number;
  avgPF: number;
  avgSharpe: number;
  winCount: number; // プラスリターンの銘柄数
  loseCount: number;
  bestStock: string;
  bestReturn: number;
  worstStock: string;
  worstReturn: number;
};

const strategyStats: StrategyStats[] = [];

for (const strategy of strategies) {
  const returns: number[] = [];
  const winRates: number[] = [];
  const drawdowns: number[] = [];
  const pfs: number[] = [];
  const sharpes: number[] = [];
  let winCount = 0;
  let loseCount = 0;
  let bestStock = "";
  let bestReturn = -Infinity;
  let worstStock = "";
  let worstReturn = Infinity;

  for (const stock of allResults) {
    const result = stock.results.get(strategy.shortName);
    if (!result || result.tradeCount === 0) continue;

    returns.push(result.totalReturnPercent);
    winRates.push(result.winRate);
    drawdowns.push(result.maxDrawdown);
    pfs.push(result.profitFactor === Infinity ? 10 : result.profitFactor);
    sharpes.push(result.sharpeRatio);

    if (result.totalReturnPercent > 0) winCount++;
    else loseCount++;

    if (result.totalReturnPercent > bestReturn) {
      bestReturn = result.totalReturnPercent;
      bestStock = stock.symbol;
    }
    if (result.totalReturnPercent < worstReturn) {
      worstReturn = result.totalReturnPercent;
      worstStock = stock.symbol;
    }
  }

  if (returns.length > 0) {
    strategyStats.push({
      name: strategy.shortName,
      avgReturn: returns.reduce((a, b) => a + b, 0) / returns.length,
      avgWinRate: winRates.reduce((a, b) => a + b, 0) / winRates.length,
      avgDrawdown: drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length,
      avgPF: pfs.reduce((a, b) => a + b, 0) / pfs.length,
      avgSharpe: sharpes.reduce((a, b) => a + b, 0) / sharpes.length,
      winCount,
      loseCount,
      bestStock,
      bestReturn,
      worstStock,
      worstReturn,
    });
  }
}

console.log("\n戦略          | 平均リターン | 平均勝率 | 平均DD | 平均PF | 平均SR | 勝敗");
console.log("-".repeat(80));

for (const stats of strategyStats) {
  const avgRet = stats.avgReturn.toFixed(1).padStart(10);
  const avgWin = stats.avgWinRate.toFixed(1).padStart(7);
  const avgDD = stats.avgDrawdown.toFixed(1).padStart(6);
  const avgPF = stats.avgPF.toFixed(2).padStart(6);
  const avgSR = stats.avgSharpe.toFixed(2).padStart(6);
  const winLose = `${stats.winCount}勝${stats.loseCount}敗`;
  console.log(
    `${stats.name.padEnd(14)}| ${avgRet}% | ${avgWin}% | ${avgDD}% | ${avgPF} | ${avgSR} | ${winLose}`
  );
}

// Best/Worst by strategy
console.log(`\n${"=".repeat(80)}`);
console.log("🏆 戦略別 最良/最悪銘柄");
console.log("=".repeat(80));

for (const stats of strategyStats) {
  console.log(
    `${stats.name}: ベスト ${stats.bestStock} (+${stats.bestReturn.toFixed(1)}%) / ワースト ${stats.worstStock} (${stats.worstReturn.toFixed(1)}%)`
  );
}

// Ranking
console.log(`\n${"=".repeat(80)}`);
console.log("🥇 戦略ランキング (平均リターン順)");
console.log("=".repeat(80));

const sortedByReturn = [...strategyStats].sort((a, b) => b.avgReturn - a.avgReturn);
sortedByReturn.forEach((s, i) => {
  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
  console.log(`${medal} ${s.name}: 平均 ${s.avgReturn.toFixed(1)}% (${s.winCount}勝${s.loseCount}敗)`);
});

console.log(`\n${"=".repeat(80)}`);
console.log("📉 リスク調整後ランキング (シャープレシオ順)");
console.log("=".repeat(80));

const sortedBySharpe = [...strategyStats].sort((a, b) => b.avgSharpe - a.avgSharpe);
sortedBySharpe.forEach((s, i) => {
  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
  console.log(`${medal} ${s.name}: SR ${s.avgSharpe.toFixed(2)} (平均DD ${s.avgDrawdown.toFixed(1)}%)`);
});

// Stock ranking
console.log(`\n${"=".repeat(80)}`);
console.log("📈 銘柄ランキング (PO基本戦略)");
console.log("=".repeat(80));

const stockReturns = allResults
  .map((s) => ({
    symbol: s.symbol,
    ret: s.results.get("PO基本")?.totalReturnPercent ?? 0,
    winRate: s.results.get("PO基本")?.winRate ?? 0,
  }))
  .sort((a, b) => b.ret - a.ret);

stockReturns.forEach((s, i) => {
  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
  console.log(`${medal} ${s.symbol}: ${s.ret.toFixed(1)}% (勝率 ${s.winRate.toFixed(0)}%)`);
});

console.log(`\n✅ 分析完了`);
