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
  - [Range-Bound Detection](#range-bound-detection)
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

#### `parabolicSar(candles, options)`

Parabolic SAR (Stop and Reverse) trend-following indicator.

```typescript
const result = parabolicSar(candles);
const custom = parabolicSar(candles, { step: 0.01, max: 0.1 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `step` | `number` | `0.02` | Acceleration Factor increment |
| `max` | `number` | `0.2` | Maximum Acceleration Factor |

**Returns:** `Series<ParabolicSarValue>`

```typescript
interface ParabolicSarValue {
  sar: number | null;       // SAR value
  direction: 1 | -1 | 0;    // 1 = bullish (SAR below), -1 = bearish (SAR above), 0 = undefined
  isReversal: boolean;      // True when trend reverses
  af: number | null;        // Current Acceleration Factor
  ep: number | null;        // Extreme Point (highest high or lowest low)
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

#### `keltnerChannel(candles, options)`

Keltner Channel volatility envelope using EMA and ATR.

```typescript
const result = keltnerChannel(candles);
const custom = keltnerChannel(candles, { emaPeriod: 20, atrPeriod: 10, multiplier: 2 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `emaPeriod` | `number` | `20` | EMA period for the middle line |
| `atrPeriod` | `number` | `10` | ATR period for band calculation |
| `multiplier` | `number` | `2` | ATR multiplier for band width |

**Returns:** `Series<KeltnerChannelValue>`

```typescript
interface KeltnerChannelValue {
  upper: number | null;   // Upper band (EMA + multiplier * ATR)
  middle: number | null;  // Middle line (EMA)
  lower: number | null;   // Lower band (EMA - multiplier * ATR)
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

#### `cmf(candles, options)`

Chaikin Money Flow - measures buying and selling pressure over a period.

```typescript
const result = cmf(candles);
const custom = cmf(candles, { period: 21 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `20` | CMF period |

**Returns:** `Series<number | null>` (-1 to +1 scale)

**Interpretation:**
- Positive values indicate buying pressure (accumulation)
- Negative values indicate selling pressure (distribution)
- Values above +0.1 suggest strong buying pressure
- Values below -0.1 suggest strong selling pressure

---

#### `volumeAnomaly(candles, options)`

Detect unusual volume spikes using statistical methods.

```typescript
const result = volumeAnomaly(candles);
const custom = volumeAnomaly(candles, { period: 20, highThreshold: 2.0, extremeThreshold: 3.0 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `20` | Period for average volume calculation |
| `highThreshold` | `number` | `2.0` | Ratio threshold for "high" volume |
| `extremeThreshold` | `number` | `3.0` | Ratio threshold for "extreme" volume |

**Returns:** `Series<VolumeAnomalyValue>`

```typescript
interface VolumeAnomalyValue {
  volume: number;           // Current volume
  avgVolume: number;        // Average volume over period
  ratio: number;            // Current / Average ratio
  isAnomaly: boolean;       // True if ratio exceeds threshold
  level: 'normal' | 'high' | 'extreme' | null;  // Anomaly level
  zScore: number | null;    // Z-score for statistical significance
}
```

---

#### `volumeProfile(candles, options)`

Calculate Volume Profile with Point of Control (POC) and Value Area.

```typescript
const result = volumeProfile(candles);
const custom = volumeProfile(candles, { period: 20, numLevels: 24, valueAreaPercent: 70 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `20` | Lookback period |
| `numLevels` | `number` | `24` | Number of price levels |
| `valueAreaPercent` | `number` | `70` | Percentage for Value Area calculation |

**Returns:** `VolumeProfileValue`

```typescript
interface VolumeProfileValue {
  levels: VolumePriceLevel[];  // Volume at each price level
  poc: number;                 // Point of Control (highest volume price)
  vah: number;                 // Value Area High
  val: number;                 // Value Area Low
  periodHigh: number;          // Period high price
  periodLow: number;           // Period low price
}

interface VolumePriceLevel {
  priceMin: number;
  priceMax: number;
  volume: number;
  percentage: number;  // Percentage of total volume
}
```

---

#### `volumeProfileSeries(candles, options)`

Calculate Volume Profile as a time series (rolling window).

```typescript
const result = volumeProfileSeries(candles, { period: 20 });
```

**Returns:** `Series<VolumeProfileValue | null>`

---

#### `volumeTrend(candles, options)`

Analyze whether volume confirms or diverges from price trend.

```typescript
const result = volumeTrend(candles);
const custom = volumeTrend(candles, { pricePeriod: 10, volumePeriod: 10, maPeriod: 20 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pricePeriod` | `number` | `10` | Period for price trend detection |
| `volumePeriod` | `number` | `10` | Period for volume trend detection |
| `maPeriod` | `number` | `20` | Period for volume MA baseline |
| `minPriceChange` | `number` | `2.0` | Minimum price change % for trend |

**Returns:** `Series<VolumeTrendValue>`

```typescript
interface VolumeTrendValue {
  priceTrend: 'up' | 'down' | 'neutral';    // Price direction
  volumeTrend: 'up' | 'down' | 'neutral';   // Volume direction
  isConfirmed: boolean;                      // Volume confirms price trend
  hasDivergence: boolean;                    // Volume diverges from price
  confidence: number;                        // Confidence score (0-100)
}
```

**Interpretation:**
- **Confirmed uptrend**: Price rising + volume increasing
- **Confirmed downtrend**: Price falling + volume increasing (strong selling)
- **Bullish divergence**: Price falling + volume decreasing (selling exhaustion)
- **Bearish divergence**: Price rising + volume decreasing (weak rally)

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

### Range-Bound Detection

#### `rangeBound(candles, options?)`

Detect range-bound (sideways) market conditions.

```typescript
const rb = rangeBound(candles, { persistBars: 3 });
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dmiPeriod` | `number` | `14` | DMI/ADX period |
| `bbPeriod` | `number` | `20` | Bollinger Bands period |
| `donchianPeriod` | `number` | `20` | Donchian Channel period |
| `atrPeriod` | `number` | `14` | ATR period |
| `adxWeight` | `number` | `0.50` | ADX score weight |
| `bandwidthWeight` | `number` | `0.20` | Bandwidth score weight |
| `donchianWeight` | `number` | `0.20` | Donchian score weight |
| `atrWeight` | `number` | `0.10` | ATR score weight |
| `adxThreshold` | `number` | `20` | ADX below this = range |
| `adxTrendThreshold` | `number` | `25` | ADX above this = trending |
| `rangeScoreThreshold` | `number` | `70` | Score threshold for range detection |
| `tightRangeThreshold` | `number` | `85` | Score threshold for tight range |
| `breakoutRiskZone` | `number` | `0.1` | Zone near boundary for breakout risk (10%) |
| `persistBars` | `number` | `3` | Bars required for confirmation |
| `lookbackPeriod` | `number` | `100` | Lookback for percentile calculations |
| `priceMovementPeriod` | `number` | `20` | Period for price movement calculation |
| `priceMovementThreshold` | `number` | `0.05` | 5% price movement = trending |
| `diDifferenceThreshold` | `number` | `10` | +DI/-DI difference for trend |
| `slopeThreshold` | `number` | `0.15` | Regression slope threshold (ATR ratio) |
| `consecutiveHHLLThreshold` | `number` | `3` | Consecutive HH/LL for trend |
| `hhllLookback` | `number` | `10` | Lookback for HH/LL detection |

**Returns:** `Series<RangeBoundValue>`

**RangeBoundValue properties:**

| Property | Type | Description |
|----------|------|-------------|
| `state` | `RangeBoundState` | Current state |
| `rangeScore` | `number` | Composite score (0-100) |
| `confidence` | `number` | Confidence level (0-1) |
| `persistCount` | `number` | Consecutive bars in current state |
| `isConfirmed` | `boolean` | True if persistCount >= persistBars |
| `rangeDetected` | `boolean` | Event: range conditions first detected |
| `rangeConfirmed` | `boolean` | Event: range first confirmed |
| `breakoutRiskDetected` | `boolean` | Event: breakout risk first detected |
| `rangeBroken` | `boolean` | Event: transition from range to trend |
| `adx` | `number \| null` | ADX value |
| `rangeHigh` | `number \| null` | Upper range boundary |
| `rangeLow` | `number \| null` | Lower range boundary |
| `pricePosition` | `number \| null` | Position within range (0=low, 1=high) |
| `trendReason` | `TrendReason` | Why market is trending (debug) |

**RangeBoundState values:**

| State | Description |
|-------|-------------|
| `NEUTRAL` | Insufficient data or mixed signals |
| `RANGE_FORMING` | Range conditions starting |
| `RANGE_CONFIRMED` | Range confirmed after persistBars |
| `RANGE_TIGHT` | Very tight range |
| `BREAKOUT_RISK_UP` | Price near upper boundary |
| `BREAKOUT_RISK_DOWN` | Price near lower boundary |
| `TRENDING` | Market is trending |

**TrendReason values:**

| Reason | Description |
|--------|-------------|
| `adx_high` | ADX >= adxTrendThreshold |
| `price_movement` | Price moved >= threshold |
| `di_diff` | +DI/-DI difference >= threshold |
| `slope` | Regression slope >= threshold |
| `hhll` | Consecutive HH or LL >= threshold |
| `null` | Not trending |

**Example:**

```typescript
import { rangeBound } from 'trendcraft';

const rb = rangeBound(candles);
const latest = rb[rb.length - 1].value;

// Check current state
console.log(`State: ${latest.state}`);
console.log(`Score: ${latest.rangeScore}/100`);

// Check range boundaries
if (latest.rangeHigh && latest.rangeLow) {
  console.log(`Range: ${latest.rangeLow} - ${latest.rangeHigh}`);
  console.log(`Position: ${(latest.pricePosition * 100).toFixed(0)}%`);
}

// Debug trend detection
if (latest.trendReason) {
  console.log(`Trending due to: ${latest.trendReason}`);
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

#### Range-Bound Conditions

```typescript
inRangeBound()       // Currently in any range state
rangeForming()       // Range conditions starting
rangeConfirmed()     // Range has been confirmed
rangeBreakout()      // Transitioning from range to trend
tightRange()         // In a very tight range
breakoutRiskUp()     // Price near upper boundary
breakoutRiskDown()   // Price near lower boundary
rangeScoreAbove(70)  // Range score above threshold
```

#### Advanced Volume Conditions

```typescript
// Volume Anomaly conditions
volumeAnomalyCondition(threshold = 2.0)  // Volume anomaly detected
volumeExtreme()                           // Extreme volume spike
volumeRatioAbove(ratio)                   // Volume ratio above threshold

// Volume Profile conditions
nearPoc(tolerance = 0.02)     // Price near Point of Control (2% default)
inValueArea()                 // Price within Value Area (VAL-VAH)
breakoutVah()                 // Price breaks above Value Area High
breakdownVal()                // Price breaks below Value Area Low
priceAbovePoc()               // Price above POC
priceBelowPoc()               // Price below POC

// Volume Trend conditions
volumeConfirmsTrend()                    // Volume confirms price trend
volumeDivergence()                       // Volume diverges from price
bullishVolumeDivergence()                // Bullish volume divergence
bearishVolumeDivergence()                // Bearish volume divergence
volumeTrendConfidence(minConfidence)     // Confidence above threshold
```

#### Multi-Timeframe (MTF) Conditions

MTF conditions allow you to filter trades based on higher timeframe indicators.

```typescript
// Weekly RSI conditions
weeklyRsiAbove(threshold, period = 14)   // Weekly RSI > threshold
weeklyRsiBelow(threshold, period = 14)   // Weekly RSI < threshold

// Monthly RSI conditions
monthlyRsiAbove(threshold, period = 14)  // Monthly RSI > threshold
monthlyRsiBelow(threshold, period = 14)  // Monthly RSI < threshold

// Generic MTF RSI
mtfRsiAbove(timeframe, threshold, period = 14)  // MTF RSI > threshold
mtfRsiBelow(timeframe, threshold, period = 14)  // MTF RSI < threshold

// Weekly SMA conditions
weeklyPriceAboveSma(period)   // Price > weekly SMA
weeklyPriceBelowSma(period)   // Price < weekly SMA

// Monthly SMA conditions
monthlyPriceAboveSma(period)  // Price > monthly SMA
monthlyPriceBelowSma(period)  // Price < monthly SMA

// Generic MTF SMA
mtfPriceAboveSma(timeframe, period)  // Price > MTF SMA
mtfPriceBelowSma(timeframe, period)  // Price < MTF SMA

// Weekly EMA conditions
weeklyPriceAboveEma(period)   // Price > weekly EMA
mtfPriceAboveEma(timeframe, period)  // Price > MTF EMA

// Trend conditions
weeklyUptrend(smaPeriod = 20)    // Weekly price > weekly SMA
weeklyDowntrend(smaPeriod = 20)  // Weekly price < weekly SMA
mtfUptrend(timeframe, smaPeriod = 20)    // MTF uptrend
mtfDowntrend(timeframe, smaPeriod = 20)  // MTF downtrend

// Strong trend (ADX-based)
weeklyTrendStrong(adxThreshold = 25)   // Weekly ADX > threshold
monthlyTrendStrong(adxThreshold = 25)  // Monthly ADX > threshold
mtfTrendStrong(timeframe, adxThreshold = 25)  // MTF ADX > threshold

// Custom MTF condition
mtfCondition(timeframe, conditionFn)  // Custom condition on MTF data
```

**Usage with Fluent API:**

```typescript
import { TrendCraft, weeklyRsiAbove, goldenCrossCondition, and } from 'trendcraft';

const result = TrendCraft.from(dailyCandles)
  .withMtf(['weekly'])  // Enable weekly timeframe
  .strategy()
    .entry(and(
      weeklyRsiAbove(50),        // Weekly RSI > 50
      goldenCrossCondition()     // Daily golden cross
    ))
    .exit(deadCrossCondition())
  .backtest({ capital: 1000000 });
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
