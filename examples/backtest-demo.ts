/**
 * Backtest Demo
 *
 * Run:
 *   npx tsx examples/backtest-demo.ts path/to/data.csv
 *
 * CSV format: date,open,high,low,close,volume (date: YYYY/MM/DD)
 */

import { readFileSync, existsSync } from "fs";
import { resolve, basename } from "path";
import {
  TrendCraft,
  goldenCrossCondition,
  deadCrossCondition,
  and,
  or,
  rsiBelow,
  rsiAbove,
  macdCrossUp,
  macdCrossDown,
  bollingerBreakout,
  validatedGoldenCross,
  validatedDeadCross,
  rsiDivergence,
  rsi,
  stochastics,
  dmi,
  donchianChannel,
  mfi,
  atr,
  sma,
  bollingerBands,
} from "../src/index.js";
import type { Candle, BacktestResult } from "../src/index.js";

// Load CSV data
function loadCSV(filePath: string): Candle[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").slice(1); // Skip header

  const candles: Candle[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split(",");
    if (parts.length < 6) continue;

    const [dateStr, open, high, low, close, volume] = parts;

    // Parse date (YYYY/MM/DD format)
    const [year, month, day] = dateStr.split("/").map(Number);
    const time = new Date(year, month - 1, day).getTime();

    candles.push({
      time,
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: parseFloat(volume),
    });
  }

  // Sort by time (oldest first)
  return candles.sort((a, b) => (a.time as number) - (b.time as number));
}

// Format result for display
function formatResult(name: string, result: BacktestResult): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 ${name}`);
  console.log("=".repeat(60));
  console.log(`総リターン: ${result.totalReturnPercent.toFixed(2)}%`);
  console.log(`取引回数: ${result.tradeCount}`);
  console.log(`勝率: ${result.winRate.toFixed(1)}%`);
  console.log(`最大ドローダウン: ${result.maxDrawdown.toFixed(2)}%`);
  console.log(`シャープレシオ: ${result.sharpeRatio.toFixed(2)}`);
  console.log(`プロフィットファクター: ${result.profitFactor.toFixed(2)}`);
  console.log(`平均保有日数: ${result.avgHoldingDays.toFixed(1)}日`);

  if (result.trades.length > 0) {
    console.log(`\n最近の取引:`);
    const recentTrades = result.trades.slice(-3);
    for (const trade of recentTrades) {
      const entryDate = new Date(trade.entryTime).toLocaleDateString("ja-JP");
      const exitDate = new Date(trade.exitTime).toLocaleDateString("ja-JP");
      const returnStr = trade.returnPercent >= 0 ? `+${trade.returnPercent.toFixed(2)}%` : `${trade.returnPercent.toFixed(2)}%`;
      console.log(`  ${entryDate} → ${exitDate}: ${returnStr}`);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Error: CSV file path is required");
  console.error("\nUsage: npx tsx examples/backtest-demo.ts <csv-file-path>");
  console.error("\nCSV format: date,open,high,low,close,volume");
  console.error("Date format: YYYY/MM/DD");
  process.exit(1);
}

const csvPath = resolve(args[0]);

// Validate file exists
if (!existsSync(csvPath)) {
  console.error(`Error: File not found: ${csvPath}`);
  process.exit(1);
}

// Extract symbol name from filename
const symbolName = basename(csvPath, ".csv");

// Main
const allCandles = loadCSV(csvPath);

// Filter: 2015年以降のみ
const startDate = new Date(2015, 0, 1).getTime();
const candles = allCandles.filter(c => (c.time as number) >= startDate);

console.log(`\n📈 ${symbolName} バックテスト`);
console.log(`データ期間: ${candles.length}日分 (2015年以降)`);
console.log(`開始日: ${new Date(candles[0].time as number).toLocaleDateString("ja-JP")}`);
console.log(`終了日: ${new Date(candles[candles.length - 1].time as number).toLocaleDateString("ja-JP")}`);

const capital = 1000000; // 100万円

// 共通オプション
const stopLoss = 5; // 5%損切り
const commissionRate = 0.1; // 売買手数料 0.1%（往復で0.2%）
const taxRate = 20.315; // 利益に対する税金（日本の分離課税）

// ============================================
// Strategy 1: Golden Cross / Dead Cross (5/25)
// ============================================
const result1 = TrendCraft.from(candles)
  .strategy()
  .entry(goldenCrossCondition(5, 25))
  .exit(deadCrossCondition(5, 25))
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略1: ゴールデンクロス/デッドクロス", result1);

// ============================================
// Strategy 2: RSI Oversold/Overbought
// ============================================
const result2 = TrendCraft.from(candles)
  .strategy()
  .entry(rsiBelow(30))
  .exit(rsiAbove(70))
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略2: RSI閾値 (30以下で買い、70以上で売り)", result2);

// ============================================
// Strategy 3: MACD Cross
// ============================================
const result3 = TrendCraft.from(candles)
  .strategy()
  .entry(macdCrossUp())
  .exit(macdCrossDown())
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略3: MACDクロス", result3);

// ============================================
// Strategy 4: Combined - Golden Cross + RSI Filter
// ============================================
const result4 = TrendCraft.from(candles)
  .strategy()
  .entry(and(goldenCrossCondition(5, 25), rsiBelow(50)))
  .exit(or(deadCrossCondition(5, 25), rsiAbove(70)))
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略4: ゴールデンクロス + RSIフィルター", result4);

// ============================================
// Strategy 5: Bollinger Band Breakout
// ============================================
const result5 = TrendCraft.from(candles)
  .strategy()
  .entry(bollingerBreakout("lower"))
  .exit(bollingerBreakout("upper"))
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略5: ボリンジャーバンド逆張り", result5);

// ============================================
// Strategy 6: Custom - Volume Spike + Price Above SMA
// ============================================
const result6 = TrendCraft.from(candles)
  .strategy()
  .entry((_indicators, candle, i, allCandles) => {
    if (i < 20) return false;

    // Calculate 20-day average volume
    let sumVolume = 0;
    for (let j = i - 20; j < i; j++) {
      sumVolume += allCandles[j].volume;
    }
    const avgVolume = sumVolume / 20;

    // Calculate 20-day SMA
    let sumClose = 0;
    for (let j = i - 20; j < i; j++) {
      sumClose += allCandles[j].close;
    }
    const sma20 = sumClose / 20;

    // Entry: Volume spike (1.5x average) + price above SMA
    return candle.volume > avgVolume * 1.5 && candle.close > sma20;
  })
  .exit((_indicators, candle, i, allCandles) => {
    if (i < 20) return false;

    // Calculate 20-day SMA
    let sumClose = 0;
    for (let j = i - 20; j < i; j++) {
      sumClose += allCandles[j].close;
    }
    const sma20 = sumClose / 20;

    // Exit: Price below SMA
    return candle.close < sma20;
  })
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略6: 出来高急増 + SMA上抜け", result6);

// ============================================
// Strategy 7: Validated GC/DC (Damashi Detection)
// ============================================
const result7 = TrendCraft.from(candles)
  .strategy()
  .entry(validatedGoldenCross({ minScore: 50 }))
  .exit(validatedDeadCross({ minScore: 50 }))
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略7: 騙し検出GC/DC (スコア50以上)", result7);

// ============================================
// Strategy 8: Validated GC (entry) + Simple DC (exit)
// ============================================
const result8 = TrendCraft.from(candles)
  .strategy()
  .entry(validatedGoldenCross({ minScore: 50 }))
  .exit(deadCrossCondition(5, 25))
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略8: 騙し検出GC + 通常DC", result8);

// ============================================
// Strategy 9: RSI Divergence
// ============================================
const rsiDivSignals = rsiDivergence(candles);
const bullishDivTimes = new Set(rsiDivSignals.filter(s => s.type === "bullish").map(s => s.time));
const bearishDivTimes = new Set(rsiDivSignals.filter(s => s.type === "bearish").map(s => s.time));

const result9 = TrendCraft.from(candles)
  .strategy()
  .entry((_indicators, candle) => bullishDivTimes.has(candle.time))
  .exit((_indicators, candle) => bearishDivTimes.has(candle.time))
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略9: RSIダイバージェンス", result9);

// ============================================
// Strategy 10: RSI Cross (30を上抜けで買い、70を下抜けで売り)
// ============================================
const rsiData = rsi(candles, { period: 14 });

const result10 = TrendCraft.from(candles)
  .strategy()
  .entry((_indicators, _candle, i) => {
    if (i < 1) return false;
    const prev = rsiData[i - 1]?.value;
    const curr = rsiData[i]?.value;
    if (prev === null || curr === null) return false;
    return prev < 30 && curr >= 30;
  })
  .exit((_indicators, _candle, i) => {
    if (i < 1) return false;
    const prev = rsiData[i - 1]?.value;
    const curr = rsiData[i]?.value;
    if (prev === null || curr === null) return false;
    return prev > 70 && curr <= 70;
  })
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略10: RSIクロス (30上抜け/70下抜け)", result10);

// ============================================
// Strategy 11: Stochastics Oversold/Overbought
// ============================================
const stochData = stochastics(candles, { kPeriod: 14, dPeriod: 3 });

const result11 = TrendCraft.from(candles)
  .strategy()
  .entry((_indicators, _candle, i) => {
    const curr = stochData[i]?.value;
    if (!curr || curr.k === null || curr.d === null) return false;
    // %Kが%Dを上抜け && 売られすぎゾーン（20以下）から脱出
    const prev = stochData[i - 1]?.value;
    if (!prev || prev.k === null || prev.d === null) return false;
    return prev.k <= prev.d && curr.k > curr.d && curr.k < 30;
  })
  .exit((_indicators, _candle, i) => {
    const curr = stochData[i]?.value;
    if (!curr || curr.k === null || curr.d === null) return false;
    // %Kが%Dを下抜け && 買われすぎゾーン（80以上）
    const prev = stochData[i - 1]?.value;
    if (!prev || prev.k === null || prev.d === null) return false;
    return prev.k >= prev.d && curr.k < curr.d && curr.k > 70;
  })
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略11: ストキャスティクス (K/Dクロス)", result11);

// ============================================
// Strategy 12: DMI/ADX Trend Following
// ============================================
const dmiData = dmi(candles, { period: 14 });

const result12 = TrendCraft.from(candles)
  .strategy()
  .entry((_indicators, _candle, i) => {
    const curr = dmiData[i]?.value;
    const prev = dmiData[i - 1]?.value;
    if (!curr || !prev) return false;
    if (curr.plusDi === null || curr.minusDi === null || curr.adx === null) return false;
    if (prev.plusDi === null || prev.minusDi === null) return false;
    // +DIが-DIを上抜け && ADX > 25（トレンド確認）
    return prev.plusDi <= prev.minusDi && curr.plusDi > curr.minusDi && curr.adx > 25;
  })
  .exit((_indicators, _candle, i) => {
    const curr = dmiData[i]?.value;
    const prev = dmiData[i - 1]?.value;
    if (!curr || !prev) return false;
    if (curr.plusDi === null || curr.minusDi === null) return false;
    if (prev.plusDi === null || prev.minusDi === null) return false;
    // +DIが-DIを下抜け
    return prev.plusDi >= prev.minusDi && curr.plusDi < curr.minusDi;
  })
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略12: DMI/ADXトレンドフォロー", result12);

// ============================================
// Strategy 13: Donchian Channel Breakout (Turtle Trading)
// ============================================
const donchian20 = donchianChannel(candles, { period: 20 });
const donchian10 = donchianChannel(candles, { period: 10 });

const result13 = TrendCraft.from(candles)
  .strategy()
  .entry((_indicators, candle, i) => {
    const curr = donchian20[i]?.value;
    if (!curr || curr.upper === null) return false;
    // 20日高値ブレイクアウトで買い
    return candle.close > curr.upper;
  })
  .exit((_indicators, candle, i) => {
    const curr = donchian10[i]?.value;
    if (!curr || curr.lower === null) return false;
    // 10日安値ブレイクで売り
    return candle.close < curr.lower;
  })
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略13: ドンチャンブレイクアウト (タートル)", result13);

// ============================================
// Strategy 14: MFI (Money Flow Index) Oversold
// ============================================
const mfiData = mfi(candles, { period: 14 });

const result14 = TrendCraft.from(candles)
  .strategy()
  .entry((_indicators, _candle, i) => {
    const prev = mfiData[i - 1]?.value;
    const curr = mfiData[i]?.value;
    if (prev === null || curr === null) return false;
    // MFIが20を上抜け（売られすぎから回復）
    return prev < 20 && curr >= 20;
  })
  .exit((_indicators, _candle, i) => {
    const prev = mfiData[i - 1]?.value;
    const curr = mfiData[i]?.value;
    if (prev === null || curr === null) return false;
    // MFIが80を下抜け（買われすぎから下落）
    return prev > 80 && curr <= 80;
  })
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略14: MFI (マネーフローインデックス)", result14);

// ============================================
// Strategy 15: ATR Volatility Breakout
// ============================================
const atrData = atr(candles, { period: 14 });
const sma20Data = sma(candles, { period: 20 });

const result15 = TrendCraft.from(candles)
  .strategy()
  .entry((_indicators, candle, i) => {
    if (i < 1) return false;
    const currAtr = atrData[i]?.value;
    const currSma = sma20Data[i]?.value;
    const prevClose = candles[i - 1].close;
    if (currAtr === null || currSma === null) return false;
    // 前日終値 + 1.5×ATR を上抜け && SMA上
    return candle.close > prevClose + currAtr * 1.5 && candle.close > currSma;
  })
  .exit((_indicators, candle, i) => {
    if (i < 1) return false;
    const currAtr = atrData[i]?.value;
    const prevClose = candles[i - 1].close;
    if (currAtr === null) return false;
    // 前日終値 - 2×ATR を下抜け
    return candle.close < prevClose - currAtr * 2;
  })
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略15: ATRボラティリティブレイクアウト", result15);

// ============================================
// Strategy 16: Bollinger Band Mean Reversion
// ============================================
const bbData = bollingerBands(candles, { period: 20, stdDev: 2 });

const result16 = TrendCraft.from(candles)
  .strategy()
  .entry((_indicators, candle, i) => {
    const curr = bbData[i]?.value;
    if (!curr || curr.lower === null || curr.middle === null) return false;
    // 下バンドタッチ && 終値がミドル以下
    return candle.low <= curr.lower && candle.close < curr.middle;
  })
  .exit((_indicators, candle, i) => {
    const curr = bbData[i]?.value;
    if (!curr || curr.middle === null) return false;
    // ミドルバンドに到達
    return candle.close >= curr.middle;
  })
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略16: BB平均回帰 (下バンド→ミドル)", result16);

// ============================================
// Strategy 17: Triple MA (5/25/75)
// ============================================
const sma5Data = sma(candles, { period: 5 });
const sma25Data = sma(candles, { period: 25 });
const sma75Data = sma(candles, { period: 75 });

const result17 = TrendCraft.from(candles)
  .strategy()
  .entry((_indicators, _candle, i) => {
    if (i < 1) return false;
    const curr5 = sma5Data[i]?.value;
    const curr25 = sma25Data[i]?.value;
    const curr75 = sma75Data[i]?.value;
    const prev5 = sma5Data[i - 1]?.value;
    const prev25 = sma25Data[i - 1]?.value;
    if (curr5 === null || curr25 === null || curr75 === null) return false;
    if (prev5 === null || prev25 === null) return false;
    // 5MA > 25MA > 75MA（パーフェクトオーダー）&& 5MAが25MAを上抜け
    return prev5 <= prev25 && curr5 > curr25 && curr25 > curr75;
  })
  .exit((_indicators, _candle, i) => {
    if (i < 1) return false;
    const curr5 = sma5Data[i]?.value;
    const curr25 = sma25Data[i]?.value;
    const prev5 = sma5Data[i - 1]?.value;
    const prev25 = sma25Data[i - 1]?.value;
    if (curr5 === null || curr25 === null) return false;
    if (prev5 === null || prev25 === null) return false;
    // 5MAが25MAを下抜け
    return prev5 >= prev25 && curr5 < curr25;
  })
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略17: トリプルMA (5/25/75パーフェクトオーダー)", result17);

// ============================================
// Strategy 18: RSI + MACD Combo
// ============================================
const result18 = TrendCraft.from(candles)
  .strategy()
  .entry(and(rsiBelow(40), macdCrossUp()))
  .exit(or(rsiAbove(70), macdCrossDown()))
  .backtest({ capital, stopLoss, commissionRate, taxRate });

formatResult("戦略18: RSI+MACDコンボ", result18);

// ============================================
// Summary
// ============================================
console.log(`\n${"=".repeat(60)}`);
console.log("📋 サマリー");
console.log("=".repeat(60));

const strategies = [
  { name: "GC/DC", result: result1 },
  { name: "RSI閾値", result: result2 },
  { name: "MACD", result: result3 },
  { name: "GC+RSI", result: result4 },
  { name: "BB逆張り", result: result5 },
  { name: "出来高", result: result6 },
  { name: "騙し検出", result: result7 },
  { name: "騙しGC+DC", result: result8 },
  { name: "RSIダイバ", result: result9 },
  { name: "RSIクロス", result: result10 },
  { name: "ストキャス", result: result11 },
  { name: "DMI/ADX", result: result12 },
  { name: "タートル", result: result13 },
  { name: "MFI", result: result14 },
  { name: "ATRブレイク", result: result15 },
  { name: "BB平均回帰", result: result16 },
  { name: "トリプルMA", result: result17 },
  { name: "RSI+MACD", result: result18 },
];

console.log("\n戦略          | リターン | 勝率  | 取引数 | DD   | シャープ");
console.log("-".repeat(65));

for (const s of strategies) {
  const ret = s.result.totalReturnPercent.toFixed(1).padStart(6);
  const win = s.result.winRate.toFixed(0).padStart(4);
  const trades = String(s.result.tradeCount).padStart(4);
  const dd = s.result.maxDrawdown.toFixed(1).padStart(5);
  const sharpe = s.result.sharpeRatio.toFixed(2).padStart(6);
  console.log(`${s.name.padEnd(14)}| ${ret}% | ${win}% | ${trades}   | ${dd}% | ${sharpe}`);
}

console.log("\n✅ おすすめ戦略:");
const best = strategies.reduce((a, b) =>
  a.result.totalReturnPercent > b.result.totalReturnPercent ? a : b
);
console.log(`   ${best.name} (リターン: ${best.result.totalReturnPercent.toFixed(2)}%)`);
