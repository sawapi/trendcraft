# TrendCraft API Reference

## Table of Contents

- [Indicators](#indicators)
  - [Moving Averages](#moving-averages)
  - [Trend](#trend)
  - [Momentum](#momentum)
  - [Volatility](#volatility)
  - [Volume](#volume)
  - [Relative Strength](#relative-strength)
  - [Price](#price)
  - [S/R Zone Clustering](#sr-zone-clustering)
  - [Fibonacci Retracement](#fibonacci-retracement)
  - [Smart Money Concepts (SMC)](#smart-money-concepts-smc)
  - [Session / Kill Zones](#session--kill-zones)
  - [HMM Regime Detection](#hmm-regime-detection)
- [Signals](#signals)
  - [Cross Detection](#cross-detection)
  - [Divergence Detection](#divergence-detection)
  - [CVD Divergence](#cvd-divergence)
  - [Squeeze Detection](#squeeze-detection)
  - [Range-Bound Detection](#range-bound-detection)
  - [Price Patterns](#price-patterns)
- [Backtesting](#backtesting)
  - [Running Backtest](#running-backtest)
  - [Preset Conditions](#preset-conditions)
  - [Combining Conditions](#combining-conditions)
- [Utilities](#utilities)
  - [Data Normalization](#data-normalization)
  - [Price Source Helpers](#price-source-helpers)
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
- [Volatility Regime](#volatility-regime)
- [Optimization](#optimization)
  - [Grid Search](#gridsearchcandles-strategyfactory-paramranges-options)
  - [Walk-Forward Analysis](#walkforwardanalysiscandles-strategyfactory-paramranges-options)
  - [Combination Search](#combinationsearchcandles-entrypool-exitpool-options)
  - [Monte Carlo Simulation](#runmontecarlosimulationresult-options)
  - [Anchored Walk-Forward Analysis](#anchoredwalkforwardanalysiscandles-entrypool-exitpool-options)
- [Scaled Entry](#scaled-entry)
- [Streaming](#streaming)
  - [Layer 1: Candle Aggregation](#layer-1-candle-aggregation)
  - [Layer 2: Signal Detectors](#layer-2-signal-detectors)
  - [Layer 3: Conditions](#layer-3-conditions)
  - [Layer 4: Pipeline & MTF](#layer-4-pipeline--mtf)
  - [Layer 5: Session & Guards](#layer-5-session--guards)
  - [Layer 6: Position Management](#layer-6-position-management)
- [Trade Signals](#trade-signals)
  - [TradeSignal Type](#tradesignal-type)
  - [Signal Converters](#signal-converters)
  - [Signal Emitter](#signal-emitter)
- [Signal Lifecycle](#signal-lifecycle)
  - [SignalManager](#signalmanager)
  - [Batch Processing](#batch-processing)
- [Short Selling](#short-selling)
  - [Backtest Short Selling](#backtest-short-selling)
  - [Streaming Short Selling](#streaming-short-selling)
  - [Portfolio / Batch Short Selling](#portfolio--batch-short-selling)
  - [Short Strategy Recipes](#short-strategy-recipes)
- [Trade Analysis](#trade-analysis)
  - [analyzeDrawdowns](#analyzedrawdownsperiods)
  - [Pattern Projection](#pattern-projection)
- [Data Validation](#data-validation)
  - [validateCandles](#validatecandles)
  - [normalizeAndValidate](#normalizeandvalidate)
  - [Individual Detectors](#individual-detectors)
- [Custom Indicators (Plugin System)](#custom-indicators-plugin-system)
  - [defineIndicator](#defineindicator)
  - [TrendCraft.use()](#trendcraftuse)
  - [Built-in Plugins](#built-in-plugins)
- [Signal Explainability](#signal-explainability)
- [Composable Indicator Algebra](#composable-indicator-algebra)
- [Alpha Decay Monitor](#alpha-decay-monitor)
- [Adaptive Indicators](#adaptive-indicators)
- [Strategy Robustness Score](#strategy-robustness-score)
- [Pairs Trading](#pairs-trading)
- [Cross-Asset Correlation](#cross-asset-correlation)
- [Wyckoff / VSA](#wyckoff--vsa)
- [Risk Analytics](#risk-analytics)
  - [VaR / CVaR](#calculatevarreturns-options)
  - [Rolling VaR](#rollingvarreturns-options)
  - [Risk Parity](#riskparityallocationreturnsseries-options)
  - [Correlation-Adjusted Sizing](#correlationadjustedsizecurrentreturns-portfolioreturns-options)
- [Meta-Strategy](#meta-strategy)
  - [Equity Curve Filter](#applyequitycurvefilterresult-options)
  - [Strategy Rotation](#rotatestrategiesresults-options)
- [Harmonic Pattern Detection](#harmonic-pattern-detection)
- [GARCH Volatility](#garch-volatility)
- [Pareto Multi-Objective Optimization (NSGA-II)](#pareto-multi-objective-optimization-nsga-ii)
- [Backtest Realism](#backtest-realism)
- [Stress Testing](#stress-testing)
- [Strategy JSON Serialization](#strategy-json-serialization)
  - [Pre-built Registries](#pre-built-registries)
  - [ConditionRegistry](#conditionregistry)
  - [Serialize / Parse](#serializestrategystrategy--parsestratejson)
  - [Hydrate / Load](#hydrateconditionspec-registry--loadstrategyjson-registry)
  - [Validate](#validateconditionspecspec-registry--validatestrategyjsonjson)
- [Live Streaming & Series Metadata](#live-streaming--series-metadata)
  - [createLiveCandle](#createlivecandleoptions-fromstate)
  - [livePresets](#livepresets)
  - [indicatorPresets](#indicatorpresets)
  - [tagSeries / SeriesMeta](#tagseries--seriesmeta)
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

#### `hma(candles, options)`

Hull Moving Average — reduces lag while maintaining smoothness using nested WMA calculations.

```typescript
const result = hma(candles);
const custom = hma(candles, { period: 20, source: 'close' });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `9` | HMA period (must be >= 2) |
| `source` | `PriceSource` | `'close'` | Price source |

**Returns:** `Series<number | null>`

**Formula:** `HMA(n) = WMA(2 * WMA(n/2) - WMA(n), sqrt(n))`

---

#### `mcginleyDynamic(candles, options)`

McGinley Dynamic — an adaptive moving average that automatically adjusts speed based on market conditions, reducing lag in fast markets.

```typescript
const result = mcginleyDynamic(candles);
const custom = mcginleyDynamic(candles, { period: 14, k: 0.6 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `14` | Lookback period |
| `k` | `number` | `0.6` | Adjustment constant |
| `source` | `PriceSource` | `'close'` | Price source |

**Returns:** `Series<number | null>`

**Formula:** `MD[i] = MD[i-1] + (Close - MD[i-1]) / (k × period × (Close/MD[i-1])^4)`

---

#### `emaRibbon(candles, options)`

EMA Ribbon — multiple EMAs plotted together to visualize trend strength and direction. Bullish when shorter EMAs are above longer ones.

```typescript
const result = emaRibbon(candles);
const custom = emaRibbon(candles, { periods: [8, 13, 21, 34, 55] });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `periods` | `number[]` | `[8, 13, 21, 34, 55]` | EMA periods (shortest to longest) |
| `source` | `PriceSource` | `'close'` | Price source |

**Returns:** `Series<EmaRibbonValue>`

```typescript
interface EmaRibbonValue {
  values: (number | null)[];    // EMA values (sorted by period, shortest first)
  bullish: boolean | null;      // True if all EMAs in bullish order
  expanding: boolean | null;    // True if ribbon spread is widening
}
```

**Interpretation:**
- **Bullish alignment**: Shorter EMAs above longer EMAs — strong uptrend
- **Bearish alignment**: Shorter EMAs below longer EMAs — strong downtrend
- **Expanding**: Trend is strengthening
- **Contracting**: Trend is weakening or reversing

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

#### `connorsRsi(candles, options)`

Connors RSI — composite momentum oscillator combining RSI, streak RSI, and ROC percentile rank.

```typescript
const result = connorsRsi(candles);
const custom = connorsRsi(candles, { rsiPeriod: 3, streakPeriod: 2, rocPeriod: 100 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rsiPeriod` | `number` | `3` | RSI period for price |
| `streakPeriod` | `number` | `2` | RSI period for up/down streak |
| `rocPeriod` | `number` | `100` | Lookback period for ROC percent rank |

**Returns:** `Series<ConnorsRsiValue>`

```typescript
interface ConnorsRsiValue {
  crsi: number | null;          // Composite Connors RSI (average of 3 components)
  rsi: number | null;           // RSI of price
  streakRsi: number | null;     // RSI of consecutive up/down streak
  rocPercentile: number | null; // Percent rank of 1-period ROC
}
```

**Interpretation:**
- Below 10: Strongly oversold (mean reversion buy signal)
- Above 90: Strongly overbought (mean reversion sell signal)
- CRSI = (RSI + StreakRSI + PercentRank) / 3

---

#### `imi(candles, options)`

Intraday Momentum Index — a variation of RSI using open-to-close price movement with simple rolling sums instead of Wilder's smoothing.

```typescript
const result = imi(candles);
const custom = imi(candles, { period: 14 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `14` | Rolling sum period |

**Returns:** `Series<number | null>` (0-100 scale)

**Formula:** `IMI = 100 × SUM(gains, n) / (SUM(gains, n) + SUM(losses, n))`
- Gain = Close - Open (when Close > Open)
- Loss = Open - Close (when Open > Close)

**Interpretation:**
- Above 70: Overbought (strong intraday buying pressure)
- Below 30: Oversold (strong intraday selling pressure)
- 50: Neutral (equal buying and selling pressure)

---

#### `adxr(candles, options)`

ADXR (Average Directional Movement Index Rating) — smoothed version of ADX providing a lagging confirmation of trend strength.

```typescript
const result = adxr(candles);
const custom = adxr(candles, { period: 14, dmiPeriod: 14, adxPeriod: 14 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `14` | ADXR lookback period |
| `dmiPeriod` | `number` | `14` | DMI calculation period |
| `adxPeriod` | `number` | `14` | ADX smoothing period |

**Returns:** `Series<number | null>`

**Formula:** `ADXR = (ADX[i] + ADX[i - period]) / 2`

**Interpretation:**
- Above 25: Trending market confirmed
- Below 20: Weak trend / ranging market
- Smoother than ADX, fewer false signals

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

#### `choppinessIndex(candles, options)`

Choppiness Index — measures whether the market is choppy (range-bound) or trending.

```typescript
const result = choppinessIndex(candles);
const custom = choppinessIndex(candles, { period: 7 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `14` | Lookback period |

**Returns:** `Series<number | null>` (0-100 scale)

**Formula:** `CHOP = 100 * LOG10(SUM(ATR(1), period) / (Highest High - Lowest Low)) / LOG10(period)`

**Interpretation:**
- Above 61.8: Market is choppy/consolidating — avoid trend-following strategies
- Below 38.2: Market is trending strongly — good for trend-following
- Values oscillate between these extremes

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
| `bandMultipliers` | `number[]` | — | Additional σ-band multipliers (e.g., `[2, 3]` for ±2σ, ±3σ) |

**Returns:** `Series<VwapValue>`

```typescript
interface VwapValue {
  vwap: number | null;   // VWAP value
  upper: number | null;  // Upper band (VWAP + stdDev)
  lower: number | null;  // Lower band (VWAP - stdDev)
  bands?: VwapBand[];    // Additional bands when bandMultipliers is set
}

interface VwapBand {
  upper: number;  // Upper band value
  lower: number;  // Lower band value
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

#### `anchoredVwap(candles, options)`

Anchored VWAP — calculates VWAP from an arbitrary anchor timestamp. Used by institutional investors to determine cost basis from significant events.

```typescript
const result = anchoredVwap(candles, { anchorTime: Date.parse('2024-01-15') });
const withBands = anchoredVwap(candles, { anchorTime: Date.parse('2024-01-15'), bands: 2 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `anchorTime` | `number` | required | Anchor timestamp (ms since epoch) |
| `bands` | `number` | `0` | Number of standard deviation bands (0, 1, or 2) |

**Returns:** `Series<AnchoredVwapValue>`

```typescript
interface AnchoredVwapValue {
  vwap: number | null;     // VWAP value
  upper1?: number | null;  // +1σ band (if bands >= 1)
  lower1?: number | null;  // -1σ band (if bands >= 1)
  upper2?: number | null;  // +2σ band (if bands >= 2)
  lower2?: number | null;  // -2σ band (if bands >= 2)
}
```

---

#### `elderForceIndex(candles, options)`

Elder's Force Index — measures the force behind price movements by combining price change and volume, smoothed with EMA.

```typescript
const result = elderForceIndex(candles);
const custom = elderForceIndex(candles, { period: 13 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `13` | EMA smoothing period |

**Returns:** `Series<number | null>`

**Formula:** `Force = (Close - Previous Close) × Volume`, then smoothed with EMA.

**Interpretation:**
- Positive: Bulls are in control
- Negative: Bears are in control
- Zero-line crossovers signal trend changes

---

#### `easeOfMovement(candles, options)`

Ease of Movement (EMV) — measures the relationship between price change and volume, indicating how easily price moves.

```typescript
const result = easeOfMovement(candles);
const custom = easeOfMovement(candles, { period: 14, volumeDivisor: 10000 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `14` | SMA smoothing period |
| `volumeDivisor` | `number` | `10000` | Volume scaling divisor |

**Returns:** `Series<number | null>`

**Formula:** `EMV = ((H+L)/2 - (prevH+prevL)/2) / ((Volume/divisor) / (H-L))`

**Interpretation:**
- Positive: Price is moving up easily on low volume
- Negative: Price is moving down easily
- Near zero: Price is having difficulty moving (high volume required)

---

#### `klinger(candles, options)`

Klinger Volume Oscillator — compares short-term and long-term volume force to identify long-term money flow trends.

```typescript
const result = klinger(candles);
const custom = klinger(candles, { shortPeriod: 34, longPeriod: 55, signalPeriod: 13 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `shortPeriod` | `number` | `34` | Short EMA period |
| `longPeriod` | `number` | `55` | Long EMA period |
| `signalPeriod` | `number` | `13` | Signal line EMA period |

**Returns:** `Series<KlingerValue>`

```typescript
interface KlingerValue {
  kvo: number | null;        // KVO line (short EMA - long EMA of Volume Force)
  signal: number | null;     // Signal line (EMA of KVO)
  histogram: number | null;  // KVO - Signal
}
```

**Interpretation:**
- KVO above signal: Bullish volume trend
- KVO below signal: Bearish volume trend
- Zero-line crossover confirms trend direction

---

#### `twap(candles, options)`

Time-Weighted Average Price — equal-weighted average of typical prices within a session, commonly used as an execution benchmark.

```typescript
const result = twap(candles);
const fixed = twap(candles, { sessionResetPeriod: 30 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sessionResetPeriod` | `'session' \| number` | `'session'` | Reset at each day or every N candles |

**Returns:** `Series<number | null>`

**Formula:** `TWAP = Cumulative Sum(Typical Price) / Count` within session

---

#### `weisWave(candles, options)`

Weis Wave Volume — accumulates volume within directional price waves. When price reverses direction, a new wave begins.

```typescript
const result = weisWave(candles);
const custom = weisWave(candles, { method: 'highlow', threshold: 0.5 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `method` | `'close' \| 'highlow'` | `'close'` | Price method for direction detection |
| `threshold` | `number` | `0` | Minimum price change to trigger a new wave |

**Returns:** `Series<WeisWaveValue>`

```typescript
interface WeisWaveValue {
  waveVolume: number;            // Cumulative volume for current wave
  direction: 'up' | 'down';     // Current wave direction
}
```

**Interpretation:**
- Large up-wave volume with small down-wave volume: Strong accumulation
- Large down-wave volume with small up-wave volume: Strong distribution
- Divergence between wave volume and price: Potential reversal

---

#### `marketProfile(candles, options)`

Market Profile / TPO — analyzes time spent at each price level, identifying POC and Value Area per session.

```typescript
const result = marketProfile(candles);
const custom = marketProfile(candles, { tickSize: 0.5, valueAreaPercent: 0.70 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tickSize` | `number` | `auto` | Price bucket size (0 = auto-detect) |
| `sessionResetPeriod` | `'session' \| number` | `'session'` | Session reset logic |
| `valueAreaPercent` | `number` | `0.70` | Percentage of TPOs for Value Area (70%) |

**Returns:** `Series<MarketProfileValue>`

```typescript
interface MarketProfileValue {
  poc: number | null;                    // Point of Control (most visited price)
  valueAreaHigh: number | null;          // Value Area High
  valueAreaLow: number | null;          // Value Area Low
  profile: Map<number, number> | null;   // Price level → TPO count
}
```

**Interpretation:**
- **POC**: Strongest support/resistance level — "fair value"
- **Value Area**: 70% of time spent here — acceptance zone
- Price above VAH: Breakout potential, overbought
- Price below VAL: Breakdown potential, oversold

---

#### `cvd(candles)`

Cumulative Volume Delta — estimates buying vs selling pressure by measuring where the close falls within each bar's range, then accumulates the delta.

```typescript
const cvdData = cvd(candles);
const currentCvd = cvdData[i].value;

// CVD increasing = net buying pressure
if (cvdData[i].value > cvdData[i - 1].value) {
  // Buying pressure dominant
}
```

**Calculation:**
- `buyVolume = volume × (close - low) / (high - low)`
- `sellVolume = volume - buyVolume`
- `delta = buyVolume - sellVolume`
- `CVD = running sum of delta`

**Returns:** `Series<number>`

**Interpretation:**
- Rising CVD: Net buying pressure (accumulation)
- Falling CVD: Net selling pressure (distribution)
- CVD diverging from price signals potential reversal
- Doji (range = 0): delta = 0

---

#### `cvdWithSignal(candles, options)`

CVD with optional EMA smoothing and a signal line.

```typescript
const data = cvdWithSignal(candles, { smoothing: 5, signalPeriod: 9 });
const last = data[data.length - 1].value;

// CVD crossing above signal = bullish
if (last.cvd > last.signal!) {
  // Bullish momentum
}
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `smoothing` | `number` | `1` | EMA smoothing period for CVD (1 = no smoothing) |
| `signalPeriod` | `number` | `9` | EMA period for the signal line |

**Returns:** `Series<CvdWithSignalValue>`

```typescript
interface CvdWithSignalValue {
  cvd: number;              // CVD value (optionally smoothed)
  signal: number | null;    // Signal line (EMA of CVD), null during warmup
}
```

---

### S/R Zone Clustering

#### `srZones(candles, options)`

Identifies support and resistance zones by collecting price levels from multiple sources and clustering them using K-means++. Each zone is scored by touch count, source diversity, and recency.

```typescript
const result = srZones(candles);
console.log(result.zones[0]);
// { price: 100.5, low: 99.8, high: 101.2, touchCount: 5,
//   sourceDiversity: 3, sources: ['swing', 'pivot', 'round'], strength: 85 }
```

**Sources collected:**
- **Swing points**: Swing highs and lows
- **Pivot points**: PP, R1, R2, S1, S2
- **VWAP**: Last VWAP value
- **Volume Profile**: POC, Value Area High/Low
- **Round numbers**: Auto-detected interval based on price range
- **Custom levels**: User-provided price levels

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `numZones` | `number` | `auto` | Number of zones (auto: `min(max(3, levels/3), 15)`) |
| `zoneWidth` | `number` | `0.5` | ATR multiplier for zone width |
| `includeRoundNumbers` | `boolean` | `true` | Include round number levels |
| `includeSwingPoints` | `boolean` | `true` | Include swing point levels |
| `includePivotPoints` | `boolean` | `true` | Include pivot point levels |
| `includeVwap` | `boolean` | `true` | Include VWAP level |
| `includeVolumeProfile` | `boolean` | `true` | Include volume profile levels |
| `customLevels` | `number[]` | `[]` | Custom price levels |
| `swingLookback` | `number` | `5` | Swing point lookback bars |
| `maxIterations` | `number` | `50` | Max K-means iterations |

**Returns:** `SrZonesResult`

```typescript
interface SrZonesResult {
  zones: SrZone[];              // Zones sorted by strength descending
  rawLevels: PriceLevelSource[];  // All raw levels before clustering
}

interface SrZone {
  price: number;          // Weighted centroid
  low: number;            // Lower boundary (centroid − zoneWidth × ATR)
  high: number;           // Upper boundary (centroid + zoneWidth × ATR)
  touchCount: number;     // Number of raw levels in cluster
  sourceDiversity: number; // Number of unique source types
  sources: string[];      // List of unique source types
  strength: number;       // Score 0-100 (touchCount 40% + diversity 40% + recency 20%)
}
```

---

#### `srZonesSeries(candles, options)`

Rolling version of `srZones` — computes zones at each bar using a lookback window.

```typescript
const series = srZonesSeries(candles, { numZones: 5 });
const currentZones = series[series.length - 1].value;
```

**Returns:** `Series<SrZone[]>`

---

### Relative Strength

#### `benchmarkRS(candles, benchmark, options)`

Calculate Relative Strength comparing a stock against a benchmark (e.g., S&P 500, Nikkei 225).

```typescript
import { benchmarkRS } from 'trendcraft';

// Compare stock against market index
const rs = benchmarkRS(stockCandles, sp500Candles, { period: 52 });

// Find outperforming stocks
const latest = rs[rs.length - 1];
if (latest.value.rsRating > 80 && latest.value.trend === 'up') {
  console.log('Strong relative strength!');
}
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `52` | Performance calculation period |
| `smaPeriod` | `number` | `52` | SMA period for Mansfield RS |
| `rankingLookback` | `number` | `252` | Lookback for percentile ranking |
| `flatThreshold` | `number` | `0.01` | Threshold for flat trend detection |

**Returns:** `Series<RSValue>`

```typescript
interface RSValue {
  rs: number;                    // Raw RS ratio (>1 = outperforming)
  rsRating: number | null;       // Percentile rank 0-100
  trend: 'up' | 'down' | 'flat'; // RS trend direction
  mansfieldRS: number | null;    // Deviation from SMA (%)
  outperformance: number;        // % outperformance vs benchmark
}
```

**Interpretation:**
- **RS > 1.0**: Stock outperforming benchmark
- **RS Rating > 80**: Stock in top 20% of historical comparisons
- **Mansfield RS > 0**: RS above its moving average (strengthening)

---

#### `calculateRSRating(candles, benchmark, period)`

Quick calculation of RS Rating only.

```typescript
const rating = calculateRSRating(stockCandles, sp500Candles, 52);
// Returns: 85 (stock in top 15%)
```

---

#### `isOutperforming(candles, benchmark, period, minOutperformance)`

Check if stock is outperforming benchmark.

```typescript
if (isOutperforming(stockCandles, sp500Candles, 52, 10)) {
  console.log('Stock beating benchmark by at least 10%');
}
```

---

#### Multi-Symbol RS Ranking

Compare relative strength across multiple stocks.

```typescript
import { rankByRS, topByRS, filterByRSPercentile } from 'trendcraft';

// Rank all stocks by RS
const symbolsData = new Map([
  ['AAPL', aaplCandles],
  ['GOOGL', googlCandles],
  ['MSFT', msftCandles],
]);

const rankings = rankByRS(symbolsData, { benchmarkSymbol: 'SPY' });
// [{ symbol: 'AAPL', rank: 1, rsRating: 92, ... }, ...]

// Get top 5 stocks
const top5 = topByRS(symbolsData, 5);

// Filter stocks in top 20%
const leaders = filterByRSPercentile(symbolsData, 80);
```

| Function | Description |
|----------|-------------|
| `rankByRS(symbolsData, options)` | Rank all symbols by RS |
| `topByRS(symbolsData, n, options)` | Get top N stocks by RS |
| `bottomByRS(symbolsData, n, options)` | Get bottom N stocks by RS |
| `filterByRSPercentile(symbolsData, minPercentile, options)` | Filter by RS percentile |
| `compareRS(symbol1, symbol2, candles1, candles2, options)` | Compare two stocks directly |

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

#### `autoTrendLine(candles, options)`

Automatic trend line detection using swing points. Draws resistance and support lines through recent swing highs and swing lows.

```typescript
const tl = autoTrendLine(candles, { leftBars: 10, rightBars: 10 });
const last = tl[tl.length - 1].value;
console.log(`Resistance: ${last.resistance}, Support: ${last.support}`);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `leftBars` | `number` | `10` | Bars to the left for swing confirmation |
| `rightBars` | `number` | `10` | Bars to the right for swing confirmation |

**Returns:** `Series<AutoTrendLineValue>`

```typescript
interface AutoTrendLineValue {
  resistance: number | null;  // Resistance line value (interpolated)
  support: number | null;     // Support line value (interpolated)
}
```

---

#### `channelLine(candles, options)`

Channel line indicator that draws upper, lower, and middle channel lines using swing points.

```typescript
const ch = channelLine(candles, { leftBars: 10, rightBars: 10 });
const last = ch[ch.length - 1].value;
console.log(`Upper: ${last.upper}, Lower: ${last.lower}, Dir: ${last.direction}`);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `leftBars` | `number` | `10` | Bars to the left for swing confirmation |
| `rightBars` | `number` | `10` | Bars to the right for swing confirmation |

**Returns:** `Series<ChannelLineValue>`

```typescript
interface ChannelLineValue {
  upper: number | null;                   // Upper channel line
  lower: number | null;                   // Lower channel line
  middle: number | null;                  // Middle channel line (average)
  direction: "up" | "down" | null;        // Channel direction
}
```

---

#### `fibonacciExtension(candles, options)`

Fibonacci Extension levels calculated from three swing points (A-B-C pattern).

```typescript
const ext = fibonacciExtension(candles, { leftBars: 10, rightBars: 10 });
const last = ext[ext.length - 1].value;
if (last.levels) {
  console.log(`161.8% target: ${last.levels["1.618"]}`);
}
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `leftBars` | `number` | `10` | Bars to the left for swing confirmation |
| `rightBars` | `number` | `10` | Bars to the right for swing confirmation |
| `levels` | `number[]` | `[0, 0.618, 1, 1.272, 1.618, 2, 2.618]` | Extension ratio levels |

**Returns:** `Series<FibonacciExtensionValue>`

```typescript
interface FibonacciExtensionValue {
  levels: Record<string, number> | null;           // Extension levels by ratio
  pointA: number | null;                           // Start of initial move
  pointB: number | null;                           // End of initial move
  pointC: number | null;                           // End of retracement
  direction: "bullish" | "bearish" | null;         // Extension direction
}
```

---

#### `andrewsPitchfork(candles, options)`

Andrew's Pitchfork indicator with median, upper, and lower handle lines.

```typescript
const pf = andrewsPitchfork(candles, { leftBars: 10, rightBars: 10 });
const last = pf[pf.length - 1].value;
console.log(`Median: ${last.median}, Upper: ${last.upper}, Lower: ${last.lower}`);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `leftBars` | `number` | `10` | Bars to the left for swing confirmation |
| `rightBars` | `number` | `10` | Bars to the right for swing confirmation |

**Returns:** `Series<AndrewsPitchforkValue>`

```typescript
interface AndrewsPitchforkValue {
  median: number | null;  // Median line value
  upper: number | null;   // Upper handle line value
  lower: number | null;   // Lower handle line value
}
```

---

### Fibonacci Retracement

#### `fibonacciRetracement(candles, options)`

Calculate Fibonacci retracement levels based on swing points. Uses swing point detection to find the most recent swing high and swing low, then calculates retracement levels between them.

```typescript
const fib = fibonacciRetracement(candles, { leftBars: 10, rightBars: 10 });
const last = fib[fib.length - 1].value;
if (last.levels) {
  console.log(`61.8% level: ${last.levels["0.618"]}`);
  console.log(`Trend: ${last.trend}`);
}
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `leftBars` | `number` | `10` | Bars to the left for swing point confirmation |
| `rightBars` | `number` | `10` | Bars to the right for swing point confirmation |
| `levels` | `number[]` | `[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]` | Fibonacci ratio levels to calculate |

**Returns:** `Series<FibonacciRetracementValue>`

```typescript
interface FibonacciRetracementValue {
  levels: Record<string, number> | null;  // Fibonacci levels mapped by ratio string to price
  swingHigh: number | null;               // Price of the swing high used
  swingLow: number | null;                // Price of the swing low used
  trend: "up" | "down" | null;            // "up" if swing high is more recent
}
```

---

#### `openingRange(candles, options)`

Opening Range Breakout (ORB) — detects the opening range of a session and identifies breakouts.

```typescript
const result = openingRange(candles);
const custom = openingRange(candles, { minutes: 15, sessionResetPeriod: 'day' });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minutes` | `number` | `30` | Opening range duration in minutes |
| `sessionResetPeriod` | `'day' \| number` | `'day'` | Session reset mode |

**Returns:** `Series<OpeningRangeValue>`

```typescript
interface OpeningRangeValue {
  high: number | null;                      // Opening range high
  low: number | null;                       // Opening range low
  breakout: 'above' | 'below' | null;      // Breakout direction
}
```

---

#### `gapAnalysis(candles, options)`

Gap Analysis — detects and classifies price gaps between consecutive candles and tracks fill status.

```typescript
const result = gapAnalysis(candles);
const custom = gapAnalysis(candles, { minGapPercent: 1.0 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minGapPercent` | `number` | `0.5` | Minimum gap percentage to qualify |

**Returns:** `Series<GapValue>`

```typescript
interface GapValue {
  type: 'up' | 'down' | null;                              // Gap direction
  gapPercent: number;                                       // Gap size as % of previous close
  classification: 'full' | 'partial' | 'unfilled' | null;  // Gap classification
  filled: boolean;                                          // Whether the gap has been filled
}
```

**Classification:**
- **Full gap up**: Open > Previous High
- **Partial gap up**: Open > Previous Close but ≤ Previous High
- **Full gap down**: Open < Previous Low
- **Partial gap down**: Open < Previous Close but ≥ Previous Low

---

### Smart Money Concepts (SMC)

#### `breakOfStructure(candles, options)`

Detect Break of Structure (BOS). A bullish BOS occurs when price closes above a recent swing high. A bearish BOS occurs when price closes below a recent swing low.

```typescript
const bos = breakOfStructure(candles, { swingPeriod: 5 });
const lastBos = bos[bos.length - 1].value;
if (lastBos.bullishBos) {
  console.log(`Bullish BOS! Broke above ${lastBos.brokenLevel}`);
}
console.log(`Current trend: ${lastBos.trend}`);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `swingPeriod` | `number` | `5` | Swing detection period (bars on each side) |

**Returns:** `Series<BosValue>`

```typescript
interface BosValue {
  bullishBos: boolean;                            // Bullish break of structure
  bearishBos: boolean;                            // Bearish break of structure
  brokenLevel: number | null;                     // The level that was broken
  trend: "bullish" | "bearish" | "neutral";       // Current market trend
  swingHighLevel: number | null;                  // Most recent swing high level
  swingLowLevel: number | null;                   // Most recent swing low level
}
```

---

#### `changeOfCharacter(candles, options)`

Detect Change of Character (CHoCH). Similar to BOS but specifically detects the first break in the opposite direction, signaling a potential trend reversal.

```typescript
const choch = changeOfCharacter(candles, { swingPeriod: 5 });
const last = choch[choch.length - 1].value;
if (last.bullishBos) {
  console.log("Bullish CHoCH - potential trend reversal to upside");
}
```

**Options:** Same as `breakOfStructure`.

**Returns:** `Series<BosValue>` (same structure as `breakOfStructure`)

---

#### `orderBlock(candles, options)`

Detect Order Blocks. An Order Block is the last opposing candle before a Break of Structure. These zones act as support/resistance where price often returns.

```typescript
const obs = orderBlock(candles, { swingPeriod: 5, minVolumeRatio: 1.2 });
const lastOb = obs[obs.length - 1].value;

if (lastOb.newOrderBlock) {
  console.log(`New ${lastOb.newOrderBlock.type} OB at ${lastOb.newOrderBlock.low}-${lastOb.newOrderBlock.high}`);
}
if (lastOb.atBullishOB) {
  console.log("Price is at a bullish order block - potential support");
}
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `swingPeriod` | `number` | `5` | Swing detection period for BOS |
| `volumePeriod` | `number` | `20` | Volume MA period for strength calculation |
| `minVolumeRatio` | `number` | `1.0` | Minimum volume ratio for valid OB |
| `maxActiveOBs` | `number` | `10` | Maximum active order blocks to track |
| `partialMitigation` | `boolean` | `true` | Consider partial touch as mitigation |

**Returns:** `Series<OrderBlockValue>`

```typescript
interface OrderBlockValue {
  newOrderBlock: OrderBlock | null;      // New OB created at this bar
  activeOrderBlocks: OrderBlock[];       // Active (not mitigated) order blocks
  mitigatedThisBar: OrderBlock[];        // OBs mitigated at this bar
  atBullishOB: boolean;                  // Price at bullish OB zone
  atBearishOB: boolean;                  // Price at bearish OB zone
}

interface OrderBlock {
  type: "bullish" | "bearish";
  high: number;                          // Upper boundary
  low: number;                           // Lower boundary
  open: number;                          // Open price of OB candle
  close: number;                         // Close price of OB candle
  startIndex: number;                    // Index where OB was created
  startTime: number;                     // Time when OB was created
  strength: number;                      // Strength score (0-100)
  mitigated: boolean;                    // Whether OB has been mitigated
  mitigatedIndex: number | null;         // Index of mitigation
  mitigatedTime: number | null;          // Time of mitigation
}
```

---

#### `getActiveOrderBlocks(candles, options)`

Get currently active (not mitigated) order blocks.

```typescript
const { bullish, bearish } = getActiveOrderBlocks(candles, { swingPeriod: 5 });
console.log(`${bullish.length} bullish OBs, ${bearish.length} bearish OBs`);
```

**Options:** Same as `orderBlock`.

**Returns:** `{ bullish: OrderBlock[]; bearish: OrderBlock[] }`

---

#### `getNearestOrderBlock(candles, options)`

Find the nearest order block to the current price.

```typescript
const nearest = getNearestOrderBlock(candles);
if (nearest) {
  console.log(`Nearest OB: ${nearest.type} at ${nearest.low}-${nearest.high}`);
}
```

**Options:** Same as `orderBlock`.

**Returns:** `OrderBlock | null`

---

#### `liquiditySweep(candles, options)`

Detect Liquidity Sweeps. A sweep occurs when price briefly breaks a swing high/low to trigger stop losses, then quickly reverses back. This is a common institutional pattern.

```typescript
const sweeps = liquiditySweep(candles, { swingPeriod: 5 });
const last = sweeps[sweeps.length - 1].value;

if (last.recoveredThisBar.length > 0) {
  const sweep = last.recoveredThisBar[0];
  if (sweep.type === "bullish") {
    console.log("Bullish sweep recovered - potential long entry");
  }
}
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `swingPeriod` | `number` | `5` | Swing detection period |
| `maxRecoveryBars` | `number` | `3` | Maximum bars to wait for recovery |
| `maxTrackedSweeps` | `number` | `10` | Maximum recent sweeps to track |
| `minSweepDepth` | `number` | `0` | Minimum sweep depth percentage |

**Returns:** `Series<LiquiditySweepValue>`

```typescript
interface LiquiditySweepValue {
  isSweep: boolean;                        // New sweep on this bar
  sweep: LiquiditySweep | null;            // New sweep details
  recentSweeps: LiquiditySweep[];          // Recent sweeps
  recoveredThisBar: LiquiditySweep[];      // Sweeps recovered on this bar
}

interface LiquiditySweep {
  type: "bullish" | "bearish";
  sweptLevel: number;                      // The swing level that was swept
  sweepExtreme: number;                    // Extreme price during sweep
  sweepIndex: number;                      // Index of sweep
  sweepTime: number;                       // Time of sweep
  recovered: boolean;                      // Whether price recovered
  recoveredIndex: number | null;           // Index of recovery
  recoveredTime: number | null;            // Time of recovery
  sweepDepthPercent: number;               // How far past swing level (%)
}
```

---

#### `getRecoveredSweeps(candles, options)`

Get all recovered sweeps from the data.

```typescript
const { bullish, bearish } = getRecoveredSweeps(candles, { swingPeriod: 5 });
console.log(`${bullish.length} bullish recoveries, ${bearish.length} bearish recoveries`);
```

**Options:** Same as `liquiditySweep`.

**Returns:** `{ bullish: LiquiditySweep[]; bearish: LiquiditySweep[] }`

---

#### `hasRecentSweepSignal(candles, type, options)`

Check if there's a recent sweep signal at the current bar.

```typescript
if (hasRecentSweepSignal(candles, "bullish")) {
  console.log("Bullish sweep signal detected!");
}
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `candles` | `Candle[]` | required | Candle data |
| `type` | `"bullish" \| "bearish" \| "both"` | `"both"` | Sweep type to check |
| `options` | `LiquiditySweepOptions` | `{}` | Liquidity Sweep options |

**Returns:** `boolean`

---

### Session / Kill Zones

ICT-standard session detection, kill zone identification, session statistics, and session breakout detection. All times are in UTC (ET = UTC-5, DST ignored).

#### `getIctSessions()`

Returns the 4 standard ICT sessions in UTC.

```typescript
const sessions = getIctSessions();
// [{ name: 'Asia', startHour: 0, startMinute: 0, endHour: 5, endMinute: 0 },
//  { name: 'London', startHour: 7, ... }, { name: 'NY AM', ... }, { name: 'NY PM', ... }]
```

| Session | UTC Time | ET Time | Characteristics |
|---------|----------|---------|----------------|
| Asia | 00:00-05:00 | 19:00-00:00 | Low liquidity, range formation |
| London | 07:00-10:00 | 02:00-05:00 | European entry, fakeouts |
| NY AM | 13:30-16:00 | 08:30-11:00 | Maximum liquidity |
| NY PM | 18:30-21:00 | 13:30-16:00 | Reversals common |

---

#### `defineSession(name, startHour, startMinute, endHour, endMinute)`

Factory function to create custom session definitions.

```typescript
const preMarket = defineSession('Pre-Market', 9, 0, 13, 30);
```

---

#### `detectSessions(candles, sessions?)`

For each candle, determine which session it belongs to and track session OHLC.

```typescript
const sessionData = detectSessions(candles);
const bar = sessionData[i].value;
if (bar.inSession) {
  console.log(`In ${bar.session}, high so far: ${bar.sessionHigh}`);
}
```

**Returns:** `Series<SessionInfo>`

```typescript
interface SessionInfo {
  session: string | null;       // Session name (null if outside all sessions)
  inSession: boolean;           // Whether in any defined session
  barIndex: number;             // Bar index within current session (0-based)
  sessionOpen: number | null;   // Session open price
  sessionHigh: number | null;   // Session high so far
  sessionLow: number | null;    // Session low so far
}
```

---

#### `sessionStats(candles, options?)`

Compute per-session aggregate statistics over a lookback period.

```typescript
const stats = sessionStats(candles, { lookback: 20 });
stats.forEach(s => {
  console.log(`${s.session}: avgRange=${s.avgRange.toFixed(2)}, bullish=${(s.bullishPercent * 100).toFixed(0)}%`);
});
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sessions` | `SessionDefinition[]` | ICT sessions | Session definitions |
| `lookback` | `number` | `20` | Number of session occurrences to analyze |

**Returns:** `SessionStatsValue[]`

```typescript
interface SessionStatsValue {
  session: string;        // Session name
  avgRange: number;       // Average range per session occurrence
  avgVolume: number;      // Average volume per session occurrence
  bullishPercent: number; // Percentage of bullish bars (close > open)
  barCount: number;       // Total bar count across all occurrences
}
```

---

#### `getIctKillZones()`

Returns the 4 standard ICT Kill Zones in UTC with characteristic descriptions.

```typescript
const zones = getIctKillZones();
// [{ name: 'Asian KZ', ..., characteristic: 'Range formation, accumulation' }, ...]
```

| Kill Zone | UTC Time | Characteristic |
|-----------|----------|---------------|
| Asian KZ | 00:00-05:00 | Range formation, accumulation |
| London Open KZ | 07:00-09:00 | Fakeouts, stop hunts, initial move |
| NY Open KZ | 12:00-14:00 | Maximum liquidity, strongest moves |
| London Close KZ | 15:00-17:00 | Reversals, profit taking |

---

#### `killZones(candles, zones?)`

For each candle, determine if it falls within a kill zone.

```typescript
const kz = killZones(candles);
if (kz[i].value.inKillZone) {
  console.log(`In ${kz[i].value.zone}: ${kz[i].value.characteristic}`);
}
```

**Returns:** `Series<KillZoneValue>`

```typescript
interface KillZoneValue {
  zone: string | null;             // Kill zone name (null if outside)
  inKillZone: boolean;             // Whether in any kill zone
  characteristic: string | null;   // Expected behavior description
}
```

---

#### `sessionBreakout(candles, options?)`

Detect breakouts above/below the most recently completed session's range.

```typescript
const breakouts = sessionBreakout(candles);
if (breakouts[i].value.breakout === 'above') {
  console.log(`Broke above ${breakouts[i].value.fromSession} high at ${breakouts[i].value.rangeHigh}`);
}
```

**Returns:** `Series<SessionBreakoutValue>`

```typescript
interface SessionBreakoutValue {
  fromSession: string | null;             // Previous session name
  breakout: 'above' | 'below' | null;    // Breakout direction
  rangeHigh: number | null;              // Previous session high
  rangeLow: number | null;               // Previous session low
}
```

---

### HMM Regime Detection

Hidden Markov Model for probabilistic market regime classification. Pure TypeScript implementation (Baum-Welch / Viterbi) with zero external dependencies.

#### `hmmRegimes(candles, options?)`

Detect market regimes using a Gaussian HMM. Extracts features (returns, volatility, volume ratio, range, body ratio), fits the model with EM, and decodes the most likely state sequence.

```typescript
const regimes = hmmRegimes(candles, { numStates: 3, seed: 42 });
const current = regimes[regimes.length - 1].value;
console.log(`Regime: ${current.label}, P=${current.probabilities}`);
// Regime: "trending-up", P=[0.02, 0.08, 0.90]
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `numStates` | `number` | `3` | Number of regime states |
| `maxIterations` | `number` | `100` | Max EM iterations |
| `seed` | `number` | `42` | Random seed for reproducibility |
| `numRestarts` | `number` | `5` | Random restarts to avoid local optima |
| `featureOptions` | `FeatureOptions` | `{}` | Feature extraction settings |

**Feature Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `returnLookback` | `number` | `1` | Return calculation lookback |
| `volatilityWindow` | `number` | `20` | Rolling volatility window |
| `volumeWindow` | `number` | `20` | Volume ratio window |

**Returns:** `Series<HmmRegimeValue>`

```typescript
interface HmmRegimeValue {
  regime: number;           // Regime index (0-based)
  label: string;            // "trending-up" | "ranging" | "trending-down" (3 states)
  probabilities: number[];  // State probabilities at this time step
  logLikelihood: number;    // Log-likelihood of the fitted model
}
```

**Labels (3-state model):** States are sorted by mean return — lowest = "trending-down", middle = "ranging", highest = "trending-up". For N ≠ 3, labels are "state-0", "state-1", etc.

---

#### `fitHmm(candles, options?)`

Fit the HMM without decoding — returns the trained model for analysis.

```typescript
const model = fitHmm(candles, { numStates: 3 });
console.log(`Log-likelihood: ${model.logLikelihood}`);
console.log(`Converged: ${model.converged}`);
```

**Returns:** `HmmModel`

```typescript
interface HmmModel {
  numStates: number;
  pi: number[];                    // Initial state probabilities
  transitionMatrix: number[][];    // A[i][j] = P(state j | state i)
  emissionMeans: number[][];       // means[state][feature]
  emissionVariances: number[][];   // variances[state][feature]
  logLikelihood: number;
  converged: boolean;
}
```

---

#### `regimeTransitionMatrix(model, labels?)`

Extract transition analysis from a fitted model.

```typescript
const model = fitHmm(candles);
const info = regimeTransitionMatrix(model);
console.log(`Expected durations: ${info.expectedDurations}`);
console.log(`Stationary distribution: ${info.stationaryDistribution}`);
```

**Returns:** `RegimeTransitionInfo`

```typescript
interface RegimeTransitionInfo {
  matrix: number[][];             // Transition probability matrix
  labels: string[];               // Labels for each state
  expectedDurations: number[];    // Expected bars in each state: 1 / (1 - self-transition)
  stationaryDistribution: number[]; // Long-run state probabilities
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

### CVD Divergence

#### `cvdDivergence(candles, options)`

Detect divergence between price and Cumulative Volume Delta (CVD). Uses `detectDivergence()` internally.

```typescript
const signals = cvdDivergence(candles);
const bullish = signals.filter(s => s.type === 'bullish');
// Bullish: price lower low, CVD higher low → buying pressure building
const bearish = signals.filter(s => s.type === 'bearish');
// Bearish: price higher high, CVD lower high → selling pressure building
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

### Price Patterns

Detect classic chart patterns for reversal and continuation signals.

#### `doubleTop(candles, options)` / `doubleBottom(candles, options)`

Detect Double Top (bearish reversal) and Double Bottom (bullish reversal) patterns.

```typescript
import { doubleTop, doubleBottom } from 'trendcraft';

const bearishPatterns = doubleTop(candles, { tolerance: 0.02 });
const bullishPatterns = doubleBottom(candles);

bearishPatterns.forEach(p => {
  if (p.confirmed) {
    console.log(`Double Top confirmed, target: ${p.pattern.target}`);
  }
});
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tolerance` | `number` | `0.02` | Max price difference between peaks/troughs (2%) |
| `minDistance` | `number` | `10` | Minimum bars between peaks/troughs |
| `maxDistance` | `number` | `60` | Maximum bars between peaks/troughs |
| `minMiddleDepth` | `number` | `0.1` | Minimum depth of middle trough/peak (10%) |
| `swingLookback` | `number` | `5` | Swing point detection lookback |

---

#### `headAndShoulders(candles, options)` / `inverseHeadAndShoulders(candles, options)`

Detect Head and Shoulders (bearish) and Inverse Head and Shoulders (bullish) patterns.

```typescript
import { headAndShoulders, inverseHeadAndShoulders } from 'trendcraft';

const bearish = headAndShoulders(candles);
const bullish = inverseHeadAndShoulders(candles);

bearish.forEach(p => {
  console.log(`H&S at ${new Date(p.time)}, neckline: ${p.pattern.neckline.currentPrice}`);
});
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `shoulderTolerance` | `number` | `0.05` | Max difference between shoulders (5%) |
| `maxNecklineSlope` | `number` | `0.1` | Maximum neckline slope (10%) |
| `minHeadHeight` | `number` | `0.03` | Minimum head prominence (3%) |
| `swingLookback` | `number` | `5` | Swing point detection lookback |

---

#### `cupWithHandle(candles, options)`

Detect Cup with Handle bullish continuation pattern (William O'Neil).

```typescript
import { cupWithHandle } from 'trendcraft';

const patterns = cupWithHandle(candles, {
  minCupDepth: 0.15,
  maxCupDepth: 0.35
});

patterns.forEach(p => {
  if (p.confirmed) {
    console.log(`Cup with Handle breakout! Target: ${p.pattern.target}`);
  }
});
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minCupDepth` | `number` | `0.12` | Minimum cup depth (12%) |
| `maxCupDepth` | `number` | `0.35` | Maximum cup depth (35%) |
| `minCupLength` | `number` | `30` | Minimum cup length in bars |
| `maxHandleDepth` | `number` | `0.12` | Maximum handle pullback (12%) |
| `minHandleLength` | `number` | `5` | Minimum handle length in bars |
| `swingLookback` | `number` | `5` | Swing point detection lookback |

---

#### `detectTriangle(candles, options)`

Detect symmetrical, ascending, and descending triangle patterns using OLS trendline fitting.

```typescript
import { detectTriangle } from 'trendcraft';

const patterns = detectTriangle(candles);
patterns.forEach(p => {
  console.log(`${p.type}, confidence: ${p.confidence}, target: ${p.pattern.target}`);
});
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `swingLookback` | `number` | `3` | Swing point detection lookback |
| `minPoints` | `number` | `2` | Minimum points per trendline |
| `minRSquared` | `number` | `0.6` | Minimum R² for trendline fit quality |
| `flatTolerance` | `number` | `0.0003` | Threshold for flat slope detection |
| `minBars` | `number` | `15` | Minimum bars for pattern formation |
| `maxBreakoutBars` | `number` | `20` | Maximum bars to search for breakout |

---

#### `detectWedge(candles, options)`

Detect rising wedge (bearish) and falling wedge (bullish) patterns.

```typescript
import { detectWedge } from 'trendcraft';

const patterns = detectWedge(candles);
const fallingWedges = patterns.filter(p => p.type === 'falling_wedge');
```

**Options:** Same as `detectTriangle` (minus `flatTolerance`).

---

#### `detectChannel(candles, options)`

Detect ascending, descending, and horizontal channel patterns.

```typescript
import { detectChannel } from 'trendcraft';

const patterns = detectChannel(candles);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `swingLookback` | `number` | `3` | Swing point detection lookback |
| `minRSquared` | `number` | `0.6` | Minimum R² for trendline fit |
| `flatTolerance` | `number` | `0.0003` | Threshold for flat slope |
| `parallelTolerance` | `number` | `0.0003` | Max slope difference for parallel |
| `minBars` | `number` | `20` | Minimum bars for pattern formation |

---

#### `detectFlag(candles, options)`

Detect flag and pennant continuation patterns (flagpole + consolidation).

```typescript
import { detectFlag } from 'trendcraft';

const patterns = detectFlag(candles);
const bullFlags = patterns.filter(p => p.type === 'bull_flag');
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `swingLookback` | `number` | `2` | Swing point detection lookback |
| `minAtrMultiple` | `number` | `2.0` | Minimum flagpole size (ATR multiples) |
| `maxPoleBars` | `number` | `8` | Maximum flagpole length |
| `minConsolidationBars` | `number` | `5` | Minimum consolidation length |
| `maxConsolidationBars` | `number` | `20` | Maximum consolidation length |

---

#### `filterPatterns(patterns, candles, options)`

Apply contextual filters (ATR ratio, trend direction, volume) to pattern signals.

```typescript
import { doubleTop, filterPatterns } from 'trendcraft';

const raw = doubleTop(candles);
const filtered = filterPatterns(raw, candles, {
  minATRRatio: 2.0,
  trendContext: true,
  minConfidence: 60,
});
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minATRRatio` | `number` | `1.5` | Minimum pattern height / ATR ratio |
| `volumeConfirm` | `boolean` | `true` | Require volume confirmation |
| `trendContext` | `boolean` | `true` | Check trend direction alignment |
| `minConfidence` | `number` | `50` | Minimum confidence after filtering |

---

#### Pattern Signal Structure

All pattern detection functions return `PatternSignal[]`:

```typescript
interface PatternSignal {
  time: number;              // Pattern completion time
  type: PatternType;         // 'double_top' | 'double_bottom' | 'head_shoulders' | etc.
  pattern: {
    startTime: number;       // Pattern start
    endTime: number;         // Pattern end
    keyPoints: PatternKeyPoint[];  // Key points (peaks, troughs, neckline)
    neckline?: PatternNeckline;    // For H&S patterns
    target?: number;         // Price target (measured move)
    stopLoss?: number;       // Suggested stop loss
    height: number;          // Pattern height
  };
  confidence: number;        // 0-100 confidence score
  confirmed: boolean;        // True if breakout occurred
}
```

| Pattern Type | Direction | Confirmation |
|--------------|-----------|--------------|
| `double_top` | Bearish | Price breaks below middle trough |
| `double_bottom` | Bullish | Price breaks above middle peak |
| `head_shoulders` | Bearish | Price breaks below neckline |
| `inverse_head_shoulders` | Bullish | Price breaks above neckline |
| `cup_handle` | Bullish | Price breaks above cup rim |
| `triangle_symmetrical` | Neutral | Price breaks above or below trendline |
| `triangle_ascending` | Bullish | Price breaks above flat resistance |
| `triangle_descending` | Bearish | Price breaks below flat support |
| `rising_wedge` | Bearish | Price breaks below lower trendline |
| `falling_wedge` | Bullish | Price breaks above upper trendline |
| `channel_ascending` | Neutral | Price breaks above or below channel |
| `channel_descending` | Neutral | Price breaks above or below channel |
| `channel_horizontal` | Neutral | Price breaks above or below channel |
| `bull_flag` | Bullish | Price breaks above consolidation |
| `bear_flag` | Bearish | Price breaks below consolidation |
| `bull_pennant` | Bullish | Price breaks above pennant |
| `bear_pennant` | Bearish | Price breaks below pennant |

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
| `direction` | `PositionDirection` | `'long'` | Position direction (`'long'` or `'short'`). See [Short Selling](#short-selling) |

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
  initialCapital: number;            // Initial capital
  finalCapital: number;              // Final capital
  totalReturn: number;               // Total return amount
  totalReturnPercent: number;        // Total return percentage
  tradeCount: number;                // Number of trades
  winRate: number;                   // Win rate (%)
  maxDrawdown: number;               // Maximum drawdown (%)
  sharpeRatio: number;               // Sharpe ratio (annualized)
  profitFactor: number;              // Profit factor
  avgHoldingDays: number;            // Average holding days
  trades: Trade[];                   // Trade details
  settings: BacktestSettings;        // Settings used (for reproducibility)
  drawdownPeriods: DrawdownPeriod[]; // Individual drawdown periods
}

interface DrawdownPeriod {
  startTime: number;         // Timestamp when drawdown started (peak equity)
  peakEquity: number;        // Peak equity value at start
  troughTime: number;        // Timestamp of maximum depth
  troughEquity: number;      // Equity at maximum depth
  recoveryTime?: number;     // Timestamp of recovery (undefined if not recovered)
  maxDepthPercent: number;   // Maximum drawdown depth (%)
  durationBars: number;      // Duration in bars
  recoveryBars?: number;     // Bars from trough to recovery
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

#### Relative Strength (RS) Conditions

RS conditions compare stock performance against a benchmark. Requires setting benchmark data.

```typescript
import { rsAbove, rsRising, rsRatingAbove, setBenchmark, and } from 'trendcraft';

// Set benchmark before backtest
const entry = and(
  rsAbove(1.0),       // Outperforming benchmark
  rsRising(),         // RS trending up
  rsRatingAbove(80),  // In top 20% historically
);

// Usage with backtest setup
runBacktest(candles, entry, exit, {
  capital: 1000000,
  setup: (indicators) => {
    setBenchmark(indicators, sp500Candles);
  }
});
```

| Function | Description |
|----------|-------------|
| `rsAbove(threshold, options)` | RS ratio > threshold (>1.0 = outperforming) |
| `rsBelow(threshold, options)` | RS ratio < threshold |
| `rsRising(options)` | RS trending up |
| `rsFalling(options)` | RS trending down |
| `rsNewHigh(lookback, options)` | RS at N-period high |
| `rsNewLow(lookback, options)` | RS at N-period low |
| `rsRatingAbove(rating, options)` | RS Rating percentile > threshold |
| `rsRatingBelow(rating, options)` | RS Rating percentile < threshold |
| `mansfieldRSAbove(threshold, options)` | Mansfield RS > threshold |
| `mansfieldRSBelow(threshold, options)` | Mansfield RS < threshold |
| `outperformanceAbove(percent, options)` | Outperforming by > N% |
| `outperformanceBelow(percent, options)` | Outperforming by < N% |

---

#### Price Pattern Conditions

Use chart pattern detection as backtest conditions.

```typescript
import { patternDetected, anyBullishPattern, patternConfidenceAbove, and } from 'trendcraft';

// Exit on double top
const exit = patternDetected('double_top');

// Enter on any confirmed bullish pattern with high confidence
const entry = and(
  anyBullishPattern({ confirmedOnly: true }),
  patternConfidenceAbove('double_bottom', 70)
);

// Enter on cup with handle pattern within last 5 bars
const cupEntry = patternWithinBars('cup_handle', 5, { confirmedOnly: true });
```

| Function | Description |
|----------|-------------|
| `patternDetected(type, options)` | Pattern detected at current bar |
| `patternConfirmed(type, options)` | Confirmed pattern (breakout occurred) |
| `anyBullishPattern(options)` | Any bullish pattern |
| `anyBearishPattern(options)` | Any bearish pattern |
| `patternConfidenceAbove(type, min, options)` | Pattern confidence > threshold |
| `anyPatternConfidenceAbove(min, options)` | Any pattern with confidence > threshold |
| `patternWithinBars(type, lookback, options)` | Pattern detected within last N bars |
| `doubleTopDetected(options)` | Double Top pattern |
| `doubleBottomDetected(options)` | Double Bottom pattern |
| `headShouldersDetected(options)` | Head and Shoulders pattern |
| `inverseHeadShouldersDetected(options)` | Inverse H&S pattern |
| `cupHandleDetected(options)` | Cup with Handle pattern |
| `triangleDetected(subtype?, options)` | Triangle pattern (any or specific subtype) |
| `wedgeDetected(subtype?, options)` | Wedge pattern (any or specific subtype) |
| `channelDetected(subtype?, options)` | Channel pattern (any or specific subtype) |
| `flagDetected(subtype?, options)` | Flag/Pennant pattern (any or specific subtype) |
| `bullFlagDetected(options)` | Bull Flag pattern |
| `bearFlagDetected(options)` | Bear Flag pattern |

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

### Price Source Helpers

Pure helpers for extracting a specific price field from a normalized candle. Most indicators that accept a `source?: PriceSource` option call these internally; you only need them when feeding price data into a non-`source`-aware function (e.g. computing returns, plotting a derived series, or composing indicators yourself).

#### `getPrice(candle, source)`

Extract a single price value from one normalized candle.

```typescript
import { normalizeCandle, getPrice } from 'trendcraft';

const c = normalizeCandle({ time: '2024-01-01', open: 99, high: 102, low: 98, close: 101, volume: 1000 });
getPrice(c, 'close');  // 101
getPrice(c, 'hl2');    // 100        ((102 + 98) / 2)
getPrice(c, 'hlc3');   // 100.333... ((102 + 98 + 101) / 3)
getPrice(c, 'ohlc4');  // 100        ((99 + 102 + 98 + 101) / 4)
getPrice(c, 'volume'); // 1000
```

#### `getPriceSeries(candles, source)`

Extract a price series (`number[]`) from an array of normalized candles. Equivalent to `candles.map((c) => getPrice(c, source))`.

```typescript
import { normalizeCandles, getPriceSeries } from 'trendcraft';

const normalized = normalizeCandles(candles);
const closes = getPriceSeries(normalized, 'close');
const typical = getPriceSeries(normalized, 'hlc3');
```

**When to reach for these vs. `source` options:**
- Indicator with a `source` option → pass `source: 'hlc3'` directly. No need to pre-extract.
- Custom math on prices (returns, regressions, your own filters) → use `getPriceSeries` to get a clean `number[]`.
- One-off price extraction inside a callback → use `getPrice`.

For the streaming/incremental side, the equivalent helper is `incremental.getSourcePrice(candle, source)`, which is what `createSma`, `createRsi`, etc. call internally when their `source` option is set.

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

## Streaming

Real-time trading infrastructure for processing live market data through a layered pipeline. All components are **stateful**, **serializable** (via `getState()`), and **restorable** (via `fromState` parameter). Most objects expose `next()` to advance state and `peek()` to preview without side effects.

### Architecture

```
Layer 1 — Candle Aggregation
  Trade ticks  →  createCandleAggregator  →  NormalizedCandle
  Candles      →  createCandleResampler   →  Higher-TF Candle

Layer 2 — Signal Detectors
  CrossOver / CrossUnder / Threshold / Squeeze / Divergence

Layer 3 — Conditions
  and() / or() / not() combinators + preset conditions (rsiBelow, priceAbove, etc.)

Layer 4 — Pipeline & MTF
  createPipeline   →  indicators + conditions → entry/exit signals
  createStreamingMtf → multi-timeframe indicator snapshots

Layer 5 — Session & Guards
  createTradingSession  →  tick-to-signal (aggregator + pipeline)
  createGuardedSession  →  + risk guard (circuit breaker) + time guard

Layer 6 — Position Management
  createPositionTracker →  SL / TP / trailing stop / P&L
  createManagedSession  →  full end-to-end: tick → signal → position → P&L
```

---

### Layer 1: Candle Aggregation

#### `createCandleAggregator(options, fromState?)`

Converts a stream of trade ticks into OHLCV candles by grouping trades within fixed time intervals.

```typescript
import { createCandleAggregator } from "trendcraft/streaming";

const agg = createCandleAggregator({ intervalMs: 60_000 }); // 1-min candles

for (const tick of tickStream) {
  const candle = agg.addTrade(tick);
  if (candle) {
    console.log("Completed candle:", candle);
  }
}

// Flush the last partial candle at session end
const last = agg.flush();
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `intervalMs` | `number` | — (required) | Candle interval in milliseconds (e.g., `60000` for 1-min) |

**`Trade` type:**

| Field | Type | Description |
|-------|------|-------------|
| `time` | `number` | Epoch milliseconds timestamp |
| `price` | `number` | Execution price |
| `volume` | `number` | Trade volume (shares/contracts/units) |
| `side` | `'buy' \| 'sell'` | Trade side (optional, for order flow analysis) |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `addTrade(trade)` | `NormalizedCandle \| null` | Process a trade; returns completed candle when period rolls over |
| `getCurrentCandle()` | `NormalizedCandle \| null` | Get the in-progress (unfinished) candle |
| `flush()` | `NormalizedCandle \| null` | Force-close the current candle |
| `getState()` | `CandleAggregatorState` | Serialize internal state for persistence |

---

#### `createCandleResampler(options, fromState?)`

Incrementally resamples lower-timeframe candles into higher-timeframe candles (e.g., 1-min → 5-min).

```typescript
import { createCandleResampler } from "trendcraft/streaming";

const resampler = createCandleResampler({ targetIntervalMs: 300_000 }); // 5-min

for (const candle1m of stream) {
  const candle5m = resampler.addCandle(candle1m);
  if (candle5m) {
    console.log("5-min candle:", candle5m);
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `targetIntervalMs` | `number` | — (required) | Target higher-timeframe interval in milliseconds |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `addCandle(candle)` | `NormalizedCandle \| null` | Process a candle; returns completed higher-TF candle when period rolls over |
| `getCurrentCandle()` | `NormalizedCandle \| null` | Get the in-progress higher-TF candle |
| `flush()` | `NormalizedCandle \| null` | Force-close the current higher-TF candle |
| `getState()` | `CandleResamplerState` | Serialize internal state |

---

### Layer 2: Signal Detectors

Incremental signal detectors that process one data point at a time. Each detector follows the `next()` / `peek()` / `getState()` pattern.

#### `createCrossOverDetector(fromState?)`

Detects when valueA crosses from below/equal to above valueB.

```typescript
import { createCrossOverDetector } from "trendcraft/streaming";

const crossOver = createCrossOverDetector();
crossOver.next(10, 20); // false (first call, no previous)
crossOver.next(21, 20); // true  (crossed over)
crossOver.next(22, 20); // false (already above, no new cross)
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `next(valueA, valueB)` | `boolean` | Advance state and return whether a cross-over occurred |
| `peek(valueA, valueB)` | `boolean` | Preview without advancing state |
| `getState()` | `CrossDetectorState` | Serialize internal state |

---

#### `createCrossUnderDetector(fromState?)`

Detects when valueA crosses from above/equal to below valueB.

```typescript
import { createCrossUnderDetector } from "trendcraft/streaming";

const crossUnder = createCrossUnderDetector();
crossUnder.next(20, 10); // false (first call)
crossUnder.next(9, 10);  // true  (crossed under)
```

Same methods as `createCrossOverDetector`.

---

#### `createThresholdDetector(threshold, fromState?)`

Detects when a value crosses above or below a fixed threshold level.

```typescript
import { createThresholdDetector } from "trendcraft/streaming";

const detector = createThresholdDetector(70);
detector.next(65); // { crossAbove: false, crossBelow: false }
detector.next(72); // { crossAbove: true, crossBelow: false }
detector.next(68); // { crossAbove: false, crossBelow: true }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `threshold` | `number` | The level to detect crosses against |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `next(value)` | `{ crossAbove: boolean; crossBelow: boolean }` | Advance state and return cross events |
| `peek(value)` | `{ crossAbove: boolean; crossBelow: boolean }` | Preview without advancing state |
| `getState()` | `ThresholdDetectorState` | Serialize internal state |

---

#### `createSqueezeDetector(options?, fromState?)`

Detects Bollinger Band squeeze conditions (low volatility) and their release.

```typescript
import { createSqueezeDetector } from "trendcraft/streaming";

const squeeze = createSqueezeDetector({ bandwidthThreshold: 0.05 });
squeeze.next(0.08); // { squeezeStart: false, squeezeEnd: false, inSqueeze: false }
squeeze.next(0.04); // { squeezeStart: true, squeezeEnd: false, inSqueeze: true }
squeeze.next(0.06); // { squeezeStart: false, squeezeEnd: true, inSqueeze: false }
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bandwidthThreshold` | `number` | `0.1` | Bandwidth threshold below which a squeeze is active |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `next(bandwidth)` | `{ squeezeStart, squeezeEnd, inSqueeze }` | Advance state and return squeeze events |
| `peek(bandwidth)` | `{ squeezeStart, squeezeEnd, inSqueeze }` | Preview without advancing state |
| `getState()` | `SqueezeDetectorState` | Serialize internal state |

---

#### `createDivergenceDetector(options?, fromState?)`

Detects bullish/bearish divergences between price and an indicator by comparing recent highs/lows.

```typescript
import { createDivergenceDetector } from "trendcraft/streaming";

const divergence = createDivergenceDetector({ lookback: 14 });
for (const candle of stream) {
  const rsi = rsiIndicator.next(candle).value;
  const { bullish, bearish } = divergence.next(candle.close, rsi);
  if (bullish) console.log("Bullish divergence detected");
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lookback` | `number` | `14` | Number of bars to look back for divergence detection |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `next(price, indicatorValue)` | `{ bullish: boolean; bearish: boolean }` | Advance state and return divergence events |
| `peek(price, indicatorValue)` | `{ bullish: boolean; bearish: boolean }` | Preview without advancing state |
| `getState()` | `DivergenceDetectorState` | Serialize internal state |

---

### Layer 3: Conditions

Streaming condition system with combinators (`and`, `or`, `not`) and preset conditions. These take an `IndicatorSnapshot` (key-value map of indicator values) and a `NormalizedCandle`.

#### `and(...conditions)`

Combine conditions with AND logic (all must be true).

```typescript
import { and, rsiBelow, smaGoldenCross } from "trendcraft/streaming";

const entry = and(rsiBelow(30), smaGoldenCross());
```

---

#### `or(...conditions)`

Combine conditions with OR logic (any must be true).

```typescript
import { or, rsiAbove, smaDeadCross } from "trendcraft/streaming";

const exit = or(rsiAbove(70), smaDeadCross());
```

---

#### `not(condition)`

Negate a condition.

```typescript
import { not, rsiAbove } from "trendcraft/streaming";

const notOverbought = not(rsiAbove(70));
```

---

#### `evaluateStreamingCondition(condition, snapshot, candle)`

Evaluate a streaming condition against a snapshot and candle.

```typescript
import { evaluateStreamingCondition } from "trendcraft/streaming";

const isEntry = evaluateStreamingCondition(entryCondition, snapshot, candle);
```

---

#### Preset Conditions

| Function | Description | Default Key |
|----------|-------------|-------------|
| `rsiBelow(threshold, key?)` | RSI is below threshold | `"rsi"` |
| `rsiAbove(threshold, key?)` | RSI is above threshold | `"rsi"` |
| `smaGoldenCross(key?)` | Short SMA crossed above long SMA | `"goldenCross"` |
| `smaDeadCross(key?)` | Short SMA crossed below long SMA | `"deadCross"` |
| `macdPositive(key?)` | MACD histogram is positive | `"macd"` |
| `macdNegative(key?)` | MACD histogram is negative | `"macd"` |
| `priceAbove(indicatorKey)` | Price (close) is above the indicator value | — |
| `priceBelow(indicatorKey)` | Price (close) is below the indicator value | — |
| `indicatorAbove(key, threshold)` | Indicator value is above threshold | — |
| `indicatorBelow(key, threshold)` | Indicator value is below threshold | — |

You can also pass a plain function as a condition:

```typescript
const customCondition = (snapshot, candle) => {
  return candle.close > 100 && snapshot.rsi < 50;
};
```

---

### Layer 4: Pipeline & MTF

#### `createPipeline(options, fromState?)`

Combines incremental indicators with streaming conditions into a signal evaluation pipeline. Processes one candle at a time with O(1) per-candle cost.

```typescript
import { createPipeline, rsiBelow, rsiAbove } from "trendcraft/streaming";
import { createRsi, createSma } from "trendcraft/incremental";

const pipeline = createPipeline({
  indicators: [
    { name: "rsi", create: () => createRsi({ period: 14 }) },
    { name: "sma20", create: () => createSma({ period: 20 }) },
  ],
  entry: rsiBelow(30),
  exit: rsiAbove(70),
  signals: [
    { name: "oversold", condition: rsiBelow(20) },
  ],
});

for (const candle of stream) {
  const result = pipeline.next(candle);
  if (result.entrySignal) console.log("BUY", result.snapshot);
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `indicators` | `PipelineIndicatorConfig[]` | — (required) | Indicator definitions (`name` + `create` factory) |
| `entry` | `StreamingCondition` | — | Entry condition |
| `exit` | `StreamingCondition` | — | Exit condition |
| `signals` | `{ name, condition }[]` | — | Named signal detectors |

**Returns `PipelineResult`:**

| Field | Type | Description |
|-------|------|-------------|
| `snapshot` | `IndicatorSnapshot` | Key-value map of current indicator values |
| `entrySignal` | `boolean` | Whether entry condition is met |
| `exitSignal` | `boolean` | Whether exit condition is met |
| `signals` | `string[]` | Names of triggered signal detectors |

---

#### `createStreamingMtf(options, fromState?)`

Multi-timeframe context that resamples a base-timeframe candle stream into multiple higher timeframes and runs indicators on each.

```typescript
import { createStreamingMtf } from "trendcraft/streaming";
import { createSma, createRsi } from "trendcraft/incremental";

const mtf = createStreamingMtf({
  timeframes: [
    {
      intervalMs: 300_000, // 5-min
      indicators: [
        { name: "sma20", create: () => createSma({ period: 20 }) },
      ],
    },
    {
      intervalMs: 900_000, // 15-min
      indicators: [
        { name: "rsi14", create: () => createRsi({ period: 14 }) },
      ],
    },
  ],
});

// Feed 1-min candles
for (const candle of stream) {
  const snapshot = mtf.next(candle);
  console.log(snapshot["5m"].sma20, snapshot["15m"].rsi14);
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeframes` | `StreamingMtfTimeframeConfig[]` | — (required) | Higher-timeframe definitions |

Each `StreamingMtfTimeframeConfig`:

| Field | Type | Description |
|-------|------|-------------|
| `intervalMs` | `number` | Timeframe interval in milliseconds |
| `indicators` | `PipelineIndicatorConfig[]` | Indicator definitions for this timeframe |

**Returns `MtfSnapshot`:** Object keyed by auto-generated timeframe label (e.g., `"5m"`, `"15m"`, `"1h"`), each containing an `IndicatorSnapshot`.

---

### Layer 5: Session & Guards

#### `createTradingSession(options, fromState?)`

End-to-end pipeline: tick → candle → indicator → signal → event. Combines `CandleAggregator` and `StreamingPipeline` into a single entry point.

```typescript
import { createTradingSession, rsiBelow, rsiAbove } from "trendcraft/streaming";
import { createRsi } from "trendcraft/incremental";

const session = createTradingSession({
  intervalMs: 60_000,
  pipeline: {
    indicators: [
      { name: "rsi", create: () => createRsi({ period: 14 }) },
    ],
    entry: rsiBelow(30),
    exit: rsiAbove(70),
  },
  warmUp: historicalCandles, // optional: warm up indicators
});

ws.on("trade", (data) => {
  const events = session.onTrade({
    time: data.timestamp,
    price: data.price,
    volume: data.quantity,
  });
  for (const event of events) {
    if (event.type === "entry") placeOrder(event);
  }
});

// At session end
const closeEvents = session.close();
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `intervalMs` | `number` | — (required) | Candle interval in milliseconds |
| `pipeline` | `PipelineOptions` | — (required) | Pipeline configuration (indicators + conditions) |
| `emitPartial` | `boolean` | `false` | Emit partial (unfinished candle) events on each trade |
| `warmUp` | `NormalizedCandle[]` | — | Historical candles for warming up indicators |

**`SessionEvent` types:**

| Type | Description | Key Fields |
|------|-------------|------------|
| `candle` | A candle was completed | `candle` |
| `signal` | A named signal triggered | `name`, `candle` |
| `entry` | Entry condition met | `snapshot`, `candle` |
| `exit` | Exit condition met | `snapshot`, `candle` |
| `partial` | Partial candle update (if `emitPartial`) | `candle`, `snapshot` |
| `blocked` | Entry blocked by a guard | `reason`, `candle` |
| `force-close` | Force-close triggered by time guard | `reason`, `candle`, `snapshot` |

---

#### `createRiskGuard(options, fromState?)`

Circuit breaker that enforces daily loss limits, trade count limits, and consecutive loss cooldowns.

```typescript
import { createRiskGuard } from "trendcraft/streaming";

const guard = createRiskGuard({
  maxDailyLoss: -50000,
  maxDailyTrades: 20,
  maxConsecutiveLosses: 3,
  cooldownMs: 30 * 60_000,
});

const { allowed, reason } = guard.check(Date.now());
if (!allowed) console.log("Blocked:", reason);

// Report trade results
guard.reportTrade(-200, Date.now());
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxDailyLoss` | `number` | — | Maximum daily loss (e.g., `-50000`). Trading blocked when `dailyPnl <= this` |
| `maxDailyTrades` | `number` | — | Maximum number of trades per day |
| `maxConsecutiveLosses` | `number` | — | Maximum consecutive losing trades before blocking |
| `cooldownMs` | `number` | — | Cooldown period in ms after hitting consecutive loss limit |
| `resetTimeOffsetMs` | `number` | `0` | Daily reset time as offset from UTC midnight in ms |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `check(time)` | `{ allowed, reason? }` | Check if trading is currently allowed |
| `reportTrade(pnl, time)` | `void` | Report a completed trade result |
| `reset()` | `void` | Reset all counters |
| `getState()` | `RiskGuardState` | Serialize internal state |

---

#### `createTimeGuard(options, fromState?)`

Enforces trading windows, force-close timing, and blackout periods.

```typescript
import { createTimeGuard } from "trendcraft/streaming";

const guard = createTimeGuard({
  tradingWindows: [
    { startMs: 9 * 3600_000, endMs: 11.5 * 3600_000 },   // 9:00-11:30
    { startMs: 12.5 * 3600_000, endMs: 15 * 3600_000 },   // 12:30-15:00
  ],
  timezoneOffsetMs: 9 * 3600_000, // JST
  forceCloseBeforeEndMs: 5 * 60_000,
});

const result = guard.check(Date.now());
if (!result.allowed) console.log("Outside trading hours:", result.reason);
if (result.shouldForceClose) closeAllPositions();

// Dynamically add a blackout period
guard.addBlackout({
  startTime: Date.parse("2024-01-31T19:00:00Z"),
  endTime: Date.parse("2024-01-31T19:30:00Z"),
  reason: "FOMC announcement",
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tradingWindows` | `TradingWindow[]` | — (required) | Trading time windows (`{ startMs, endMs }` offsets from local midnight) |
| `forceCloseBeforeEndMs` | `number` | `0` | Force-close positions N ms before each window ends |
| `timezoneOffsetMs` | `number` | `0` | Timezone offset from UTC in ms (e.g., JST = `9 * 3600_000`) |
| `blackoutPeriods` | `BlackoutPeriod[]` | `[]` | Absolute blackout periods (e.g., economic announcements) |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `check(time)` | `{ allowed, shouldForceClose, reason? }` | Check if trading is allowed at the given time |
| `addBlackout(period)` | `void` | Add a blackout period dynamically |
| `getState()` | `TimeGuardState` | Serialize internal state |

---

#### `createGuardedSession(sessionOptions, guardOptions, fromState?)`

Wraps a `TradingSession` with risk and time guards. Entry signals are checked against guards before being emitted; force-close events are injected when trading windows are about to end.

```typescript
import { createGuardedSession, rsiBelow, rsiAbove } from "trendcraft/streaming";
import { createRsi } from "trendcraft/incremental";

const session = createGuardedSession(
  {
    intervalMs: 60_000,
    pipeline: {
      indicators: [
        { name: "rsi", create: () => createRsi({ period: 14 }) },
      ],
      entry: rsiBelow(30),
      exit: rsiAbove(70),
    },
  },
  {
    riskGuard: { maxDailyLoss: -50000, maxDailyTrades: 20 },
    timeGuard: {
      tradingWindows: [{ startMs: 9 * 3600_000, endMs: 15 * 3600_000 }],
      timezoneOffsetMs: 9 * 3600_000,
      forceCloseBeforeEndMs: 5 * 60_000,
    },
  },
);

const events = session.onTrade({ time: Date.now(), price: 100, volume: 10 });
for (const e of events) {
  if (e.type === "blocked") console.log("Blocked:", e.reason);
  if (e.type === "force-close") closeAllPositions();
}

// Report trade results for risk tracking
session.riskGuard?.reportTrade(-200, Date.now());
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionOptions` | `SessionOptions` | Standard session configuration |
| `guardOptions` | `GuardedSessionOptions` | Guard configuration |
| `guardOptions.riskGuard` | `RiskGuardOptions` | Risk guard config (omit to disable) |
| `guardOptions.timeGuard` | `TimeGuardOptions` | Time guard config (omit to disable) |

**Additional properties on returned session:**

| Property | Type | Description |
|----------|------|-------------|
| `riskGuard` | `RiskGuard \| null` | RiskGuard instance (null if not configured) |
| `timeGuard` | `TimeGuard \| null` | TimeGuard instance (null if not configured) |

---

### Layer 6: Position Management

#### `createPositionTracker(options, fromState?)`

Stateful position and account management with SL/TP/trailing stop detection and P&L calculation.

```typescript
import { createPositionTracker } from "trendcraft/streaming";

const tracker = createPositionTracker({
  capital: 1_000_000,
  stopLoss: 2,
  takeProfit: 6,
  trailingStop: 3,
  commissionRate: 0.1,
  slippage: 0.05,
});

// Open a position
const pos = tracker.openPosition(100, 50, Date.now());

// Check SL/TP/trailing on each candle
const { triggered } = tracker.updatePrice(candle);
if (triggered) {
  console.log(`${triggered.reason} triggered @ ${triggered.price}`);
}

// Manual close
const { trade } = tracker.closePosition(105, Date.now(), "exit-signal");
console.log("P&L:", trade.return);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `capital` | `number` | — (required) | Initial capital |
| `stopLoss` | `number` | `0` | Stop loss in percent (e.g., `2` = exit at -2%) |
| `takeProfit` | `number` | `0` | Take profit in percent (e.g., `6` = exit at +6%) |
| `trailingStop` | `number` | `0` | Trailing stop in percent (e.g., `3` = exit if price drops 3% from peak) |
| `commission` | `number` | `0` | Fixed commission per trade in currency |
| `commissionRate` | `number` | `0` | Commission rate in percent (e.g., `0.1` = 0.1%) |
| `taxRate` | `number` | `0` | Tax rate on profits in percent |
| `slippage` | `number` | `0` | Slippage in percent |
| `maxTradeHistory` | `number` | `1000` | Maximum number of closed trades to keep in memory |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `openPosition(price, shares, time, opts?)` | `ManagedPosition` | Open a new position (optional SL/TP override via `opts`) |
| `updatePrice(candle)` | `{ position, triggered }` | Update price and check SL/TP/trailing triggers |
| `closePosition(price, time, reason)` | `{ trade, fill }` | Close the current position |
| `getPosition()` | `ManagedPosition \| null` | Get the current open position |
| `getAccount()` | `AccountState` | Get current account state |
| `getTrades()` | `Trade[]` | Get all closed trade records |
| `updateStopLoss(price)` | `void` | Update stop loss price for current position |
| `updateTakeProfit(price)` | `void` | Update take profit price for current position |
| `getState()` | `PositionTrackerState` | Serialize internal state |

---

#### `createManagedSession(sessionOptions, guardOptions, positionOptions, fromState?)`

Full end-to-end managed trading session: tick → candle → indicator → signal → position → P&L. Wraps `GuardedSession` with automatic position management, including sizing, SL/TP/trailing, and auto-reporting to RiskGuard.

```typescript
import { createManagedSession, rsiBelow, rsiAbove } from "trendcraft/streaming";
import { createRsi, createAtr } from "trendcraft/incremental";

const session = createManagedSession(
  {
    intervalMs: 60_000,
    pipeline: {
      indicators: [
        { name: "rsi", create: () => createRsi({ period: 14 }) },
        { name: "atr14", create: () => createAtr({ period: 14 }) },
      ],
      entry: rsiBelow(30),
      exit: rsiAbove(70),
    },
  },
  {
    riskGuard: { maxDailyLoss: -50000, maxDailyTrades: 20 },
    timeGuard: {
      tradingWindows: [{ startMs: 9 * 3600_000, endMs: 15 * 3600_000 }],
      timezoneOffsetMs: 9 * 3600_000,
      forceCloseBeforeEndMs: 5 * 60_000,
    },
  },
  {
    capital: 1_000_000,
    sizing: { method: "risk-based", riskPercent: 1 },
    stopLoss: 2,
    takeProfit: 6,
    trailingStop: 3,
    commissionRate: 0.1,
    slippage: 0.05,
  },
);

ws.on("trade", (data) => {
  const events = session.onTrade({
    time: data.timestamp,
    price: data.price,
    volume: data.quantity,
  });
  for (const e of events) {
    if (e.type === "position-opened") console.log("Opened:", e.position.shares);
    if (e.type === "position-closed") console.log("P&L:", e.trade.return);
    if (e.type === "position-update") console.log("Equity:", e.equity);
  }
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionOptions` | `SessionOptions` | Standard session configuration |
| `guardOptions` | `GuardedSessionOptions` | Guard configuration (risk and/or time) |
| `positionOptions` | `PositionManagerOptions` | Position management configuration (see below) |

**`PositionManagerOptions`:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `capital` | `number` | — (required) | Initial capital |
| `sizing` | `PositionSizingConfig` | `{ method: 'full-capital' }` | Position sizing method |
| `stopLoss` | `number` | `0` | Stop loss in percent |
| `takeProfit` | `number` | `0` | Take profit in percent |
| `trailingStop` | `number` | `0` | Trailing stop in percent |
| `commission` | `number` | `0` | Fixed commission per trade |
| `commissionRate` | `number` | `0` | Commission rate in percent |
| `taxRate` | `number` | `0` | Tax rate on profits in percent |
| `slippage` | `number` | `0` | Slippage in percent |
| `maxTradeHistory` | `number` | `1000` | Maximum trade history to keep |

**`PositionSizingConfig` variants:**

| Method | Fields | Description |
|--------|--------|-------------|
| `full-capital` | — | Use all available equity |
| `fixed-fractional` | `fractionPercent` | Invest a fixed percentage of equity |
| `risk-based` | `riskPercent` | Risk a percentage of equity per trade (requires `stopLoss`) |
| `atr-based` | `riskPercent`, `atrKey`, `atrMultiplier?` | ATR-based sizing (default multiplier: `2`) |

**`ManagedEvent` types** (in addition to all `SessionEvent` types):

| Type | Description | Key Fields |
|------|-------------|------------|
| `position-opened` | A position was opened | `position`, `fill`, `candle` |
| `position-closed` | A position was closed | `trade`, `fill`, `account`, `candle` |
| `position-update` | Position P&L update | `unrealizedPnl`, `equity`, `candle` |

**Additional methods on `ManagedSession`:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getPosition()` | `ManagedPosition \| null` | Get current open position |
| `getAccount()` | `AccountState` | Get current account state |
| `getTrades()` | `Trade[]` | Get all closed trade records |
| `closePosition(time, price)` | `ManagedEvent[]` | Manually close current position |
| `updateStopLoss(price)` | `void` | Update stop loss price |
| `updateTakeProfit(price)` | `void` | Update take profit price |

---

## Trade Signals

Unified trade signal format for consumption by automated trading scripts.

### TradeSignal Type

```typescript
type TradeSignal = {
  id: string;              // Unique signal identifier
  time: number;            // Signal timestamp (epoch ms)
  action: TradeAction;     // "BUY" | "SELL" | "CLOSE"
  direction: TradeDirection; // "LONG" | "SHORT"
  confidence: number;      // 0-100
  prices?: PriceLevels;    // { entry, stopLoss?, takeProfit? }
  reasons: SignalReason[];  // [{ source, name, detail? }]
  timeframe?: string;      // e.g., "1d", "4h"
  metadata?: Record<string, unknown>;
};
```

### Signal Converters

Convert existing TrendCraft signal types into the unified `TradeSignal` format.

#### `fromCrossSignal(signal, entryPrice?)`

```typescript
import { fromCrossSignal } from 'trendcraft';

const signals = validateCrossSignals(candles);
const tradeSignals = signals.map(s => fromCrossSignal(s, candles[i].close));
// { action: "BUY", direction: "LONG", confidence: 85, ... }
```

#### `fromDivergenceSignal(signal, entryPrice?)`

```typescript
import { fromDivergenceSignal } from 'trendcraft';

const divSignals = rsiDivergence(candles);
const tradeSignals = divSignals.map(s => fromDivergenceSignal(s, candles[s.secondIdx].close));
```

#### `fromSqueezeSignal(signal, direction?, entryPrice?)`

```typescript
import { fromSqueezeSignal } from 'trendcraft';

const squeezes = bollingerSqueeze(candles);
const tradeSignals = squeezes.map(s => fromSqueezeSignal(s, "LONG", candles[i].close));
```

#### `fromPatternSignal(signal, entryPrice?)`

Maps pattern `target` and `stopLoss` to `TradeSignal.prices`.

```typescript
import { fromPatternSignal } from 'trendcraft';

const patterns = doubleBottom(candles);
const tradeSignals = patterns.map(p => fromPatternSignal(p, 100));
// { prices: { entry: 100, takeProfit: 120, stopLoss: 90 }, ... }
```

#### `fromScoreResult(score, time, options?)`

Converts a `ScoreBreakdown` to a `TradeSignal`. Returns `null` if below threshold.

```typescript
import { fromScoreResult } from 'trendcraft';

const breakdown = calculateScoreBreakdown(candles, signals, i);
const signal = fromScoreResult(breakdown, candle.time, { minScore: 50, entryPrice: 100 });
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minScore` | `number` | `0` | Minimum score threshold |
| `direction` | `'LONG' \| 'SHORT'` | `'LONG'` | Position direction |
| `entryPrice` | `number` | - | Entry price |

#### `fromPipelineResult(result, time, entryPrice?)`

Converts a streaming `PipelineResult` to a `TradeSignal`. Returns `null` when no signal is detected.

```typescript
import { fromPipelineResult } from 'trendcraft';

const result = pipeline.next(candle);
const signal = fromPipelineResult(result, candle.time, candle.close);
```

### Signal Emitter

Wraps a streaming pipeline to automatically emit `TradeSignal` events.

#### `createSignalEmitter(options)`

```typescript
import { streaming } from 'trendcraft';

const emitter = streaming.createSignalEmitter({
  intervalMs: 60000,
  pipeline: {
    indicators: [{ name: 'rsi14', create: () => streaming.incremental.rsi({ period: 14 }) }],
    entry: rsiBelow(30),
    exit: rsiAbove(70),
  },
  onSignal: (signal) => {
    console.log(`${signal.action} at confidence ${signal.confidence}`);
  },
});

for (const trade of trades) {
  emitter.onTrade(trade);
}
emitter.close();
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `intervalMs` | `number` | required | Candle interval in milliseconds |
| `pipeline` | `PipelineOptions` | required | Pipeline configuration |
| `onSignal` | `(signal: TradeSignal) => void` | required | Callback for generated signals |
| `emitPartial` | `boolean` | `false` | Emit partial candle events |
| `warmUp` | `NormalizedCandle[]` | - | Historical candles for indicator warm-up |

---

## Signal Lifecycle

Deduplication and lifecycle management for trade signals.

### SignalManager

#### `createSignalManager(options?, state?)`

Creates a signal manager that filters incoming signals through cooldown, debounce, and expiry rules.

```typescript
import { createSignalManager } from 'trendcraft';

const manager = createSignalManager({
  cooldown: { bars: 5 },    // Suppress duplicates for 5 bars
  debounce: { bars: 3 },    // Require 3 consecutive bars
  expiry: { bars: 10 },     // Expire after 10 bars
});

// Process signals bar by bar
const activated = manager.onBar(incomingSignals, barTime);
// Only newly activated signals are returned

// Mark signals as filled or cancelled
manager.fill(signal.id);
manager.cancel(signal.id);

// Query state
manager.getActiveCount();        // Number of active signals
manager.getSignals('FILLED');    // Get filled signals
manager.getState();              // Serialize for persistence
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cooldown` | `CooldownConfig` | - | Suppress duplicates for N bars or ms |
| `debounce` | `DebounceConfig` | - | Require N consecutive bars to activate |
| `expiry` | `ExpiryConfig` | - | Auto-expire active signals after TTL |
| `signalKey` | `SignalKeyFn` | default | Custom function for signal identity |

**CooldownConfig:** `{ bars?: number; ms?: number }`
**DebounceConfig:** `{ bars: number }`
**ExpiryConfig:** `{ bars?: number; ms?: number }`

**Signal states:** `PENDING` → `ACTIVE` → `EXPIRED` / `FILLED` / `CANCELLED`

**State restoration:**

```typescript
const state = manager.getState();
// Persist state (e.g., to disk)
const restored = createSignalManager(options, state);
```

### Batch Processing

#### `processSignalsBatch(signals, options?)`

Applies lifecycle rules to an array of signals at once. Useful for backtest post-processing.

```typescript
import { processSignalsBatch } from 'trendcraft';

const allSignals = [/* signals from backtest */];
const filtered = processSignalsBatch(allSignals, { cooldown: { bars: 3 } });
// Removes duplicate signals within 3-bar windows
```

---

## Short Selling

TrendCraft supports short selling in both backtest and streaming modes. All short-related fields are optional — omitting `direction` defaults to `"long"` for full backward compatibility.

### Backtest Short Selling

Pass `direction: "short"` in backtest options to simulate short positions.

```typescript
import { runBacktest, deadCross, goldenCross } from 'trendcraft';

const result = runBacktest(
  candles,
  deadCross(5, 25),     // Entry: Dead Cross (short entry)
  goldenCross(5, 25),   // Exit: Golden Cross (short exit)
  {
    capital: 1000000,
    direction: 'short',  // Enable short selling
    stopLoss: 5,         // Triggers at entry * 1.05 (price rises)
    takeProfit: 5,       // Triggers at entry * 0.95 (price drops)
    trailingStop: 3,     // Trails from lowest price (trough)
  }
);

// Short P&L is direction-aware
console.log(result.totalReturnPercent); // Positive when price drops
console.log(result.trades[0].direction); // "short"
```

**Short position behavior:**

| Feature | Long (default) | Short |
|---------|---------------|-------|
| Profit | Price rises | Price drops |
| Stop Loss | `entry * (1 - sl%)` | `entry * (1 + sl%)` |
| Take Profit | `entry * (1 + tp%)` | `entry * (1 - tp%)` |
| Trailing Stop | Tracks peak price, triggers on drop | Tracks trough price, triggers on rise |
| MFE | Max unrealized profit from price rise | Max unrealized profit from price drop |
| MAE | Max unrealized loss from price drop | Max unrealized loss from price rise |

### Streaming Short Selling

The position tracker also supports short positions.

```typescript
import { streaming } from 'trendcraft';

const tracker = streaming.createPositionTracker({
  capital: 100000,
  direction: 'short',
  stopLoss: 5,        // SL at entry * 1.05
  takeProfit: 10,     // TP at entry * 0.90
  trailingStop: 3,    // Trail from trough
});

tracker.openPosition(100, currentTime, 1000);

// Unrealized P&L is direction-aware
const account = tracker.getAccount();
console.log(account.unrealizedPnl); // Positive when price < entry

// Auto-triggers: SL on price rise, TP on price drop
const result = tracker.updatePrice(candle);
if (result.triggered) {
  console.log(result.triggered.reason); // "stop-loss" | "take-profit" | "trailing-stop"
}
```

### Portfolio / Batch Short Selling

Both `batchBacktest()` and `portfolioBacktest()` support short selling through the same `direction` option.

```typescript
import { batchBacktest, deadCross, goldenCross } from 'trendcraft';

// Batch backtest: direction is passed directly in options
const batchResult = batchBacktest(datasets, deadCross(5, 25), goldenCross(5, 25), {
  capital: 3_000_000,
  direction: 'short',
  stopLoss: 5,
  takeProfit: 10,
});

// Portfolio backtest: direction goes inside tradeOptions
const portfolioResult = portfolioBacktest(datasets, deadCross(5, 25), goldenCross(5, 25), {
  capital: 3_000_000,
  allocation: { type: 'equal' },
  maxPositions: 5,
  tradeOptions: {
    direction: 'short',
    stopLoss: 5,
    takeProfit: 10,
  },
});
```

### Short Strategy Recipes

Common short strategy patterns using built-in conditions:

```typescript
import {
  and, rsiAbove, rsiBelow, bollingerTouch, deadCross, goldenCross,
  dmiBearish, anyBearishPattern, stochAbove, stochBelow,
} from 'trendcraft';

// Mean reversion short: overbought reversal
const mrEntry = and(rsiAbove(70), bollingerTouch('upper'));
const mrExit  = rsiBelow(50);

// Trend-following short: confirmed downtrend
const tfEntry = and(deadCross(5, 25), dmiBearish());
const tfExit  = goldenCross(5, 25);

// Pattern-based short: bearish pattern + overbought stochastic
const ptEntry = and(anyBearishPattern(), stochAbove(80));
const ptExit  = stochBelow(20);

const result = runBacktest(candles, tfEntry, tfExit, {
  capital: 1_000_000,
  direction: 'short',
  stopLoss: 5,
  takeProfit: 15,
});
```

---

## Trade Analysis

### `analyzeDrawdowns(periods)`

Analyze drawdown periods from backtest results to produce summary statistics.

```typescript
import { runBacktest, analyzeDrawdowns } from 'trendcraft';

const result = runBacktest(candles, entry, exit, { capital: 1_000_000 });
const summary = analyzeDrawdowns(result.drawdownPeriods);

console.log(`Drawdown count: ${summary.count}`);
console.log(`Worst drawdown: ${summary.maxDepth}%`);
console.log(`Avg recovery: ${summary.avgRecoveryBars} bars`);
console.log(`Recovery rate: ${summary.recoveryRate}%`);
```

**Returns:** `DrawdownSummary`

| Property | Type | Description |
|----------|------|-------------|
| `count` | `number` | Total number of drawdown periods |
| `avgDepth` | `number` | Average drawdown depth (%) |
| `maxDepth` | `number` | Maximum drawdown depth (%) |
| `avgDurationBars` | `number` | Average drawdown duration in bars |
| `maxDurationBars` | `number` | Maximum drawdown duration in bars |
| `avgRecoveryBars` | `number` | Average recovery time in bars |
| `maxRecoveryBars` | `number` | Maximum recovery time in bars |
| `recoveryRate` | `number` | Percentage of drawdowns that recovered |
| `worstDrawdown` | `DrawdownPeriod \| null` | The deepest drawdown period |
| `longestRecovery` | `DrawdownPeriod \| null` | The longest recovery period |

---

### Pattern Projection

Analyze price behavior after pattern/event occurrences to project future returns with statistical confidence bounds.

#### `projectPatternOutcome(candles, events, extractor, options?)`

Generic projection function for any event type.

```typescript
import { projectPatternOutcome, doubleBottom } from 'trendcraft';

const patterns = doubleBottom(candles);
const projection = projectPatternOutcome(
  candles,
  patterns,
  (p) => ({ time: p.time, direction: 'bullish' }),
  { horizon: 30, confidenceLevel: 0.95, thresholds: [1, 2, 5, 10] },
);

console.log(`Valid events: ${projection.validCount}`);
console.log(`Avg return after 10 bars: ${projection.avgReturnByBar[9]}%`);
console.log(`5% hit rate: ${projection.hitRates.find(h => h.threshold === 5)?.rate}%`);
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `horizon` | `number` | `20` | Number of bars to project forward |
| `confidenceLevel` | `number` | `0.95` | Confidence level for upper/lower bounds |
| `thresholds` | `number[]` | `[1,2,5,10]` | Return thresholds for hit rate calculation |

**Returns:** `PatternProjection`

| Property | Type | Description |
|----------|------|-------------|
| `patternCount` | `number` | Total events found |
| `validCount` | `number` | Events with sufficient forward data |
| `avgReturnByBar` | `number[]` | Average return at each bar offset |
| `medianReturnByBar` | `number[]` | Median return at each bar offset |
| `upperBound` | `number[]` | Upper confidence bound |
| `lowerBound` | `number[]` | Lower confidence bound |
| `hitRates` | `HitRate[]` | Hit rates for each threshold |

#### `projectFromPatterns(candles, signals, options?)`

Convenience wrapper for `PatternSignal[]`. Automatically detects direction from pattern type (double_top/head_shoulders → bearish, others → bullish).

```typescript
import { projectFromPatterns, doubleTop, doubleBottom } from 'trendcraft';

const tops = doubleTop(candles);
const projection = projectFromPatterns(candles, tops); // auto bearish
```

#### `projectFromSeries(candles, series, options?)`

Project outcomes from any `Series<T>` where truthy values are events.

```typescript
import { projectFromSeries, crossOver, sma } from 'trendcraft';

const crosses = crossOver(sma(candles, { period: 5 }), sma(candles, { period: 25 }));
const projection = projectFromSeries(candles, crosses, { horizon: 20 });
```

---

## Data Validation

Validate candle data quality before running indicators or backtests.

### `validateCandles(candles, options?)`

Runs all enabled validation checks and returns a unified result.

```typescript
import { validateCandles } from 'trendcraft';

const result = validateCandles(candles);

if (!result.valid) {
  console.log('Errors:', result.errors);
}
console.log('Warnings:', result.warnings);
console.log('Info:', result.info);
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `gaps` | `boolean \| GapDetectionOptions` | `true` | Detect time gaps |
| `duplicates` | `boolean` | `true` | Detect duplicate timestamps |
| `ohlc` | `boolean` | `true` | Check OHLC consistency |
| `spikes` | `boolean \| SpikeDetectionOptions` | `true` | Detect price spikes |
| `volumeAnomalies` | `boolean \| VolumeAnomalyOptions` | `true` | Detect volume anomalies |
| `stale` | `boolean \| StaleDetectionOptions` | `true` | Detect stale/frozen data |
| `splits` | `boolean` | `false` | Detect stock split hints |
| `autoClean` | `boolean` | `false` | Return cleaned candles (deduped, sorted) |

**Detection options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `GapDetectionOptions.maxGapMultiplier` | `number` | `3` | Max gap as multiple of expected interval |
| `GapDetectionOptions.skipWeekends` | `boolean` | `true` | Skip weekends in gap calculation |
| `SpikeDetectionOptions.maxPriceChangePercent` | `number` | `20` | Max single-bar price change (%) |
| `VolumeAnomalyOptions.zScoreThreshold` | `number` | `4` | Z-score threshold |
| `VolumeAnomalyOptions.lookback` | `number` | `20` | Lookback period for mean/std |
| `StaleDetectionOptions.minConsecutive` | `number` | `5` | Min consecutive bars with same close |

**Validation findings:**

| Category | Severity | Description |
|----------|----------|-------------|
| `duplicate` | error | Duplicate timestamps |
| `ohlc` | error | OHLC inconsistency (e.g., high < low) |
| `gap` | warning | Time gaps exceeding threshold |
| `spike` | warning | Single-bar price change exceeding threshold |
| `volume` | warning | Volume z-score exceeding threshold |
| `stale` | warning | Consecutive identical close prices |
| `split` | info | Price ratio matches common split ratios (1:2, 1:3, etc.) |

**Auto-clean example:**

```typescript
const result = validateCandles(candles, { autoClean: true });
if (result.cleanedCandles) {
  // Use cleaned data (duplicates removed, sorted by time)
  const indicators = sma(result.cleanedCandles, { period: 20 });
}
```

### `normalizeAndValidate(candles, validation?)`

Convenience wrapper that normalizes and validates in one step.

```typescript
import { normalizeAndValidate } from 'trendcraft';

const { candles: normalized, validation } = normalizeAndValidate(rawCandles, {
  gaps: true,
  duplicates: true,
  autoClean: true,
});

if (validation && !validation.valid) {
  console.warn('Data quality issues:', validation.errors);
}
```

### Individual Detectors

Each validation check is also available as a standalone function:

```typescript
import {
  detectGaps,
  detectDuplicates,
  removeDuplicates,
  detectOhlcErrors,
  detectPriceSpikes,
  detectVolumeAnomalies,
  detectStaleData,
  detectSplitHints,
} from 'trendcraft';

const gaps = detectGaps(candles, { maxGapMultiplier: 5 });
const dupes = detectDuplicates(candles);
const cleaned = removeDuplicates(candles); // Returns deduped array
const ohlcErrors = detectOhlcErrors(candles);
const spikes = detectPriceSpikes(candles, { maxPriceChangePercent: 15 });
const volumeIssues = detectVolumeAnomalies(candles, { zScoreThreshold: 3 });
const stale = detectStaleData(candles, { minConsecutive: 10 });
const splits = detectSplitHints(candles);
```

---

## Custom Indicators (Plugin System)

Create custom indicators as plugins and add them to the TrendCraft fluent API pipeline.

### When to Use Custom Indicators

Use the plugin system when:
- **Proprietary indicators**: You have custom formulas not included in the 130+ built-in indicators
- **Composite indicators**: Combine multiple built-in indicators into a single series (e.g., SMA spread, multi-factor score)
- **Dynamic pipelines**: Build indicator sets from configuration files or user input at runtime

For most use cases, the built-in shorthand methods (`.sma()`, `.rsi()`, etc.) are sufficient.

### defineIndicator

Helper function to define a type-safe indicator plugin.

```typescript
import { defineIndicator, sma } from "trendcraft";
import type { IndicatorPlugin } from "trendcraft";

const customSma = defineIndicator({
  name: "customSma" as const,
  compute: (candles, opts) => sma(candles, { period: opts.period, source: opts.source }),
  defaultOptions: { period: 20, source: "close" as const },
  buildKey: (opts) => `customSma_${opts.period}`,
});
```

**Plugin interface:**

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` (const) | Unique name used as cache key prefix |
| `compute` | `(candles, options) => Series<T>` | Compute function |
| `defaultOptions` | `TOptions` | Default option values |
| `buildKey` | `(options) => string` (optional) | Custom cache key generator. Falls back to `name_JSON(options)` |

### TrendCraft.use()

Add a plugin to the computation pipeline.

```typescript
import { defineIndicator, TrendCraft, sma, ema } from "trendcraft";

// Define a custom spread indicator
const spread = defineIndicator({
  name: "spread" as const,
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
  buildKey: (opts) => `spread_${opts.fastPeriod}_${opts.slowPeriod}`,
});

// Use in the fluent API
const result = TrendCraft.from(candles)
  .sma(20)                                 // built-in shorthand
  .use(spread, { fastPeriod: 10 })         // custom plugin (slowPeriod defaults to 20)
  .rsi(14)                                 // built-in shorthand
  .compute();

console.log(result.indicators.sma20);
console.log(result.indicators.spread_10_20);
console.log(result.indicators.rsi14);
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `plugin` | `IndicatorPlugin<K, O, V>` | Plugin definition |
| `options` | `Partial<O>` (optional) | Partial options merged with defaults |

**Returns:** `TrendCraft` (chainable)

### Built-in Plugins

All built-in shorthand methods (`.sma()`, `.rsi()`, etc.) are backed by plugins.
You can use them directly with `.use()` for programmatic or dynamic usage:

```typescript
import { TrendCraft, plugins } from "trendcraft";

// Equivalent to .sma(50)
TrendCraft.from(candles).use(plugins.sma, { period: 50 });

// Dynamic plugin selection
const selected = [plugins.sma, plugins.rsi];
let tc = TrendCraft.from(candles);
for (const p of selected) {
  tc = tc.use(p);
}
const result = tc.compute();
```

**Available built-in plugins:**

| Plugin | Shorthand | Default Options |
|--------|-----------|-----------------|
| `plugins.sma` | `.sma()` | `{ period: 20, source: "close" }` |
| `plugins.ema` | `.ema()` | `{ period: 20, source: "close" }` |
| `plugins.rsi` | `.rsi()` | `{ period: 14 }` |
| `plugins.macd` | `.macd()` | `{ fast: 12, slow: 26, signal: 9 }` |
| `plugins.bollingerBands` | `.bollingerBands()` | `{ period: 20, stdDev: 2, source: "close" }` |
| `plugins.atr` | `.atr()` | `{ period: 14 }` |
| `plugins.volumeMa` | `.volumeMa()` | `{ period: 20, maType: "sma" }` |
| `plugins.highest` | `.highest()` | `{ period: 20 }` |
| `plugins.lowest` | `.lowest()` | `{ period: 20 }` |
| `plugins.returns` | `.returns()` | `{ period: 1, returnType: "simple" }` |
| `plugins.parabolicSar` | `.parabolicSar()` | `{ step: 0.02, max: 0.2 }` |
| `plugins.keltnerChannel` | `.keltnerChannel()` | `{ emaPeriod: 20, atrPeriod: 10, multiplier: 2 }` |
| `plugins.cmf` | `.cmf()` | `{ period: 20 }` |
| `plugins.volumeAnomaly` | `.volumeAnomalyIndicator()` | `{ period: 20, highThreshold: 2.0 }` |
| `plugins.volumeProfileSeries` | `.volumeProfileIndicator()` | `{ period: 20 }` |
| `plugins.volumeTrend` | `.volumeTrendIndicator()` | `{ pricePeriod: 10, volumePeriod: 10 }` |

---

## Signal Explainability

Traces why a signal fired, which indicators contributed, their values,
which conditions passed/failed, with human-readable narrative.

### `explainSignal(candles, index, entryCondition, exitCondition, options?, mtfContext?)`

Explain a signal evaluation at a specific candle index. Traces both entry and exit conditions.

```typescript
import { explainSignal, rsiBelow, rsiAbove, and, goldenCrossCondition } from "trendcraft";

const entry = and(goldenCrossCondition(), rsiBelow(40));
const exit = rsiAbove(70);

const explanation = explainSignal(candles, 50, entry, exit);
console.log(explanation.fired);          // true/false
console.log(explanation.signalType);     // "entry" | "exit"
console.log(explanation.narrative);      // Human-readable text
console.log(explanation.contributions);  // Leaf condition details
console.log(explanation.trace);          // Full condition tree
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeValues` | `boolean` | `true` | Include indicator values in trace |
| `maxDepth` | `number` | `10` | Maximum trace recursion depth |
| `language` | `'en' \| 'ja'` | `'en'` | Narrative output language |

**Returns:** `SignalExplanation` with `signalType`, `fired`, `time`, `candle`, `trace`, `contributions`, `narrative`.

### `explainCondition(candles, index, condition, options?, mtfContext?)`

Trace a single condition evaluation at a specific candle index.

```typescript
import { explainCondition, rsiBelow } from "trendcraft";

const trace = explainCondition(candles, 50, rsiBelow(30));
console.log(trace.passed);          // true/false
console.log(trace.indicatorValues); // { rsi14: 28.5 }
```

**Returns:** `ConditionTrace` with `name`, `passed`, `indicatorValues`, `reason`, `type`, `children?`.

### `traceCondition(condition, indicators, candle, index, candles, mtfContext?, options?, depth?)`

Low-level condition tracing. Recursively traces combined conditions (and/or/not) and captures indicator cache state.

### `generateNarrative(trace, signalType, fired, candle, language?)`

Generate a human-readable narrative string from a condition trace.

```typescript
const narrative = generateNarrative(trace, "entry", true, candle, "ja");
// => "エントリーシグナルは終値=150で発火しました。rsiBelow(30): 成立 (rsi14 = 28.5)"
```

---

## Composable Indicator Algebra

Provides `pipe()`, `compose()`, and adapter functions for chaining indicator calculations. Bridges indicators that accept `Candle[]` and those that return `Series<T>`.

### `pipe(source, ...transforms)`

Pipe a value through a series of transform functions.

```typescript
import { pipe, through, extractField, rsi, ema, macd, bollingerBands } from "trendcraft";

// EMA of RSI
const smoothedRsi = pipe(
  candles,
  c => rsi(c, { period: 14 }),
  through(ema, { period: 9 }),
);

// Bollinger Bands of MACD histogram
const bbOfHist = pipe(
  candles,
  c => macd(c),
  s => extractField(s, "histogram"),
  through(bollingerBands, { period: 20 }),
);
```

### `compose(...fns)`

Compose multiple transforms into a single function (right-to-left).

```typescript
import { compose, applyIndicator, rsi, ema } from "trendcraft";

const smoothedRsi = compose(
  (s: Series<number|null>) => applyIndicator(s, ema, { period: 9 }),
  (c: NormalizedCandle[]) => rsi(c, { period: 14 }),
);
const result = smoothedRsi(candles);
```

### `through(indicator, options?)`

Create an indicator step for use in `pipe()` that converts Series to candles and applies an indicator.

### `applyIndicator(series, indicator, options?)`

Apply an indicator function that expects candles to a `Series<number|null>`. Internally converts via `seriesToCandles`.

### `seriesToCandles(series, options?)`

Convert a `Series<number|null>` to pseudo `NormalizedCandle[]` for use as input to indicators. Non-null values become OHLC (all the same value).

### `extractField(series, field)`

Extract a numeric field from a complex series to create a `Series<number|null>`.

```typescript
const histogram = extractField(macd(candles), "histogram");
```

### `mapValues(series, fn)`

Map series values through a transform function.

```typescript
const normalized = mapValues(rsiSeries, v => v !== null ? v / 100 : null);
```

### `combineSeries(a, b, fn)`

Combine two series point-by-point (aligned by index).

```typescript
const spread = combineSeries(seriesA, seriesB, (a, b) =>
  a !== null && b !== null ? a - b : null
);
```

---

## Alpha Decay Monitor

Tracks whether a strategy's predictive power degrades over time using rolling Information Coefficient (IC), hit rate, and CUSUM structural break detection.

### `analyzeAlphaDecay(observations, options?)`

Analyze alpha decay from a sequence of signal/return observations.

```typescript
import { analyzeAlphaDecay, createObservationsFromTrades } from "trendcraft";

const observations = createObservationsFromTrades(result.trades);
const decay = analyzeAlphaDecay(observations);

console.log(decay.assessment.status);      // "healthy" | "warning" | "degraded" | "critical"
console.log(decay.assessment.reason);      // Human-readable assessment
console.log(decay.assessment.currentIC);   // Current Information Coefficient
console.log(decay.assessment.halfLife);     // Estimated half-life in bars (or null)
console.log(decay.rollingIC);              // Rolling IC series
console.log(decay.rollingHitRate);         // Rolling hit rate series
console.log(decay.breaks);                 // CUSUM structural break points
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `window` | `number` | `60` | Rolling window size |
| `cusumThreshold` | `number` | `4.0` | CUSUM detection threshold |
| `minObservations` | `number` | `30` | Minimum observations required |

### `createObservationsFromTrades(trades)`

Convert backtest trades into decay observations. Sets signal=1 for all trades (long bias).

### `createObservationsFromScores(scores, candles, forwardBars?)`

Pair signal scores with actual forward returns from candle data.

```typescript
const observations = createObservationsFromScores(scoreSeries, candles, 5);
const decay = analyzeAlphaDecay(observations);
```

### `spearmanCorrelation(x, y)`

Spearman rank correlation coefficient with p-value.

**Returns:** `{ rho: number, pValue: number }`

---

## Adaptive Indicators

Indicators whose parameters dynamically adjust based on market conditions (volatility, trend strength).

### `adaptiveRsi(candles, options?)`

RSI whose period adapts based on market volatility. High volatility uses a shorter period (faster response), low volatility uses a longer period (smoother).

```typescript
import { adaptiveRsi } from "trendcraft";

const result = adaptiveRsi(candles, { basePeriod: 14, minPeriod: 6, maxPeriod: 28 });
result.forEach(p => console.log(`RSI: ${p.value.rsi}, Period: ${p.value.effectivePeriod}`));
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `basePeriod` | `number` | `14` | Base RSI period |
| `minPeriod` | `number` | `6` | Minimum period (high volatility) |
| `maxPeriod` | `number` | `28` | Maximum period (low volatility) |
| `atrPeriod` | `number` | `14` | ATR period for volatility measurement |
| `volLookback` | `number` | `100` | Volatility lookback for normalization |

**Returns:** `Series<{ rsi: number | null, effectivePeriod: number, volatilityPercentile: number | null }>`

### `adaptiveBollinger(candles, options?)`

Bollinger Bands where the standard deviation multiplier adapts based on rolling kurtosis. Fat tails (high kurtosis) produce wider bands.

```typescript
const result = adaptiveBollinger(candles, { period: 20, baseStdDev: 2 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | `number` | `20` | SMA period |
| `baseStdDev` | `number` | `2` | Base standard deviation multiplier |
| `kurtosisLookback` | `number` | `100` | Lookback for kurtosis calculation |
| `minMultiplier` | `number` | `1.5` | Minimum band multiplier |
| `maxMultiplier` | `number` | `3.0` | Maximum band multiplier |

**Returns:** `Series<{ upper, middle, lower, bandwidth, effectiveMultiplier, kurtosis }>`

### `adaptiveMa(candles, options?)`

Moving average that adjusts smoothing speed based on the Efficiency Ratio (ER). Trending markets get fast smoothing; choppy markets get slow smoothing.

```typescript
const result = adaptiveMa(candles, { erPeriod: 10 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `erPeriod` | `number` | `10` | Efficiency ratio lookback period |
| `fastConstant` | `number` | `0.6667` | Fast smoothing constant |
| `slowConstant` | `number` | `0.0645` | Slow smoothing constant |

**Returns:** `Series<{ value: number | null, efficiencyRatio: number | null, smoothingConstant: number | null }>`

### `adaptiveStochastics(candles, options?)`

Stochastic oscillator whose lookback period adapts based on ADX trend strength. Strong trends use longer periods to avoid whipsaws; weak trends use shorter periods for responsiveness.

```typescript
const result = adaptiveStochastics(candles, { basePeriod: 14, adxThreshold: 40 });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `basePeriod` | `number` | `14` | Base stochastic lookback |
| `minPeriod` | `number` | `5` | Minimum period (low ADX) |
| `maxPeriod` | `number` | `21` | Maximum period (high ADX) |
| `adxPeriod` | `number` | `14` | ADX period |
| `adxThreshold` | `number` | `40` | ADX threshold for full adaptation |
| `kSmoothing` | `number` | `3` | K line smoothing period |
| `dSmoothing` | `number` | `3` | D line smoothing period |

**Returns:** `Series<{ k: number | null, d: number | null, effectivePeriod: number, adx: number | null }>`

---

## Strategy Robustness Score

Composite robustness grading (A+ to F) for backtest strategies. Evaluates Monte Carlo survival, trade consistency, drawdown resilience, parameter sensitivity, walk-forward efficiency, and regime consistency.

### `quickRobustnessScore(result, options?)`

Quick robustness assessment from a single backtest result. No re-running of backtests needed.

```typescript
import { quickRobustnessScore } from "trendcraft";

const robustness = quickRobustnessScore(result);
console.log(`Grade: ${robustness.grade} (${robustness.compositeScore}/100)`);
console.log(robustness.assessment);
console.log(robustness.recommendations);
console.log(robustness.dimensions); // { monteCarlo, tradeConsistency, drawdownResilience }
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `monteCarloSimulations` | `number` | `300` | Number of Monte Carlo simulations |
| `seed` | `number` | - | Random seed for reproducibility |

**Returns:** `QuickRobustnessResult` with `compositeScore` (0-100), `grade` (A+ to F), `dimensions`, `assessment`, `recommendations`.

### `calculateRobustnessScore(candles, originalResult, createStrategy, parameterRanges, options?)`

Full robustness analysis. Requires candles, strategy definition, and parameter ranges. Evaluates all four dimensions: Monte Carlo, parameter sensitivity, walk-forward efficiency, and regime consistency.

```typescript
import { calculateRobustnessScore } from "trendcraft";

const robustness = calculateRobustnessScore(
  candles,
  result,
  (params) => ({
    entry: and(rsiBelow(params.rsiThreshold), goldenCrossCondition(params.shortMA, params.longMA)),
    exit: rsiAbove(70),
    options: { capital: 1_000_000 },
  }),
  [
    { name: "rsiThreshold", min: 20, max: 40, step: 5 },
    { name: "shortMA", min: 3, max: 10, step: 1 },
    { name: "longMA", min: 20, max: 40, step: 5 },
  ],
);
console.log(`Grade: ${robustness.grade}`);
```

**Returns:** `RobustnessResult` with `compositeScore`, `grade`, `dimensions` (monteCarlo, parameterSensitivity, walkForward, regimeConsistency), `assessment`, `recommendations`.

### `scoreToGrade(score)`

Convert a numeric score (0-100) to a letter grade.

```typescript
scoreToGrade(92); // "A+"
scoreToGrade(75); // "B+"
scoreToGrade(30); // "D"
```

Grade scale: A+ (90+), A (80+), B+ (70+), B (60+), C+ (50+), C (40+), D (25+), F (<25).

---

## Pairs Trading

Statistical arbitrage tools for pairs trading. Includes cointegration testing (Engle-Granger method), spread calculation, mean reversion analysis, and signal generation.

### `analyzePair(seriesA, seriesB, options?)`

Full pairs trading analysis between two instruments.

```typescript
import { analyzePair } from "trendcraft";

const result = analyzePair(
  candlesGOOG.map(c => ({ time: c.time, value: c.close })),
  candlesMSFT.map(c => ({ time: c.time, value: c.close })),
  { entryThreshold: 2.0, exitThreshold: 0.5 },
);

if (result.cointegration.isCointegrated) {
  console.log(`Hedge ratio: ${result.cointegration.hedgeRatio}`);
  console.log(`Half-life: ${result.meanReversion.halfLife} bars`);
  console.log(`Viable: ${result.assessment.isViable}`);
}
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `significanceLevel` | `number` | `0.05` | Significance level for ADF test |
| `entryThreshold` | `number` | `2.0` | Z-score threshold for signal entry |
| `exitThreshold` | `number` | `0.5` | Z-score threshold for signal exit |
| `maxHalfLife` | `number` | `100` | Maximum half-life to consider mean-reverting |
| `rollingWindow` | `number` | `0` | Rolling window for z-score (0 = full sample) |

**Returns:** `PairsAnalysisResult` with `cointegration`, `meanReversion`, `spreadSeries`, `signals`, `assessment`.

### `adfTest(series, maxLag?)`

Augmented Dickey-Fuller test for stationarity.

```typescript
const result = adfTest(residuals);
if (result.adfStatistic < result.criticalValues["5%"]) {
  console.log("Series is stationary at 5% significance");
}
```

**Returns:** `{ adfStatistic, pValue, criticalValues: { "1%", "5%", "10%" }, lag }`

### `calculateSpread(seriesY, seriesX, hedgeRatio, intercept, times, options?)`

Calculate spread and z-scores between two price series given a hedge ratio.

**Returns:** `SpreadPoint[]` with `time`, `spread`, `zScore`, `mean`, `stdDev`.

### `analyzeMeanReversion(spreads, maxHalfLife?)`

Analyze mean reversion properties using AR(1) half-life and Hurst exponent (R/S analysis).

**Returns:** `{ halfLife, lambda, isMeanReverting, hurstExponent }`

### `olsRegression(x, y)`

Ordinary Least Squares regression.

**Returns:** `{ beta, intercept, rSquared, residuals }`

---

## Cross-Asset Correlation

Analyzes correlation dynamics between two assets, including rolling correlation, regime detection, lead-lag relationships, and intermarket divergence.

### `analyzeCorrelation(seriesA, seriesB, options?)`

Full cross-asset correlation analysis.

```typescript
import { analyzeCorrelation } from "trendcraft";

const analysis = analyzeCorrelation(
  candlesSPY.map(c => ({ time: c.time, value: c.close })),
  candlesQQQ.map(c => ({ time: c.time, value: c.close })),
  { window: 60 },
);
console.log(`Average correlation: ${analysis.summary.avgCorrelation}`);
console.log(`Current regime: ${analysis.summary.currentRegime}`);
console.log(`Lead-lag: ${analysis.leadLag.assessment}`);
console.log(`Divergences: ${analysis.divergences.length}`);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `window` | `number` | `60` | Rolling correlation window |
| `maxLag` | `number` | `10` | Maximum lag for lead-lag analysis |
| `regimeThresholds` | `object` | - | Custom regime thresholds (strongPositive, positive, negative, strongNegative) |
| `divergenceLookback` | `number` | `20` | Lookback for divergence detection |
| `divergenceThreshold` | `number` | `2.0` | Z-score threshold for divergence |

**Returns:** `CorrelationAnalysisResult` with `rollingCorrelation`, `regimes`, `leadLag`, `divergences`, `summary`.

### `rollingCorrelation(returnsA, returnsB, times, window?)`

Calculate rolling Pearson and Spearman correlation between two return series.

**Returns:** `CorrelationPoint[]` with `time`, `pearson`, `spearman`.

### `pearsonCorrelation(x, y)`

Pearson correlation coefficient between two arrays.

**Returns:** `number` (-1 to 1)

### `spearmanRankCorrelation(x, y)`

Spearman rank correlation coefficient between two arrays.

**Returns:** `number` (-1 to 1)

### `detectCorrelationRegimes(correlationSeries, options?)`

Classify each point in a rolling correlation series into regimes: `strong_positive`, `positive`, `neutral`, `negative`, `strong_negative`.

**Returns:** `CorrelationRegimePoint[]` with `time`, `regime`, `correlation`, `regimeDuration`.

### `analyzeLeadLag(returnsA, returnsB, options?)`

Analyze lead-lag relationship using cross-correlation at various lags. Positive optimal lag means A leads B; negative means B leads A.

```typescript
const result = analyzeLeadLag(returnsA, returnsB, { maxLag: 5 });
console.log(`Optimal lag: ${result.optimalLag}`);
```

**Returns:** `LeadLagResult` with `optimalLag`, `crossCorrelation`, `maxCorrelation`, `assessment`.

### `detectIntermarketDivergence(pricesA, pricesB, times, options?)`

Detect intermarket divergences where one asset moves up while a correlated asset moves down. Uses z-score of the rolling return spread.

**Returns:** `DivergencePoint[]` with `time`, `type` (`'bullish'` | `'bearish'`), `returnA`, `returnB`, `returnSpread`, `significance`.

---

## Live Streaming & Series Metadata

Infrastructure for real-time candle/indicator processing and for attaching domain metadata to indicator output. All symbols are optional — the library works end-to-end without touching them.

### `createLiveCandle(options, fromState?)`

Unified tick/candle aggregator with pluggable incremental indicators and an event bus. Supports both **tick mode** (aggregates raw trades) and **candle mode** (accepts pre-formed candles). State is fully serializable via `getState()` / `fromState`.

```typescript
import { createLiveCandle, incremental } from "trendcraft";

const live = createLiveCandle({
  intervalMs: 60_000,
  indicators: [
    { name: "sma20", create: (s) => incremental.createSma({ period: 20 }, { fromState: s }) },
    { name: "rsi14", create: (s) => incremental.createRsi({ period: 14 }, { fromState: s }) },
  ],
  history: historicalCandles,
  maxHistory: 500,
});

live.on("tick", ({ candle, snapshot, isNewCandle }) => updateChart(candle, snapshot));
live.on("candleComplete", ({ candle, snapshot }) => {
  console.log("Closed:", candle.close, "SMA20:", snapshot.sma20);
});

// Tick mode
ws.on("trade", (t) => live.addTick(t));

// Candle mode
live.addCandle(formedCandle);
live.addCandle(partialCandle, { partial: true });
```

**Options:**

| Option | Type | Description |
|---|---|---|
| `intervalMs` | `number?` | Candle interval in ms. Required for tick mode; omit for candle mode. |
| `indicators` | `LiveIndicatorFactory[]?` | Initial indicators to register (can also add dynamically via `addIndicator`). |
| `history` | `NormalizedCandle[]?` | Historical candles used only for context (not emitted). |
| `maxHistory` | `number?` | Cap on the number of completed candles kept in memory. |

**Methods:**

| Method | Description |
|---|---|
| `addTick(trade)` | Feed a trade tick (tick mode). |
| `addCandle(candle, opts?)` | Feed a candle. `opts.partial = true` for forming candles. |
| `addIndicator({ name, create })` | Register an indicator factory after construction. |
| `removeIndicator(name)` | Remove an indicator. |
| `snapshot()` | Get the current indicator snapshot (keyed by registered name). |
| `completedCandles` | Readonly array of closed candles since start. |
| `formingCandle` | The in-progress candle, or `null`. |
| `on(event, handler)` / `off(event, handler)` | Event subscription. Events: `tick`, `candleComplete`. |
| `getState()` | Serialize state (aggregator + indicators + completed candles). |

### `livePresets`

A registry of 76 incremental indicator presets bundling factory + metadata + default params + snapshot-name convention. Usable by any consumer that wants to register indicators by string id with zero config (UI forms, renderers, screeners, etc.).

```typescript
import { livePresets } from "trendcraft";

const sma = livePresets.sma;
// {
//   meta: { kind: 'sma', label: 'SMA', overlay: true, ... },
//   defaultParams: { period: 20 },
//   snapshotName: (p) => `sma${p.period}`,
//   createFactory: (params) => (fromState) => IncrementalIndicator,
// }

// Instantiate an indicator from the registry
const factory = sma.createFactory({ period: 50 });
const rsiIndicator = factory(undefined); // no prior state
```

**Entry shape (`LivePreset`):**

| Field | Type | Description |
|---|---|---|
| `meta` | `SeriesMeta` | Rendering metadata (kind, label, overlay, yRange, referenceLines). |
| `defaultParams` | `Record<string, unknown>` | Default parameters when user passes `{}`. |
| `snapshotName` | `(params) => string` | Derive the snapshot key (e.g. `"sma20"`) for this instance. |
| `createFactory` | `(params) => LiveIndicatorFactory` | Build the incremental factory closed over the given params. |

### `indicatorPresets`

Extends `livePresets` with batch `compute(candles, params)` functions, giving a single registry that supports both static (snapshot-at-a-time) and streaming (bar-by-bar) modes. 95 entries.

```typescript
import { indicatorPresets } from "trendcraft";

const rsi = indicatorPresets.rsi;

// Static mode — one-shot computation
const series = rsi.compute(candles, { period: 14 });

// Streaming mode — use createFactory for incremental updates
const factory = rsi.createFactory({ period: 14 });
```

**Entry shape (`IndicatorPreset` extends `LivePreset`):**

| Field | Type | Description |
|---|---|---|
| ...all `LivePreset` fields | — | — |
| `compute` | `(candles, params) => Series<T>` | Batch compute for static mode. |
| `category` | `IndicatorCategory` | Grouping hint for UI (`"momentum"`, `"trend"`, etc.). |
| `paramSchema` | `ParamSchema?` | Parameter schema for automatic UI form generation. |

### `tagSeries` / `SeriesMeta`

Attach domain metadata to any `Series<T>` via a non-enumerable `__meta` property. Every built-in indicator already tags its output. Use `tagSeries` on your own indicators if you want downstream consumers (renderers, UI generators, etc.) to pick up the same conventions.

```typescript
import { tagSeries, rsi, type SeriesMeta } from "trendcraft";

const r = rsi(candles, { period: 14 });
r.__meta;
// {
//   kind: "rsi",
//   label: "RSI(14)",
//   overlay: false,
//   yRange: [0, 100],
//   referenceLines: [30, 70],
// }

const myCustom = tagSeries(myData, {
  label: "Custom Score",
  overlay: false,
  yRange: [0, 1],
  referenceLines: [0.5],
});
```

**`SeriesMeta` fields:**

| Field | Type | Description |
|---|---|---|
| `kind` | `string?` | Parameter-independent identifier (e.g. `"sma"`, `"rsi"`, `"macd"`). Matches `indicatorPresets` keys. Use for identity matching. |
| `label` | `string` | Display label, typically parameterized (e.g. `"SMA(20)"`, `"MACD(12, 26, 9)"`). Changes with parameter values. |
| `overlay` | `boolean` | `true` = share the price scale (overlay on main pane). `false` = needs its own scale (sub-pane). |
| `yRange` | `[min, max]?` | Fixed Y-axis range (e.g. `[0, 100]` for oscillators). |
| `referenceLines` | `number[]?` | Horizontal reference line values (e.g. `[30, 70]` for RSI). |

A renderer may translate `overlay` to pane placement and `yRange` to an axis config; non-rendering consumers can ignore the metadata entirely.

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

type PriceSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'volume';
```

### Signal Types

```typescript
type SignalType = 'bullish' | 'bearish';

interface Signal {
  time: number;
  type: SignalType;
}
```

---

## Error Handling Guide

TrendCraft provides two approaches for error handling:

### Throw Version (Default)

All indicator functions throw on invalid parameters. Use `try/catch` for error handling:

```typescript
import { rsi, sma } from "trendcraft";

try {
  const result = rsi(candles, { period: 14 });
} catch (error) {
  console.error(error.message);
}
```

Best for: Internal calculations, performance-critical paths, scripts.

### Safe Version (Result-returning)

Every indicator has a Safe counterpart accessible via the `safe` namespace.
These return `Result<T>` instead of throwing:

```typescript
import { safe } from "trendcraft";

const result = safe.rsiSafe(candles, { period: 14 });
if (result.ok) {
  console.log(result.value); // Series<number | null>
} else {
  console.error(result.error.code);    // "INDICATOR_ERROR"
  console.error(result.error.message); // Human-readable message
}
```

Best for: User-facing applications, pipelines with fallback logic, batch processing.

### toResult Utility

Wrap any throwing function into a Result:

```typescript
import { toResult } from "trendcraft";

const result = toResult(() => someThrowingFunction(), "INDICATOR_ERROR");
```

### Error Codes

| Code | Description |
|------|-------------|
| `INDICATOR_ERROR` | Indicator computation failure (invalid parameters, etc.) |
| `INVALID_PARAMETER` | Invalid parameter value |
| `INSUFFICIENT_DATA` | Not enough data points |
| `NO_DATA` | Empty input data |
| `COMPUTATION_FAILED` | General computation failure |
| `OPTIMIZATION_FAILED` | Optimization process failure |
| `BACKTEST_FAILED` | Backtest execution failure |
| `SCREENING_FAILED` | Screening process failure |

### Recommendation

- **Library consumers**: Prefer Safe versions for robustness

---

## Wyckoff Analysis (VSA + Phase Detection)

### `vsa(candles, options?)`

Volume Spread Analysis — classifies each bar by the relationship between volume, spread, and close position.

```typescript
import { vsa } from "trendcraft";

const vsaBars = vsa(candles, { volumeMaPeriod: 20, atrPeriod: 14 });
const last = vsaBars[vsaBars.length - 1].value;
// last.barType: 'noSupply' | 'noDemand' | 'stoppingVolume' | 'climacticAction'
//             | 'test' | 'upthrust' | 'spring' | 'absorption'
//             | 'effortUp' | 'effortDown' | 'normal'
// last.spreadRelative: number (1.0 = average)
// last.closePosition: number (0 = low, 1 = high)
// last.volumeRelative: number (1.0 = average)
// last.isEffortDivergence: boolean
```

| Option | Default | Description |
|--------|---------|-------------|
| `volumeMaPeriod` | `20` | Volume MA period |
| `atrPeriod` | `14` | ATR period for spread normalization |
| `highVolumeThreshold` | `1.5` | Relative volume threshold for "high" |
| `lowVolumeThreshold` | `0.7` | Relative volume threshold for "low" |
| `wideSpreadThreshold` | `1.2` | Relative spread threshold for "wide" |
| `narrowSpreadThreshold` | `0.7` | Relative spread threshold for "narrow" |

### `wyckoffPhases(candles, options?)`

Wyckoff Phase Detection — identifies accumulation/distribution phases and schematic events using a state machine driven by VSA, swing points, and BOS/CHoCH.

```typescript
import { wyckoffPhases } from "trendcraft";

const phases = wyckoffPhases(candles, { swingPeriod: 5, minRangeBars: 20 });
const last = phases[phases.length - 1].value;
// last.phase: 'accumulation' | 'markup' | 'distribution' | 'markdown' | 'unknown'
// last.event: 'PS' | 'SC' | 'AR' | 'ST' | 'spring' | 'SOS' | 'LPS' | ... | null
// last.confidence: 0-100
// last.eventsDetected: WyckoffEvent[]
// last.rangeHigh / last.rangeLow: range boundaries
```

| Option | Default | Description |
|--------|---------|-------------|
| `swingPeriod` | `5` | Swing point detection period |
| `minRangeBars` | `20` | Minimum bars for a trading range |
| `atrPeriod` | `14` | ATR period |
| `volumeMaPeriod` | `20` | Volume MA period |
| `rangeTolerance` | `0.5` | ATR multiplier for range boundary tolerance |

---

## Meta-Strategy (Equity Curve Trading)

### `applyEquityCurveFilter(result, options?)`

Filters a backtest result by analyzing the equity curve health. Skips or reduces trades when the equity is below its MA, in excessive drawdown, or has low win rate.

```typescript
import { runBacktest, applyEquityCurveFilter } from "trendcraft";

const result = runBacktest(candles, entry, exit, { capital: 100000 });
const analysis = applyEquityCurveFilter(result, {
  type: 'ma',
  maPeriod: 10,
  filteredSizeFactor: 0, // 0 = skip, 0.5 = half size
});
console.log(analysis.tradesSkipped);
console.log(analysis.improvement.maxDrawdown); // positive = improvement
```

| Option | Default | Description |
|--------|---------|-------------|
| `type` | `'ma'` | Filter type: `'ma'`, `'drawdown'`, `'winRate'`, `'combined'` |
| `maPeriod` | `20` | MA period (in trades) |
| `maType` | `'sma'` | `'sma'` or `'ema'` |
| `maxDrawdown` | `0.15` | Max drawdown threshold for pause |
| `winRateWindow` | `20` | Rolling window for win rate |
| `minWinRate` | `0.4` | Minimum win rate to continue |
| `filteredSizeFactor` | `0` | Size factor when filtered (0 = skip) |

### `equityCurveHealth(result, options?)`

Assess the current health of a strategy's equity curve.

```typescript
import { equityCurveHealth } from "trendcraft";

const health = equityCurveHealth(result, { maPeriod: 10 });
// health.aboveMa: boolean
// health.currentDrawdown: 0-1
// health.rollingWinRate: 0-1
// health.healthScore: 0-100
```

### `rotateStrategies(results, options?)`

Rank multiple strategies by recent performance and allocate capital.

```typescript
import { rotateStrategies } from "trendcraft";

const rotation = rotateStrategies([resultA, resultB, resultC], {
  lookbackTrades: 20,
  rankingMetric: 'returnPercent',
  allocationMethod: 'proportional',
});
// rotation.allocations: [{ strategyIndex, weight, metricValue }]
// rotation.rankings: [bestIdx, ..., worstIdx]
```

| Option | Default | Description |
|--------|---------|-------------|
| `lookbackTrades` | `20` | Recent trades for ranking |
| `rankingMetric` | `'returnPercent'` | `'returnPercent'`, `'sharpeRatio'`, `'profitFactor'`, `'winRate'` |
| `maxActiveStrategies` | all | Max strategies to allocate to |
| `minAllocation` | `0.05` | Minimum allocation per strategy |
| `allocationMethod` | `'proportional'` | `'equal'`, `'proportional'`, `'topN'` |

---

## Risk Analytics (VaR / CVaR / Risk Parity)

### `calculateVaR(returns, options?)`

Calculate Value at Risk and Conditional VaR (Expected Shortfall).

```typescript
import { calculateVaR } from "trendcraft";

const result = calculateVaR(dailyReturns, {
  confidence: 0.95,
  method: 'historical', // 'historical' | 'parametric' | 'cornishFisher'
});
// result.var: 0.025 (2.5% potential loss)
// result.cvar: 0.035 (3.5% average loss beyond VaR)
// result.skewness, result.kurtosis
```

| Option | Default | Description |
|--------|---------|-------------|
| `confidence` | `0.95` | Confidence level |
| `method` | `'historical'` | `'historical'`, `'parametric'`, `'cornishFisher'` |

### `rollingVaR(returns, options?)`

Rolling window VaR/CVaR calculation.

```typescript
import { rollingVaR } from "trendcraft";

const rolling = rollingVaR(dailyReturns, { window: 60, confidence: 0.95 });
// rolling[i]: { var: number, cvar: number }
```

### `riskParityAllocation(returnsSeries, options?)`

Calculate risk parity allocation weights that equalize risk contribution across assets.

```typescript
import { riskParityAllocation } from "trendcraft";

const result = riskParityAllocation({
  SPY: spyReturns,
  TLT: tltReturns,
  GLD: gldReturns,
});
// result.weights: { SPY: 0.20, TLT: 0.45, GLD: 0.35 }
// result.riskContributions: approximately equal
// result.portfolioVolatility: number
// result.correlationMatrix: number[][]
```

### `correlationAdjustedSize(currentReturns, portfolioReturns, options)`

Adjust position size based on correlation with existing portfolio holdings.

```typescript
import { correlationAdjustedSize } from "trendcraft";

const result = correlationAdjustedSize(stockReturns, [pos1Returns, pos2Returns], {
  baseSize: 10000,
  lowCorrelationThreshold: 0.3,
  highCorrelationThreshold: 0.7,
  minSizeFactor: 0.25,
});
// result.adjustedSize: 7500
// result.sizeFactor: 0.75
// result.averageCorrelation: 0.5
```

---

## Wyckoff / VSA

### `vsa(candles, options?)`

Volume Spread Analysis — classifies each bar based on the relationship between spread (range), close position within the bar, and relative volume.

```typescript
import { vsa } from "trendcraft";

const result = vsa(candles, {
  volumeMaPeriod: 20,
  atrPeriod: 14,
  highVolumeThreshold: 1.5,
  lowVolumeThreshold: 0.7,
  wideSpreadThreshold: 1.2,
  narrowSpreadThreshold: 0.7,
});
// result[]: { time, value: { barType, spreadRelative, closePosition, volumeRelative, isEffortDivergence } }
```

| Option | Default | Description |
|--------|---------|-------------|
| `volumeMaPeriod` | `20` | Period for volume moving average |
| `atrPeriod` | `14` | Period for ATR (spread normalization) |
| `highVolumeThreshold` | `1.5` | Volume ratio above this = high volume |
| `lowVolumeThreshold` | `0.7` | Volume ratio below this = low volume |
| `wideSpreadThreshold` | `1.2` | Spread ratio above this = wide spread |
| `narrowSpreadThreshold` | `0.7` | Spread ratio below this = narrow spread |

**Bar types:** `noSupply`, `noDemand`, `stoppingVolume`, `climacticAction`, `test`, `upthrust`, `spring`, `absorption`, `effortUp`, `effortDown`, `normal`.

Returns `Series<VsaValue>`.

### `wyckoffPhases(candles, options?)`

Wyckoff Phase Detection — identifies market phases and key events within accumulation/distribution cycles.

```typescript
import { wyckoffPhases } from "trendcraft";

const phases = wyckoffPhases(candles, {
  swingPeriod: 5,
  minRangeBars: 20,
  atrPeriod: 14,
  volumeMaPeriod: 20,
  rangeTolerance: 0.5,
});
// phases[]: { time, value: { phase, subPhase, event, confidence, rangeHigh, rangeLow, eventsDetected } }
```

| Option | Default | Description |
|--------|---------|-------------|
| `swingPeriod` | `5` | Swing point detection lookback |
| `minRangeBars` | `20` | Minimum bars for range detection |
| `atrPeriod` | `14` | ATR period for range tolerance |
| `volumeMaPeriod` | `20` | Volume MA period |
| `rangeTolerance` | `0.5` | Range boundary tolerance (ATR multiplier) |

**Phases:** `accumulation`, `markup`, `distribution`, `markdown`, `unknown`.

**Events:** `PS` (Preliminary Supply/Support), `SC` (Selling Climax), `AR` (Automatic Rally), `ST` (Secondary Test), `spring`, `test`, `SOS` (Sign of Strength), `LPS` (Last Point of Support), `BU` (Back-Up), `PSY` (Preliminary Supply), `BC` (Buying Climax), `SOW` (Sign of Weakness), `LPSY`, `UT` (Upthrust), `UTAD`.

Returns `Series<WyckoffValue>`.

---

## Harmonic Pattern Detection

### `detectHarmonicPatterns(candles, options?)`

Detects XABCD harmonic patterns using Fibonacci ratio validation. Supports Gartley, Butterfly, Bat, Crab, and Shark patterns in both bullish and bearish variants.

```typescript
import { detectHarmonicPatterns } from "trendcraft";

const patterns = detectHarmonicPatterns(candles, {
  swingLookback: 5,
  tolerance: 0.05,
  minSwingPoints: 50,
  patterns: ["gartley", "butterfly", "bat", "crab", "shark"],
});
// patterns[]: PatternSignal with type, confidence, pattern.keyPoints (X, A, B, C, D), target, stopLoss
```

| Option | Default | Description |
|--------|---------|-------------|
| `swingLookback` | `5` | Swing point detection period |
| `tolerance` | `0.05` | Fibonacci ratio matching tolerance (5%) |
| `minSwingPoints` | `50` | Minimum bars for swing detection |
| `patterns` | all | Pattern types to detect |

**Pattern types:** `gartley_bullish`, `gartley_bearish`, `butterfly_bullish`, `butterfly_bearish`, `bat_bullish`, `bat_bearish`, `crab_bullish`, `crab_bearish`, `shark_bullish`, `shark_bearish`.

Returns `PatternSignal[]` with `confidence` (0-100), `confirmed`, `pattern.target`, `pattern.stopLoss`, `pattern.keyPoints` (X, A, B, C, D points).

---

## GARCH Volatility

### `garch(returns, options?)`

GARCH(1,1) volatility model — estimates conditional variance time series via Maximum Likelihood Estimation. Useful for volatility forecasting and risk management.

```typescript
import { garch, returns } from "trendcraft";

const dailyReturns = returns(candles).map((s) => s.value ?? 0);
const result = garch(dailyReturns, {
  p: 1,
  q: 1,
  maxIterations: 100,
  tolerance: 1e-6,
});
// result.volatilityForecast — next period annualized volatility (%)
// result.conditionalVariance — Series<number> time series
// result.params — { omega, alpha, beta }
// result.logLikelihood — model fit quality
// result.converged — whether optimization converged
```

| Option | Default | Description |
|--------|---------|-------------|
| `p` | `1` | GARCH lag order |
| `q` | `1` | ARCH lag order |
| `maxIterations` | `100` | Max MLE iterations |
| `tolerance` | `1e-6` | Convergence tolerance |

Returns `GarchResult`.

### `ewmaVolatility(returns, options?)`

EWMA (Exponentially Weighted Moving Average) volatility — RiskMetrics standard method for real-time volatility estimation.

```typescript
import { ewmaVolatility } from "trendcraft";

const vol = ewmaVolatility(dailyReturns, { lambda: 0.94 });
// vol: annualized volatility estimate (number)
```

| Option | Default | Description |
|--------|---------|-------------|
| `lambda` | `0.94` | Decay factor (RiskMetrics standard) |

Returns `number` (annualized volatility).

---

## Pareto Multi-Objective Optimization (NSGA-II)

### `paretoOptimization(candles, strategyFactory, paramRanges, options)`

NSGA-II multi-objective optimization — finds Pareto-optimal parameter sets that balance competing objectives (e.g., maximize Sharpe ratio while minimizing drawdown). Uses fast non-dominated sorting and crowding distance for diversity.

```typescript
import { paretoOptimization, param, constraint, summarizeParetoResult } from "trendcraft";

const result = paretoOptimization(
  candles,
  (params) => ({
    entry: goldenCross(params.short, params.long),
    exit: deadCross(params.short, params.long),
  }),
  [param("short", [5, 10, 15, 20]), param("long", [25, 50, 75, 100])],
  {
    objectives: [
      { metric: "sharpe", direction: "maximize" },
      { metric: "maxDrawdown", direction: "minimize" },
    ],
    constraints: [constraint("winRate", ">=", 35)],
    maxCombinations: 10000,
  },
);
// result.paretoFront — non-dominated solutions on the efficient frontier
// result.allResults — all evaluated combinations
// result.totalCombinations, result.validCombinations

console.log(summarizeParetoResult(result));
```

| Option | Default | Description |
|--------|---------|-------------|
| `objectives` | required | 2-4 objectives with metric and direction |
| `constraints` | `[]` | Metric constraints |
| `maxCombinations` | `10000` | Maximum parameter combinations to evaluate |
| `progressCallback` | - | Progress reporting callback |

**Available metrics:** `sharpe`, `returnPercent`, `maxDrawdown`, `profitFactor`, `winRate`, `calmar`, `recoveryFactor`, `avgHoldingDays`.

Returns `ParetoResult` with `paretoFront: ParetoResultEntry[]` (each with `frontIndex`, `crowdingDistance`).

**Helper functions:**
- `fastNonDominatedSort(entries, objectives)` — NSGA-II non-dominated sorting
- `crowdingDistance(entries, frontIndices, objectives)` — Crowding distance calculation
- `summarizeParetoResult(result)` — Human-readable summary string

---

## Backtest Realism

### `calculateDynamicSlippage(model, candle, atr?)`

Calculate context-aware slippage based on market conditions. Supports multiple models for realistic backtest simulation.

```typescript
import { runBacktest, calculateDynamicSlippage } from "trendcraft";

// Use in backtest options
const result = runBacktest(candles, entry, exit, {
  capital: 1000000,
  slippageModel: {
    type: "composite",
    atrMultiplier: 0.1,
    impactCoeff: 0.1,
    volatilityWeight: 0.7,
  },
});

// Standalone usage
const slippage = calculateDynamicSlippage(
  { type: "volatility", atrMultiplier: 0.1 },
  candle,
  atrValue,
);
```

**Slippage model types:**

| Type | Parameters | Description |
|------|-----------|-------------|
| `fixed` | `percent` | Fixed percentage slippage |
| `volatility` | `atrMultiplier` | ATR-proportional slippage (wider in volatile markets) |
| `volume` | `impactCoeff` | Market impact based on volume |
| `composite` | `atrMultiplier`, `impactCoeff`, `volatilityWeight?` | Combined volatility + volume model |

### `resolveSlippageModel(slippage?, model?)`

Resolves a `SlippageModel` from either a fixed percentage or a model config. Returns `SlippageModel | undefined`.

---

## Stress Testing

### `stressTest(returns, scenario, initialCapital?)`

Test strategy resilience against a single stress scenario. Applies synthetic shocks to the return series and measures impact on key metrics.

```typescript
import { stressTest, runAllStressTests, PRESET_SCENARIOS } from "trendcraft";

const result = stressTest(dailyReturns, PRESET_SCENARIOS.lehman2008, 1_000_000);
// result.scenario — scenario name
// result.originalMetrics — { totalReturn, maxDrawdown, sharpe }
// result.stressedMetrics — { totalReturn, maxDrawdown, sharpe }
// result.worstCase — { drawdown, duration, recoveryDays }
// result.survivalRate — percentage of capital surviving
// result.capitalAtRisk — capital at risk amount
// result.stressedVaR, result.stressedCVaR
```

### `runAllStressTests(returns, initialCapital?)`

Run all preset stress scenarios at once.

```typescript
const summary = runAllStressTests(dailyReturns, 1_000_000);
// summary.results — StressTestResult[] for each scenario
// summary.worstScenario — name of the worst-performing scenario
// summary.overallSurvivalRate — minimum survival across all scenarios
// summary.maxStressedDrawdown — maximum drawdown across all scenarios
```

### `generateShockedReturns(baseReturns, shock)`

Generate a stressed return series by applying a shock.

**Shock types:**

| Type | Parameters | Description |
|------|-----------|-------------|
| `drawdown` | `magnitude`, `days`, `recoveryDays` | Simulated drawdown event |
| `volatilitySpike` | `multiplier`, `days` | Volatility multiplier |
| `correlationBreakdown` | `targetCorrelation` | Correlation regime shift |
| `absolute` | `returns` | Inject a specific return sequence |

**Preset scenarios:** `lehman2008`, `covidCrash2020`, `flashCrash2010`, `volmageddon2018`, `blackMonday1987`, `svbCrisis2023`.

### `calculateMetricsFromReturns(returns)`

Calculate basic performance metrics from a return series. Returns `{ totalReturn, maxDrawdown, sharpe }`.

---

## Strategy JSON Serialization

Declarative JSON representation for strategies, enabling save/share/version control of trading strategies.

### Concepts

- **`ConditionSpec`** — JSON-safe condition representation (`{ name, params }` or `{ op: "and"|"or"|"not", conditions }`)
- **`ConditionRegistry`** — Maps condition names to factory functions + parameter schemas
- **`StrategyJSON`** — Version-stamped strategy schema with entry/exit specs and backtest config

### Pre-built Registries

Two pre-built registries are available:

- **`backtestRegistry`** — 105+ backtest conditions (trend, momentum, volume, volatility, pattern, smc, range, fundamental)
- **`streamingRegistry`** — 65+ streaming conditions (same categories, adapted for real-time snapshots)

### `backtestRegistry` / `streamingRegistry`

```typescript
import { backtestRegistry, streamingRegistry } from "trendcraft";

// List all conditions
const all = backtestRegistry.list();

// Filter by category
const trendConditions = backtestRegistry.list("trend");

// Check if condition exists
backtestRegistry.has("goldenCross"); // true

// Get entry with param schema (for UI generation)
const entry = backtestRegistry.get("rsiBelow");
// entry.params = { threshold: { type: "number", default: 30, min: 0, max: 100 }, ... }
```

**Categories:** `trend`, `momentum`, `volume`, `volatility`, `pattern`, `smc`, `range`, `fundamental`

### `ConditionRegistry`

```typescript
import { ConditionRegistry } from "trendcraft";

const registry = new ConditionRegistry<Condition>();
registry.register({
  name: "myCondition",
  displayName: "My Condition",
  category: "trend",
  params: {
    period: { type: "number", default: 14, min: 1, max: 200 },
  },
  create: (p) => myConditionFactory((p.period as number) ?? 14),
});
```

**Methods:**
- `register(entry)` — Register a condition (throws on duplicate name)
- `get(name)` → `ConditionRegistryEntry | undefined`
- `has(name)` → `boolean`
- `list(category?)` → `ConditionRegistryEntry[]`
- `names()` → `string[]`
- `size` → `number`
- `hydrate(spec, combinators)` → `T` — Resolve ConditionSpec to executable condition

### `serializeStrategy(strategy)` / `parseStrategy(json)`

```typescript
import { serializeStrategy, parseStrategy } from "trendcraft";
import type { StrategyJSON } from "trendcraft";

const strategy: StrategyJSON = {
  $schema: "trendcraft/strategy",
  version: 1,
  id: "golden-cross-rsi",
  name: "Golden Cross + RSI",
  entry: {
    op: "and",
    conditions: [
      { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
      { name: "rsiBelow", params: { threshold: 30 } },
    ],
  },
  exit: { name: "rsiAbove", params: { threshold: 70 } },
  backtest: { capital: 1_000_000, stopLoss: 5, fillMode: "next-bar-open" },
};

// Serialize to JSON string
const jsonString = serializeStrategy(strategy);

// Parse back
const restored = parseStrategy(jsonString);
```

`parseStrategy` validates `$schema` and `version` fields, throwing on mismatch.

### `hydrateCondition(spec, registry)` / `loadStrategy(json, registry)`

```typescript
import { hydrateCondition, loadStrategy, backtestRegistry, runBacktest } from "trendcraft";

// Hydrate a single condition
const condition = hydrateCondition(
  { name: "goldenCross", params: { shortPeriod: 10 } },
  backtestRegistry,
);

// Load a full strategy → executable entry/exit + options
const { entry, exit, backtestOptions } = loadStrategy(strategyJson, backtestRegistry);
const result = runBacktest(candles, entry, exit, { capital: 1_000_000, ...backtestOptions });
```

### `validateConditionSpec(spec, registry)` / `validateStrategyJSON(json)`

```typescript
import { validateConditionSpec, validateStrategyJSON, backtestRegistry } from "trendcraft";

// Validate condition spec against registry (type/range/enum/required checks)
const result = validateConditionSpec(
  { name: "rsiBelow", params: { threshold: "not-a-number" } },
  backtestRegistry,
);
// { valid: false, errors: ["rsiBelow.threshold: expected number, got string"] }

// Validate strategy JSON structure
const structResult = validateStrategyJSON(strategyJson);
// { valid: boolean, errors: string[] }
```

### StrategyJSON Schema

```typescript
type StrategyJSON = {
  $schema: "trendcraft/strategy";
  version: 1;
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  entry: ConditionSpec;
  exit: ConditionSpec;
  backtest?: {
    capital?: number;
    direction?: "long" | "short";
    stopLoss?: number;
    takeProfit?: number;
    trailingStop?: number;
    commission?: number;
    commissionRate?: number;
    slippage?: number;
    fillMode?: "same-bar-close" | "next-bar-open";
  };
  metadata?: Record<string, unknown>;
};
```

### ConditionSpec

```typescript
// Leaf condition
type ConditionSpec =
  | { name: string; params?: Record<string, unknown> }
  | { op: "and" | "or" | "not"; conditions: ConditionSpec[] };

// Example: and(goldenCross(5,25), rsiBelow(30))
{
  "op": "and",
  "conditions": [
    { "name": "goldenCross", "params": { "shortPeriod": 5, "longPeriod": 25 } },
    { "name": "rsiBelow", "params": { "threshold": 30 } }
  ]
}
```

### Types

`ConditionSpec`, `StrategyJSON`, `ParamDef`, `ConditionParamSchema`, `ConditionCategory`, `ConditionRegistryEntry`, `StrategyValidationResult`
