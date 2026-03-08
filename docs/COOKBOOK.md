# TrendCraft Cookbook

Practical recipes for common trading analysis tasks. Each recipe is self-contained and copy-paste ready.

---

## Recipe 1: Basic Backtest — Golden Cross + RSI Filter

**Goal:** Backtest a simple trend-following strategy with momentum confirmation.
**Indicators:** SMA(5), SMA(25), RSI(14)

```typescript
import {
  normalizeCandles,
  runBacktest,
  goldenCrossCondition,
  deadCrossCondition,
  rsiBelow,
  and,
} from "trendcraft";

const candles = normalizeCandles(rawCandles);

const entry = and(goldenCrossCondition(5, 25), rsiBelow(40));
const exit = deadCrossCondition(5, 25);

const result = runBacktest(candles, entry, exit, {
  capital: 1_000_000,
  stopLoss: 5,         // 5% stop loss
  takeProfit: 15,      // 15% take profit
});

console.log(`Return: ${result.totalReturnPercent.toFixed(2)}%`);
console.log(`Win Rate: ${result.winRate.toFixed(1)}%`);
console.log(`Trades: ${result.tradeCount}`);
console.log(`Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
```

---

## Recipe 2: Trend Following — Supertrend + ADX + Volume

**Goal:** Follow established trends with multi-indicator confirmation.
**Indicators:** Supertrend, DMI/ADX, Volume MA

```typescript
import {
  normalizeCandles,
  runBacktest,
  dmiBullish,
  dmiBearish,
  adxStrong,
  volumeAboveAvg,
  and,
} from "trendcraft";

const candles = normalizeCandles(rawCandles);

// Enter: strong bullish trend + volume confirmation
const entry = and(dmiBullish(20), adxStrong(25), volumeAboveAvg(1.5));
// Exit: bearish DMI crossover
const exit = dmiBearish(20);

const result = runBacktest(candles, entry, exit, {
  capital: 1_000_000,
  trailingStop: 8,     // 8% trailing stop
});

console.log(`Return: ${result.totalReturnPercent.toFixed(2)}%`);
console.log(`Profit Factor: ${result.profitFactor.toFixed(2)}`);
```

---

## Recipe 3: Mean Reversion — Bollinger Bands + RSI

**Goal:** Buy at oversold levels, sell at overbought levels.
**Indicators:** Bollinger Bands(20, 2), RSI(14)

```typescript
import {
  normalizeCandles,
  runBacktest,
  bollingerTouch,
  rsiBelow,
  rsiAbove,
  and,
} from "trendcraft";

const candles = normalizeCandles(rawCandles);

// Enter: price touches lower band + RSI oversold
const entry = and(bollingerTouch("lower"), rsiBelow(30));
// Exit: price touches upper band or RSI overbought
const exit = rsiAbove(70);

const result = runBacktest(candles, entry, exit, {
  capital: 1_000_000,
  stopLoss: 3,
});

console.log(`Return: ${result.totalReturnPercent.toFixed(2)}%`);
```

---

## Recipe 4: Multi-Timeframe Strategy — Weekly Trend + Daily Entry

**Goal:** Enter daily trades only when the weekly trend is bullish.
**Indicators:** Weekly SMA(20), Daily Golden Cross

```typescript
import {
  normalizeCandles,
  runBacktest,
  goldenCrossCondition,
  deadCrossCondition,
  weeklyPriceAboveSma,
  and,
} from "trendcraft";

const dailyCandles = normalizeCandles(rawDailyCandles);

// Enter: daily golden cross + price above weekly SMA(20)
const entry = and(goldenCrossCondition(5, 25), weeklyPriceAboveSma(20));
const exit = deadCrossCondition(5, 25);

const result = runBacktest(candles, entry, exit, {
  capital: 1_000_000,
  mtfTimeframes: ["1W"],   // Enable weekly MTF data
  stopLoss: 5,
});

console.log(`Return: ${result.totalReturnPercent.toFixed(2)}%`);
```

---

## Recipe 5: Risk Management — ATR Trailing Stop + Position Sizing

**Goal:** Use ATR-based stops and risk-based position sizing.
**Indicators:** ATR(14), RSI(14)

```typescript
import {
  normalizeCandles,
  runBacktest,
  rsiBelow,
  rsiAbove,
  riskBasedSize,
  atr,
} from "trendcraft";

const candles = normalizeCandles(rawCandles);

// Backtest with ATR-based risk management
const result = runBacktest(candles, rsiBelow(30), rsiAbove(70), {
  capital: 1_000_000,
  atrRisk: {
    atrPeriod: 14,
    atrStopMultiplier: 2,          // Stop at 2x ATR
    atrTakeProfitMultiplier: 4,    // TP at 4x ATR (2:1 R/R)
    atrTrailingMultiplier: 3,      // Trail at 3x ATR
  },
});

// Position sizing: risk 2% per trade
const atrSeries = atr(candles, { period: 14 });
const lastAtr = atrSeries[atrSeries.length - 1]?.value ?? 0;
const lastPrice = candles[candles.length - 1].close;

const position = riskBasedSize({
  capital: 1_000_000,
  riskPercent: 2,
  entryPrice: lastPrice,
  stopPrice: lastPrice - lastAtr * 2,
});

console.log(`Shares: ${position.shares}, Risk: $${position.riskAmount.toFixed(0)}`);
```

---

## Recipe 6: Parameter Optimization — Grid Search + Walk-Forward

**Goal:** Find optimal parameters and validate with out-of-sample testing.
**Indicators:** SMA(variable), RSI(variable)

```typescript
import {
  normalizeCandles,
  gridSearch,
  walkForwardAnalysis,
  param,
  goldenCrossCondition,
  deadCrossCondition,
} from "trendcraft";

const candles = normalizeCandles(rawCandles);

// Step 1: Grid search for best parameters
const gridResult = gridSearch(
  candles,
  {
    shortPeriod: param(3, 10, 1),    // 3 to 10, step 1
    longPeriod: param(15, 50, 5),    // 15 to 50, step 5
  },
  (params) => ({
    entry: goldenCrossCondition(params.shortPeriod, params.longPeriod),
    exit: deadCrossCondition(params.shortPeriod, params.longPeriod),
    options: { capital: 1_000_000 },
  }),
  { metric: "sharpe" },
);

console.log(`Best params:`, gridResult.results[0].params);
console.log(`Best Sharpe: ${gridResult.results[0].metricValue.toFixed(2)}`);

// Step 2: Walk-forward validation
const wfResult = walkForwardAnalysis(
  candles,
  {
    shortPeriod: param(3, 10, 1),
    longPeriod: param(15, 50, 5),
  },
  (params) => ({
    entry: goldenCrossCondition(params.shortPeriod, params.longPeriod),
    exit: deadCrossCondition(params.shortPeriod, params.longPeriod),
    options: { capital: 1_000_000 },
  }),
  {
    metric: "sharpe",
    inSampleRatio: 0.7,
    periods: 5,
  },
);

console.log(`OOS Return: ${wfResult.outOfSampleReturn.toFixed(2)}%`);
console.log(`Robustness: ${wfResult.robustnessScore.toFixed(2)}`);
```

---

## Recipe 7: Real-Time Streaming — Session + Signal Detection

**Goal:** Process live trade data into candles with indicator-based signals.
**Indicators:** RSI(14), SMA(20)

```typescript
import * as streaming from "trendcraft/streaming";
import * as incremental from "trendcraft/incremental";

const session = streaming.createTradingSession({
  intervalMs: 60_000,   // 1-minute candles
  pipeline: {
    indicators: [
      { name: "rsi", create: () => incremental.createRsi({ period: 14 }) },
      { name: "sma20", create: () => incremental.createSma({ period: 20 }) },
    ],
    detectors: [
      {
        name: "rsiCross30",
        create: () => streaming.createThresholdDetector({ threshold: 30, direction: "crossBelow" }),
        indicatorKey: "rsi",
      },
    ],
  },
});

// Process incoming trades (e.g., from WebSocket)
function onTrade(price: number, volume: number) {
  const events = session.onTrade({
    time: Date.now(),
    price,
    volume,
  });

  for (const event of events) {
    if (event.type === "signal") {
      console.log(`Signal: ${event.detectorName} at price ${price}`);
    }
    if (event.type === "candle") {
      console.log(`New candle: O=${event.candle.open} H=${event.candle.high}`);
    }
  }
}
```

---

## Recipe 8: Scoring-Based Strategy — Composite Score Entry

**Goal:** Use weighted signal scoring for entry decisions.
**Indicators:** RSI, MACD, Stochastics, Perfect Order, Volume

```typescript
import {
  normalizeCandles,
  createMomentumPreset,
  ScoreBuilder,
  calculateScore,
  calculateScoreSeries,
  runBacktest,
  scoreAbove,
  scoreBelow,
} from "trendcraft";

const candles = normalizeCandles(rawCandles);

// Option A: Use a preset
const config = createMomentumPreset();
const score = calculateScore(candles, candles.length - 1, config);
console.log(`Score: ${score.totalScore}, Strength: ${score.strength}`);

// Option B: Build custom scoring
const custom = ScoreBuilder.create()
  .addRsiOversold(30, 3.0)
  .addMacdBullish(2.0)
  .addPerfectOrderBullish(2.5)
  .addVolumeSpike(1.5, 1.5)
  .setThresholds(70, 50, 30)
  .build();

// Option C: Use scoring in backtest
const result = runBacktest(
  candles,
  scoreAbove(70, custom),      // Enter when score > 70
  scoreBelow(30, custom),      // Exit when score < 30
  { capital: 1_000_000 },
);

console.log(`Return: ${result.totalReturnPercent.toFixed(2)}%`);
```

---

## Recipe 9: Stock Screening — Filter Stocks by Conditions

**Goal:** Screen multiple stocks for entry signals.
**Indicators:** Golden Cross, Volume Anomaly, RSI

```typescript
import {
  normalizeCandles,
  screenStock,
  goldenCrossCondition,
  volumeAnomalyCondition,
  rsiBelow,
  and,
} from "trendcraft";

// Define screening criteria
const criteria = {
  entry: and(goldenCrossCondition(5, 25), rsiBelow(40)),
};

// Screen each stock
const tickers = ["7203.T", "6758.T", "9984.T"];
const results = tickers.map((ticker) => {
  const candles = normalizeCandles(stockData[ticker]);
  return screenStock(ticker, candles, criteria);
});

// Show stocks with entry signals
const hits = results.filter((r) => r.entrySignal);
for (const hit of hits) {
  console.log(`${hit.ticker}: Entry signal detected`);
}
```

---

## Recipe 10: Scaled Entry — Pyramiding + Partial Take Profit

**Goal:** Build a position gradually and take partial profits.
**Indicators:** RSI, SMA

```typescript
import {
  normalizeCandles,
  runBacktest,
  goldenCrossCondition,
  deadCrossCondition,
} from "trendcraft";

const candles = normalizeCandles(rawCandles);

const result = runBacktest(
  candles,
  goldenCrossCondition(5, 25),
  deadCrossCondition(5, 25),
  {
    capital: 1_000_000,
    stopLoss: 8,
    // Partial take profit: sell 50% at +5% gain
    partialTakeProfit: {
      threshold: 5,
      sellPercent: 50,
    },
    // Scale out: sell at multiple levels
    scaleOut: {
      levels: [
        { threshold: 3, sellPercent: 30 },   // Sell 30% at +3%
        { threshold: 7, sellPercent: 50 },   // Sell 50% of remaining at +7%
        { threshold: 12, sellPercent: 100 }, // Sell rest at +12%
      ],
    },
  },
);

console.log(`Return: ${result.totalReturnPercent.toFixed(2)}%`);
console.log(`Trades: ${result.tradeCount}`);

// Check exit reasons
const byReason = result.trades.reduce(
  (acc, t) => {
    acc[t.exitReason] = (acc[t.exitReason] ?? 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);
console.log("Exit reasons:", byReason);
```

---

## Recipe 11: Custom Indicator — Plugin System

**Goal:** Create a custom indicator and use it alongside built-in indicators.
**Use case:** SMA spread (fast SMA − slow SMA) as a trend strength measure.

```typescript
import { defineIndicator, TrendCraft, sma } from "trendcraft";

// Step 1: Define a custom indicator
const smaSpread = defineIndicator({
  name: "smaSpread" as const,
  compute: (candles, opts) => {
    const fast = sma(candles, { period: opts.fastPeriod });
    const slow = sma(candles, { period: opts.slowPeriod });
    return fast.map((f, i) => ({
      time: f.time,
      value:
        f.value != null && slow[i].value != null
          ? f.value - slow[i].value
          : null,
    }));
  },
  defaultOptions: { fastPeriod: 5, slowPeriod: 20 },
  buildKey: (opts) => `smaSpread_${opts.fastPeriod}_${opts.slowPeriod}`,
});

// Step 2: Use in the fluent API pipeline
const result = TrendCraft.from(candles)
  .sma(20)
  .rsi(14)
  .use(smaSpread, { fastPeriod: 10, slowPeriod: 50 })
  .compute();

// Access results by cache key
console.log(result.indicators.sma20);
console.log(result.indicators.rsi14);
console.log(result.indicators.smaSpread_10_50);

// Step 3: Dynamic plugin selection from config
import { plugins } from "trendcraft";

const pipeline = [
  { plugin: plugins.sma, options: { period: 50 } },
  { plugin: plugins.rsi, options: { period: 14 } },
  { plugin: smaSpread, options: { fastPeriod: 5, slowPeriod: 20 } },
];

let tc = TrendCraft.from(candles);
for (const { plugin, options } of pipeline) {
  tc = tc.use(plugin, options);
}
const dynamicResult = tc.compute();
console.log(Object.keys(dynamicResult.indicators));
```

---

## Recipe 12: Multi-Asset Backtest — Portfolio of Stocks

**Goal:** Backtest the same strategy across multiple symbols and get portfolio-level metrics.
**Use case:** Evaluate a trend-following strategy across a diversified basket.

```typescript
import {
  normalizeCandles,
  batchBacktest,
  goldenCrossCondition,
  deadCrossCondition,
} from "trendcraft";

// Prepare datasets (one per symbol)
const datasets = [
  { symbol: "AAPL", candles: normalizeCandles(aaplRaw) },
  { symbol: "MSFT", candles: normalizeCandles(msftRaw) },
  { symbol: "GOOG", candles: normalizeCandles(googRaw) },
  { symbol: "AMZN", candles: normalizeCandles(amznRaw) },
];

// Run batch backtest with equal capital allocation
const result = batchBacktest(
  datasets,
  goldenCrossCondition(5, 25),
  deadCrossCondition(5, 25),
  { capital: 4_000_000, stopLoss: 5, takeProfit: 15 },
);

// Portfolio-level metrics
console.log(`Portfolio Return: ${result.portfolio.totalReturnPercent}%`);
console.log(`Portfolio Drawdown: ${result.portfolio.maxDrawdown}%`);
console.log(`Total Trades: ${result.portfolio.tradeCount}`);

// Per-symbol breakdown
for (const s of result.symbols) {
  console.log(`  ${s.symbol}: ${s.result.totalReturnPercent}% (${s.result.tradeCount} trades)`);
}

// Custom allocation (overweight AAPL)
const weighted = batchBacktest(
  datasets,
  goldenCrossCondition(5, 25),
  deadCrossCondition(5, 25),
  {
    capital: 4_000_000,
    allocation: "custom",
    allocations: { AAPL: 0.4, MSFT: 0.25, GOOG: 0.2, AMZN: 0.15 },
    stopLoss: 5,
  },
);
```

---

## Recipe 13: Portfolio Backtest — Shared Capital with Position Limits

**Goal:** Simulate a portfolio with shared capital, per-symbol exposure caps, and rebalancing.

```typescript
import {
  normalizeCandles,
  portfolioBacktest,
  goldenCrossCondition,
  deadCrossCondition,
} from "trendcraft";

const datasets = [
  { symbol: "7203.T", candles: normalizeCandles(toyotaRaw) },
  { symbol: "6758.T", candles: normalizeCandles(sonyRaw) },
  { symbol: "9984.T", candles: normalizeCandles(softbankRaw) },
];

const result = portfolioBacktest(
  datasets,
  goldenCrossCondition(5, 25),
  deadCrossCondition(5, 25),
  {
    capital: 10_000_000,
    allocation: { type: "equal" },
    maxPositions: 2,           // Max 2 concurrent positions
    maxSymbolExposure: 40,     // Max 40% per symbol
    maxPortfolioDrawdown: 15,  // Halt if DD exceeds 15%
    rebalance: { frequency: "monthly" },
    tradeOptions: {
      stopLoss: 5,
      takeProfit: 15,
      trailingStop: 8,
    },
  },
);

console.log(`Return: ${result.portfolio.totalReturnPercent}%`);
console.log(`Peak Concurrent Positions: ${result.peakConcurrentPositions}`);
console.log(`Rebalance Events: ${result.rebalanceCount}`);
```

---

## Recipe 14: Series Utilities — Combining Indicators

**Goal:** Combine and transform indicator series with time-aligned operations.

```typescript
import {
  normalizeCandles,
  sma,
  rsi,
  bollingerBands,
  zipSeries,
  mapSeries,
  filterSeries,
  alignSeries,
  resample,
} from "trendcraft";

const candles = normalizeCandles(rawCandles);

// Transform: Normalize RSI to 0-1 range
const rsi14 = rsi(candles);
const normalizedRsi = mapSeries(rsi14, (val) => val / 100);

// Combine: SMA spread
const sma5 = sma(candles, { period: 5 });
const sma25 = sma(candles, { period: 25 });
const spread = zipSeries(sma5, sma25, (fast, slow) => fast - slow);

// Complex merge: Create a composite signal
const bb = bollingerBands(candles);
const composite = zipSeries(rsi14, bb, (rsiVal, bbVal) => ({
  rsi: rsiVal,
  percentB: bbVal.percentB,
  signal:
    rsiVal < 30 && bbVal.percentB !== null && bbVal.percentB < 0
      ? "strong_buy"
      : rsiVal > 70 && bbVal.percentB !== null && bbVal.percentB > 1
        ? "strong_sell"
        : "neutral",
}));

// Filter: Find oversold moments
const oversold = filterSeries(rsi14, (val) => val < 30);
console.log(`Oversold points: ${oversold.length}`);

// Align: Higher timeframe indicator to daily data
const weeklyCandles = resample(candles, { value: 1, unit: "week" });
const weeklySma = sma(weeklyCandles, { period: 20 });
const dailySma = sma(candles, { period: 20 });
const alignedWeeklySma = alignSeries(weeklySma, dailySma);
```

---

## Recipe 15: AI-Powered Strategy Generation with llms.txt

**Goal:** Use an LLM (ChatGPT, Claude, etc.) to generate TrendCraft strategies.
**No code changes needed — just leverage the existing `llms.txt` file.**

### Step 1: Provide Context to the LLM

Copy the contents of `llms.txt` (shipped with the package) into your LLM prompt:

```
You are a quant strategy developer. Use the TrendCraft library to build strategies.
Here is the API reference:

[paste contents of llms.txt]

Create a mean-reversion strategy for Japanese stocks with:
- Entry: RSI below 25 + price at lower Bollinger Band
- Exit: RSI above 65
- Risk: 2% max loss per trade, 3:1 R/R ratio
- Use ATR-based position sizing
```

### Step 2: The LLM generates ready-to-run code

```typescript
// Generated by LLM using llms.txt context
import {
  normalizeCandles,
  runBacktest,
  bollingerTouch,
  rsiBelow,
  rsiAbove,
  and,
  riskBasedSize,
  atr,
} from "trendcraft";

const candles = normalizeCandles(rawCandles);

const result = runBacktest(
  candles,
  and(bollingerTouch("lower"), rsiBelow(25)),
  rsiAbove(65),
  {
    capital: 1_000_000,
    atrRisk: {
      atrPeriod: 14,
      atrStopMultiplier: 2,
      atrTakeProfitMultiplier: 6,
    },
  },
);
```

### Tips for Better LLM-Generated Strategies

- Always include `llms.txt` — it contains all function signatures and examples
- Use `StrategyDefinition` type for serializable strategies the LLM can output as JSON
- Validate generated code with `pnpm build` before running

---

## Recipe 16: Drawdown Analysis — Risk Management Insights

**Goal:** Analyze drawdown periods from backtest results to identify risk characteristics and recovery patterns.

```typescript
import {
  runBacktest,
  analyzeDrawdowns,
  goldenCrossCondition,
  deadCrossCondition,
} from "trendcraft";

const result = runBacktest(candles, goldenCrossCondition(5, 25), deadCrossCondition(5, 25), {
  capital: 1_000_000,
  stopLoss: 5,
  takeProfit: 15,
});

// Analyze drawdown periods
const dd = analyzeDrawdowns(result.drawdownPeriods);

console.log(`=== Drawdown Analysis ===`);
console.log(`Total drawdowns: ${dd.count}`);
console.log(`Avg depth: ${dd.avgDepth}%`);
console.log(`Max depth: ${dd.maxDepth}%`);
console.log(`Avg duration: ${dd.avgDurationBars} bars`);
console.log(`Max duration: ${dd.maxDurationBars} bars`);
console.log(`Recovery rate: ${dd.recoveryRate}%`);
console.log(`Avg recovery: ${dd.avgRecoveryBars} bars`);

if (dd.worstDrawdown) {
  const w = dd.worstDrawdown;
  console.log(`\nWorst drawdown: ${w.maxDepthPercent}% (peak: ${w.peakEquity} → trough: ${w.troughEquity})`);
}

// Compare strategies by drawdown profile
const strategies = [
  { name: "SL 3%", opts: { capital: 1_000_000, stopLoss: 3 } },
  { name: "SL 5%", opts: { capital: 1_000_000, stopLoss: 5 } },
  { name: "SL 10%", opts: { capital: 1_000_000, stopLoss: 10 } },
];

for (const s of strategies) {
  const r = runBacktest(candles, goldenCrossCondition(5, 25), deadCrossCondition(5, 25), s.opts);
  const d = analyzeDrawdowns(r.drawdownPeriods);
  console.log(`${s.name}: maxDD=${d.maxDepth}%, avgRecovery=${d.avgRecoveryBars} bars, recoveryRate=${d.recoveryRate}%`);
}
```

**Key insights:**
- `recoveryRate` < 80% suggests the strategy has trouble recovering from losses
- Compare `avgRecoveryBars` across strategies to find faster-recovering setups
- `worstDrawdown` helps set realistic expectations for live trading

---

## Recipe 17: Pattern Projection — Expected Returns After Signals

**Goal:** Statistically analyze what happens after a pattern or signal occurs, with confidence bounds and hit rates.

```typescript
import {
  projectFromPatterns,
  projectFromSeries,
  projectPatternOutcome,
  doubleBottom,
  crossOver,
  sma,
  rsi,
} from "trendcraft";

// === Example 1: Double bottom pattern projection ===
const patterns = doubleBottom(candles);
const dbProjection = projectFromPatterns(candles, patterns, {
  horizon: 30,
  confidenceLevel: 0.95,
});

console.log(`=== Double Bottom Projection ===`);
console.log(`Patterns found: ${dbProjection.patternCount}`);
console.log(`Valid (with forward data): ${dbProjection.validCount}`);
console.log(`Avg return after 5 bars: ${dbProjection.avgReturnByBar[4]}%`);
console.log(`Avg return after 20 bars: ${dbProjection.avgReturnByBar[19]}%`);
console.log(`95% CI at 20 bars: [${dbProjection.lowerBound[19]}%, ${dbProjection.upperBound[19]}%]`);

for (const hr of dbProjection.hitRates) {
  console.log(`  ${hr.threshold}% target hit rate: ${hr.rate}%`);
}

// === Example 2: Golden cross projection ===
const crosses = crossOver(sma(candles, { period: 5 }), sma(candles, { period: 25 }));
const gcProjection = projectFromSeries(candles, crosses, { horizon: 20 });

console.log(`\n=== Golden Cross Projection ===`);
console.log(`Events: ${gcProjection.validCount}`);
for (let i = 0; i < 20; i += 5) {
  console.log(
    `  Bar ${i + 1}: avg=${gcProjection.avgReturnByBar[i]}%, ` +
      `median=${gcProjection.medianReturnByBar[i]}%`,
  );
}

// === Example 3: Custom event — RSI oversold bounce ===
const rsi14 = rsi(candles, { period: 14 });
const oversoldEvents = rsi14.filter((r) => r.value !== null && r.value < 30);

const rsiProjection = projectPatternOutcome(
  candles,
  oversoldEvents,
  (e) => ({ time: e.time, direction: "bullish" }),
  { horizon: 10, thresholds: [1, 3, 5] },
);

console.log(`\n=== RSI Oversold Bounce ===`);
console.log(`Events: ${rsiProjection.validCount}`);
console.log(`5-bar avg return: ${rsiProjection.avgReturnByBar[4]}%`);
console.log(`3% hit rate: ${rsiProjection.hitRates.find((h) => h.threshold === 3)?.rate}%`);
```

**Key insights:**
- Use `hitRates` to validate if a pattern is worth trading (e.g., "does this pattern reach +5% within 20 bars at least 60% of the time?")
- Compare `avgReturnByBar` vs `medianReturnByBar` to detect skewed distributions
- `lowerBound` / `upperBound` show the range of expected outcomes
- Bearish patterns (double top, H&S) have returns automatically inverted so positive = favorable

---

## Recipe 18: Data Integration — Connecting External Sources

**Goal:** Convert data from popular APIs (CCXT, Alpaca, Yahoo Finance) to TrendCraft format.
**No library dependency needed — just use `normalizeCandles()`.**

### CCXT (Crypto Exchanges)

```typescript
import { normalizeCandles } from "trendcraft";

// CCXT returns [timestamp, open, high, low, close, volume]
const ohlcv = await exchange.fetchOHLCV("BTC/USDT", "1d", undefined, 200);

const candles = normalizeCandles(
  ohlcv.map(([time, open, high, low, close, volume]) => ({
    time,
    open,
    high,
    low,
    close,
    volume,
  })),
);
```

### Alpaca Markets

```typescript
import { normalizeCandles } from "trendcraft";

// Alpaca bars: { t, o, h, l, c, v }
const bars = await alpaca.getBars({ symbol: "AAPL", timeframe: "1Day", limit: 200 });

const candles = normalizeCandles(
  bars.map((bar) => ({
    time: new Date(bar.t).getTime(),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  })),
);
```

### Yahoo Finance (via yahoo-finance2)

```typescript
import { normalizeCandles } from "trendcraft";

// yahoo-finance2 returns { date, open, high, low, close, volume }
const history = await yahooFinance.chart("AAPL", { period1: "2023-01-01" });

const candles = normalizeCandles(
  history.quotes.map((q) => ({
    time: q.date.getTime(),
    open: q.open,
    high: q.high,
    low: q.low,
    close: q.close,
    volume: q.volume,
  })),
);
```

### CSV Files

```typescript
import { parseCsv, normalizeCandles } from "trendcraft";

// TrendCraft's built-in CSV parser handles common formats
const raw = parseCsv(csvString); // Returns Candle[]
const candles = normalizeCandles(raw);
```
