/**
 * フィルタ検証スクリプト
 *
 * ATRフィルタと動的停止ルールの有効性を検証する。
 *
 * フィルタ案:
 * 1. ATRフィルタ: ATR% >= 2.3% の銘柄のみ対象
 * 2. 動的停止ルール: 勝率 < 25% かつ Trades >= 20 → 戦略停止
 *
 * 使い方:
 *   npx tsx examples/filter-validation.ts
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeCandles,
  runBacktest,
  and,
  calculateAllMetrics,
  atr,
  // Conditions
  goldenCrossCondition as goldenCross,
  volumeAnomalyCondition,
  volumeDivergence,
  macdCrossDown,
  // Types
  type NormalizedCandle,
  type BacktestResult,
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
// ATR Filter
// ============================================

function calculateATRPercent(candles: NormalizedCandle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;

  const atrValues = atr(candles, period);
  const recentCandles = candles.slice(-252);
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

// ============================================
// Dynamic Stop Rule (Simulated)
// ============================================

type DynamicStopResult = {
  originalResult: BacktestResult;
  stoppedResult: BacktestResult | null;
  stoppedAt: number | null;
  stoppedReason: string | null;
};

function runBacktestWithDynamicStop(
  candles: NormalizedCandle[],
  minTradesForCheck: number = 20,
  minWinRateThreshold: number = 25,
): DynamicStopResult {
  const entry = and(goldenCross(5, 25), volumeAnomalyCondition(2.0, 20));
  const exit = and(macdCrossDown(), volumeDivergence());

  // フルバックテスト
  const fullResult = runBacktest(candles, entry, exit, {
    capital: 1000000,
    stopLoss: 5,
    commissionRate: 0.1,
    taxRate: 20.315,
  });

  // トレードがない場合
  if (fullResult.trades.length === 0) {
    return {
      originalResult: fullResult,
      stoppedResult: null,
      stoppedAt: null,
      stoppedReason: null,
    };
  }

  // 動的停止チェック: N回トレード後に勝率をチェック
  if (fullResult.trades.length >= minTradesForCheck) {
    const checkTrades = fullResult.trades.slice(0, minTradesForCheck);
    const wins = checkTrades.filter((t) => t.profit > 0).length;
    const winRate = (wins / minTradesForCheck) * 100;

    if (winRate < minWinRateThreshold) {
      // 停止すべきだった場合、最初のN回で終了したと仮定
      const lastCheckTrade = checkTrades[checkTrades.length - 1];
      const stoppedCandles = candles.filter((c) => c.time <= lastCheckTrade.exitTime);

      const stoppedResult = runBacktest(stoppedCandles, entry, exit, {
        capital: 1000000,
        stopLoss: 5,
        commissionRate: 0.1,
        taxRate: 20.315,
      });

      return {
        originalResult: fullResult,
        stoppedResult,
        stoppedAt: minTradesForCheck,
        stoppedReason: `勝率${winRate.toFixed(0)}% < ${minWinRateThreshold}%`,
      };
    }
  }

  return {
    originalResult: fullResult,
    stoppedResult: null,
    stoppedAt: null,
    stoppedReason: null,
  };
}

// ============================================
// Validation
// ============================================

type ValidationResult = {
  ticker: string;
  name: string;
  atrPercent: number;
  passATRFilter: boolean;

  // フィルタなし
  noFilterSharpe: number;
  noFilterReturn: number;
  noFilterWinRate: number;
  noFilterTrades: number;

  // 動的停止適用後
  dynamicStopApplied: boolean;
  dynamicStopReason: string | null;
  dynamicStopSharpe: number | null;
  dynamicStopReturn: number | null;
};

function validateStock(ticker: string, candles: NormalizedCandle[]): ValidationResult {
  const name = TICKER_NAMES[ticker] || ticker;
  const atrPercent = calculateATRPercent(candles);
  const passATRFilter = atrPercent >= 2.3;

  // 動的停止付きバックテスト
  const dynamicResult = runBacktestWithDynamicStop(candles, 20, 25);
  const metrics = calculateAllMetrics(dynamicResult.originalResult, candles, { initialCapital: 1000000 });

  let dynamicStopSharpe: number | null = null;
  let dynamicStopReturn: number | null = null;

  if (dynamicResult.stoppedResult) {
    const stoppedMetrics = calculateAllMetrics(dynamicResult.stoppedResult, candles, { initialCapital: 1000000 });
    dynamicStopSharpe = stoppedMetrics.sharpe;
    dynamicStopReturn = stoppedMetrics.returns;
  }

  return {
    ticker,
    name,
    atrPercent,
    passATRFilter,
    noFilterSharpe: metrics.sharpe,
    noFilterReturn: metrics.returns,
    noFilterWinRate: metrics.winRate,
    noFilterTrades: metrics.tradeCount,
    dynamicStopApplied: dynamicResult.stoppedResult !== null,
    dynamicStopReason: dynamicResult.stoppedReason,
    dynamicStopSharpe,
    dynamicStopReturn,
  };
}

// ============================================
// Main
// ============================================

async function main() {
  console.log("=".repeat(80));
  console.log("フィルタ検証");
  console.log("=".repeat(80));
  console.log();
  console.log("フィルタ条件:");
  console.log("  1. ATRフィルタ: ATR% >= 2.3%");
  console.log("  2. 動的停止: 20回トレード後、勝率 < 25% なら停止");
  console.log();

  const tickers = getAvailableTickers();
  const results: ValidationResult[] = [];

  console.log("検証中...\n");

  for (const ticker of tickers) {
    process.stdout.write(`  ${ticker.padEnd(12)} ... `);
    try {
      const candles = loadCsv(`${ticker}.csv`);
      const result = validateStock(ticker, candles);
      results.push(result);
      console.log(`OK (ATR ${result.atrPercent.toFixed(2)}%)`);
    } catch (error) {
      console.log(`ERROR: ${error}`);
    }
  }

  console.log();

  // ============================================
  // シナリオ別結果
  // ============================================

  console.log("=".repeat(80));
  console.log("## シナリオ別比較");
  console.log("=".repeat(80));
  console.log();

  // シナリオ1: フィルタなし（全銘柄）
  const scenario1 = results;
  const s1Success = scenario1.filter((r) => r.noFilterReturn > 0);
  const s1AvgReturn = scenario1.reduce((s, r) => s + r.noFilterReturn, 0) / scenario1.length;

  // シナリオ2: ATRフィルタのみ
  const scenario2 = results.filter((r) => r.passATRFilter);
  const s2Success = scenario2.filter((r) => r.noFilterReturn > 0);
  const s2AvgReturn = scenario2.reduce((s, r) => s + r.noFilterReturn, 0) / scenario2.length;
  const s2Excluded = results.filter((r) => !r.passATRFilter);

  // シナリオ3: 動的停止のみ
  const s3Results = results.map((r) => {
    if (r.dynamicStopApplied && r.dynamicStopReturn !== null) {
      return { ...r, effectiveReturn: r.dynamicStopReturn };
    }
    return { ...r, effectiveReturn: r.noFilterReturn };
  });
  const s3AvgReturn = s3Results.reduce((s, r) => s + r.effectiveReturn, 0) / s3Results.length;
  const s3Stopped = results.filter((r) => r.dynamicStopApplied);

  // シナリオ4: ATRフィルタ + 動的停止
  const scenario4base = results.filter((r) => r.passATRFilter);
  const s4Results = scenario4base.map((r) => {
    if (r.dynamicStopApplied && r.dynamicStopReturn !== null) {
      return { ...r, effectiveReturn: r.dynamicStopReturn };
    }
    return { ...r, effectiveReturn: r.noFilterReturn };
  });
  const s4AvgReturn = s4Results.length > 0 ? s4Results.reduce((s, r) => s + r.effectiveReturn, 0) / s4Results.length : 0;
  const s4Success = s4Results.filter((r) => r.effectiveReturn > 0);

  console.log("| シナリオ | 対象銘柄数 | 成功率 | 平均リターン |");
  console.log("|----------|-----------|--------|-------------|");
  console.log(
    `| フィルタなし | ${scenario1.length} | ${((s1Success.length / scenario1.length) * 100).toFixed(0)}% | ${s1AvgReturn.toFixed(0)}% |`,
  );
  console.log(
    `| ATRフィルタ (>=2.3%) | ${scenario2.length} | ${((s2Success.length / scenario2.length) * 100).toFixed(0)}% | ${s2AvgReturn.toFixed(0)}% |`,
  );
  console.log(
    `| 動的停止 (WR<25%@20T) | ${scenario1.length} | - | ${s3AvgReturn.toFixed(0)}% |`,
  );
  console.log(
    `| ATR + 動的停止 | ${s4Results.length} | ${s4Results.length > 0 ? ((s4Success.length / s4Results.length) * 100).toFixed(0) : 0}% | ${s4AvgReturn.toFixed(0)}% |`,
  );

  console.log();

  // ============================================
  // ATRフィルタで除外された銘柄
  // ============================================

  console.log("=".repeat(80));
  console.log("## ATRフィルタで除外された銘柄");
  console.log("=".repeat(80));
  console.log();

  console.log("| 銘柄 | ATR% | 元Return | 除外判定 |");
  console.log("|------|------|----------|----------|");

  for (const r of s2Excluded) {
    const judgment = r.noFilterReturn < 0 ? "正解 (損失回避)" : "誤り (利益逃す)";
    console.log(`| ${r.ticker} (${r.name}) | ${r.atrPercent.toFixed(2)}% | ${r.noFilterReturn.toFixed(0)}% | ${judgment} |`);
  }

  console.log();

  // ============================================
  // 動的停止が発動した銘柄
  // ============================================

  console.log("=".repeat(80));
  console.log("## 動的停止が発動した銘柄");
  console.log("=".repeat(80));
  console.log();

  console.log("| 銘柄 | 理由 | 停止後Return | 継続時Return | 効果 |");
  console.log("|------|------|-------------|-------------|------|");

  for (const r of s3Stopped) {
    const effect =
      r.dynamicStopReturn !== null && r.dynamicStopReturn > r.noFilterReturn
        ? "損失軽減"
        : r.dynamicStopReturn !== null && r.dynamicStopReturn < r.noFilterReturn
          ? "利益逃す"
          : "-";
    console.log(
      `| ${r.ticker} (${r.name}) | ${r.dynamicStopReason} | ${r.dynamicStopReturn?.toFixed(0) ?? "-"}% | ${r.noFilterReturn.toFixed(0)}% | ${effect} |`,
    );
  }

  console.log();

  // ============================================
  // 全銘柄詳細
  // ============================================

  console.log("=".repeat(80));
  console.log("## 全銘柄詳細");
  console.log("=".repeat(80));
  console.log();

  console.log("| 銘柄 | ATR% | ATRフィルタ | 動的停止 | 最終Return | 元Return |");
  console.log("|------|------|------------|---------|-----------|---------|");

  const sortedResults = [...results].sort((a, b) => b.noFilterReturn - a.noFilterReturn);

  for (const r of sortedResults) {
    const atrStatus = r.passATRFilter ? "PASS" : "FAIL";
    const stopStatus = r.dynamicStopApplied ? `STOP(${r.dynamicStopReason})` : "-";
    const finalReturn = r.dynamicStopApplied && r.dynamicStopReturn !== null ? r.dynamicStopReturn : r.noFilterReturn;

    console.log(
      `| ${r.ticker.padEnd(8)} | ${r.atrPercent.toFixed(2).padStart(5)}% | ${atrStatus.padEnd(4)} | ${stopStatus.padEnd(20)} | ${finalReturn.toFixed(0).padStart(9)}% | ${r.noFilterReturn.toFixed(0).padStart(7)}% |`,
    );
  }

  console.log();

  // ============================================
  // 結論
  // ============================================

  console.log("=".repeat(80));
  console.log("## 結論");
  console.log("=".repeat(80));
  console.log();

  // ATRフィルタの精度
  const atrCorrect = s2Excluded.filter((r) => r.noFilterReturn < 0).length;
  const atrWrong = s2Excluded.filter((r) => r.noFilterReturn > 0).length;

  console.log(`ATRフィルタ (>=2.3%):`);
  console.log(`  - 除外銘柄: ${s2Excluded.length}銘柄`);
  console.log(`  - 正解（損失回避）: ${atrCorrect}銘柄`);
  console.log(`  - 誤り（利益逃す）: ${atrWrong}銘柄`);
  console.log(`  - 精度: ${((atrCorrect / s2Excluded.length) * 100).toFixed(0)}%`);
  console.log();

  // 動的停止の精度
  const stopBenefit = s3Stopped.filter(
    (r) => r.dynamicStopReturn !== null && r.dynamicStopReturn > r.noFilterReturn,
  ).length;
  const stopHarm = s3Stopped.filter(
    (r) => r.dynamicStopReturn !== null && r.dynamicStopReturn < r.noFilterReturn,
  ).length;

  console.log(`動的停止ルール (WR<25%@20T):`);
  console.log(`  - 発動銘柄: ${s3Stopped.length}銘柄`);
  console.log(`  - 効果あり（損失軽減）: ${stopBenefit}銘柄`);
  console.log(`  - 逆効果（利益逃す）: ${stopHarm}銘柄`);
  if (s3Stopped.length > 0) {
    console.log(`  - 有効率: ${((stopBenefit / s3Stopped.length) * 100).toFixed(0)}%`);
  }
  console.log();

  // 推奨
  console.log("推奨フィルタ:");
  if (s2AvgReturn > s1AvgReturn && atrCorrect > atrWrong) {
    console.log("  -> ATRフィルタ (>=2.3%) を採用");
  }
  if (stopBenefit > stopHarm) {
    console.log("  -> 動的停止ルール (WR<25%@20T) を採用");
  }
  if (s4AvgReturn > s2AvgReturn) {
    console.log("  -> 両方の組み合わせが最も効果的");
  }
}

main().catch(console.error);
