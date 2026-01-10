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
- [Signal Scoring](#signal-scoring)
  - [ScoreBuilder](#scorebuilder)
  - [Calculating Scores](#calculating-scores)
  - [Presets](#presets)
  - [Backtest Conditions](#scoring-backtest-conditions)
- [Position Sizing](#position-sizing)
  - [Risk-Based Sizing](#risk-based-sizing)
  - [ATR-Based Sizing](#atr-based-sizing)
  - [Kelly Criterion](#kelly-criterion)
  - [Fixed Fractional](#fixed-fractional)
- [ATR Risk Management](#atr-risk-management)
  - [Chandelier Exit](#chandelier-exit)
  - [ATR Stops](#atr-stops)
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

### Volume Signals

#### `volumeBreakout(candles, options)`

Detect when volume breaks out above N-day high.

```typescript
const signals = volumeBreakout(candles, { period: 20 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `20` | Lookback period for highest volume |

**Returns:** `VolumeBreakoutSignal[]`

```typescript
interface VolumeBreakoutSignal {
  time: number;
  type: 'volume_breakout';
  volume: number;
  previousHigh: number;
  ratio: number;
}
```

---

#### `volumeAccumulation(candles, options)`

Detect volume accumulation phases using linear regression slope.

```typescript
const signals = volumeAccumulation(candles, {
  period: 10,
  minSlope: 0.05,
  minConsecutiveDays: 3,
  minR2: 0.5
});
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `10` | Period for regression calculation |
| `minSlope` | `number` | `0.05` | Minimum normalized slope (5%/day) |
| `minConsecutiveDays` | `number` | `3` | Minimum consecutive days |
| `minR2` | `number` | `0.5` | Minimum R² for regression quality |

**Returns:** `VolumeAccumulationSignal[]`

```typescript
interface VolumeAccumulationSignal {
  time: number;
  type: 'volume_accumulation';
  slope: number;           // Normalized slope
  r2: number;              // R² quality score
  consecutiveDays: number; // Days of accumulation
}
```

---

#### `volumeAboveAverage(candles, options)`

Detect sustained high volume periods where volume is above the N-day moving average for consecutive days.

```typescript
const signals = volumeAboveAverage(candles, {
  period: 20,
  minRatio: 1.2,
  minConsecutiveDays: 3
});
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `20` | Lookback period for average calculation |
| `minRatio` | `number` | `1.0` | Minimum ratio of current to average volume |
| `minConsecutiveDays` | `number` | `3` | Minimum consecutive days above average |

**Returns:** `VolumeAboveAverageSignal[]`

```typescript
interface VolumeAboveAverageSignal {
  time: number;
  type: 'volume_above_average';
  volume: number;           // Current volume
  averageVolume: number;    // N-day average volume
  ratio: number;            // Current / Average (e.g., 1.5 = 150%)
  consecutiveDays: number;  // Days above average
}
```

**Note:** `volumeAboveAverage` uses a simple ratio comparison, while `volumeAccumulation` uses linear regression to detect volume growth trends. Use `volumeAboveAverage` for sustained high activity detection, and `volumeAccumulation` for detecting accelerating volume patterns.

---

#### `volumeMaCross(candles, options)`

Detect volume moving average crossovers.

```typescript
const signals = volumeMaCross(candles, {
  shortPeriod: 5,
  longPeriod: 20
});
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `shortPeriod` | `number` | `5` | Short MA period |
| `longPeriod` | `number` | `20` | Long MA period |

**Returns:** `VolumeMaCrossSignal[]`

```typescript
interface VolumeMaCrossSignal {
  time: number;
  type: 'volume_ma_cross_up' | 'volume_ma_cross_down';
  shortMa: number;
  longMa: number;
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
| `fillMode` | `FillMode` | `'next-bar-open'` | Order fill timing (see below) |
| `slTpMode` | `SlTpMode` | `'close-only'` | Stop loss/take profit evaluation mode (see below) |

#### Look-Ahead Bias Prevention

TrendCraft provides options to prevent look-ahead bias in backtests:

**FillMode** - Controls when orders are executed:
| Mode | Description | Look-Ahead Bias |
|------|-------------|-----------------|
| `'next-bar-open'` | Execute at next bar's open price (default, recommended) | No |
| `'same-bar-close'` | Execute at signal bar's close price (legacy) | Yes |

**SlTpMode** - Controls how stop loss/take profit are evaluated:
| Mode | Description | Look-Ahead Bias |
|------|-------------|-----------------|
| `'close-only'` | Check only against close price (default, recommended) | No |
| `'intraday'` | Check against high/low within the bar (legacy) | Yes |

**Example with bias prevention settings:**

```typescript
const result = runBacktest(candles, entry, exit, {
  capital: 1000000,
  stopLoss: 5,
  takeProfit: 10,
  // Recommended settings (default)
  fillMode: 'next-bar-open',
  slTpMode: 'close-only',
});

// Legacy mode (for comparison with older strategies)
const legacyResult = runBacktest(candles, entry, exit, {
  capital: 1000000,
  stopLoss: 5,
  takeProfit: 10,
  fillMode: 'same-bar-close',
  slTpMode: 'intraday',
});
```

**Returns:** `BacktestResult`

```typescript
interface BacktestResult {
  initialCapital: number;      // Initial capital
  finalCapital: number;        // Final capital
  totalReturn: number;         // Total return amount
  totalReturnPercent: number;  // Total return percentage
  tradeCount: number;          // Number of trades
  winRate: number;             // Win rate (%)
  maxDrawdown: number;         // Maximum drawdown (%)
  sharpeRatio: number;         // Sharpe ratio (annualized)
  profitFactor: number;        // Profit factor
  avgHoldingDays: number;      // Average holding days
  trades: Trade[];             // Trade details
  settings: BacktestSettings;  // Settings used (for reproducibility)
}

interface BacktestSettings {
  fillMode: FillMode;          // Order fill timing mode
  slTpMode: SlTpMode;          // SL/TP evaluation mode
  stopLoss?: number;           // Stop loss percentage
  takeProfit?: number;         // Take profit percentage
  trailingStop?: number;       // Trailing stop percentage
  slippage: number;            // Slippage percentage
  commission: number;          // Fixed commission per trade
  commissionRate: number;      // Commission rate (%)
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

// CMF (Chaikin Money Flow) conditions
cmfAbove(threshold = 0, period = 20)     // CMF > threshold (buying pressure)
cmfBelow(threshold = 0, period = 20)     // CMF < threshold (selling pressure)

// OBV (On-Balance Volume) conditions
obvRising(period = 10)                   // OBV rising over N periods
obvFalling(period = 10)                  // OBV falling over N periods
obvCrossUp(shortPeriod = 5, longPeriod = 20)   // OBV short MA crosses above long MA
obvCrossDown(shortPeriod = 5, longPeriod = 20) // OBV short MA crosses below long MA
```

**CMF (Chaikin Money Flow) Conditions:**

CMF measures buying and selling pressure based on where price closes within the high-low range, weighted by volume. Values range from -1 to +1.

| Function | Description | Trading Use |
|----------|-------------|-------------|
| `cmfAbove(threshold, period)` | CMF above threshold | Accumulation phase, buying pressure |
| `cmfBelow(threshold, period)` | CMF below threshold | Distribution phase, selling pressure |

```typescript
// Detect accumulation phase
const entry = and(
  cmfAbove(0),           // Buying pressure dominant
  priceAboveSma(50),     // Uptrend
);

// Strong buying pressure (CMF > 0.1)
const strongBuy = cmfAbove(0.1, 20);
```

**OBV (On-Balance Volume) Conditions:**

OBV accumulates volume on up/down closes. Rising OBV = buyers in control, falling OBV = sellers in control.

| Function | Description | Trading Use |
|----------|-------------|-------------|
| `obvRising(period)` | OBV trending up over N periods | Accumulation signal |
| `obvFalling(period)` | OBV trending down over N periods | Distribution signal |
| `obvCrossUp(short, long)` | Short OBV MA crosses above long MA | Bullish momentum reversal |
| `obvCrossDown(short, long)` | Short OBV MA crosses below long MA | Bearish momentum reversal |

```typescript
// Confirm accumulation with multiple volume indicators
const entry = and(
  cmfAbove(0),         // CMF positive
  obvRising(10),       // OBV trending up
  volumeRatioAbove(1.2), // Volume above average
);

// OBV momentum turning bullish
const obvBullish = obvCrossUp(5, 20);
```

---

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

## Signal Scoring

Signal Scoring combines multiple technical signals with weighted importance to produce a composite score (0-100).

### ScoreBuilder

Fluent API for building scoring configurations.

```typescript
import { ScoreBuilder, calculateScore } from 'trendcraft';

const config = ScoreBuilder.create()
  .addPOConfirmation(3.0)      // weight: 3.0
  .addRsiOversold(30, 2.0)     // threshold: 30, weight: 2.0
  .addVolumeSpike(1.5, 1.5)    // threshold: 1.5x, weight: 1.5
  .addMacdBullish(1.5)
  .setThresholds(70, 50, 30)   // strong, moderate, weak
  .build();
```

**Builder Methods:**

| Category | Method | Parameters | Description |
|----------|--------|------------|-------------|
| **Momentum** | `addRsiOversold` | threshold?, weight?, period? | RSI below threshold |
| | `addRsiOverbought` | threshold?, weight?, period? | RSI above threshold |
| | `addMacdBullish` | weight? | MACD bullish crossover |
| | `addMacdBearish` | weight? | MACD bearish crossover |
| | `addStochOversold` | threshold?, weight? | Stochastics oversold |
| | `addStochBullishCross` | threshold?, weight? | Stoch %K crosses %D |
| **Trend** | `addPerfectOrderBullish` | weight? | Perfect Order bullish |
| | `addPOConfirmation` | weight? | PO+ confirmation signal |
| | `addPullbackEntry` | maPeriod?, weight? | Pullback to MA |
| | `addGoldenCross` | short?, long?, weight? | Golden cross signal |
| | `addPriceAboveEma` | period?, weight? | Price above EMA |
| **Volume** | `addVolumeSpike` | threshold?, weight? | Volume spike |
| | `addVolumeAnomaly` | zThreshold?, weight? | Statistical anomaly |
| | `addBullishVolumeTrend` | weight? | Volume confirms trend |
| | `addCmfPositive` | threshold?, weight? | CMF positive |
| **Config** | `setThresholds` | strong, moderate, weak | Score thresholds |
| | `addSignal` | SignalDefinition | Custom signal |
| | `addSignals` | SignalDefinition[] | Multiple signals |

---

### Calculating Scores

#### `calculateScore(candles, index, config, context?)`

Calculate composite score at a specific index.

```typescript
const result = calculateScore(candles, candles.length - 1, config);

console.log(result.normalizedScore);  // 0-100
console.log(result.strength);         // 'strong' | 'moderate' | 'weak' | 'none'
console.log(result.activeSignals);    // Number of active signals
```

**Returns:** `ScoreResult`

```typescript
interface ScoreResult {
  rawScore: number;         // Sum of weighted scores
  normalizedScore: number;  // 0-100 normalized score
  maxScore: number;         // Maximum possible score
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  activeSignals: number;    // Count of signals > 0
  totalSignals: number;     // Total signal count
}
```

---

#### `calculateScoreBreakdown(candles, index, config, context?)`

Get detailed breakdown of each signal's contribution.

```typescript
const breakdown = calculateScoreBreakdown(candles, index, config);

for (const c of breakdown.contributions) {
  if (c.isActive) {
    console.log(`${c.displayName}: +${c.score.toFixed(1)}`);
  }
}
```

**Returns:** `ScoreBreakdown`

```typescript
interface ScoreBreakdown extends ScoreResult {
  contributions: SignalContribution[];
}

interface SignalContribution {
  name: string;
  displayName: string;
  rawValue: number;     // 0-1
  score: number;        // rawValue * weight
  weight: number;
  isActive: boolean;
  category?: string;
}
```

---

#### `calculateScoreSeries(candles, config, startIndex?, context?)`

Calculate scores for all candles (useful for charting).

```typescript
const series = calculateScoreSeries(candles, config);
// [{ time: 1234567890, score: ScoreResult }, ...]
```

---

### Presets

Pre-configured scoring strategies for common trading styles.

```typescript
import { getPreset, listPresets } from 'trendcraft';

const config = getPreset('trendFollowing');
const available = listPresets();  // ['momentum', 'meanReversion', 'trendFollowing', 'balanced']
```

| Preset | Focus | Thresholds (S/M/W) | Description |
|--------|-------|-------------------|-------------|
| `momentum` | RSI, MACD, Stoch | 70/50/30 | Momentum-based entries |
| `meanReversion` | Oversold signals | 75/55/35 | Buy dips strategy |
| `trendFollowing` | PO, Volume | 70/50/30 | Trend continuation |
| `balanced` | Mixed | 70/50/30 | Balanced approach |

**Factory functions:**

```typescript
import {
  createMomentumPreset,
  createMeanReversionPreset,
  createTrendFollowingPreset,
  createBalancedPreset,
  createAggressivePreset,      // Lower thresholds: 60/40/25
  createConservativePreset,    // Higher thresholds: 80/60/40
} from 'trendcraft';
```

---

### Scoring Backtest Conditions

Use scores as entry/exit conditions in backtests.

```typescript
import { scoreAbove, scoreBelow, runBacktest } from 'trendcraft';

const entry = scoreAbove(70, config);  // or preset name: scoreAbove(70, 'trendFollowing')
const exit = scoreBelow(30, config);

const result = runBacktest(candles, entry, exit, { capital: 1000000 });
```

**Condition Functions:**

| Function | Parameters | Description |
|----------|------------|-------------|
| `scoreAbove` | threshold, config | Score >= threshold |
| `scoreBelow` | threshold, config | Score <= threshold |
| `scoreStrength` | 'strong'\|'moderate'\|'weak', config | Strength match |
| `minActiveSignals` | count, config | Minimum active signals |
| `scoreWithMinSignals` | threshold, minActive, config | Both conditions |
| `scoreIncreasing` | minIncrease, config | Score increased from previous bar |

---

## Position Sizing

Calculate optimal position sizes based on risk management rules.

### Risk-Based Sizing

Calculate position size from risk amount and stop distance.

```typescript
import { riskBasedSize } from 'trendcraft';

const result = riskBasedSize({
  accountSize: 100000,
  entryPrice: 50,
  stopLossPrice: 48,
  riskPercent: 1,           // Risk 1% of account
  maxPositionPercent: 25,   // Max 25% of account
  minShares: 1,
  roundShares: true,
  direction: 'long',        // 'long' | 'short'
});

// Result:
// {
//   shares: 500,
//   positionValue: 25000,
//   riskAmount: 1000,
//   riskPercent: 1,
//   stopPrice: 48,
//   method: 'risk-based'
// }
```

**Formula:** `shares = riskAmount / stopDistance`

---

### ATR-Based Sizing

Use ATR to dynamically set stop distance.

```typescript
import { atrBasedSize } from 'trendcraft';

const result = atrBasedSize({
  accountSize: 100000,
  entryPrice: 50,
  atrValue: 2.5,
  atrMultiplier: 2,     // Stop at 2x ATR
  riskPercent: 1,
  direction: 'long',
});

// stopPrice: 45 (50 - 2.5 * 2)
// shares: 200 (1000 / 5)
```

**Utility functions:**

```typescript
import { calculateAtrStopDistance, recommendedAtrMultiplier } from 'trendcraft';

const stopDistance = calculateAtrStopDistance(2.5, 2);  // 5
const multiplier = recommendedAtrMultiplier('conservative');  // 2.5-3.0
```

---

### Kelly Criterion

Optimal bet sizing based on win rate and payoff ratio.

```typescript
import { kellySize, calculateKellyPercent } from 'trendcraft';

// Calculate optimal Kelly percentage
const kellyPct = calculateKellyPercent(0.6, 1.5);  // 60% win rate, 1.5 win/loss ratio
// 33.3% (Kelly = winRate - (1 - winRate) / winLossRatio)

const result = kellySize({
  accountSize: 100000,
  entryPrice: 50,
  winRate: 0.6,
  winLossRatio: 1.5,
  kellyFraction: 0.5,     // Half-Kelly (safer)
  maxKellyPercent: 25,    // Cap at 25%
});
```

---

### Fixed Fractional

Simple fixed percentage allocation.

```typescript
import { fixedFractionalSize, maxPositions, fractionForPositionCount } from 'trendcraft';

const result = fixedFractionalSize({
  accountSize: 100000,
  entryPrice: 50,
  fractionPercent: 10,      // 10% per position
  maxPositionPercent: 20,   // Cap
});

// Utility functions
const positions = maxPositions(100000, 10);  // 10 positions at 10%
const fraction = fractionForPositionCount(5);  // 20% for 5 positions
```

---

## ATR Risk Management

Dynamic stop-loss and take-profit levels based on ATR.

### Chandelier Exit

Trailing stop indicator based on highest high minus ATR.

```typescript
import { chandelierExit } from 'trendcraft';

const result = chandelierExit(candles, {
  period: 22,
  multiplier: 3.0,
});

const latest = result[result.length - 1].value;
// {
//   longExit: 95.5,       // Stop for long positions
//   shortExit: 105.2,     // Stop for short positions
//   direction: 1,         // 1 = bullish, -1 = bearish
//   isCrossover: false,   // True on direction change
// }
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `22` | ATR and highest/lowest period |
| `multiplier` | `number` | `3.0` | ATR multiplier for stop distance |

---

### ATR Stops

Calculate stop and take-profit levels from ATR.

```typescript
import { calculateAtrStops } from 'trendcraft';

const stops = calculateAtrStops(candles, {
  atrPeriod: 14,
  stopMultiplier: 2.5,
  takeProfitMultiplier: 4.0,
});

const latest = stops[stops.length - 1].value;
// {
//   atr: 2.5,
//   stopDistance: 6.25,      // 2.5 * 2.5
//   takeProfitDistance: 10,  // 2.5 * 4.0
//   longStop: 93.75,         // close - stopDistance
//   longTakeProfit: 110,     // close + takeProfitDistance
//   shortStop: 106.25,       // close + stopDistance
//   shortTakeProfit: 90,     // close - takeProfitDistance
// }
```

**Backtest integration:**

```typescript
const result = runBacktest(candles, entry, exit, {
  capital: 1000000,
  atrRisk: {
    atrPeriod: 14,
    atrStopMultiplier: 2.5,
    atrTakeProfitMultiplier: 4.0,
    atrTrailingMultiplier: 2.0,
    useEntryAtr: true,  // Use ATR at entry vs dynamic
  },
});
```

---

## Volatility Regime

#### `volatilityRegime(candles, options)`

Classify market volatility into regimes using ATR and Bollinger Bandwidth percentiles.

```typescript
const regimes = volatilityRegime(candles);
const currentRegime = regimes[regimes.length - 1].value.regime;

if (currentRegime === 'low') {
  // Consider range-bound strategies
} else if (currentRegime === 'high' || currentRegime === 'extreme') {
  // Consider wider stops, smaller position sizes
}
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `atrPeriod` | `number` | `14` | ATR period |
| `bbPeriod` | `number` | `20` | Bollinger Bands period |
| `lookbackPeriod` | `number` | `100` | Lookback for percentile calculation |
| `thresholds.low` | `number` | `25` | Low volatility threshold (percentile) |
| `thresholds.high` | `number` | `75` | High volatility threshold (percentile) |
| `thresholds.extreme` | `number` | `95` | Extreme volatility threshold (percentile) |

**Returns:** `Series<VolatilityRegimeValue>`

```typescript
type VolatilityRegime = 'low' | 'normal' | 'high' | 'extreme';

interface VolatilityRegimeValue {
  regime: VolatilityRegime;           // Current regime classification
  atrPercentile: number | null;       // ATR percentile (0-100)
  bandwidthPercentile: number | null; // Bollinger Bandwidth percentile (0-100)
  historicalVol: number | null;       // Annualized historical volatility (%)
  atr: number | null;                 // Current ATR value
  bandwidth: number | null;           // Current Bollinger Bandwidth
  confidence: number;                 // Confidence level (0-1)
}
```

---

### Volatility Regime Conditions

Use these conditions to filter trades by market volatility environment.

| Condition | Description |
|-----------|-------------|
| `regimeIs(regime)` | Current regime matches the specified regime |
| `regimeNot(regime)` | Current regime does NOT match the specified regime |
| `volatilityAbove(percentile)` | Average percentile >= threshold |
| `volatilityBelow(percentile)` | Average percentile <= threshold |
| `atrPercentileAbove(percentile)` | ATR percentile >= threshold |
| `atrPercentileBelow(percentile)` | ATR percentile <= threshold |
| `regimeConfidenceAbove(confidence)` | Regime classification confidence >= threshold |
| `volatilityExpanding(threshold, lookback)` | Volatility increasing from recent past |
| `volatilityContracting(threshold, lookback)` | Volatility decreasing from recent past |
| `atrPercentAbove(threshold)` | ATR% >= threshold (default: 2.3) |
| `atrPercentBelow(threshold)` | ATR% <= threshold |

**Example:**

```typescript
import { regimeIs, regimeNot, atrPercentAbove, and, goldenCross } from 'trendcraft';

// Only enter trades in low volatility environment
const entry = and(
  regimeIs('low'),
  rsiBelow(30)
);

// Avoid extreme volatility
const entry = and(
  regimeNot('extreme'),
  goldenCross()
);

// Filter by ATR% for trend-following (volatile stocks only)
const entry = and(
  atrPercentAbove(2.3),
  perfectOrderBullish()
);
```

---

## Optimization

### `gridSearch(candles, strategyFactory, paramRanges, options)`

Grid search for optimal strategy parameters.

```typescript
import { gridSearch, param, constraint, goldenCross, deadCross } from 'trendcraft';

const result = gridSearch(
  candles,
  (params) => ({
    entry: goldenCross(params.short, params.long),
    exit: deadCross(params.short, params.long),
  }),
  [
    param('short', [5, 10, 15, 20]),
    param('long', [25, 50, 75]),
  ],
  {
    metric: 'sharpeRatio',
    constraints: [
      constraint('winRate', '>=', 40),
      constraint('maxDrawdown', '<=', 30),
    ],
    topN: 10,
  }
);

console.log('Best parameters:', result.results[0].parameters);
console.log('Sharpe ratio:', result.results[0].metrics.sharpeRatio);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `metric` | `OptimizationMetric` | `'sharpeRatio'` | Target metric to optimize |
| `constraints` | `OptimizationConstraint[]` | `[]` | Constraints to filter results |
| `topN` | `number` | `10` | Number of top results to return |
| `capital` | `number` | `1000000` | Initial capital for backtests |

**Metrics:** `'sharpeRatio' | 'calmarRatio' | 'recoveryFactor' | 'totalReturn' | 'winRate' | 'profitFactor'`

**Returns:** `GridSearchResult`

```typescript
interface GridSearchResult {
  results: OptimizationResultEntry[];
  totalCombinations: number;
  passedConstraints: number;
  bestParameters: Record<string, number>;
  bestMetrics: Record<string, number>;
}
```

---

### `walkForwardAnalysis(candles, strategyFactory, paramRanges, options)`

Walk-forward analysis for out-of-sample validation.

```typescript
import { walkForwardAnalysis, param } from 'trendcraft';

const result = walkForwardAnalysis(
  candles,
  strategyFactory,
  paramRanges,
  {
    inSampleRatio: 0.7,    // 70% in-sample, 30% out-of-sample
    periods: 5,            // 5 walk-forward periods
    metric: 'sharpeRatio',
  }
);

console.log('Out-of-sample results:', result.outOfSampleResults);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `inSampleRatio` | `number` | `0.7` | Ratio of data for in-sample optimization |
| `periods` | `number` | `5` | Number of walk-forward periods |
| `metric` | `OptimizationMetric` | `'sharpeRatio'` | Metric to optimize |

---

### `combinationSearch(candles, entryPool, exitPool, options)`

Search for optimal entry/exit condition combinations.

```typescript
import {
  combinationSearch,
  createEntryConditionPool,
  createExitConditionPool
} from 'trendcraft';

const entryPool = createEntryConditionPool();  // Default entry conditions
const exitPool = createExitConditionPool();    // Default exit conditions

const result = combinationSearch(candles, entryPool, exitPool, {
  metric: 'sharpeRatio',
  topN: 20,
});

result.results.forEach((r) => {
  console.log(`Entry: ${r.entryName}, Exit: ${r.exitName}`);
  console.log(`Sharpe: ${r.metrics.sharpeRatio}`);
});
```

---

### Optimization Metrics

```typescript
import {
  calculateSharpeRatio,
  calculateCalmarRatio,
  calculateRecoveryFactor,
  annualizeReturn,
  calculateAllMetrics
} from 'trendcraft';

// Calculate individual metrics
const sharpe = calculateSharpeRatio(returns, riskFreeRate);
const calmar = calculateCalmarRatio(totalReturn, maxDrawdown, years);
const recovery = calculateRecoveryFactor(totalReturn, maxDrawdown);

// Calculate all metrics at once
const metrics = calculateAllMetrics(backtestResult);
```

---

### `runMonteCarloSimulation(result, options)`

Monte Carlo simulation to test if backtest results are statistically significant or just lucky.

```typescript
import { runMonteCarloSimulation, formatMonteCarloResult } from 'trendcraft';

const mcResult = runMonteCarloSimulation(backtestResult, {
  simulations: 1000,
  seed: 42,              // Optional: for reproducibility
  confidenceLevel: 0.95,
});

console.log(formatMonteCarloResult(mcResult));
// => p=0.023, SIGNIFICANT - Strategy shows statistically significant edge
```

**How it works:**
1. Shuffles the trade sequence 1000 times (configurable)
2. Recalculates metrics (Sharpe, MaxDrawdown, etc.) for each shuffle
3. Computes p-value: probability of achieving original result by chance
4. If p < 0.05, the strategy is statistically significant

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `simulations` | `number` | `1000` | Number of shuffle simulations |
| `seed` | `number` | - | Random seed for reproducibility |
| `confidenceLevel` | `number` | `0.95` | Confidence level for intervals |
| `progressCallback` | `function` | - | Progress callback (current, total) |

**Returns:** `MonteCarloResult`

```typescript
interface MonteCarloResult {
  originalResult: {
    sharpe: number;
    maxDrawdown: number;
    totalReturnPercent: number;
    profitFactor: number;
  };
  statistics: {
    sharpe: MetricStatistics;
    maxDrawdown: MetricStatistics;
    totalReturnPercent: MetricStatistics;
    profitFactor: MetricStatistics;
  };
  simulationCount: number;
  pValue: { sharpe: number; returns: number };
  confidenceInterval: {
    sharpe: { lower: number; upper: number };
    returns: { lower: number; upper: number };
    maxDrawdown: { lower: number; upper: number };
  };
  assessment: {
    isSignificant: boolean;
    reason: string;
    confidenceLevel: number;
  };
}

interface MetricStatistics {
  mean: number;
  median: number;
  stdDev: number;
  percentile5: number;
  percentile25: number;
  percentile75: number;
  percentile95: number;
  min: number;
  max: number;
}
```

**Helper functions:**

```typescript
import { summarizeMonteCarloResult, calculateStatistics } from 'trendcraft';

// Get summary
const summary = summarizeMonteCarloResult(mcResult);
console.log(summary.isSignificant);    // true
console.log(summary.pValueSharpe);     // 0.023

// Calculate statistics for any array
const stats = calculateStatistics([1, 2, 3, 4, 5]);
console.log(stats.mean);    // 3
console.log(stats.median);  // 3
```

---

### `anchoredWalkForwardAnalysis(candles, entryPool, exitPool, options)`

Anchored Walk-Forward (AWF) analysis for robust strategy validation. Unlike rolling walk-forward, AWF keeps the training start date fixed and progressively expands the training period.

```typescript
import { anchoredWalkForwardAnalysis, formatAWFResult } from 'trendcraft';

const awfResult = anchoredWalkForwardAnalysis(
  candles,
  entryConditions,
  exitConditions,
  {
    anchorDate: new Date('2015-01-01').getTime(),
    initialTrainSize: 504,   // ~2 years
    expansionStep: 252,      // Expand by 1 year
    testSize: 252,           // Test on 1 year
    metric: 'sharpe',
  }
);

console.log(formatAWFResult(awfResult));
```

**How it works:**

```
Period 1: Train 2015-01-01 ~ 2017-12-31 → Test 2018
Period 2: Train 2015-01-01 ~ 2018-12-31 → Test 2019
Period 3: Train 2015-01-01 ~ 2019-12-31 → Test 2020
...
```

Each period:
1. Runs `combinationSearch` on training data to find best conditions
2. Tests those conditions on out-of-sample data
3. Tracks which conditions appear consistently

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `anchorDate` | `number` | required | Fixed start date (epoch ms) |
| `initialTrainSize` | `number` | `504` | Initial training period (~2 years) |
| `expansionStep` | `number` | `252` | Training period expansion (~1 year) |
| `testSize` | `number` | `252` | Test period size (~1 year) |
| `metric` | `OptimizationMetric` | `'sharpe'` | Metric to optimize |
| `constraints` | `OptimizationConstraint[]` | `[]` | Constraints for optimization |
| `progressCallback` | `function` | - | Progress callback (period, total, phase) |

**Returns:** `AWFResult`

```typescript
interface AWFResult {
  periods: AWFPeriod[];
  aggregateMetrics: {
    avgInSample: Record<OptimizationMetric, number>;
    avgOutOfSample: Record<OptimizationMetric, number>;
    stabilityRatio: number;      // OOS / IS performance ratio
    oosReturnStdDev: number;     // OOS return volatility
  };
  stabilityAnalysis: {
    conditionFrequency: Record<string, number>;  // Condition appearance %
    stableEntryConditions: string[];   // Appear in >50% of periods
    stableExitConditions: string[];
    consistencyScore: number;          // 0-100
  };
  recommendation: {
    useOptimized: boolean;
    entryConditions: string[];
    exitConditions: string[];
    reason: string;
  };
}

interface AWFPeriod {
  periodNumber: number;
  trainStart: number;
  trainEnd: number;
  trainCandleCount: number;
  testStart: number;
  testEnd: number;
  testCandleCount: number;
  bestEntryConditions: string[];
  bestExitConditions: string[];
  inSampleMetrics: Record<OptimizationMetric, number>;
  outOfSampleMetrics: Record<OptimizationMetric, number>;
  testBacktest: BacktestResult;
}
```

**Helper functions:**

```typescript
import {
  generateAWFBoundaries,
  calculateAWFPeriodCount,
  summarizeAWFResult,
  getAWFEquityCurve
} from 'trendcraft';

// Calculate how many periods will be generated
const count = calculateAWFPeriodCount(candles.length, 0, 504, 252, 252);

// Get boundaries without running full analysis
const boundaries = generateAWFBoundaries(candles, options);

// Get summary
const summary = summarizeAWFResult(awfResult);
console.log(summary.stabilityRatio);        // 0.72 (72% of IS performance)
console.log(summary.profitablePeriods);     // 4 (out of 5)
console.log(summary.recommendedEntry);      // ['gc', 'stochUp']

// Get equity curve from OOS results
const curve = getAWFEquityCurve(awfResult, 1000000);
// [{ time: ..., equity: 1050000, periodNumber: 1 }, ...]
```

**Comparison with Rolling Walk-Forward:**

| Aspect | Rolling WF | Anchored WF |
|--------|------------|-------------|
| Training start | Slides forward | **Fixed** |
| Training end | Slides forward | **Expands** |
| Old data usage | Discarded | **Accumulated** |
| Best for | Short-term patterns | **Long-term robustness** |

---

## Scaled Entry

### `runBacktestScaled(candles, entry, exit, options)`

Backtest with split/scaled entry strategies. Instead of entering a full position at once, capital is divided into multiple tranches.

```typescript
import { runBacktestScaled, goldenCross, deadCross } from 'trendcraft';

const result = runBacktestScaled(candles, goldenCross(), deadCross(), {
  capital: 1000000,
  scaledEntry: {
    tranches: 3,
    strategy: 'pyramid',      // 50%, 33%, 17%
    intervalType: 'price',
    priceInterval: -2,        // Add on 2% dips
  },
});
```

**ScaledEntryConfig:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tranches` | `number` | required | Number of entry tranches (2-10) |
| `strategy` | `'equal' \| 'pyramid' \| 'reverse-pyramid'` | `'equal'` | Weight distribution strategy |
| `intervalType` | `'signal' \| 'price'` | `'signal'` | How to trigger additional entries |
| `priceInterval` | `number` | `-2` | Price change % for next tranche (negative = dip) |

**Strategies:**
| Strategy | Description | Example (3 tranches) |
|----------|-------------|---------------------|
| `equal` | Equal weight per tranche | 33%, 33%, 33% |
| `pyramid` | Larger weight for earlier tranches | 50%, 33%, 17% |
| `reverse-pyramid` | Larger weight for later tranches | 17%, 33%, 50% |

**Interval Types:**
| Type | Trigger |
|------|---------|
| `signal` | Add tranche on each entry signal |
| `price` | Add tranche when price drops by `priceInterval` % from first entry |

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
