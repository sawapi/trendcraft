# TrendCraft API Reference

## Table of Contents

- [Indicators](#indicators)
  - [Moving Averages](#moving-averages)
  - [Trend](#trend)
  - [Momentum](#momentum)
  - [Volatility](#volatility)
  - [Volume](#volume)
  - [Price](#price)
- [Signals](#signals)
  - [Cross Detection](#cross-detection)
  - [Divergence Detection](#divergence-detection)
  - [Squeeze Detection](#squeeze-detection)
- [Backtesting](#backtesting)
  - [Running Backtest](#running-backtest)
  - [Preset Conditions](#preset-conditions)
  - [Combining Conditions](#combining-conditions)
- [Utilities](#utilities)
  - [Data Normalization](#data-normalization)
  - [Resampling](#resampling)
- [Types](#types)

---

## Indicators

### Moving Averages

#### `sma(candles, options)`

Simple Moving Average.

```typescript
const result = sma(candles, { period: 20 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | required | Number of periods |
| `source` | `PriceSource` | `'close'` | Price source (`'open'`, `'high'`, `'low'`, `'close'`, `'hl2'`, `'hlc3'`, `'ohlc4'`) |

**Returns:** `Series<number | null>`

---

#### `wma(candles, options)`

Weighted Moving Average.

```typescript
const result = wma(candles, { period: 20 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | required | Number of periods |
| `source` | `PriceSource` | `'close'` | Price source |

**Returns:** `Series<number | null>`

---

#### `ema(candles, options)`

Exponential Moving Average.

```typescript
const result = ema(candles, { period: 12 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | required | Number of periods |
| `source` | `PriceSource` | `'close'` | Price source |

**Returns:** `Series<number | null>`

---

### Trend

#### `ichimoku(candles, options)`

Ichimoku Kinko Hyo (一目均衡表).

```typescript
const result = ichimoku(candles);
const custom = ichimoku(candles, { tenkanPeriod: 7, kijunPeriod: 22, senkouBPeriod: 44 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tenkanPeriod` | `number` | `9` | Tenkan-sen (Conversion Line) period |
| `kijunPeriod` | `number` | `26` | Kijun-sen (Base Line) period |
| `senkouBPeriod` | `number` | `52` | Senkou Span B period |
| `displacement` | `number` | `26` | Displacement period for Kumo and Chikou |

**Returns:** `Series<IchimokuValue>`

```typescript
interface IchimokuValue {
  tenkan: number | null;   // Conversion Line (転換線)
  kijun: number | null;    // Base Line (基準線)
  senkouA: number | null;  // Leading Span A (先行スパンA)
  senkouB: number | null;  // Leading Span B (先行スパンB)
  chikou: number | null;   // Lagging Span (遅行スパン)
}
```

---

#### `supertrend(candles, options)`

Supertrend trend-following indicator.

```typescript
const result = supertrend(candles);
const custom = supertrend(candles, { period: 7, multiplier: 2 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `10` | ATR period |
| `multiplier` | `number` | `3` | ATR multiplier |

**Returns:** `Series<SupertrendValue>`

```typescript
interface SupertrendValue {
  supertrend: number | null;  // Supertrend value (support/resistance)
  direction: 1 | -1 | 0;      // 1 = bullish, -1 = bearish, 0 = undefined
  upperBand: number | null;   // Upper band
  lowerBand: number | null;   // Lower band
}
```

---

### Momentum

#### `rsi(candles, options)`

Relative Strength Index (Wilder's method).

```typescript
const result = rsi(candles, { period: 14 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `14` | RSI period |
| `source` | `PriceSource` | `'close'` | Price source |

**Returns:** `Series<number | null>` (0-100 scale)

---

#### `macd(candles, options)`

Moving Average Convergence Divergence.

```typescript
const result = macd(candles, { fast: 12, slow: 26, signal: 9 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fast` | `number` | `12` | Fast EMA period |
| `slow` | `number` | `26` | Slow EMA period |
| `signal` | `number` | `9` | Signal line period |
| `source` | `PriceSource` | `'close'` | Price source |

**Returns:** `Series<MacdValue>`

```typescript
interface MacdValue {
  macd: number | null;      // MACD line
  signal: number | null;    // Signal line
  histogram: number | null; // MACD - Signal
}
```

---

#### `stochastics(candles, options)`

Stochastics Oscillator.

```typescript
// Raw Stochastics
const raw = stochastics(candles, { kPeriod: 14, dPeriod: 3 });

// Fast Stochastics
const fast = fastStochastics(candles, { kPeriod: 14, dPeriod: 3 });

// Slow Stochastics
const slow = slowStochastics(candles, { kPeriod: 14, dPeriod: 3 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `kPeriod` | `number` | `14` | %K period |
| `dPeriod` | `number` | `3` | %D smoothing period |
| `smoothK` | `number` | `3` | %K smoothing (for slow stochastics) |

**Returns:** `Series<StochasticsValue>`

```typescript
interface StochasticsValue {
  k: number | null;  // %K line
  d: number | null;  // %D line
}
```

---

#### `dmi(candles, options)`

Directional Movement Index with ADX.

```typescript
const result = dmi(candles, { period: 14, adxPeriod: 14 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `14` | DI period |
| `adxPeriod` | `number` | `14` | ADX smoothing period |

**Returns:** `Series<DmiValue>`

```typescript
interface DmiValue {
  plusDi: number | null;   // +DI
  minusDi: number | null;  // -DI
  adx: number | null;      // ADX
}
```

---

#### `stochRsi(candles, options)`

Stochastic RSI.

```typescript
const result = stochRsi(candles, {
  rsiPeriod: 14,
  stochPeriod: 14,
  kPeriod: 3,
  dPeriod: 3
});
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rsiPeriod` | `number` | `14` | RSI period |
| `stochPeriod` | `number` | `14` | Stochastics period |
| `kPeriod` | `number` | `3` | %K smoothing |
| `dPeriod` | `number` | `3` | %D smoothing |

**Returns:** `Series<StochRsiValue>`

```typescript
interface StochRsiValue {
  k: number | null;  // %K line
  d: number | null;  // %D line
}
```

---

#### `cci(candles, options)`

Commodity Channel Index.

```typescript
const result = cci(candles);
const custom = cci(candles, { period: 14 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `20` | CCI period |
| `constant` | `number` | `0.015` | Constant multiplier |

**Returns:** `Series<number | null>` (typically -100 to +100, but can exceed)

---

#### `williamsR(candles, options)`

Williams %R momentum indicator.

```typescript
const result = williamsR(candles);
const custom = williamsR(candles, { period: 7 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `14` | Williams %R period |

**Returns:** `Series<number | null>` (-100 to 0 scale)

---

#### `roc(candles, options)`

Rate of Change.

```typescript
const result = roc(candles);
const custom = roc(candles, { period: 9 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `12` | ROC period |
| `source` | `PriceSource` | `'close'` | Price source |

**Returns:** `Series<number | null>` (percentage)

---

### Volatility

#### `bollingerBands(candles, options)`

Bollinger Bands.

```typescript
const result = bollingerBands(candles, { period: 20, stdDev: 2 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `20` | SMA period |
| `stdDev` | `number` | `2` | Standard deviation multiplier |
| `source` | `PriceSource` | `'close'` | Price source |

**Returns:** `Series<BollingerBandsValue>`

```typescript
interface BollingerBandsValue {
  upper: number | null;     // Upper band
  middle: number | null;    // Middle band (SMA)
  lower: number | null;     // Lower band
  percentB: number | null;  // %B indicator
  bandwidth: number | null; // Band width
}
```

---

#### `atr(candles, options)`

Average True Range (Wilder's method).

```typescript
const result = atr(candles, { period: 14 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `14` | ATR period |

**Returns:** `Series<number | null>`

---

#### `donchianChannel(candles, options)`

Donchian Channel.

```typescript
const result = donchianChannel(candles, { period: 20 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `20` | Lookback period |

**Returns:** `Series<DonchianValue>`

```typescript
interface DonchianValue {
  upper: number | null;   // Highest high
  middle: number | null;  // (Upper + Lower) / 2
  lower: number | null;   // Lowest low
}
```

---

### Volume

#### `vwap(candles, options)`

Volume Weighted Average Price.

```typescript
// Session VWAP (resets daily)
const result = vwap(candles);

// Rolling VWAP over 20 periods
const rolling = vwap(candles, { resetPeriod: 'rolling', period: 20 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `resetPeriod` | `'session' \| 'rolling' \| number` | `'session'` | Reset period type |
| `period` | `number` | `20` | Period for rolling VWAP |

**Returns:** `Series<VwapValue>`

```typescript
interface VwapValue {
  vwap: number | null;   // VWAP value
  upper: number | null;  // Upper band (VWAP + stdDev)
  lower: number | null;  // Lower band (VWAP - stdDev)
}
```

---

#### `obv(candles)`

On-Balance Volume.

```typescript
const result = obv(candles);
```

**Returns:** `Series<number>`

---

#### `mfi(candles, options)`

Money Flow Index.

```typescript
const result = mfi(candles, { period: 14 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `14` | MFI period |

**Returns:** `Series<number | null>` (0-100 scale)

---

#### `volumeMa(candles, options)`

Volume Moving Average.

```typescript
const result = volumeMa(candles, { period: 20 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `20` | MA period |

**Returns:** `Series<number | null>`

---

### Price

#### `highest(candles, options)` / `lowest(candles, options)`

Highest High / Lowest Low over n periods.

```typescript
const highestHigh = highest(candles, { period: 20 });
const lowestLow = lowest(candles, { period: 20 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | required | Lookback period |

**Returns:** `Series<number | null>`

---

#### `returns(candles, options)`

Price returns calculation.

```typescript
const simpleReturns = returns(candles, { period: 1 });
const logReturns = returns(candles, { period: 1, log: true });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `1` | Return period |
| `log` | `boolean` | `false` | Use logarithmic returns |

**Returns:** `Series<number | null>`

---

#### `pivotPoints(candles, options)`

Pivot Points for support and resistance levels.

```typescript
const result = pivotPoints(candles);
const fib = pivotPoints(candles, { method: 'fibonacci' });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `method` | `'standard' \| 'fibonacci' \| 'woodie' \| 'camarilla' \| 'demark'` | `'standard'` | Calculation method |

**Returns:** `Series<PivotPointsValue>`

```typescript
interface PivotPointsValue {
  pivot: number | null;  // Pivot Point (central level)
  r1: number | null;     // Resistance level 1
  r2: number | null;     // Resistance level 2
  r3: number | null;     // Resistance level 3
  s1: number | null;     // Support level 1
  s2: number | null;     // Support level 2
  s3: number | null;     // Support level 3
}
```

---

## Signals

### Cross Detection

#### `crossOver(series1, series2)` / `crossUnder(series1, series2)`

Detect when one series crosses over/under another.

```typescript
const crosses = crossOver(shortMA, longMA);
```

**Returns:** `Signal[]`

```typescript
interface Signal {
  time: number;
  type: 'bullish' | 'bearish';
}
```

---

#### `goldenCross(candles, options)` / `deadCross(candles, options)`

Detect Golden Cross (bullish) and Dead Cross (bearish) signals.

```typescript
const gc = goldenCross(candles, { short: 5, long: 25 });
const dc = deadCross(candles, { short: 5, long: 25 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `short` | `number` | required | Short MA period |
| `long` | `number` | required | Long MA period |

**Returns:** `Signal[]`

---

#### `validateCrossSignals(candles, options)`

Detect cross signals with quality assessment.

```typescript
const signals = validateCrossSignals(candles, {
  short: 5,
  long: 25,
  volumeMaPeriod: 20,
  trendPeriod: 5,
});
```

**Returns:** `CrossSignalQuality[]`

```typescript
interface CrossSignalQuality {
  time: number;
  type: 'golden' | 'dead';
  isFake: boolean;
  details: {
    volumeConfirmed: boolean;
    trendConfirmed: boolean;
    holdingConfirmed: boolean | null;
    pricePositionConfirmed: boolean;
    daysUntilReverse: number | null;
  };
}
```

---

### Divergence Detection

#### `obvDivergence(candles, options)`

Detect OBV divergence.

```typescript
const signals = obvDivergence(candles);
```

---

#### `rsiDivergence(candles, options)`

Detect RSI divergence.

```typescript
const signals = rsiDivergence(candles);
```

---

#### `macdDivergence(candles, options)`

Detect MACD divergence.

```typescript
const signals = macdDivergence(candles);
```

---

**Options (all divergence functions):**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `swingLookback` | `number` | `5` | Swing point detection lookback |
| `minSwingDistance` | `number` | `5` | Minimum bars between swings |
| `maxSwingDistance` | `number` | `60` | Maximum bars between swings |

**Returns:** `DivergenceSignal[]`

```typescript
interface DivergenceSignal {
  time: number;
  type: 'bullish' | 'bearish';
  firstIdx: number;
  secondIdx: number;
  price: { first: number; second: number };
  indicator: { first: number; second: number };
}
```

---

### Squeeze Detection

#### `bollingerSqueeze(candles, options)`

Detect Bollinger Bands squeeze (low volatility periods).

```typescript
const signals = bollingerSqueeze(candles, { threshold: 10 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `20` | Bollinger Bands period |
| `stdDev` | `number` | `2` | Standard deviation multiplier |
| `lookback` | `number` | `120` | Lookback for percentile calculation |
| `threshold` | `number` | `5` | Percentile threshold (e.g., 5 = bottom 5%) |

**Returns:** `SqueezeSignal[]`

```typescript
interface SqueezeSignal {
  time: number;
  type: 'squeeze';
  bandwidth: number;
  percentile: number;
}
```

---

## Backtesting

### Running Backtest

#### `runBacktest(candles, entryCondition, exitCondition, options)`

Run a backtest simulation on historical data.

```typescript
import { runBacktest, goldenCross, deadCross } from 'trendcraft';

const result = runBacktest(
  candles,
  goldenCross(5, 25),  // Entry: Golden Cross
  deadCross(5, 25),    // Exit: Dead Cross
  {
    capital: 1000000,
    commission: 0,
    commissionRate: 0.1,  // 0.1%
    slippage: 0.05,       // 0.05%
    stopLoss: 5,          // 5% stop loss
    takeProfit: 10,       // 10% take profit
    trailingStop: 3,      // 3% trailing stop
    taxRate: 20.315,      // Japan tax rate
  }
);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `capital` | `number` | required | Initial capital |
| `commission` | `number` | `0` | Fixed commission per trade |
| `commissionRate` | `number` | `0` | Commission rate (%) |
| `slippage` | `number` | `0` | Slippage rate (%) |
| `stopLoss` | `number` | - | Stop loss percentage |
| `takeProfit` | `number` | - | Take profit percentage |
| `trailingStop` | `number` | - | Trailing stop percentage |
| `taxRate` | `number` | `0` | Tax rate on profits (%) |

**Returns:** `BacktestResult`

```typescript
interface BacktestResult {
  totalReturn: number;         // Total return amount
  totalReturnPercent: number;  // Total return percentage
  tradeCount: number;          // Number of trades
  winRate: number;             // Win rate (%)
  maxDrawdown: number;         // Maximum drawdown (%)
  sharpeRatio: number;         // Sharpe ratio (annualized)
  profitFactor: number;        // Profit factor
  avgHoldingDays: number;      // Average holding days
  trades: Trade[];             // Trade details
}

interface Trade {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  return: number;
  returnPercent: number;
  holdingDays: number;
}
```

---

### Preset Conditions

#### Moving Average Cross

```typescript
goldenCross(shortPeriod = 5, longPeriod = 25)  // Short MA crosses above Long MA
deadCross(shortPeriod = 5, longPeriod = 25)    // Short MA crosses below Long MA
```

#### RSI Conditions

```typescript
rsiBelow(threshold = 30, period = 14)  // RSI < threshold (oversold)
rsiAbove(threshold = 70, period = 14)  // RSI > threshold (overbought)
```

#### MACD Conditions

```typescript
macdCrossUp(fast = 12, slow = 26, signal = 9)   // MACD crosses above signal
macdCrossDown(fast = 12, slow = 26, signal = 9) // MACD crosses below signal
```

#### Bollinger Bands Conditions

```typescript
bollingerBreakout('upper', period = 20, stdDev = 2)  // Price breaks above upper band
bollingerBreakout('lower', period = 20, stdDev = 2)  // Price breaks below lower band
bollingerTouch('upper', period = 20, stdDev = 2)     // Price touches upper band
bollingerTouch('lower', period = 20, stdDev = 2)     // Price touches lower band
```

#### Price vs SMA

```typescript
priceAboveSma(period)  // Price is above SMA
priceBelowSma(period)  // Price is below SMA
```

#### Validated Cross (with Fake Signal Detection)

```typescript
validatedGoldenCross({
  shortPeriod: 5,
  longPeriod: 25,
  volumeMaPeriod: 20,
  trendPeriod: 5,
  minScore: 50
})

validatedDeadCross({
  shortPeriod: 5,
  longPeriod: 25,
  volumeMaPeriod: 20,
  trendPeriod: 5,
  minScore: 50
})
```

---

### Combining Conditions

Combine multiple conditions with logical operators.

```typescript
import { and, or, not, goldenCross, rsiBelow, rsiAbove, deadCross } from 'trendcraft';

// Entry: Golden Cross AND RSI < 30
const entry = and(goldenCross(), rsiBelow(30));

// Exit: Dead Cross OR RSI > 70
const exit = or(deadCross(), rsiAbove(70));

// Entry: NOT overbought
const notOverbought = not(rsiAbove(70));

// Complex condition
const complexEntry = and(
  goldenCross(),
  rsiBelow(40),
  not(rsiAbove(60))
);

const result = runBacktest(candles, entry, exit, { capital: 1000000 });
```

#### Custom Condition Function

```typescript
// Custom condition function
const customCondition = (
  indicators: Record<string, unknown>,
  candle: NormalizedCandle,
  index: number,
  candles: NormalizedCandle[]
) => {
  // Your custom logic here
  return candle.volume > 1000000 && candle.close > candle.open;
};

const result = runBacktest(candles, customCondition, deadCross(), { capital: 1000000 });
```

---

## Utilities

### Data Normalization

#### `normalizeCandles(candles)`

Convert candles with various date formats to normalized format.

```typescript
import { normalizeCandles } from 'trendcraft';

const normalized = normalizeCandles(candles);
// All timestamps converted to Unix milliseconds
```

---

### Resampling

#### `resample(candles, timeframe)`

Resample candles to different timeframe.

```typescript
import { resample } from 'trendcraft';

const weekly = resample(dailyCandles, 'weekly');
const monthly = resample(dailyCandles, 'monthly');
```

**Supported timeframes:**
- `'weekly'` or `'1w'`
- `'monthly'` or `'1M'`

---

## Types

### Candle Types

```typescript
// Input candle (flexible)
interface Candle {
  time: number | string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Normalized candle
interface NormalizedCandle {
  time: number;  // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### Indicator Types

```typescript
interface IndicatorValue<T> {
  time: number;
  value: T;
}

type Series<T> = IndicatorValue<T>[];

type PriceSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
```

### Signal Types

```typescript
type SignalType = 'bullish' | 'bearish';

interface Signal {
  time: number;
  type: SignalType;
}
```
