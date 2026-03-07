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
