/**
 * Walk-Forward 検証スクリプト
 *
 * ソニー(6758.T)で発見した戦略の過学習リスクを評価します。
 * 時系列を複数区間に分割し、各区間での成績を検証します。
 *
 * 使い方:
 *   npx tsx examples/walk-forward-validation.ts
 *   npx tsx examples/walk-forward-validation.ts --ticker 6758.T
 *   npx tsx examples/walk-forward-validation.ts --strategy best --periods 5
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type BacktestResult,
  type Condition,
  // Types
  type NormalizedCandle,
  and,
  calculateAllMetrics,
  // Conditions
  goldenCrossCondition as goldenCross,
  macdCrossDown,
  normalizeCandles,
  perfectOrderCollapsed,
  priceAboveSma,
  rangeBreakout,
  runBacktest,
  stochAbove,
  stochCrossUp,
  validatedGoldenCross,
  volumeAnomalyCondition,
  volumeConfirmsTrend,
  volumeDivergence,
  volumeRatioAbove,
} from "../../src";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// Strategy Definitions (same as cross-stock)
// ============================================

type StrategyDef = {
  name: string;
  description: string;
  entry: () => Condition;
  exit: () => Condition;
};

const STRATEGIES: Record<string, StrategyDef> = {
  best: {
    name: "GC + VolAnomaly → MACD↓ + VolDiv",
    description: "最高効率戦略 (DD最小, PF最大)",
    entry: () => and(goldenCross(5, 25), volumeAnomalyCondition(2.0, 20)),
    exit: () => and(macdCrossDown(), volumeDivergence()),
  },
  top1: {
    name: "Stoch↑ + Vol>1.5x → MACD↓ + VolDiv",
    description: "最高リターン戦略 (高リスク・高リターン)",
    entry: () => and(stochCrossUp(), volumeRatioAbove(1.5, 20)),
    exit: () => and(macdCrossDown(), volumeDivergence()),
  },
  stable: {
    name: "ValidatedGC + VolTrend → MACD↓ + VolDiv",
    description: "安定型戦略 (中DD, 高PF)",
    entry: () => and(validatedGoldenCross({ minScore: 50 }), volumeConfirmsTrend()),
    exit: () => and(macdCrossDown(), volumeDivergence()),
  },
  breakout: {
    name: ">SMA75 + RangeBreak → MACD↓ + VolDiv",
    description: "レンジブレイク戦略",
    entry: () => and(priceAboveSma(75), rangeBreakout()),
    exit: () => and(macdCrossDown(), volumeDivergence()),
  },
  highWr: {
    name: "Stoch↑ + Vol>1.5x → Stoch>80 + VolDiv",
    description: "高勝率戦略 (51%)",
    entry: () => and(stochCrossUp(), volumeRatioAbove(1.5, 20)),
    exit: () => and(stochAbove(80), volumeDivergence()),
  },
  poCollapse: {
    name: "ValidatedGC + VolTrend → PO崩壊 + Stoch>80",
    description: "PO崩壊Exit戦略",
    entry: () => and(validatedGoldenCross({ minScore: 50 }), volumeConfirmsTrend()),
    exit: () => and(perfectOrderCollapsed({ periods: [5, 25, 75] }), stochAbove(80)),
  },
};

// ============================================
// CLI Arguments
// ============================================

function parseArgs(): {
  ticker: string;
  strategy: string;
  periods: number;
  outputMarkdown: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    ticker: "6758.T",
    strategy: "best",
    periods: 5,
    outputMarkdown: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--ticker":
      case "-t":
        result.ticker = args[++i];
        break;
      case "--strategy":
      case "-s":
        result.strategy = args[++i];
        break;
      case "--periods":
      case "-p":
        result.periods = Number.parseInt(args[++i], 10);
        break;
      case "--markdown":
      case "-md":
        result.outputMarkdown = true;
        break;
      case "--help":
      case "-h":
        console.log(`
Walk-Forward検証スクリプト

オプション:
  --ticker, -t <code>     銘柄コード (default: 6758.T)
  --strategy, -s <name>   検証する戦略 (${Object.keys(STRATEGIES).join(", ")})
  --periods, -p <n>       分割数 (default: 5)
  --markdown, -md         Markdown形式で出力
  --help, -h              ヘルプ表示

戦略一覧:
${Object.entries(STRATEGIES)
  .map(([key, s]) => `  ${key.padEnd(12)} ${s.description}`)
  .join("\n")}

例:
  npx tsx examples/walk-forward-validation.ts
  npx tsx examples/walk-forward-validation.ts --ticker 7203.T --periods 10
  npx tsx examples/walk-forward-validation.ts -s top1 -p 8
`);
        process.exit(0);
    }
  }

  return result;
}

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
      open: Number.parseFloat(open),
      high: Number.parseFloat(high),
      low: Number.parseFloat(low),
      close: Number.parseFloat(close),
      volume: Number.parseFloat(volume),
    };
  });

  rawCandles.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return normalizeCandles(rawCandles);
}

const TICKER_NAMES: Record<string, string> = {
  "6758.T": "ソニーG",
  "7203.T": "トヨタ",
  "7974.T": "任天堂",
  "4063.T": "信越化学",
  "6861.T": "キーエンス",
  "9984.T": "SBG",
};

function getTickerName(ticker: string): string {
  return TICKER_NAMES[ticker] || ticker;
}

// ============================================
// Walk-Forward Analysis
// ============================================

type PeriodResult = {
  periodNum: number;
  startDate: string;
  endDate: string;
  dataCount: number;
  backtest: BacktestResult;
  metrics: {
    sharpe: number;
    calmar: number;
    mar: number;
    profitFactor: number;
    returns: number;
    winRate: number;
    tradeCount: number;
    maxDrawdown: number;
  };
};

function splitIntoPeriods(candles: NormalizedCandle[], numPeriods: number): NormalizedCandle[][] {
  const periodSize = Math.floor(candles.length / numPeriods);
  const periods: NormalizedCandle[][] = [];

  for (let i = 0; i < numPeriods; i++) {
    const start = i * periodSize;
    const end = i === numPeriods - 1 ? candles.length : (i + 1) * periodSize;
    periods.push(candles.slice(start, end));
  }

  return periods;
}

function runPeriodBacktest(
  periodNum: number,
  candles: NormalizedCandle[],
  strategy: StrategyDef,
): PeriodResult {
  const entry = strategy.entry();
  const exit = strategy.exit();

  const result = runBacktest(candles, entry, exit, {
    capital: 1000000,
    stopLoss: 5,
    commissionRate: 0.1,
    taxRate: 20.315,
  });

  const metrics = calculateAllMetrics(result, candles, { initialCapital: 1000000 });

  const startDate = new Date(candles[0].time).toISOString().split("T")[0];
  const endDate = new Date(candles[candles.length - 1].time).toISOString().split("T")[0];

  return {
    periodNum,
    startDate,
    endDate,
    dataCount: candles.length,
    backtest: result,
    metrics: {
      sharpe: metrics.sharpe,
      calmar: metrics.calmar,
      mar: metrics.mar,
      profitFactor: metrics.profitFactor,
      returns: metrics.returns,
      winRate: metrics.winRate,
      tradeCount: metrics.tradeCount,
      maxDrawdown: metrics.maxDrawdown,
    },
  };
}

// ============================================
// Output Formatting
// ============================================

function formatConsoleOutput(
  ticker: string,
  strategy: StrategyDef,
  results: PeriodResult[],
  fullPeriodResult: PeriodResult,
): void {
  console.log("=".repeat(80));
  console.log("Walk-Forward 検証");
  console.log("=".repeat(80));
  console.log();
  console.log(`銘柄: ${ticker} (${getTickerName(ticker)})`);
  console.log(`戦略: ${strategy.name}`);
  console.log(`説明: ${strategy.description}`);
  console.log(`期間分割: ${results.length}期間`);
  console.log();

  // Period results table
  console.log("-".repeat(80));
  console.log(
    "期間".padEnd(6) +
      "期間".padEnd(26) +
      "Sharpe".padStart(8) +
      "Return".padStart(10) +
      "勝率".padStart(8) +
      "取引".padStart(6) +
      "MaxDD".padStart(10) +
      "PF".padStart(8),
  );
  console.log("-".repeat(80));

  let positiveSharpe = 0;
  let positiveReturn = 0;

  for (const r of results) {
    const { metrics } = r;
    const periodLabel = `${r.startDate} - ${r.endDate}`;

    console.log(
      `#${r.periodNum}`.padEnd(6) +
        periodLabel.padEnd(26) +
        metrics.sharpe.toFixed(2).padStart(8) +
        `${metrics.returns.toFixed(0)}%`.padStart(10) +
        `${metrics.winRate.toFixed(0)}%`.padStart(8) +
        String(metrics.tradeCount).padStart(6) +
        `${metrics.maxDrawdown.toFixed(1)}%`.padStart(10) +
        metrics.profitFactor.toFixed(2).padStart(8),
    );

    if (metrics.sharpe > 0) positiveSharpe++;
    if (metrics.returns > 0) positiveReturn++;
  }

  console.log("-".repeat(80));

  // Full period comparison
  console.log();
  console.log("全期間結果 (比較用):");
  console.log(
    `  期間: ${fullPeriodResult.startDate} - ${fullPeriodResult.endDate} (${fullPeriodResult.dataCount.toLocaleString()}件)`,
  );
  console.log(`  Sharpe: ${fullPeriodResult.metrics.sharpe.toFixed(2)}`);
  console.log(`  Return: ${fullPeriodResult.metrics.returns.toFixed(1)}%`);
  console.log(`  勝率: ${fullPeriodResult.metrics.winRate.toFixed(1)}%`);
  console.log(`  取引数: ${fullPeriodResult.metrics.tradeCount}`);
  console.log(`  MaxDD: ${fullPeriodResult.metrics.maxDrawdown.toFixed(1)}%`);
  console.log(`  PF: ${fullPeriodResult.metrics.profitFactor.toFixed(2)}`);
  console.log();

  // Aggregate stats
  const avgSharpe = results.reduce((sum, r) => sum + r.metrics.sharpe, 0) / results.length;
  const avgReturn = results.reduce((sum, r) => sum + r.metrics.returns, 0) / results.length;
  const avgWinRate = results.reduce((sum, r) => sum + r.metrics.winRate, 0) / results.length;
  const avgPF = results.reduce((sum, r) => sum + r.metrics.profitFactor, 0) / results.length;
  const avgDD = results.reduce((sum, r) => sum + r.metrics.maxDrawdown, 0) / results.length;

  console.log("期間別集計:");
  console.log(
    `  Sharpe > 0: ${positiveSharpe}/${results.length} (${((positiveSharpe / results.length) * 100).toFixed(0)}%)`,
  );
  console.log(
    `  Return > 0: ${positiveReturn}/${results.length} (${((positiveReturn / results.length) * 100).toFixed(0)}%)`,
  );
  console.log();
  console.log("期間平均メトリクス:");
  console.log(`  Sharpe: ${avgSharpe.toFixed(2)}`);
  console.log(`  Return: ${avgReturn.toFixed(1)}%`);
  console.log(`  勝率: ${avgWinRate.toFixed(1)}%`);
  console.log(`  MaxDD: ${avgDD.toFixed(1)}%`);
  console.log(`  PF: ${avgPF.toFixed(2)}`);
  console.log();

  // Stability assessment
  const stabilityRatio =
    fullPeriodResult.metrics.sharpe > 0 ? avgSharpe / fullPeriodResult.metrics.sharpe : 0;

  const consistency = positiveSharpe / results.length;

  console.log("過学習リスク評価:");
  console.log(
    `  安定性比率: ${(stabilityRatio * 100).toFixed(1)}% (期間平均Sharpe / 全期間Sharpe)`,
  );
  console.log(`  一貫性: ${(consistency * 100).toFixed(0)}% (Sharpe > 0 の期間比率)`);
  console.log();

  let verdict = "";
  if (consistency >= 0.8 && stabilityRatio >= 0.6) {
    verdict = "★★★ 低リスク - 安定した成績が期待できます";
  } else if (consistency >= 0.6 && stabilityRatio >= 0.4) {
    verdict = "★★ 中程度のリスク - 一部の期間で不調の可能性";
  } else if (consistency >= 0.4) {
    verdict = "★ 高リスク - 過学習の可能性があります";
  } else {
    verdict = "✗ 非常に高リスク - 戦略の見直しを推奨";
  }

  console.log(`評価: ${verdict}`);
  console.log();

  // Detailed period analysis
  console.log("期間別詳細分析:");
  const sortedByReturn = [...results].sort((a, b) => b.metrics.returns - a.metrics.returns);
  const best = sortedByReturn[0];
  const worst = sortedByReturn[sortedByReturn.length - 1];

  console.log(
    `  最高期間: #${best.periodNum} (${best.startDate}~) Return: ${best.metrics.returns.toFixed(0)}%`,
  );
  console.log(
    `  最低期間: #${worst.periodNum} (${worst.startDate}~) Return: ${worst.metrics.returns.toFixed(0)}%`,
  );

  // Check for trend (is recent performance better or worse?)
  const firstHalf = results.slice(0, Math.floor(results.length / 2));
  const secondHalf = results.slice(Math.floor(results.length / 2));
  const firstHalfAvg = firstHalf.reduce((s, r) => s + r.metrics.returns, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((s, r) => s + r.metrics.returns, 0) / secondHalf.length;

  if (secondHalfAvg > firstHalfAvg * 1.2) {
    console.log(
      `  トレンド: 📈 直近の成績が改善傾向 (前半平均: ${firstHalfAvg.toFixed(0)}%, 後半平均: ${secondHalfAvg.toFixed(0)}%)`,
    );
  } else if (firstHalfAvg > secondHalfAvg * 1.2) {
    console.log(
      `  トレンド: 📉 直近の成績が悪化傾向 (前半平均: ${firstHalfAvg.toFixed(0)}%, 後半平均: ${secondHalfAvg.toFixed(0)}%)`,
    );
  } else {
    console.log(
      `  トレンド: ➡️ 安定 (前半平均: ${firstHalfAvg.toFixed(0)}%, 後半平均: ${secondHalfAvg.toFixed(0)}%)`,
    );
  }
  console.log();
}

function generateMarkdownReport(
  ticker: string,
  strategy: StrategyDef,
  results: PeriodResult[],
  fullPeriodResult: PeriodResult,
): string {
  const now = new Date().toISOString().split("T")[0];

  let md = `# Walk-Forward検証レポート

**実行日**: ${now}
**銘柄**: ${ticker} (${getTickerName(ticker)})
**戦略**: ${strategy.name}
**説明**: ${strategy.description}
**期間分割**: ${results.length}期間

## 期間別結果

| 期間 | 開始日 | 終了日 | Sharpe | Return | 勝率 | 取引数 | MaxDD | PF |
|------|--------|--------|--------|--------|------|--------|-------|-----|
`;

  for (const r of results) {
    const { metrics } = r;
    md += `| #${r.periodNum} | ${r.startDate} | ${r.endDate} | ${metrics.sharpe.toFixed(2)} | ${metrics.returns.toFixed(0)}% | ${metrics.winRate.toFixed(0)}% | ${metrics.tradeCount} | ${metrics.maxDrawdown.toFixed(1)}% | ${metrics.profitFactor.toFixed(2)} |\n`;
  }

  // Full period
  md += `
## 全期間結果 (比較用)

| 項目 | 値 |
|------|-----|
| 期間 | ${fullPeriodResult.startDate} - ${fullPeriodResult.endDate} |
| データ件数 | ${fullPeriodResult.dataCount.toLocaleString()} |
| Sharpe | ${fullPeriodResult.metrics.sharpe.toFixed(2)} |
| Return | ${fullPeriodResult.metrics.returns.toFixed(1)}% |
| 勝率 | ${fullPeriodResult.metrics.winRate.toFixed(1)}% |
| 取引数 | ${fullPeriodResult.metrics.tradeCount} |
| MaxDD | ${fullPeriodResult.metrics.maxDrawdown.toFixed(1)}% |
| PF | ${fullPeriodResult.metrics.profitFactor.toFixed(2)} |

`;

  // Aggregate stats
  const avgSharpe = results.reduce((sum, r) => sum + r.metrics.sharpe, 0) / results.length;
  const avgReturn = results.reduce((sum, r) => sum + r.metrics.returns, 0) / results.length;
  let positiveSharpe = 0;
  let positiveReturn = 0;

  for (const r of results) {
    if (r.metrics.sharpe > 0) positiveSharpe++;
    if (r.metrics.returns > 0) positiveReturn++;
  }

  const stabilityRatio =
    fullPeriodResult.metrics.sharpe > 0 ? avgSharpe / fullPeriodResult.metrics.sharpe : 0;
  const consistency = positiveSharpe / results.length;

  md += `## 過学習リスク評価

| 指標 | 値 | 説明 |
|------|-----|------|
| Sharpe > 0 | ${positiveSharpe}/${results.length} (${((positiveSharpe / results.length) * 100).toFixed(0)}%) | プラスSharpeの期間比率 |
| Return > 0 | ${positiveReturn}/${results.length} (${((positiveReturn / results.length) * 100).toFixed(0)}%) | プラスリターンの期間比率 |
| 安定性比率 | ${(stabilityRatio * 100).toFixed(1)}% | 期間平均Sharpe / 全期間Sharpe |
| 一貫性 | ${(consistency * 100).toFixed(0)}% | Sharpe > 0 の期間比率 |

### 評価

`;

  if (consistency >= 0.8 && stabilityRatio >= 0.6) {
    md += "**★★★ 低リスク** - 安定した成績が期待できます。過学習の兆候は見られません。\n";
  } else if (consistency >= 0.6 && stabilityRatio >= 0.4) {
    md += "**★★ 中程度のリスク** - 一部の期間で不調の可能性があります。慎重な運用を推奨します。\n";
  } else if (consistency >= 0.4) {
    md += "**★ 高リスク** - 過学習の可能性があります。他の銘柄での検証も推奨します。\n";
  } else {
    md += "**✗ 非常に高リスク** - 戦略の見直しを強く推奨します。\n";
  }

  return md;
}

// ============================================
// Main
// ============================================

async function main() {
  const args = parseArgs();

  // Validate strategy
  if (!STRATEGIES[args.strategy]) {
    console.error(`Unknown strategy: ${args.strategy}`);
    console.error(`Available strategies: ${Object.keys(STRATEGIES).join(", ")}`);
    process.exit(1);
  }

  const strategy = STRATEGIES[args.strategy];

  console.log(`データ読み込み中: ${args.ticker}...`);
  const candles = loadCsv(`${args.ticker}.csv`);
  console.log(`データ件数: ${candles.length.toLocaleString()}`);
  console.log();

  // Split into periods
  const periods = splitIntoPeriods(candles, args.periods);

  // Run backtest on each period
  const results: PeriodResult[] = [];
  for (let i = 0; i < periods.length; i++) {
    process.stdout.write(`  期間 #${i + 1}/${periods.length} ... `);
    const result = runPeriodBacktest(i + 1, periods[i], strategy);
    results.push(result);
    console.log(
      `OK (${result.metrics.tradeCount}取引, Sharpe ${result.metrics.sharpe.toFixed(2)})`,
    );
  }

  // Run full period backtest
  console.log();
  process.stdout.write("  全期間 ... ");
  const fullPeriodResult = runPeriodBacktest(0, candles, strategy);
  console.log(
    `OK (${fullPeriodResult.metrics.tradeCount}取引, Sharpe ${fullPeriodResult.metrics.sharpe.toFixed(2)})`,
  );

  console.log();

  // Output results
  formatConsoleOutput(args.ticker, strategy, results, fullPeriodResult);

  // Generate markdown report if requested
  if (args.outputMarkdown) {
    const md = generateMarkdownReport(args.ticker, strategy, results, fullPeriodResult);
    const filename = `walk-forward-${args.ticker.replace(".", "-")}-${args.strategy}-${new Date().toISOString().split("T")[0]}.md`;
    const filepath = join(__dirname, "..", "..", "docs", "analysis", filename);
    writeFileSync(filepath, md);
    console.log(`Markdown report saved to: ${filepath}`);
  }
}

main().catch(console.error);
