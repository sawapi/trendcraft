/**
 * 銘柄特性分析スクリプト
 *
 * best戦略が失敗する銘柄と成功する銘柄の特性を比較分析し、
 * 銘柄フィルタの設計に必要な知見を得る。
 *
 * 分析観点:
 * - 価格トレンド（CAGR、高値更新率）
 * - ボラティリティ（ATR/Price、標準偏差）
 * - 出来高特性（平均出来高、出来高変動）
 * - トレード特性（シグナル発生頻度、勝率パターン）
 *
 * 使い方:
 *   npx tsx examples/stock-failure-analysis.ts
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeCandles,
  runBacktest,
  and,
  calculateAllMetrics,
  sma,
  atr,
  // Conditions
  goldenCrossCondition as goldenCross,
  volumeAnomalyCondition,
  volumeDivergence,
  macdCrossDown,
  // Types
  type NormalizedCandle,
} from "../../src";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// Data Loading
// ============================================

function loadCsv(filename: string): NormalizedCandle[] {
  const filepath = join(__dirname, "..", "data", filename);
  if (!existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }

  const content = readFileSync(filepath, "utf-8");
  const lines = content.trim().split("\n");
  const dataLines = lines.slice(1);

  const rawCandles = dataLines.map((line) => {
    const [date, open, high, low, close, volume] = line.split(",");
    const [year, month, day] = date.split("/");
    const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    return {
      time: isoDate,
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: parseFloat(volume),
    };
  });

  rawCandles.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return normalizeCandles(rawCandles);
}

function getAvailableTickers(): string[] {
  const dataDir = join(__dirname, "..", "data");
  if (!existsSync(dataDir)) return [];

  return readdirSync(dataDir)
    .filter((f) => f.endsWith(".csv"))
    .map((f) => f.replace(".csv", ""));
}

const TICKER_NAMES: Record<string, string> = {
  "3542.T": "ベガコーポ",
  "4063.T": "信越化学",
  "4502.T": "武田薬品",
  "4689.T": "Zホールディングス",
  "4755.T": "楽天G",
  "4997.T": "日本農薬",
  "6005.T": "三浦工業",
  "6594.T": "日本電産",
  "6758.T": "ソニーG",
  "6762.T": "TDK",
  "6861.T": "キーエンス",
  "6920.T": "レーザーテック",
  "7203.T": "トヨタ",
  "7267.T": "ホンダ",
  "7974.T": "任天堂",
  "8035.T": "東京エレクトロン",
  "8306.T": "三菱UFJ",
  "9432.T": "NTT",
  "9984.T": "SBG",
};

// ============================================
// Stock Characteristics Calculation
// ============================================

type StockCharacteristics = {
  ticker: string;
  name: string;

  // Price trend
  totalReturn: number; // 全期間リターン
  cagr3y: number; // 直近3年CAGR
  cagr5y: number; // 直近5年CAGR
  highUpdateRate: number; // 252日高値更新率
  priceAboveSma200: number; // SMA200上の日数比率

  // Volatility
  atrPercent: number; // ATR / Price (%)
  dailyVolatility: number; // 日次リターン標準偏差
  maxDrawdown: number; // 最大ドローダウン

  // Volume
  avgVolume: number; // 平均出来高
  volumeVolatility: number; // 出来高の標準偏差/平均

  // Strategy performance
  strategySharpe: number;
  strategyReturn: number;
  strategyWinRate: number;
  strategyTradeCount: number;
  strategyMaxDD: number;
  strategyPF: number;
};

function calculateCAGR(startPrice: number, endPrice: number, years: number): number {
  if (startPrice <= 0 || years <= 0) return 0;
  return (Math.pow(endPrice / startPrice, 1 / years) - 1) * 100;
}

function calculateHighUpdateRate(candles: NormalizedCandle[], lookback: number = 252): number {
  if (candles.length < lookback) return 0;

  const recentCandles = candles.slice(-lookback);
  let highUpdates = 0;

  for (let i = 1; i < recentCandles.length; i++) {
    const prevHigh = Math.max(...recentCandles.slice(0, i).map((c) => c.high));
    if (recentCandles[i].high > prevHigh) {
      highUpdates++;
    }
  }

  return (highUpdates / (lookback - 1)) * 100;
}

function calculatePriceAboveSma(candles: NormalizedCandle[], period: number = 200): number {
  if (candles.length < period) return 0;

  const smaValues = sma(candles, period);
  let aboveCount = 0;
  let totalCount = 0;

  // SeriesはIndicatorValue[]なので、candle.timeでマッチングする
  const smaMap = new Map(smaValues.map((v) => [v.time, v.value]));

  for (let i = period; i < candles.length; i++) {
    const smaVal = smaMap.get(candles[i].time);
    if (smaVal !== undefined) {
      totalCount++;
      if (candles[i].close > smaVal) {
        aboveCount++;
      }
    }
  }

  return totalCount > 0 ? (aboveCount / totalCount) * 100 : 0;
}

function calculateATRPercent(candles: NormalizedCandle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;

  const atrValues = atr(candles, period);
  const recentCandles = candles.slice(-252); // 直近1年

  // SeriesはIndicatorValue[]なので、candle.timeでマッチングする
  const atrMap = new Map(atrValues.map((v) => [v.time, v.value]));

  let totalAtrPercent = 0;
  let count = 0;

  for (const candle of recentCandles) {
    const atrVal = atrMap.get(candle.time);
    if (atrVal !== undefined && candle.close > 0) {
      totalAtrPercent += (atrVal / candle.close) * 100;
      count++;
    }
  }

  return count > 0 ? totalAtrPercent / count : 0;
}

function calculateDailyVolatility(candles: NormalizedCandle[]): number {
  if (candles.length < 2) return 0;

  const returns: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i - 1].close > 0) {
      returns.push((candles[i].close - candles[i - 1].close) / candles[i - 1].close);
    }
  }

  if (returns.length === 0) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * 100; // パーセント
}

function calculateMaxDrawdown(candles: NormalizedCandle[]): number {
  if (candles.length === 0) return 0;

  let peak = candles[0].close;
  let maxDD = 0;

  for (const candle of candles) {
    if (candle.close > peak) {
      peak = candle.close;
    }
    const dd = ((peak - candle.close) / peak) * 100;
    if (dd > maxDD) {
      maxDD = dd;
    }
  }

  return maxDD;
}

function calculateVolumeVolatility(candles: NormalizedCandle[]): number {
  if (candles.length === 0) return 0;

  const volumes = candles.map((c) => c.volume);
  const mean = volumes.reduce((a, b) => a + b, 0) / volumes.length;

  if (mean === 0) return 0;

  const variance = volumes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / volumes.length;
  return Math.sqrt(variance) / mean; // 変動係数
}

function analyzeStock(ticker: string, candles: NormalizedCandle[]): StockCharacteristics {
  const name = TICKER_NAMES[ticker] || ticker;

  // Price trend
  const totalReturn =
    candles.length > 0
      ? ((candles[candles.length - 1].close - candles[0].close) / candles[0].close) * 100
      : 0;

  const threeYearsAgo = candles.length > 756 ? candles.slice(-756) : candles;
  const fiveYearsAgo = candles.length > 1260 ? candles.slice(-1260) : candles;

  const cagr3y =
    threeYearsAgo.length > 1
      ? calculateCAGR(
          threeYearsAgo[0].close,
          threeYearsAgo[threeYearsAgo.length - 1].close,
          threeYearsAgo.length / 252,
        )
      : 0;

  const cagr5y =
    fiveYearsAgo.length > 1
      ? calculateCAGR(
          fiveYearsAgo[0].close,
          fiveYearsAgo[fiveYearsAgo.length - 1].close,
          fiveYearsAgo.length / 252,
        )
      : 0;

  const highUpdateRate = calculateHighUpdateRate(candles, 252);
  const priceAboveSma200 = calculatePriceAboveSma(candles, 200);

  // Volatility
  const atrPercent = calculateATRPercent(candles, 14);
  const dailyVolatility = calculateDailyVolatility(candles);
  const maxDrawdown = calculateMaxDrawdown(candles);

  // Volume
  const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
  const volumeVolatility = calculateVolumeVolatility(candles);

  // Strategy performance (best strategy)
  const entry = and(goldenCross(5, 25), volumeAnomalyCondition(2.0, 20));
  const exit = and(macdCrossDown(), volumeDivergence());

  const result = runBacktest(candles, entry, exit, {
    capital: 1000000,
    stopLoss: 5,
    commissionRate: 0.1,
    taxRate: 20.315,
  });

  const metrics = calculateAllMetrics(result, candles, { initialCapital: 1000000 });

  return {
    ticker,
    name,
    totalReturn,
    cagr3y,
    cagr5y,
    highUpdateRate,
    priceAboveSma200,
    atrPercent,
    dailyVolatility,
    maxDrawdown,
    avgVolume,
    volumeVolatility,
    strategySharpe: metrics.sharpe,
    strategyReturn: metrics.returns,
    strategyWinRate: metrics.winRate,
    strategyTradeCount: metrics.tradeCount,
    strategyMaxDD: metrics.maxDrawdown,
    strategyPF: metrics.profitFactor,
  };
}

// ============================================
// Analysis and Output
// ============================================

function analyzeFailurePatterns(results: StockCharacteristics[]): void {
  // 成功/失敗で分類
  const successful = results.filter((r) => r.strategySharpe > 0.1 && r.strategyReturn > 0);
  const failed = results.filter((r) => r.strategySharpe < 0 || r.strategyReturn < 0);
  const marginal = results.filter(
    (r) => r.strategySharpe >= 0 && r.strategySharpe <= 0.1 && r.strategyReturn >= 0,
  );

  console.log("=".repeat(80));
  console.log("銘柄特性分析 - best戦略 (GC + VolAnomaly → MACD↓ + VolDiv)");
  console.log("=".repeat(80));
  console.log();

  // 分類結果
  console.log("## 分類結果");
  console.log();
  console.log(`成功 (Sharpe > 0.1, Return > 0): ${successful.length}銘柄`);
  successful.forEach((r) =>
    console.log(
      `  - ${r.ticker} (${r.name}): Sharpe ${r.strategySharpe.toFixed(2)}, Return ${r.strategyReturn.toFixed(0)}%, WinRate ${r.strategyWinRate.toFixed(0)}%, Trades ${r.strategyTradeCount}`,
    ),
  );
  console.log();

  console.log(`失敗 (Sharpe < 0 or Return < 0): ${failed.length}銘柄`);
  failed.forEach((r) =>
    console.log(
      `  - ${r.ticker} (${r.name}): Sharpe ${r.strategySharpe.toFixed(2)}, Return ${r.strategyReturn.toFixed(0)}%, WinRate ${r.strategyWinRate.toFixed(0)}%, Trades ${r.strategyTradeCount}`,
    ),
  );
  console.log();

  console.log(`限界的 (Sharpe 0-0.1, Return >= 0): ${marginal.length}銘柄`);
  marginal.forEach((r) =>
    console.log(
      `  - ${r.ticker} (${r.name}): Sharpe ${r.strategySharpe.toFixed(2)}, Return ${r.strategyReturn.toFixed(0)}%, WinRate ${r.strategyWinRate.toFixed(0)}%, Trades ${r.strategyTradeCount}`,
    ),
  );
  console.log();

  // 特性比較
  console.log("=".repeat(80));
  console.log("## 成功 vs 失敗 特性比較");
  console.log("=".repeat(80));
  console.log();

  const avgCharacteristics = (group: StockCharacteristics[]) => ({
    cagr3y: group.reduce((s, r) => s + r.cagr3y, 0) / group.length,
    cagr5y: group.reduce((s, r) => s + r.cagr5y, 0) / group.length,
    highUpdateRate: group.reduce((s, r) => s + r.highUpdateRate, 0) / group.length,
    priceAboveSma200: group.reduce((s, r) => s + r.priceAboveSma200, 0) / group.length,
    atrPercent: group.reduce((s, r) => s + r.atrPercent, 0) / group.length,
    dailyVolatility: group.reduce((s, r) => s + r.dailyVolatility, 0) / group.length,
    maxDrawdown: group.reduce((s, r) => s + r.maxDrawdown, 0) / group.length,
    volumeVolatility: group.reduce((s, r) => s + r.volumeVolatility, 0) / group.length,
  });

  if (successful.length > 0 && failed.length > 0) {
    const successAvg = avgCharacteristics(successful);
    const failedAvg = avgCharacteristics(failed);

    console.log("| 特性 | 成功銘柄平均 | 失敗銘柄平均 | 差分 | 判別力 |");
    console.log("|------|-------------|-------------|------|--------|");

    const compare = (name: string, sVal: number, fVal: number, unit: string = "") => {
      const diff = sVal - fVal;
      const ratio = fVal !== 0 ? Math.abs(diff / fVal) : 0;
      let power = "";
      if (ratio > 0.5) power = "★★★";
      else if (ratio > 0.3) power = "★★";
      else if (ratio > 0.1) power = "★";
      else power = "-";

      console.log(
        `| ${name.padEnd(20)} | ${sVal.toFixed(1)}${unit} | ${fVal.toFixed(1)}${unit} | ${diff > 0 ? "+" : ""}${diff.toFixed(1)} | ${power} |`,
      );
    };

    compare("3年CAGR", successAvg.cagr3y, failedAvg.cagr3y, "%");
    compare("5年CAGR", successAvg.cagr5y, failedAvg.cagr5y, "%");
    compare("高値更新率(252日)", successAvg.highUpdateRate, failedAvg.highUpdateRate, "%");
    compare("SMA200上比率", successAvg.priceAboveSma200, failedAvg.priceAboveSma200, "%");
    compare("ATR/Price", successAvg.atrPercent, failedAvg.atrPercent, "%");
    compare("日次ボラティリティ", successAvg.dailyVolatility, failedAvg.dailyVolatility, "%");
    compare("最大DD", successAvg.maxDrawdown, failedAvg.maxDrawdown, "%");
    compare("出来高変動係数", successAvg.volumeVolatility, failedAvg.volumeVolatility, "");
  }

  console.log();

  // トレード特性比較
  console.log("=".repeat(80));
  console.log("## トレード特性比較");
  console.log("=".repeat(80));
  console.log();

  if (successful.length > 0 && failed.length > 0) {
    const avgTradeStats = (group: StockCharacteristics[]) => ({
      winRate: group.reduce((s, r) => s + r.strategyWinRate, 0) / group.length,
      tradeCount: group.reduce((s, r) => s + r.strategyTradeCount, 0) / group.length,
      maxDD: group.reduce((s, r) => s + r.strategyMaxDD, 0) / group.length,
      pf: group.reduce((s, r) => s + (isFinite(r.strategyPF) ? r.strategyPF : 0), 0) / group.length,
    });

    const successTrade = avgTradeStats(successful);
    const failedTrade = avgTradeStats(failed);

    console.log("| 指標 | 成功銘柄平均 | 失敗銘柄平均 | 考察 |");
    console.log("|------|-------------|-------------|------|");
    console.log(
      `| 勝率 | ${successTrade.winRate.toFixed(1)}% | ${failedTrade.winRate.toFixed(1)}% | ${successTrade.winRate > failedTrade.winRate ? "成功の方が高い" : "差なし"} |`,
    );
    console.log(
      `| トレード回数 | ${successTrade.tradeCount.toFixed(1)} | ${failedTrade.tradeCount.toFixed(1)} | ${successTrade.tradeCount > failedTrade.tradeCount ? "成功の方が多い" : "失敗の方が多い"} |`,
    );
    console.log(
      `| 最大DD | ${successTrade.maxDD.toFixed(1)}% | ${failedTrade.maxDD.toFixed(1)}% | ${successTrade.maxDD < failedTrade.maxDD ? "成功の方が低い" : "失敗の方が低い"} |`,
    );
    console.log(
      `| PF | ${successTrade.pf.toFixed(2)} | ${failedTrade.pf.toFixed(2)} | ${successTrade.pf > failedTrade.pf ? "成功の方が高い" : "差なし"} |`,
    );
  }

  console.log();

  // 個別トレード詳細
  console.log("=".repeat(80));
  console.log("## 個別トレード詳細");
  console.log("=".repeat(80));
  console.log();

  console.log("| 銘柄 | WinRate | Trades | MaxDD | PF | W/L比率 | 考察 |");
  console.log("|------|---------|--------|-------|-----|---------|------|");

  const sortedForTrade = [...results].sort((a, b) => b.strategySharpe - a.strategySharpe);
  for (const r of sortedForTrade) {
    const status = r.strategySharpe > 0.1 ? "✓" : r.strategySharpe < 0 ? "✗" : "△";
    // 勝率とPFから推測する平均利益/損失の比率
    const winLossRatio =
      r.strategyWinRate > 0 && r.strategyWinRate < 100
        ? r.strategyPF * ((100 - r.strategyWinRate) / r.strategyWinRate)
        : 0;

    let insight = "";
    if (r.strategyReturn < 0) {
      if (r.strategyWinRate < 40) insight = "勝率が低い";
      else if (r.strategyPF < 1) insight = "損大利小";
      else if (r.strategyTradeCount < 20) insight = "サンプル不足";
      else insight = "要調査";
    }

    console.log(
      `| ${status} ${r.ticker.padEnd(7)} | ${r.strategyWinRate.toFixed(0).padStart(5)}% | ${String(r.strategyTradeCount).padStart(6)} | ${r.strategyMaxDD.toFixed(1).padStart(5)}% | ${r.strategyPF.toFixed(2).padStart(4)} | ${winLossRatio.toFixed(2).padStart(7)} | ${insight} |`,
    );
  }

  console.log();

  // 詳細データ
  console.log("=".repeat(80));
  console.log("## 全銘柄詳細データ");
  console.log("=".repeat(80));
  console.log();

  console.log(
    "| 銘柄 | 3yCAGR | 5yCAGR | 高値更新 | SMA200上 | ATR% | 日次Vol | 戦略Sharpe | 戦略Return |",
  );
  console.log("|------|--------|--------|----------|----------|------|---------|------------|------------|");

  // Sharpe順でソート
  const sorted = [...results].sort((a, b) => b.strategySharpe - a.strategySharpe);

  for (const r of sorted) {
    const status = r.strategySharpe > 0.1 ? "✓" : r.strategySharpe < 0 ? "✗" : "△";
    console.log(
      `| ${status} ${r.ticker.padEnd(8)} | ${r.cagr3y.toFixed(1).padStart(6)}% | ${r.cagr5y.toFixed(1).padStart(6)}% | ${r.highUpdateRate.toFixed(1).padStart(8)}% | ${r.priceAboveSma200.toFixed(1).padStart(8)}% | ${r.atrPercent.toFixed(2).padStart(4)}% | ${r.dailyVolatility.toFixed(2).padStart(7)}% | ${r.strategySharpe.toFixed(2).padStart(10)} | ${r.strategyReturn.toFixed(0).padStart(10)}% |`,
    );
  }

  console.log();

  // フィルタ推奨
  console.log("=".repeat(80));
  console.log("## フィルタ推奨値");
  console.log("=".repeat(80));
  console.log();

  if (successful.length > 0 && failed.length > 0) {
    const successAvg = avgCharacteristics(successful);
    const failedAvg = avgCharacteristics(failed);

    // 成功銘柄の最小値を閾値候補に
    const successMin = {
      cagr3y: Math.min(...successful.map((r) => r.cagr3y)),
      highUpdateRate: Math.min(...successful.map((r) => r.highUpdateRate)),
      priceAboveSma200: Math.min(...successful.map((r) => r.priceAboveSma200)),
      atrPercent: Math.min(...successful.map((r) => r.atrPercent)),
    };

    console.log("成功銘柄の最小値（フィルタ閾値候補）:");
    console.log(`  - 3年CAGR >= ${successMin.cagr3y.toFixed(1)}%`);
    console.log(`  - 高値更新率 >= ${successMin.highUpdateRate.toFixed(1)}%`);
    console.log(`  - SMA200上比率 >= ${successMin.priceAboveSma200.toFixed(1)}%`);
    console.log(`  - ATR/Price >= ${successMin.atrPercent.toFixed(2)}%`);
    console.log();

    // 失敗銘柄の平均値も参考に
    console.log("失敗銘柄の平均値（除外の目安）:");
    console.log(`  - 3年CAGR: ${failedAvg.cagr3y.toFixed(1)}%`);
    console.log(`  - 高値更新率: ${failedAvg.highUpdateRate.toFixed(1)}%`);
    console.log(`  - SMA200上比率: ${failedAvg.priceAboveSma200.toFixed(1)}%`);
    console.log(`  - ATR/Price: ${failedAvg.atrPercent.toFixed(2)}%`);
  }
}

// ============================================
// Main
// ============================================

async function main() {
  console.log("銘柄データ分析中...\n");

  const tickers = getAvailableTickers();
  const results: StockCharacteristics[] = [];

  for (const ticker of tickers) {
    process.stdout.write(`  ${ticker.padEnd(12)} ... `);
    try {
      const candles = loadCsv(`${ticker}.csv`);
      const characteristics = analyzeStock(ticker, candles);
      results.push(characteristics);
      console.log(`OK (${candles.length}件, Sharpe ${characteristics.strategySharpe.toFixed(2)})`);
    } catch (error) {
      console.log(`ERROR: ${error}`);
    }
  }

  console.log();
  analyzeFailurePatterns(results);
}

main().catch(console.error);
