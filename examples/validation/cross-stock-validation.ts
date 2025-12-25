/**
 * 複数銘柄横断検証スクリプト
 *
 * ソニー(6758.T)の組み合わせ検索で発見された最適戦略を
 * 他の銘柄でも検証し、戦略の汎用性を評価します。
 *
 * 使い方:
 *   npx tsx examples/cross-stock-validation.ts
 *   npx tsx examples/cross-stock-validation.ts --strategy best   # ソニー#4/#5戦略
 *   npx tsx examples/cross-stock-validation.ts --strategy top1   # ソニー#1戦略
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeCandles,
  runBacktest,
  and,
  calculateAllMetrics,
  // Conditions
  goldenCrossCondition as goldenCross,
  deadCrossCondition as deadCross,
  validatedGoldenCross,
  perfectOrderBreakdown,
  perfectOrderCollapsed,
  volumeAnomalyCondition,
  volumeConfirmsTrend,
  volumeRatioAbove,
  volumeDivergence,
  macdCrossDown,
  stochCrossUp,
  stochAbove,
  priceAboveSma,
  rangeBreakout,
  // Types
  type NormalizedCandle,
  type BacktestResult,
  type Condition,
} from "../../src";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// Strategy Definitions
// ============================================

type StrategyDef = {
  name: string;
  description: string;
  entry: () => Condition;
  exit: () => Condition;
};

/**
 * ソニー検索結果から抽出した戦略
 */
const STRATEGIES: Record<string, StrategyDef> = {
  // #4/#5: 最高効率 (DD 22.2%, PF 3.46)
  best: {
    name: "GC + VolAnomaly → MACD↓ + VolDiv",
    description: "最高効率戦略 (DD最小, PF最大)",
    entry: () => and(goldenCross(5, 25), volumeAnomalyCondition(2.0, 20)),
    exit: () => and(macdCrossDown(), volumeDivergence()),
  },

  // #1: 最高リターン (Sharpe 0.46, Return +2218%)
  top1: {
    name: "Stoch↑ + Vol>1.5x → MACD↓ + VolDiv",
    description: "最高リターン戦略 (高リスク・高リターン)",
    entry: () => and(stochCrossUp(), volumeRatioAbove(1.5, 20)),
    exit: () => and(macdCrossDown(), volumeDivergence()),
  },

  // #2: 安定型 (DD 32.6%, PF 2.07)
  stable: {
    name: "ValidatedGC + VolTrend → MACD↓ + VolDiv",
    description: "安定型戦略 (中DD, 高PF)",
    entry: () => and(validatedGoldenCross({ minScore: 50 }), volumeConfirmsTrend()),
    exit: () => and(macdCrossDown(), volumeDivergence()),
  },

  // #3: レンジブレイク型
  breakout: {
    name: ">SMA75 + RangeBreak → MACD↓ + VolDiv",
    description: "レンジブレイク戦略",
    entry: () => and(priceAboveSma(75), rangeBreakout()),
    exit: () => and(macdCrossDown(), volumeDivergence()),
  },

  // #11: 高勝率型 (51%)
  highWr: {
    name: "Stoch↑ + Vol>1.5x → Stoch>80 + VolDiv",
    description: "高勝率戦略 (51%)",
    entry: () => and(stochCrossUp(), volumeRatioAbove(1.5, 20)),
    exit: () => and(stochAbove(80), volumeDivergence()),
  },

  // PO崩壊 Exit variant
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
  strategy: string;
  tickers: string[];
  outputMarkdown: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    strategy: "best",
    tickers: [] as string[],
    outputMarkdown: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--strategy":
      case "-s":
        result.strategy = args[++i];
        break;
      case "--ticker":
      case "-t":
        result.tickers.push(args[++i]);
        break;
      case "--markdown":
      case "-md":
        result.outputMarkdown = true;
        break;
      case "--help":
      case "-h":
        console.log(`
複数銘柄横断検証スクリプト

オプション:
  --strategy, -s <name>   検証する戦略 (${Object.keys(STRATEGIES).join(", ")})
  --ticker, -t <code>     銘柄コード (複数指定可能)
  --markdown, -md         Markdown形式で出力
  --help, -h              ヘルプ表示

戦略一覧:
${Object.entries(STRATEGIES)
  .map(([key, s]) => `  ${key.padEnd(12)} ${s.description}`)
  .join("\n")}

例:
  npx tsx examples/cross-stock-validation.ts
  npx tsx examples/cross-stock-validation.ts --strategy top1
  npx tsx examples/cross-stock-validation.ts -s best -t 7203.T -t 6758.T
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
  "6861.T": "キーエンス",
  "6920.T": "レーザーテック",
  "7203.T": "トヨタ",
  "7974.T": "任天堂",
  "8306.T": "三菱UFJ",
  "9432.T": "NTT",
  "9984.T": "SBG",
};

function getTickerName(ticker: string): string {
  return TICKER_NAMES[ticker] || ticker;
}

// ============================================
// Validation
// ============================================

type ValidationResult = {
  ticker: string;
  tickerName: string;
  dataCount: number;
  dataRange: string;
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

function validateStrategy(
  ticker: string,
  candles: NormalizedCandle[],
  strategy: StrategyDef,
): ValidationResult {
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
    ticker,
    tickerName: getTickerName(ticker),
    dataCount: candles.length,
    dataRange: `${startDate} - ${endDate}`,
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
  strategyKey: string,
  strategy: StrategyDef,
  results: ValidationResult[],
): void {
  console.log("=".repeat(70));
  console.log("複数銘柄横断検証 (Cross-Stock Validation)");
  console.log("=".repeat(70));
  console.log();
  console.log(`戦略: ${strategy.name}`);
  console.log(`説明: ${strategy.description}`);
  console.log();

  // Summary table
  console.log("-".repeat(70));
  console.log(
    "銘柄".padEnd(12) +
      "Sharpe".padStart(8) +
      "Return".padStart(10) +
      "勝率".padStart(8) +
      "取引数".padStart(8) +
      "MaxDD".padStart(10) +
      "PF".padStart(8),
  );
  console.log("-".repeat(70));

  let totalTrades = 0;
  let positiveSharpe = 0;
  let positiveReturn = 0;

  for (const r of results) {
    const { metrics } = r;
    console.log(
      `${r.ticker} (${r.tickerName})`.slice(0, 20).padEnd(20) +
        metrics.sharpe.toFixed(2).padStart(8) +
        `${metrics.returns.toFixed(0)}%`.padStart(10) +
        `${metrics.winRate.toFixed(0)}%`.padStart(8) +
        String(metrics.tradeCount).padStart(8) +
        `${metrics.maxDrawdown.toFixed(1)}%`.padStart(10) +
        metrics.profitFactor.toFixed(2).padStart(8),
    );

    totalTrades += metrics.tradeCount;
    if (metrics.sharpe > 0) positiveSharpe++;
    if (metrics.returns > 0) positiveReturn++;
  }

  console.log("-".repeat(70));
  console.log();

  // Aggregate stats
  const avgSharpe = results.reduce((sum, r) => sum + r.metrics.sharpe, 0) / results.length;
  const avgReturn = results.reduce((sum, r) => sum + r.metrics.returns, 0) / results.length;
  const avgWinRate = results.reduce((sum, r) => sum + r.metrics.winRate, 0) / results.length;
  const avgPF = results.reduce((sum, r) => sum + r.metrics.profitFactor, 0) / results.length;
  const avgDD = results.reduce((sum, r) => sum + r.metrics.maxDrawdown, 0) / results.length;

  console.log("集計結果:");
  console.log(`  銘柄数: ${results.length}`);
  console.log(`  合計取引数: ${totalTrades}`);
  console.log(`  Sharpe > 0: ${positiveSharpe}/${results.length} (${((positiveSharpe / results.length) * 100).toFixed(0)}%)`);
  console.log(`  Return > 0: ${positiveReturn}/${results.length} (${((positiveReturn / results.length) * 100).toFixed(0)}%)`);
  console.log();
  console.log("平均メトリクス:");
  console.log(`  Sharpe: ${avgSharpe.toFixed(2)}`);
  console.log(`  Return: ${avgReturn.toFixed(1)}%`);
  console.log(`  勝率: ${avgWinRate.toFixed(1)}%`);
  console.log(`  MaxDD: ${avgDD.toFixed(1)}%`);
  console.log(`  PF: ${avgPF.toFixed(2)}`);
  console.log();

  // Robustness assessment
  const robustness = positiveSharpe / results.length;
  let verdict = "";
  if (robustness >= 0.8) {
    verdict = "★★★ 高い汎用性 - 多くの銘柄で有効";
  } else if (robustness >= 0.6) {
    verdict = "★★ 中程度の汎用性 - 一部の銘柄で有効";
  } else if (robustness >= 0.4) {
    verdict = "★ 限定的な汎用性 - 銘柄選定が重要";
  } else {
    verdict = "✗ 低い汎用性 - 過学習の可能性";
  }

  console.log(`汎用性評価: ${verdict}`);
  console.log();
}

function generateMarkdownReport(
  strategyKey: string,
  strategy: StrategyDef,
  results: ValidationResult[],
): string {
  const now = new Date().toISOString().split("T")[0];

  let md = `# 複数銘柄横断検証レポート

**実行日**: ${now}
**戦略**: ${strategy.name}
**説明**: ${strategy.description}

## 検証結果サマリー

| 銘柄 | Sharpe | Return | 勝率 | 取引数 | MaxDD | PF |
|------|--------|--------|------|--------|-------|-----|
`;

  for (const r of results) {
    const { metrics } = r;
    md += `| ${r.ticker} (${r.tickerName}) | ${metrics.sharpe.toFixed(2)} | ${metrics.returns.toFixed(0)}% | ${metrics.winRate.toFixed(0)}% | ${metrics.tradeCount} | ${metrics.maxDrawdown.toFixed(1)}% | ${metrics.profitFactor.toFixed(2)} |\n`;
  }

  // Aggregate stats
  const avgSharpe = results.reduce((sum, r) => sum + r.metrics.sharpe, 0) / results.length;
  const avgReturn = results.reduce((sum, r) => sum + r.metrics.returns, 0) / results.length;
  const avgWinRate = results.reduce((sum, r) => sum + r.metrics.winRate, 0) / results.length;
  const avgPF = results.reduce((sum, r) => sum + r.metrics.profitFactor, 0) / results.length;
  const avgDD = results.reduce((sum, r) => sum + r.metrics.maxDrawdown, 0) / results.length;

  let positiveSharpe = 0;
  let positiveReturn = 0;
  for (const r of results) {
    if (r.metrics.sharpe > 0) positiveSharpe++;
    if (r.metrics.returns > 0) positiveReturn++;
  }

  md += `
## 集計結果

| 項目 | 値 |
|------|-----|
| 銘柄数 | ${results.length} |
| Sharpe > 0 | ${positiveSharpe}/${results.length} (${((positiveSharpe / results.length) * 100).toFixed(0)}%) |
| Return > 0 | ${positiveReturn}/${results.length} (${((positiveReturn / results.length) * 100).toFixed(0)}%) |

## 平均メトリクス

| メトリクス | 平均値 |
|------------|--------|
| Sharpe | ${avgSharpe.toFixed(2)} |
| Return | ${avgReturn.toFixed(1)}% |
| 勝率 | ${avgWinRate.toFixed(1)}% |
| MaxDD | ${avgDD.toFixed(1)}% |
| PF | ${avgPF.toFixed(2)} |

## 汎用性評価

`;

  const robustness = positiveSharpe / results.length;
  if (robustness >= 0.8) {
    md += "**★★★ 高い汎用性** - 多くの銘柄で有効な戦略です。\n";
  } else if (robustness >= 0.6) {
    md += "**★★ 中程度の汎用性** - 一部の銘柄で有効です。銘柄の特性を考慮した運用が推奨されます。\n";
  } else if (robustness >= 0.4) {
    md += "**★ 限定的な汎用性** - 銘柄選定が重要です。特定のセクターや特性を持つ銘柄に限定することを推奨します。\n";
  } else {
    md += "**✗ 低い汎用性** - 過学習の可能性があります。戦略の見直しまたはWalk-Forward分析による検証を推奨します。\n";
  }

  md += `
## 銘柄別詳細

`;

  for (const r of results) {
    md += `### ${r.ticker} (${r.tickerName})

- データ期間: ${r.dataRange}
- データ件数: ${r.dataCount.toLocaleString()}件
- Sharpe: ${r.metrics.sharpe.toFixed(3)}
- Return: ${r.metrics.returns.toFixed(1)}%
- 勝率: ${r.metrics.winRate.toFixed(1)}%
- 取引数: ${r.metrics.tradeCount}
- MaxDD: ${r.metrics.maxDrawdown.toFixed(1)}%
- PF: ${r.metrics.profitFactor.toFixed(2)}
- MAR: ${r.metrics.mar.toFixed(3)}
- Calmar: ${r.metrics.calmar.toFixed(3)}

`;
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

  // Get tickers
  const tickers = args.tickers.length > 0 ? args.tickers : getAvailableTickers();

  if (tickers.length === 0) {
    console.error("No data files found in examples/data/");
    process.exit(1);
  }

  console.log(`検証銘柄: ${tickers.length}件`);
  console.log();

  // Run validation
  const results: ValidationResult[] = [];

  for (const ticker of tickers) {
    try {
      process.stdout.write(`  ${ticker.padEnd(12)} ... `);
      const candles = loadCsv(`${ticker}.csv`);
      const result = validateStrategy(ticker, candles, strategy);
      results.push(result);
      console.log(`OK (${result.metrics.tradeCount}取引, Sharpe ${result.metrics.sharpe.toFixed(2)})`);
    } catch (error) {
      console.log(`ERROR: ${error}`);
    }
  }

  console.log();

  // Output results
  formatConsoleOutput(args.strategy, strategy, results);

  // Generate markdown report if requested
  if (args.outputMarkdown) {
    const md = generateMarkdownReport(args.strategy, strategy, results);
    const filename = `cross-stock-validation-${args.strategy}-${new Date().toISOString().split("T")[0]}.md`;
    const filepath = join(__dirname, "..", "..", "docs", "analysis", filename);
    writeFileSync(filepath, md);
    console.log(`Markdown report saved to: ${filepath}`);
  }
}

main().catch(console.error);
