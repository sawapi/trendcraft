# TrendCraft

A TypeScript library for technical analysis of financial data. Calculate indicators, detect signals, and analyze market trends.

[日本語版 README](./README.ja.md)

## Features

### Indicators
- **Moving Averages**: SMA, EMA, WMA
- **Trend**: Ichimoku Cloud, Supertrend
- **Momentum**: RSI, MACD, Stochastics (Fast/Slow), DMI/ADX, Stoch RSI, CCI, Williams %R, ROC
- **Volatility**: Bollinger Bands, ATR, Donchian Channel
- **Volume**: OBV, MFI, VWAP, Volume MA
- **Price**: Highest/Lowest, Returns, Pivot Points

### Signal Detection
- **Cross Detection**: Golden Cross, Dead Cross, custom crossovers
- **Fake Signal Detection**: Validate cross signals with volume/trend confirmation
- **Divergence**: OBV, RSI, MACD divergence detection
- **Squeeze**: Bollinger Bands squeeze detection

### Backtesting
- Simple strategy backtesting with preset conditions
- Stop loss, take profit, trailing stop support
- Commission and slippage simulation
- Performance metrics (Sharpe ratio, max drawdown, win rate)

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
