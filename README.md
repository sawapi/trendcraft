# TrendCraft

A TypeScript library for technical analysis of financial data. Calculate indicators, detect signals, and analyze market trends.

[日本語版 README](./README.ja.md)

## Features

### Indicators (51+)
- **Moving Averages**: SMA, EMA, WMA, VWMA, KAMA, T3
- **Trend**: Ichimoku Cloud, Supertrend, Parabolic SAR, Vortex
- **Momentum**: RSI, MACD, Stochastics (Fast/Slow), DMI/ADX, Stoch RSI, CCI, Williams %R, ROC, TRIX, Aroon, DPO, Hurst Exponent
- **Volatility**: Bollinger Bands, ATR, Donchian Channel, Keltner Channel, Chandelier Exit, Volatility Regime
- **Volume**: OBV, MFI, VWAP, Volume MA, CMF, Volume Anomaly, Volume Profile, Volume Trend, ADL
- **Price**: Highest/Lowest, Returns, Pivot Points, Swing Points, Fractals, Zigzag, Fibonacci Retracement/Extension, Heikin-Ashi

### Signal Detection
- **Cross Detection**: Golden Cross, Dead Cross, custom crossovers
- **Fake Signal Detection**: Validate cross signals with volume/trend confirmation
- **Divergence**: OBV, RSI, MACD divergence detection
- **Squeeze**: Bollinger Bands squeeze detection
- **Range-Bound**: Detect sideways markets and potential breakouts

### Backtesting
- Simple strategy backtesting with preset conditions
- Stop loss, take profit, trailing stop support
- Commission and slippage simulation
- Performance metrics (Sharpe ratio, max drawdown, win rate)
- Multi-timeframe (MTF) conditions (weekly/monthly RSI, SMA, trend)
- Advanced volume conditions (anomaly detection, volume profile)

### Signal Scoring
- Combine multiple signals with weighted importance
- Pre-built presets: momentum, meanReversion, trendFollowing, balanced
- Fluent API (ScoreBuilder) for custom scoring strategies
- Backtest conditions based on composite scores

### Position Sizing
- **Risk-Based**: Calculate size from risk amount and stop distance
- **ATR-Based**: Dynamic stop distance using ATR
- **Kelly Criterion**: Optimal sizing based on win rate and payoff ratio
- **Fixed Fractional**: Simple percentage-based allocation

### ATR Risk Management
- Chandelier Exit trailing stops
- Dynamic ATR-based stop and take-profit levels
- Integrated with backtesting engine

### Strategy Optimization
- **Grid Search**: Parameter tuning with constraints
- **Walk-Forward Analysis**: Out-of-sample validation
- **Combination Search**: Find optimal entry/exit condition combinations

### Scaled Entry
- Split entry strategies (equal, pyramid, reverse-pyramid)
- Signal-based or price-based intervals
- Partial take-profit support

### Volatility Regime Detection
- Classify market volatility (low, normal, high, extreme)
- Filter trades by volatility environment
- ATR% filtering for stock screening

### CLI Tools
- **Screening CLI**: Screen multiple stocks against entry/exit conditions
- **Backtest CLI**: Run backtests on single files or compare across multiple files
- Output formats: table, JSON, CSV

### Utilities
- Data normalization (various date formats to timestamps)
- Timeframe resampling (daily to weekly/monthly)
- Fluent API for chaining operations

## Installation

```bash
npm install trendcraft
```

## Quick Start

```typescript
import { sma, rsi, bollingerBands, goldenCross } from 'trendcraft';

// Your candle data
const candles = [
  { time: 1700000000000, open: 100, high: 105, low: 99, close: 104, volume: 1000 },
  // ... more candles
];

// Calculate indicators
const sma20 = sma(candles, { period: 20 });
const rsi14 = rsi(candles, { period: 14 });
const bb = bollingerBands(candles, { period: 20, stdDev: 2 });

// Detect signals
const crosses = goldenCross(candles, { short: 5, long: 25 });
```

## Usage Examples

### Moving Averages

```typescript
import { sma, ema } from 'trendcraft';

// Simple Moving Average
const sma20 = sma(candles, { period: 20 });
// Returns: [{ time: number, value: number | null }, ...]

// Exponential Moving Average
const ema12 = ema(candles, { period: 12 });
```

### RSI

```typescript
import { rsi } from 'trendcraft';

const rsi14 = rsi(candles, { period: 14 });

// Check oversold/overbought
rsi14.forEach(({ time, value }) => {
  if (value !== null) {
    if (value < 30) console.log(`${time}: Oversold`);
    if (value > 70) console.log(`${time}: Overbought`);
  }
});
```

### MACD

```typescript
import { macd } from 'trendcraft';

const macdData = macd(candles, { fast: 12, slow: 26, signal: 9 });

macdData.forEach(({ time, value }) => {
  const { macd: macdLine, signal, histogram } = value;
  // macdLine: MACD line value
  // signal: Signal line value
  // histogram: MACD - Signal
});
```

### Bollinger Bands

```typescript
import { bollingerBands } from 'trendcraft';

const bb = bollingerBands(candles, { period: 20, stdDev: 2 });

bb.forEach(({ time, value }) => {
  const { upper, middle, lower, percentB, bandwidth } = value;
  // upper: Upper band
  // middle: Middle band (SMA)
  // lower: Lower band
  // percentB: %B indicator (0-1 scale)
  // bandwidth: Band width
});
```

### Signal Detection

```typescript
import { goldenCross, deadCross, rsiDivergence, bollingerSqueeze } from 'trendcraft';

// Golden Cross / Dead Cross
const gc = goldenCross(candles, { short: 5, long: 25 });
const dc = deadCross(candles, { short: 5, long: 25 });

// RSI Divergence
const divergences = rsiDivergence(candles);
divergences.forEach(signal => {
  console.log(`${signal.type} divergence at ${signal.time}`);
  // type: 'bullish' or 'bearish'
});

// Bollinger Squeeze
const squeezes = bollingerSqueeze(candles, { threshold: 10 });
// Detects low volatility periods (potential breakout setup)

// Range-Bound Detection
import { rangeBound } from 'trendcraft';

const rb = rangeBound(candles);
const latest = rb[rb.length - 1].value;

if (latest.state === 'RANGE_CONFIRMED') {
  console.log(`Range: ${latest.rangeLow} - ${latest.rangeHigh}`);
}
if (latest.state === 'BREAKOUT_RISK_UP') {
  console.log('Watch for upside breakout!');
}
```

### Timeframe Resampling

```typescript
import { resample } from 'trendcraft';

// Convert daily candles to weekly
const weeklyCandles = resample(dailyCandles, 'weekly');

// Convert to monthly
const monthlyCandles = resample(dailyCandles, 'monthly');
```

### Fluent API

```typescript
import { TrendCraft } from 'trendcraft';

const result = TrendCraft.from(candles)
  .sma(20)
  .ema(12)
  .rsi(14)
  .compute();

// Access results
console.log(result.sma);
console.log(result.ema);
console.log(result.rsi);
```

### Backtesting

```typescript
import { TrendCraft, goldenCross, deadCross, and, rsiBelow } from 'trendcraft';

// Simple backtest with preset conditions
const result = TrendCraft.from(candles)
  .strategy()
    .entry(goldenCross())        // Enter on golden cross
    .exit(deadCross())           // Exit on dead cross
  .backtest({ capital: 1000000 });

console.log(result.totalReturnPercent);  // Total return %
console.log(result.winRate);             // Win rate %
console.log(result.maxDrawdown);         // Max drawdown %
console.log(result.sharpeRatio);         // Sharpe ratio

// Combine conditions with AND/OR
const advancedResult = TrendCraft.from(candles)
  .strategy()
    .entry(and(goldenCross(), rsiBelow(30)))  // GC + RSI oversold
    .exit(deadCross())
  .backtest({
    capital: 1000000,
    stopLoss: 5,       // 5% stop loss
    takeProfit: 15,    // 15% take profit
    commission: 0,
    commissionRate: 0.1,  // 0.1% commission
  });
```

### Volume Analysis

```typescript
import { volumeAnomaly, volumeProfile, volumeTrend } from 'trendcraft';

// Detect unusual volume spikes
const anomalies = volumeAnomaly(candles, { period: 20, highThreshold: 2.0 });
anomalies.forEach(({ time, value }) => {
  if (value.isAnomaly) {
    console.log(`${time}: ${value.level} volume (${value.ratio.toFixed(1)}x avg)`);
  }
});

// Volume Profile with POC, VAH, VAL
const profile = volumeProfile(candles, { period: 20 });
console.log(`POC: ${profile.poc}`);      // Point of Control (highest volume price)
console.log(`VAH: ${profile.vah}`);      // Value Area High
console.log(`VAL: ${profile.val}`);      // Value Area Low

// Volume Trend Confirmation
const trends = volumeTrend(candles);
trends.forEach(({ time, value }) => {
  if (value.isConfirmed) {
    console.log(`${time}: Trend confirmed (${value.confidence}%)`);
  }
  if (value.hasDivergence) {
    console.log(`${time}: Volume divergence detected`);
  }
});
```

### Multi-Timeframe (MTF) Conditions

```typescript
import { weeklyRsiAbove, weeklyPriceAboveSma, and, goldenCrossCondition } from 'trendcraft';

// Backtest with weekly RSI filter
const result = TrendCraft.from(dailyCandles)
  .withMtf(['weekly'])  // Enable MTF with weekly data
  .strategy()
    .entry(and(
      weeklyRsiAbove(50),        // Weekly RSI > 50 (bullish bias)
      goldenCrossCondition()     // Daily golden cross
    ))
    .exit(deadCrossCondition())
  .backtest({ capital: 1000000 });
```

### Signal Scoring

```typescript
import { ScoreBuilder, calculateScore, scoreAbove } from 'trendcraft';

// Build custom scoring strategy
const config = ScoreBuilder.create()
  .addPOConfirmation(3.0)      // Perfect Order confirmation (weight: 3.0)
  .addRsiOversold(30, 2.0)     // RSI < 30 (weight: 2.0)
  .addVolumeSpike(1.5, 1.5)    // Volume > 1.5x average (weight: 1.5)
  .addMacdBullish(1.5)         // MACD bullish crossover
  .setThresholds(70, 50, 30)   // strong, moderate, weak
  .build();

// Calculate score at specific index
const result = calculateScore(candles, candles.length - 1, config);
console.log(result.normalizedScore);  // 0-100 score
console.log(result.strength);         // "strong" | "moderate" | "weak" | "none"

// Use in backtest
import { TrendCraft, deadCross } from 'trendcraft';

const backtestResult = TrendCraft.from(candles)
  .strategy()
    .entry(scoreAbove(70, "trendFollowing"))  // Enter when score > 70
    .exit(deadCross())
  .backtest({ capital: 1000000 });
```

### Position Sizing

```typescript
import { riskBasedSize, atrBasedSize, kellySize, fixedFractionalSize } from 'trendcraft';

// Risk-based: Calculate size from risk amount and stop distance
const riskResult = riskBasedSize({
  accountSize: 100000,
  entryPrice: 50,
  stopLossPrice: 48,
  riskPercent: 1,           // Risk 1% of account
  maxPositionPercent: 25,   // Max 25% position size
});
// { shares: 500, positionValue: 25000, riskAmount: 1000, ... }

// ATR-based: Dynamic stop using ATR
const atrResult = atrBasedSize({
  accountSize: 100000,
  entryPrice: 50,
  atrValue: 2.5,
  atrMultiplier: 2,         // 2x ATR for stop distance
  riskPercent: 1,
});
// { shares: 200, stopPrice: 45, ... }

// Kelly Criterion: Optimal sizing based on historical win rate
const kellyResult = kellySize({
  accountSize: 100000,
  entryPrice: 50,
  winRate: 0.6,
  winLossRatio: 1.5,
  kellyFraction: 0.5,       // Half Kelly (safer)
});

// Fixed Fractional: Simple percentage allocation
const fixedResult = fixedFractionalSize({
  accountSize: 100000,
  entryPrice: 50,
  fractionPercent: 10,      // 10% of account
});
```

### ATR Risk Management

```typescript
import { chandelierExit, calculateAtrStops, TrendCraft, goldenCross, deadCross } from 'trendcraft';

// Chandelier Exit trailing stop
const chandelier = chandelierExit(candles, { period: 22, multiplier: 3 });
chandelier.forEach(({ time, value }) => {
  console.log(`Long stop: ${value.longStop}, Short stop: ${value.shortStop}`);
});

// Calculate ATR-based stop and take-profit levels
const stops = calculateAtrStops({
  entryPrice: 100,
  atrValue: 2.5,
  stopMultiplier: 2,        // 2x ATR for stop
  takeProfitMultiplier: 3,  // 3x ATR for take-profit
  direction: 'long',
});
// { stopPrice: 95, takeProfitPrice: 107.5, riskRewardRatio: 1.5 }

// Use in backtest with ATR-based stops
const result = TrendCraft.from(candles)
  .strategy()
    .entry(goldenCross())
    .exit(deadCross())
  .backtest({
    capital: 1000000,
    atrRisk: {
      enabled: true,
      period: 14,
      stopMultiplier: 2,
      takeProfitMultiplier: 3,
    },
  });
```

## CLI Tools

TrendCraft provides two CLI tools for screening and backtesting.

### Screening CLI

Screen multiple stocks against entry/exit conditions.

```bash
# Basic usage
npx trendcraft-screen ./data --entry "goldenCross"

# With entry and exit conditions
npx trendcraft-screen ./data --entry "goldenCross,volumeAnomaly" --exit "deadCross"

# Filter by ATR% (volatility)
npx trendcraft-screen ./data --entry "perfectOrderBullish" --min-atr 2.3

# JSON output
npx trendcraft-screen ./data --output json > results.json

# Show all stocks (not just signals)
npx trendcraft-screen ./data --all

# List available conditions
npx trendcraft-screen --list

# Specify minimum data points required
npx trendcraft-screen ./data --entry "goldenCross" --min-data 200
```

**Output Example (table):**
```
====================================================================
Stock Screening Results - 2025-12-25
====================================================================

Criteria: goldenCross + volumeAnomaly

Summary:
  Total Files: 19
  Entry Signals: 3
  Exit Signals: 1

--------------------------------------------------------------------
| Ticker       | Signal |     Price |    ATR% |   RSI | Vol Ratio |
--------------------------------------------------------------------
| 6920.T       | ENTRY  |     32500 |   4.52% |    38 |      2.31 |
| 4755.T       | ENTRY  |       850 |   3.21% |    42 |      1.87 |
| 6758.T       | EXIT   |     13200 |   2.34% |    68 |      1.12 |
--------------------------------------------------------------------
```

### Backtest CLI

Run backtests on single files or compare across multiple files.

```bash
# Single file (detailed output)
npx trendcraft-backtest ./data/6758.T.csv --entry "goldenCross" --exit "deadCross"

# Multiple files (comparison table)
npx trendcraft-backtest ./data --entry "perfectOrderActiveBullish" --exit "perfectOrderCollapsed"

# With risk management
npx trendcraft-backtest ./data/6758.T.csv \
  --entry "goldenCross,volumeAnomaly" \
  --exit "deadCross" \
  --stop-loss 5 --take-profit 10

# Show individual trades
npx trendcraft-backtest ./data/6758.T.csv --trades

# JSON output
npx trendcraft-backtest ./data --output json > results.json

# List available conditions
npx trendcraft-backtest --list

# Custom capital and commission
npx trendcraft-backtest ./data/6758.T.csv \
  --entry "goldenCross" --exit "deadCross" \
  --capital 500000 --commission 500

# With trailing stop
npx trendcraft-backtest ./data/6758.T.csv \
  --entry "goldenCross" --exit "deadCross" \
  --trailing-stop 3
```

**Single File Output:**
```
======================================================================
Backtest Result: 6758.T
======================================================================

Performance Summary:
  Total Return:     34.48%
  Trade Count:      311
  Win Rate:         34.4%
  Profit Factor:    1.01
  Max Drawdown:     86.88%
  Sharpe Ratio:     1.130

Capital:
  Initial:          1,000,000
  Final:            1,344,761
```

**Multiple Files Output:**
```
Summary:
  Total Stocks:     19
  Profitable:       7 (37%)
  Average Return:   417.90%

--------------------------------------------------------------------------------------------------------------
| Ticker       | Trades |  WinRate |     Return |    MaxDD |     PF |  Sharpe |
--------------------------------------------------------------------------------------------------------------
| 9984.T       |    166 |    41.0% |   7162.68% |   68.78% |   1.42 |   3.090 |
| 6920.T       |     83 |    37.4% |    818.02% |   73.30% |   1.74 |   3.410 |
| 6758.T       |    311 |    34.4% |     34.48% |   86.88% |   1.01 |   1.130 |
--------------------------------------------------------------------------------------------------------------
```

### Available Condition Presets

Both CLI tools support these preset conditions:

| Category | Conditions |
|----------|-----------|
| Moving Average | `goldenCross`, `deadCross`, `goldenCross25_75`, `deadCross25_75` |
| RSI | `rsiBelow30`, `rsiBelow40`, `rsiAbove60`, `rsiAbove70` |
| MACD | `macdCrossUp`, `macdCrossDown` |
| Perfect Order | `perfectOrderBullish`, `perfectOrderBearish`, `perfectOrderCollapsed`, `perfectOrderActiveBullish`, `perfectOrderPullbackEntry`, `perfectOrderBullishConfirmed`, `perfectOrderPreBullish` |
| Volume | `volumeAnomaly`, `volumeAbove1_5x`, `volumeAbove2x`, `volumeConfirmsTrend` |
| Bollinger | `bollingerBreakoutUp`, `bollingerBreakoutDown` |
| Stochastics | `stochBelow20`, `stochAbove80`, `stochCrossUp`, `stochCrossDown` |
| DMI/ADX | `dmiBullish`, `dmiBearish`, `adxStrong` |
| Range | `rangeBreakout`, `rangeConfirmed`, `inRangeBound`, `tightRange` |
| Volatility | `atrPercentAbove2_3`, `atrPercentAbove3` |
| Volatility Regime | `regimeIs('low')`, `regimeNot('high')`, `volatilityAbove(70)`, `volatilityBelow(30)` |

## Cookbook

See [Cookbook](./docs/COOKBOOK.md) for practical recipes including:
- Golden Cross + RSI backtest
- Trend following with ADX + volume
- Mean reversion with Bollinger Bands
- Multi-timeframe strategies
- ATR risk management + position sizing
- Parameter optimization with walk-forward validation
- Real-time streaming pipelines
- Scoring-based entry strategies
- Stock screening
- Scaled entry with partial take profit

## API Reference

See [API Documentation](./docs/API.md) for detailed API reference.

## Data Format

### Input: Candle Data

```typescript
interface Candle {
  time: number | string | Date;  // Timestamp, date string, or Date object
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### Output: Indicator Values

```typescript
interface IndicatorValue<T> {
  time: number;   // Unix timestamp (milliseconds)
  value: T;       // Indicator value (type varies by indicator)
}

type Series<T> = IndicatorValue<T>[];
```

## License

MIT
