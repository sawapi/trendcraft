# TrendCraft Beginner's Guide

A practical guide to understanding technical indicators and trading signals.

## Table of Contents

- [Moving Averages](#moving-averages)
- [RSI (Relative Strength Index)](#rsi-relative-strength-index)
- [MACD](#macd)
- [Stochastics](#stochastics)
- [Bollinger Bands](#bollinger-bands)
- [DMI/ADX](#dmiadx)
- [Ichimoku Cloud](#ichimoku-cloud)
- [Supertrend](#supertrend)
- [CCI (Commodity Channel Index)](#cci-commodity-channel-index)
- [Williams %R](#williams-r)
- [ROC (Rate of Change)](#roc-rate-of-change)
- [Pivot Points](#pivot-points)
- [VWAP](#vwap)
- [Volume Indicators](#volume-indicators)
- [Advanced Volume Analysis](#advanced-volume-analysis)
- [Relative Strength (RS)](#relative-strength-rs)
- [Price Patterns](#price-patterns)
- [Multi-Timeframe (MTF) Analysis](#multi-timeframe-mtf-analysis)
- [Range-Bound Detection](#range-bound-detection)
- [Day Trading & Short-Term Swing Indicators](#day-trading--short-term-swing-indicators)
- [Backtesting](#backtesting)
- [Signal Scoring](#signal-scoring)
- [Position Sizing](#position-sizing)
- [ATR Risk Management](#atr-risk-management)
- [Signal Interpretation](#signal-interpretation)
- [Volatility Regime](#volatility-regime)
- [Strategy Optimization](#strategy-optimization)
- [Scaled Entry Strategies](#scaled-entry-strategies)
- [Real-Time Streaming](#real-time-streaming)

---

## Moving Averages

### What is it?

A moving average smooths out price data by calculating the average price over a specific period. It helps identify the overall trend direction by filtering out short-term noise.

### Types

| Type | Description | Characteristics |
|------|-------------|-----------------|
| **SMA** (Simple) | Equal weight to all prices | Smoother, slower to react |
| **EMA** (Exponential) | More weight to recent prices | More responsive to new data |
| **WMA** (Weighted) | Linear weight increase to recent prices | Between SMA and EMA sensitivity |

### How to Read

```
Price above MA → Uptrend (bullish)
Price below MA → Downtrend (bearish)
```

### Common Periods

| Period | Use Case |
|--------|----------|
| 5-10 | Short-term trends |
| 20-25 | Medium-term trends |
| 50-75 | Intermediate trends |
| 200 | Long-term trends |

### Golden Cross / Dead Cross

These are powerful signals when two moving averages cross:

```
Golden Cross: Short MA crosses ABOVE long MA → Buy signal
Dead Cross:   Short MA crosses BELOW long MA → Sell signal
```

**Example:** 5-day MA crossing above 25-day MA

### Tips

- Use multiple MAs together (e.g., 5, 25, 75) for confirmation
- The longer the period, the more significant the signal
- MAs work best in trending markets, less reliable in sideways markets

---

## RSI (Relative Strength Index)

### What is it?

RSI measures the speed and magnitude of price changes on a scale of 0-100. It helps identify overbought and oversold conditions.

### How to Read

```
RSI > 70  → Overbought (price may be too high)
RSI < 30  → Oversold (price may be too low)
RSI = 50  → Neutral
```

### Key Signals

| Condition | Interpretation | Potential Action |
|-----------|----------------|------------------|
| RSI enters >70 | Overbought zone | Consider selling / taking profits |
| RSI enters <30 | Oversold zone | Consider buying |
| RSI crosses 50 upward | Bullish momentum | Trend confirmation |
| RSI crosses 50 downward | Bearish momentum | Trend confirmation |

### RSI Divergence

Divergence occurs when price and RSI move in opposite directions:

```
Bullish Divergence:
  Price: Lower Low  +  RSI: Higher Low  →  Potential reversal UP

Bearish Divergence:
  Price: Higher High  +  RSI: Lower High  →  Potential reversal DOWN
```

**Important:** Divergence indicates *potential* reversal, not guaranteed. Always wait for confirmation.

### Tips

- Don't sell immediately when RSI hits 70 (strong trends can stay overbought)
- Look for divergence + other confirmation signals
- RSI works best in ranging markets

---

## MACD

### What is it?

MACD (Moving Average Convergence Divergence) shows the relationship between two moving averages. It helps identify trend direction, momentum, and potential reversals.

### Components

```
MACD Line    = 12-period EMA - 26-period EMA
Signal Line  = 9-period EMA of MACD Line
Histogram    = MACD Line - Signal Line
```

### How to Read

#### 1. Zero Line

```
MACD above zero → Bullish trend (short-term MA > long-term MA)
MACD below zero → Bearish trend (short-term MA < long-term MA)
```

#### 2. Signal Line Crossover

```
MACD crosses ABOVE signal → Buy signal (bullish)
MACD crosses BELOW signal → Sell signal (bearish)
```

#### 3. Histogram

```
Histogram growing (positive) → Bullish momentum increasing
Histogram shrinking → Momentum weakening
Histogram negative → Bearish momentum
```

### Visual Guide

```
        MACD Line
           ↓
     ~~~~~/\~~~~~  ← Signal Line
         /  \
    ____/    \____

   ▓▓▓▓          ← Histogram (above zero = bullish)
   ▓▓▓▓▓▓
   ▓▓▓▓▓▓▓▓
   ▓▓▓▓▓▓
───────────────── Zero Line
         ░░░░░░
         ░░░░░░░░ ← Histogram (below zero = bearish)
         ░░░░░░
```

### MACD Divergence

Similar to RSI divergence:

```
Bullish: Price makes Lower Low, MACD makes Higher Low
Bearish: Price makes Higher High, MACD makes Lower High
```

### Tips

- MACD is a lagging indicator (confirms trends, doesn't predict)
- Works best in trending markets
- Combine with other indicators for better accuracy

---

## Stochastics

### What is it?

Stochastics measures where the current price is relative to its high-low range over a period. It oscillates between 0 and 100.

### Types

| Type | Calculation | Best For |
|------|-------------|----------|
| **Fast** | Raw %K with smoothed %D | Quick signals (more noise) |
| **Slow** | Smoothed %K and %D | Reliable signals (less noise) |

### Components

```
%K Line = Main line (faster)
%D Line = Signal line (3-period MA of %K, slower)
```

### How to Read

```
Above 80 → Overbought zone
Below 20 → Oversold zone
```

### Key Signals

| Signal | Condition | Meaning |
|--------|-----------|---------|
| Buy | %K crosses above %D in oversold (<20) | Bullish reversal |
| Sell | %K crosses below %D in overbought (>80) | Bearish reversal |

### Tips

- Slow Stochastics is preferred for most traders (fewer false signals)
- Like RSI, strong trends can stay overbought/oversold for extended periods
- Best in ranging/sideways markets

---

## Bollinger Bands

### What is it?

Bollinger Bands consist of three lines that envelope price action. They expand and contract based on market volatility.

### Components

```
Upper Band  = Middle Band + (2 × Standard Deviation)
Middle Band = 20-period SMA
Lower Band  = Middle Band - (2 × Standard Deviation)
```

### How to Read

#### Band Width = Volatility

```
Bands narrow (squeeze) → Low volatility, breakout coming
Bands widen            → High volatility
```

#### Price Position

```
Price touches upper band → Potentially overbought
Price touches lower band → Potentially oversold
Price bounces off middle → Middle band acts as support/resistance
```

### %B Indicator

%B shows where price is within the bands:

```
%B > 1.0  → Price above upper band
%B = 0.5  → Price at middle band
%B < 0.0  → Price below lower band
```

### Squeeze Signal (SQ)

The squeeze is one of the most important Bollinger Band signals:

```
Squeeze = Bandwidth in bottom 5-10% of recent history
        = "Calm before the storm"
        = Volatility contraction often precedes big moves
```

**When you see SQ:**
1. Prepare for a potential breakout
2. Watch which direction price breaks
3. Volume confirmation strengthens the signal

### Tips

- Bollinger Bands don't predict direction, only volatility
- Squeeze + volume surge = strong signal
- Use with trend indicators (MA, MACD) for direction

---

## DMI/ADX

### What is it?

DMI (Directional Movement Index) measures trend direction and strength. ADX measures trend strength regardless of direction.

### Components

```
+DI = Positive Directional Indicator (buying pressure)
-DI = Negative Directional Indicator (selling pressure)
ADX = Average Directional Index (trend strength)
```

### How to Read ADX

```
ADX < 20  → Weak trend / sideways market
ADX 20-25 → Trend emerging
ADX > 25  → Strong trend
ADX > 50  → Very strong trend
```

### How to Read DI

```
+DI > -DI → Uptrend (buyers in control)
-DI > +DI → Downtrend (sellers in control)
```

### Key Signals

| Signal | Condition | Meaning |
|--------|-----------|---------|
| Buy | +DI crosses above -DI + ADX > 25 | Strong uptrend starting |
| Sell | -DI crosses above +DI + ADX > 25 | Strong downtrend starting |

### Tips

- ADX doesn't tell you direction, only strength
- DI crossovers in low ADX environments are less reliable
- Rising ADX = trend strengthening (good for trend-following)
- Falling ADX = trend weakening (consider taking profits)

---

## Ichimoku Cloud

### What is it?

Ichimoku Kinko Hyo is a comprehensive Japanese technical indicator that shows trend direction, support/resistance, and momentum at a glance.

### Components

```
Tenkan-sen (Conversion Line) = 9-period (highest high + lowest low) / 2 → Short-term trend
Kijun-sen (Base Line)        = 26-period (highest high + lowest low) / 2 → Medium-term trend
Senkou Span A                = (Tenkan + Kijun) / 2, plotted 26 periods ahead
Senkou Span B                = 52-period (highest high + lowest low) / 2, plotted 26 periods ahead
Chikou Span (Lagging Span)   = Close price plotted 26 periods back
```

### The Cloud (Kumo)

The area between Senkou Span A and B forms the "cloud":

```
Price above cloud → Uptrend (bullish)
Price below cloud → Downtrend (bearish)
Price inside cloud → Trend unclear, ranging market
Thick cloud → Strong support/resistance
Thin cloud → Weak support/resistance
```

### Key Signals

| Signal | Condition | Meaning |
|--------|-----------|---------|
| Strong Buy | Price breaks above cloud + Tenkan > Kijun | Uptrend starting |
| Strong Sell | Price breaks below cloud + Tenkan < Kijun | Downtrend starting |
| Kumo Twist | Senkou A and B cross | Potential trend change |

### Tips

- Standard settings: 9, 26, 52 (developed for Japanese markets)
- The cloud shows future support/resistance (26 periods ahead)
- More confirming elements = higher reliability

---

## Supertrend

### What is it?

Supertrend uses ATR (Average True Range) to calculate dynamic support/resistance levels and trend direction. It can also be used as a trailing stop.

### Components

```
Upper Band = HL2 + (Multiplier × ATR)
Lower Band = HL2 - (Multiplier × ATR)

Price closes above Upper Band → Bullish trend, Lower Band becomes support
Price closes below Lower Band → Bearish trend, Upper Band becomes resistance
```

### How to Read

```
direction = 1  → Bullish trend (green), Supertrend = support
direction = -1 → Bearish trend (red), Supertrend = resistance
```

### Key Signals

| Signal | Condition | Meaning |
|--------|-----------|---------|
| Buy | direction changes from -1 to 1 | Trend turns bullish |
| Sell | direction changes from 1 to -1 | Trend turns bearish |

### Tips

- Adjust sensitivity with period and multiplier (default: 10, 3)
- Smaller multiplier = more sensitive (more false signals)
- Excellent as a trailing stop

---

## CCI (Commodity Channel Index)

### What is it?

CCI measures how far the price has deviated from its average. Originally for commodities, now widely used for stocks.

### Calculation

```
CCI = (Typical Price - SMA of Typical Price) / (0.015 × Mean Deviation)
Typical Price = (High + Low + Close) / 3
```

### How to Read

```
CCI > +100 → Overbought (strong bullish momentum)
CCI < -100 → Oversold (strong bearish momentum)
CCI crosses above 0 → Bullish turn
CCI crosses below 0 → Bearish turn
```

### Key Signals

| Signal | Condition | Meaning |
|--------|-----------|---------|
| Buy | CCI crosses above -100 | Reversal from oversold |
| Sell | CCI crosses below +100 | Reversal from overbought |

### Tips

- Unlike RSI, CCI can exceed ±100 (in strong trends)
- Divergence works well with CCI
- Most reliable in ranging markets

---

## Williams %R

### What is it?

Williams %R is the inverse of Fast Stochastics, ranging from -100 to 0. It identifies overbought/oversold conditions.

### Calculation

```
%R = (Highest High - Close) / (Highest High - Lowest Low) × -100
```

### How to Read

```
%R > -20 → Overbought zone
%R < -80 → Oversold zone
%R = -50 → Neutral
```

### Key Signals

| Signal | Condition | Meaning |
|--------|-----------|---------|
| Buy | %R crosses above -80 | Reversal from oversold |
| Sell | %R crosses below -20 | Reversal from overbought |

### Tips

- Same interpretation as Stochastics
- Good for short-term trading (default 14 periods)
- Extreme values can persist in strong trends

---

## ROC (Rate of Change)

### What is it?

ROC measures the percentage change between the current price and the price n periods ago. The simplest momentum indicator.

### Calculation

```
ROC = ((Current Price - Price n periods ago) / Price n periods ago) × 100
```

### How to Read

```
ROC > 0 → Price rising (bullish momentum)
ROC < 0 → Price falling (bearish momentum)
ROC crosses above 0 → Bullish turn
ROC crosses below 0 → Bearish turn
```

### Key Signals

| Signal | Condition | Meaning |
|--------|-----------|---------|
| Buy | ROC crosses above zero line | Rising momentum starting |
| Sell | ROC crosses below zero line | Falling momentum starting |

### Tips

- Shorter period = more sensitive (default 12)
- Divergence works well
- Best used with other indicators

---

## Pivot Points

### What is it?

Pivot Points calculate support and resistance levels from the previous day's high, low, and close. Popular among day traders.

### Calculation Methods

| Method | Characteristics |
|--------|-----------------|
| **Standard** | Most common, (H+L+C)/3 |
| **Fibonacci** | Uses Fibonacci ratios |
| **Woodie** | Emphasizes current day's open |
| **Camarilla** | Close-based, tighter ranges |
| **DeMark** | Changes formula based on price position |

### How to Read

```
Pivot (P) = (Previous High + Previous Low + Previous Close) / 3

Support levels: S1, S2, S3 (stronger going down)
Resistance levels: R1, R2, R3 (stronger going up)
```

### Key Signals

| Condition | Interpretation |
|-----------|----------------|
| Price > Pivot | Bullish bias |
| Price < Pivot | Bearish bias |
| Bounce at S1/R1 | Level acting as support/resistance |
| Break through S1/R1 | Targets next level (S2/R2) |

### Tips

- Most effective for day trading
- Typically calculated from daily data
- Combine with other indicators for confirmation

---

## VWAP

### What is it?

VWAP (Volume Weighted Average Price) is the average price weighted by volume. Institutional traders use it to benchmark execution quality.

### Calculation

```
VWAP = Cumulative(Typical Price × Volume) / Cumulative(Volume)
Typical Price = (High + Low + Close) / 3
```

### How to Read

```
Price > VWAP → Bullish (buyers in control)
Price < VWAP → Bearish (sellers in control)
Price approaches VWAP → Regression to mean
```

### Key Signals

| Signal | Condition | Meaning |
|--------|-----------|---------|
| Buy | Price crosses above VWAP | Bullish turn |
| Sell | Price crosses below VWAP | Bearish turn |
| Buy | Price bounces off VWAP (in uptrend) | VWAP acting as support |
| Sell | Price rejected at VWAP (in downtrend) | VWAP acting as resistance |

### Tips

- Session VWAP (daily reset) is most common
- Important benchmark for institutional traders
- Works well with standard deviation bands

---

## Volume Indicators

### OBV (On-Balance Volume)

#### What is it?

OBV tracks cumulative buying and selling pressure using volume.

```
Price up   → Add volume to OBV
Price down → Subtract volume from OBV
```

#### How to Read

```
OBV rising with price  → Healthy uptrend (volume confirms)
OBV falling with price → Healthy downtrend (volume confirms)
OBV rising, price flat → Accumulation (bullish)
OBV falling, price flat → Distribution (bearish)
```

#### OBV Divergence

```
Bullish: Price makes Lower Low, OBV makes Higher Low
         → Buying pressure building despite falling prices

Bearish: Price makes Higher High, OBV makes Lower High
         → Selling pressure building despite rising prices
```

### MFI (Money Flow Index)

#### What is it?

MFI is like RSI but incorporates volume. It's often called "volume-weighted RSI."

#### How to Read

```
MFI > 80 → Overbought (with high volume)
MFI < 20 → Oversold (with high volume)
```

MFI gives more weight to high-volume moves, making it useful for confirming significant price changes.

### Tips

- Volume confirms price moves (price up + volume up = strong)
- Divergence between price and volume indicators often precedes reversals
- Low volume rallies are suspicious
- High volume selloffs may indicate capitulation (potential bottom)

---

## Advanced Volume Analysis

TrendCraft provides advanced volume analysis tools beyond basic OBV and MFI.

### Volume Anomaly Detection

#### What is it?

Volume anomaly detection identifies unusual volume spikes that may signal significant market events like institutional activity, news reactions, or trend reversals.

#### How to Read

```
ratio > 2.0  → High volume (2x average)
ratio > 3.0  → Extreme volume (3x average)
zScore > 2   → Statistically significant spike
```

#### Key Signals

| Condition | Meaning |
|-----------|---------|
| High volume + price breakout | Confirmed breakout |
| Extreme volume at support | Potential capitulation/bottom |
| Extreme volume at resistance | Potential distribution/top |
| Volume spike + no price change | Accumulation/distribution |

### Volume Profile

#### What is it?

Volume Profile shows the distribution of trading volume at different price levels over a period. It reveals where most trading occurred (support/resistance levels).

#### Key Components

```
POC (Point of Control) = Price level with highest volume (strongest S/R)
VAH (Value Area High)  = Upper bound of 70% volume
VAL (Value Area Low)   = Lower bound of 70% volume
Value Area             = Price range with 70% of total volume
```

#### How to Read

```
Price near POC    → Strong support/resistance zone
Price in Value Area → Fair value zone
Price above VAH   → Potentially overextended
Price below VAL   → Potentially undervalued
```

#### Trading Strategies

| Strategy | Entry | Target |
|----------|-------|--------|
| Mean reversion | Price touches VAH/VAL | Return to POC |
| Breakout | Price breaks VAH with volume | Next resistance |
| Support trade | Price bounces off POC | Previous high |

### Volume Trend Confirmation

#### What is it?

Volume trend confirmation analyzes whether volume supports the current price trend. Healthy trends should have confirming volume.

#### How to Read

```
isConfirmed = true   → Volume confirms price direction
hasDivergence = true → Volume diverges from price (warning)
confidence > 70      → High confidence in signal
```

#### Key Patterns

| Pattern | Meaning | Implication |
|---------|---------|-------------|
| Price up + Volume up | Confirmed uptrend | Trend likely continues |
| Price down + Volume up | Confirmed downtrend | Strong selling |
| Price up + Volume down | Bearish divergence | Rally weakening |
| Price down + Volume down | Bullish divergence | Selling exhaustion |

#### Usage Example

```typescript
import { volumeAnomaly, volumeProfile, volumeTrend } from 'trendcraft';

// Detect volume spikes
const anomalies = volumeAnomaly(candles, { period: 20 });
anomalies.filter(d => d.value.isAnomaly).forEach(d => {
  console.log(`${d.time}: ${d.value.level} volume (${d.value.ratio.toFixed(1)}x)`);
});

// Analyze volume profile
const profile = volumeProfile(candles, { period: 20 });
console.log(`POC: ${profile.poc}, Value Area: ${profile.val} - ${profile.vah}`);

// Check trend confirmation
const trends = volumeTrend(candles);
const latest = trends[trends.length - 1].value;
if (latest.hasDivergence) {
  console.log('Warning: Volume divergence detected');
}
```

### CMF (Chaikin Money Flow)

#### What is it?

CMF measures buying and selling pressure over a period by analyzing where price closes within the high-low range, weighted by volume. It ranges from -1 to +1.

```
CMF > 0  → Buying pressure (accumulation)
CMF < 0  → Selling pressure (distribution)
CMF > +0.1 → Strong buying pressure
CMF < -0.1 → Strong selling pressure
```

#### How CMF Works

```
Close Location = (Close - Low) - (High - Close)
                 ─────────────────────────────
                        (High - Low)

CMF = Sum(Close Location × Volume) over N periods
      ────────────────────────────────────────
            Sum(Volume) over N periods
```

- When price closes near the high: positive contribution
- When price closes near the low: negative contribution
- Volume amplifies the signal

#### Key Signals

| CMF Pattern | Price Action | Interpretation |
|-------------|--------------|----------------|
| CMF rising above 0 | Price in uptrend | Accumulation confirmed |
| CMF falling below 0 | Price in downtrend | Distribution confirmed |
| CMF positive | Price making new high | Strong uptrend |
| CMF negative | Price making new low | Strong downtrend |
| CMF diverging from price | Price up, CMF down | Warning: trend weakening |

#### Usage Example

```typescript
import { cmfAbove, cmfBelow, and, priceAboveSma } from 'trendcraft';

// Entry: Accumulation phase in uptrend
const entry = and(
  cmfAbove(0),           // Buying pressure
  priceAboveSma(50),     // Above 50-day MA
);

// Exit: Distribution starts
const exit = cmfBelow(-0.1);  // Strong selling pressure
```

### OBV (On-Balance Volume)

#### What is it?

OBV (On-Balance Volume) is a cumulative volume indicator that adds volume on up days and subtracts on down days. It shows the flow of volume in and out of an asset.

```
Up day (Close > Previous Close):   OBV = Previous OBV + Volume
Down day (Close < Previous Close): OBV = Previous OBV - Volume
Unchanged:                          OBV = Previous OBV
```

#### How to Read

```
OBV rising  → Buyers in control (accumulation)
OBV falling → Sellers in control (distribution)
OBV flat    → Neutral/consolidation
```

#### Key Signals

| OBV Pattern | Price Pattern | Meaning |
|-------------|---------------|---------|
| OBV rising | Price rising | Confirmed uptrend |
| OBV falling | Price falling | Confirmed downtrend |
| OBV rising | Price flat | Hidden accumulation (bullish) |
| OBV falling | Price flat | Hidden distribution (bearish) |
| OBV flat | Price rising | Weak uptrend (caution) |

#### OBV vs CMF: When to Use Each

| Indicator | Best For | Characteristics |
|-----------|----------|-----------------|
| **CMF** | Current buying/selling pressure | Short-term, bounded (-1 to +1), clear thresholds |
| **OBV** | Cumulative volume flow | Long-term trend, unbounded, good for divergences |

**Use CMF when:**
- You need clear buy/sell signals with thresholds
- Analyzing short-term accumulation/distribution
- Want to compare across different assets

**Use OBV when:**
- Looking for divergences from price
- Analyzing long-term volume trends
- Confirming breakouts with volume

#### Usage Example

```typescript
import { obvRising, obvCrossUp, cmfAbove, and } from 'trendcraft';

// Strong accumulation: multiple volume confirmations
const strongEntry = and(
  cmfAbove(0),         // Current buying pressure
  obvRising(10),       // OBV trending up over 10 days
);

// OBV momentum turning bullish
const obvBullish = obvCrossUp(5, 20);  // Short MA crosses above long MA
```

### Volume Signals

#### volumeAboveAverage

Detects when volume stays above average for consecutive days. Useful for identifying sustained high activity periods.

```typescript
import { volumeAboveAverage } from 'trendcraft';

const signals = volumeAboveAverage(candles, {
  period: 20,            // 20-day average
  minRatio: 1.2,         // At least 120% of average
  minConsecutiveDays: 3  // For 3+ consecutive days
});

signals.forEach(s => {
  console.log(`High volume: ${s.consecutiveDays} days at ${(s.ratio * 100).toFixed(0)}% of avg`);
});
```

#### volumeAccumulation vs volumeAboveAverage

| Signal | Method | Best For |
|--------|--------|----------|
| `volumeAccumulation` | Linear regression slope | Detecting accelerating volume (getting stronger) |
| `volumeAboveAverage` | Simple ratio comparison | Detecting sustained high volume |

---

## Relative Strength (RS)

### What is it?

Relative Strength (RS) compares a stock's performance against a benchmark index (like S&P 500 or Nikkei 225). It helps identify stocks that are outperforming or underperforming the market.

### Key Concepts

```
RS > 1.0  →  Outperforming benchmark
RS < 1.0  →  Underperforming benchmark
RS = 1.0  →  Matching benchmark
```

### Why Use RS?

| Benefit | Description |
|---------|-------------|
| **Market leaders** | Find stocks stronger than the market |
| **Trend confirmation** | Strong stocks tend to stay strong (momentum) |
| **Risk filter** | Avoid laggards during uptrends |
| **Sector rotation** | Identify sector/stock leadership changes |

### Mansfield RS

Mansfield RS measures how far the RS line is above or below its moving average:

```
Mansfield RS > 0  →  RS strengthening
Mansfield RS < 0  →  RS weakening
```

### Basic Usage

```typescript
import { benchmarkRS, isOutperforming, rankByRS } from 'trendcraft';

// Calculate RS against benchmark
const rs = benchmarkRS(stockCandles, sp500Candles, { period: 52 });

const latest = rs[rs.length - 1].value;
console.log(`RS Rating: ${latest.rsRating}`);        // Percentile (0-100)
console.log(`Outperformance: ${latest.outperformance.toFixed(1)}%`);
console.log(`Mansfield RS: ${latest.mansfieldRS?.toFixed(2)}`);

// Simple outperformance check
if (isOutperforming(stockCandles, benchmarkCandles, 52, 10)) {
  console.log('Stock beating benchmark by 10%+');
}

// Rank multiple stocks
const rankings = rankByRS(symbolsMap, { benchmarkSymbol: 'SPY' });
rankings.slice(0, 5).forEach((r, i) => {
  console.log(`#${i + 1}: ${r.symbol} (RS Rating: ${r.rsRating})`);
});
```

### Trading Strategies with RS

| Strategy | RS Condition | Other Conditions |
|----------|--------------|------------------|
| **Market leaders** | RS Rating > 80 | Price in uptrend |
| **RS breakout** | RS at 52-week high | Volume spike |
| **Momentum** | RS rising + above 50 | Golden cross |
| **Avoid laggards** | RS Rating < 20 | - (avoid these stocks) |

### RS in Backtesting

```typescript
import { rsAbove, rsRising, rsRatingAbove, setBenchmark, and } from 'trendcraft';

// Entry: Strong RS + trend confirmation
const entry = and(
  rsAbove(1.0),         // Outperforming
  rsRising(),           // RS improving
  rsRatingAbove(70),    // Top 30%
  goldenCross()         // Technical entry
);

// Run backtest with benchmark
runBacktest(candles, entry, exit, {
  capital: 1000000,
  setup: (indicators) => {
    setBenchmark(indicators, sp500Candles);
  }
});
```

---

## Price Patterns

### What are they?

Price patterns are recognizable chart formations that signal potential reversals or continuations. They form from the collective psychology of market participants.

### Pattern Types

| Type | Direction | Signal |
|------|-----------|--------|
| **Double Top** | Bearish | Reversal after uptrend |
| **Double Bottom** | Bullish | Reversal after downtrend |
| **Head & Shoulders** | Bearish | Major reversal pattern |
| **Inverse H&S** | Bullish | Major reversal pattern |
| **Cup with Handle** | Bullish | Continuation (William O'Neil) |

### Double Top / Double Bottom

```
Double Top (M pattern):     Double Bottom (W pattern):

  Peak1     Peak2              Trough1   Trough2
    ___       ___              ▼          ▼
   /   \     /   \            /          /
  /     \___/     \          /    ___   /
         Trough    ▼ Breakdown    /   \/
                              Peak
                              ▲ Breakout
```

**Confirmation**: Price breaks below/above the middle trough/peak.

### Head and Shoulders

```
      Head
       /\
      /  \
     /    \
    /      \___
L.Shoulder    R.Shoulder
    \          /
     \        /
      \      /
   ----\----/----  Neckline
        ▼
     Breakdown
```

**Key Points**:
- Left shoulder and right shoulder at similar levels
- Head is higher (lower for inverse)
- Neckline connects the troughs (peaks for inverse)
- Target = Pattern height measured from neckline

### Cup with Handle

```
  Rim        Rim
   │          │
   │ Cup ____/│
   │/   \___/ │  ← Handle (small pullback)
   └──────────┴──▶ Breakout

- Cup: U-shaped, not V-shaped
- Depth: 12-35% typical
- Handle: Small pullback from rim (< 12%)
```

### Basic Usage

```typescript
import { doubleTop, headAndShoulders, cupWithHandle } from 'trendcraft';

// Detect patterns
const doubleTops = doubleTop(candles);
const headShoulders = headAndShoulders(candles);
const cups = cupWithHandle(candles);

// Check for confirmed patterns
doubleTops.filter(p => p.confirmed).forEach(p => {
  console.log(`Double Top confirmed at ${new Date(p.time)}`);
  console.log(`Target: ${p.pattern.target}`);
  console.log(`Confidence: ${p.confidence}%`);
});

// Cup with Handle trading
cups.forEach(p => {
  if (p.confirmed && p.confidence > 70) {
    console.log('High-confidence cup breakout!');
    console.log(`Entry: ${p.pattern.keyPoints[2].price}`);  // Right rim
    console.log(`Target: ${p.pattern.target}`);
    console.log(`Stop: ${p.pattern.stopLoss}`);
  }
});
```

### Pattern Confidence

Each pattern has a confidence score (0-100) based on:

| Factor | Higher Confidence |
|--------|-------------------|
| Peak/trough alignment | Closer to same level |
| Pattern depth | Optimal depth range |
| Neckline slope | Flatter = more reliable |
| Confirmation | Breakout occurred |

### Patterns in Backtesting

```typescript
import { patternDetected, anyBullishPattern, cupHandleDetected, and } from 'trendcraft';

// Exit on bearish reversal pattern
const exit = patternDetected('head_shoulders');

// Enter on any bullish pattern with good volume
const entry = and(
  anyBullishPattern({ confirmedOnly: true }),
  volumeAboveAvg()
);

// Trade only cup with handle
const cupEntry = cupHandleDetected({ confirmedOnly: true });
```

---

## Multi-Timeframe (MTF) Analysis

### What is it?

Multi-timeframe analysis uses higher timeframe indicators to filter trades on lower timeframes. This helps align trades with the bigger picture trend.

### Why Use MTF?

```
Higher timeframe trend = Context (the "forest")
Lower timeframe signal = Entry (the "trees")

Trading WITH the higher timeframe trend improves win rate.
```

### Common MTF Strategies

| Strategy | Higher TF Check | Lower TF Entry |
|----------|-----------------|----------------|
| Trend alignment | Weekly RSI > 50 | Daily Golden Cross |
| Pullback | Weekly uptrend | Daily RSI < 30 |
| Breakout filter | Monthly ADX > 25 | Daily breakout |

### Available MTF Conditions

```typescript
// RSI filters
weeklyRsiAbove(50)    // Weekly RSI bullish
weeklyRsiBelow(50)    // Weekly RSI bearish

// Trend filters
weeklyUptrend()       // Price > Weekly SMA
weeklyDowntrend()     // Price < Weekly SMA
weeklyTrendStrong()   // Weekly ADX > 25

// Price vs MA
weeklyPriceAboveSma(20)  // Price > Weekly 20 SMA
monthlyPriceAboveSma(50) // Price > Monthly 50 SMA
```

### Usage Example

```typescript
import { TrendCraft, weeklyRsiAbove, goldenCrossCondition, and } from 'trendcraft';

// Only take golden cross signals when weekly RSI is bullish
const result = TrendCraft.from(dailyCandles)
  .withMtf(['weekly'])  // Enable weekly timeframe
  .strategy()
    .entry(and(
      weeklyRsiAbove(50),        // Weekly RSI > 50 (bullish)
      goldenCrossCondition()     // Daily golden cross
    ))
    .exit(deadCrossCondition())
  .backtest({ capital: 1000000 });

console.log(`Win rate: ${result.winRate}%`);
```

### Tips

- Always trade in the direction of the higher timeframe trend
- Weekly RSI > 50 = bullish bias, < 50 = bearish bias
- Monthly trend defines the primary direction
- MTF analysis reduces overtrading by filtering weak signals

---

## Range-Bound Detection

### What is it?

Range-bound (or "box range") detection identifies periods when the market is moving sideways within a defined price range, rather than trending up or down. These consolidation phases often precede significant breakouts.

### How It Works

TrendCraft's `rangeBound()` function combines multiple indicators into a composite score:

| Indicator | Weight | What It Measures |
|-----------|--------|------------------|
| **ADX** | 50% | Trend strength (low ADX = weak trend) |
| **Bollinger Bandwidth** | 20% | Price volatility (narrow = low volatility) |
| **Donchian Width** | 20% | Price range (narrow = tight range) |
| **ATR Ratio** | 10% | Historical volatility comparison |

### States

The detector returns one of these states for each candle:

| State | Meaning |
|-------|---------|
| `NEUTRAL` | Insufficient data or mixed signals |
| `RANGE_FORMING` | Range conditions detected, awaiting confirmation |
| `RANGE_CONFIRMED` | Range persisted for 3+ bars |
| `RANGE_TIGHT` | Very tight range with high confidence |
| `BREAKOUT_RISK_UP` | Price near upper boundary |
| `BREAKOUT_RISK_DOWN` | Price near lower boundary |
| `TRENDING` | Market has clear directional movement |

### Trend Detection

To avoid false positives, the algorithm detects trends via multiple methods:

| Method | Default Threshold | Meaning |
|--------|-------------------|---------|
| ADX | ≥ 25 | Strong trend strength |
| Price Movement | ≥ 5% in 20 bars | Significant price change |
| DI Difference | ≥ 10 | Directional indicator divergence |
| Regression Slope | ≥ 0.15 × ATR | Consistent price direction |
| HH/LL Pattern | ≥ 3 consecutive | Higher highs or lower lows |

### How to Read

```
rangeScore > 70        → Likely range-bound
rangeScore > 85        → Very tight range (watch for breakout!)
pricePosition near 0   → Price at bottom of range (potential bounce)
pricePosition near 1   → Price at top of range (potential rejection)
```

### Key Signals

| Event Flag | When It Fires | Trading Implication |
|------------|---------------|---------------------|
| `rangeDetected` | Range conditions first appear | Be cautious with trend strategies |
| `rangeConfirmed` | Range persists 3+ bars | Consider range-bound strategies |
| `breakoutRiskDetected` | Price near range boundary | Prepare for potential breakout |
| `rangeBroken` | Transition from range to trend | Trend strategy opportunity |

### Usage Example

```typescript
import { rangeBound } from 'trendcraft';

const rb = rangeBound(candles);
const latest = rb[rb.length - 1].value;

// Check current state
if (latest.state === 'RANGE_CONFIRMED') {
  console.log('Market is range-bound');
  console.log(`Range: ${latest.rangeLow} - ${latest.rangeHigh}`);
  console.log(`Position: ${(latest.pricePosition * 100).toFixed(0)}%`);
}

// React to breakout risk
if (latest.state === 'BREAKOUT_RISK_UP') {
  console.log('Watch for upside breakout!');
}

// Debug why market is trending
if (latest.trendReason === 'hhll') {
  console.log('Trending due to consecutive higher highs/lows');
}
```

### Trading Strategies

#### Range Trading

Buy near support (pricePosition ≈ 0), sell near resistance (pricePosition ≈ 1):

```typescript
import { rangeBound, inRangeBound } from 'trendcraft';

// Entry when price at bottom of confirmed range
const rb = rangeBound(candles);
const isGoodEntry = rb[rb.length - 1].value.state === 'RANGE_CONFIRMED'
  && rb[rb.length - 1].value.pricePosition < 0.2;
```

#### Breakout Trading

Wait for range to form, then trade the breakout:

```typescript
import { rangeBreakout } from 'trendcraft';

// Use as backtest entry condition
const result = TrendCraft.from(candles)
  .strategy()
    .entry(rangeBreakout())  // Enter when range breaks
    .exit(deadCross())
  .backtest({ capital: 1000000 });
```

### Tips

- **Wait for confirmation** - Don't trade the first sign of a range
- **Check range width** - Very tight ranges often lead to explosive breakouts
- **Watch the trendReason** - Helps understand why range detection was rejected
- **Combine with volume** - Breakouts with high volume are more reliable
- **Use persistBars wisely** - Higher values = fewer false positives, but slower signals

### Backtest Conditions

| Condition | Description |
|-----------|-------------|
| `inRangeBound()` | Currently in any range state |
| `rangeForming()` | Range conditions starting |
| `rangeConfirmed()` | Range has been confirmed |
| `rangeBreakout()` | Transitioning from range to trend |
| `tightRange()` | In a very tight range |
| `breakoutRiskUp()` | Price near upper boundary |
| `breakoutRiskDown()` | Price near lower boundary |

---

## Day Trading & Short-Term Swing Indicators

These indicators are particularly useful for intraday and short-term swing trading.

### Hull Moving Average (HMA)

HMA reduces the lag inherent in traditional moving averages by using nested WMA calculations.

```typescript
import { hma } from 'trendcraft';

const hma9 = hma(candles);                          // Default period 9
const hma20 = hma(candles, { period: 20 });          // Custom period
```

HMA responds faster to price changes than SMA or EMA of the same period, making it ideal for short-term trend detection.

### Choppiness Index

Measures whether the market is choppy (range-bound) or trending. Values range from 0-100.

```typescript
import { choppinessIndex } from 'trendcraft';

const chop = choppinessIndex(candles);               // Default period 14

// Interpretation
chop.forEach(({ value }) => {
  if (value !== null) {
    if (value > 61.8) console.log('Choppy — avoid trend strategies');
    if (value < 38.2) console.log('Trending — good for trend following');
  }
});
```

### VWAP Bands

The standard VWAP now supports additional standard deviation bands for better support/resistance analysis.

```typescript
import { vwap } from 'trendcraft';

// Add ±2σ and ±3σ bands
const result = vwap(candles, { bandMultipliers: [2, 3] });
result.forEach(({ value }) => {
  console.log(value.vwap);           // VWAP
  console.log(value.upper, value.lower);  // ±1σ bands (always included)
  console.log(value.bands);          // [{upper, lower}, {upper, lower}] for 2σ and 3σ
});
```

### Anchored VWAP

Calculate VWAP from a specific anchor point — useful for measuring institutional cost basis from significant events like earnings, breakouts, or lows.

```typescript
import { anchoredVwap } from 'trendcraft';

const avwap = anchoredVwap(candles, {
  anchorTime: Date.parse('2024-01-15'),
  bands: 2,                           // Include ±1σ and ±2σ bands
});
```

### Connors RSI

A composite oscillator combining three components for mean reversion signals:

```typescript
import { connorsRsi } from 'trendcraft';

const crsi = connorsRsi(candles);    // Default: rsiPeriod=3, streakPeriod=2, rocPeriod=100

crsi.forEach(({ value }) => {
  if (value.crsi !== null) {
    if (value.crsi < 10) console.log('Strongly oversold');
    if (value.crsi > 90) console.log('Strongly overbought');
  }
});
```

### Gap Analysis

Detects price gaps between consecutive candles, classifies them, and tracks whether they get filled.

```typescript
import { gapAnalysis } from 'trendcraft';

const gaps = gapAnalysis(candles, { minGapPercent: 0.5 });

gaps.forEach(({ value }) => {
  if (value.type) {
    console.log(`Gap ${value.type}: ${value.gapPercent.toFixed(1)}% (${value.classification})`);
    if (value.filled) console.log('  → Gap has been filled');
  }
});
```

### Opening Range Breakout (ORB)

Identifies the high and low of the first N minutes of a trading session, then detects breakouts.

```typescript
import { openingRange } from 'trendcraft';

// 30-minute opening range (default)
const orb = openingRange(intradayCandles);

// 15-minute opening range
const orb15 = openingRange(intradayCandles, { minutes: 15 });

orb.forEach(({ value }) => {
  if (value.breakout === 'above') console.log('Breakout above opening range!');
  if (value.breakout === 'below') console.log('Breakdown below opening range!');
});
```

---

## Backtesting

### What is it?

Backtesting simulates a trading strategy's performance using historical data. TrendCraft provides a backtesting engine with preset conditions.

### Basic Usage

```typescript
import { runBacktest, goldenCross, deadCross } from 'trendcraft';

const result = runBacktest(
  candles,
  goldenCross(5, 25),  // Entry condition
  deadCross(5, 25),    // Exit condition
  {
    capital: 1000000,    // Initial capital
    stopLoss: 5,         // 5% stop loss
    takeProfit: 10,      // 10% take profit
  }
);
```

### Preset Conditions

| Condition | Description |
|-----------|-------------|
| `goldenCross(short, long)` | Short MA crosses above Long MA |
| `deadCross(short, long)` | Short MA crosses below Long MA |
| `rsiBelow(threshold)` | RSI below threshold |
| `rsiAbove(threshold)` | RSI above threshold |
| `macdCrossUp()` | MACD crosses above signal |
| `macdCrossDown()` | MACD crosses below signal |
| `bollingerBreakout('upper'/'lower')` | BB breakout |
| `validatedGoldenCross()` | Golden cross with fake signal detection |
| `validatedDeadCross()` | Dead cross with fake signal detection |

### Combining Conditions

```typescript
import { and, or, not } from 'trendcraft';

// Golden Cross AND RSI < 30
const entry = and(goldenCross(), rsiBelow(30));

// Dead Cross OR RSI > 70
const exit = or(deadCross(), rsiAbove(70));

// NOT overbought
const notOverbought = not(rsiAbove(70));
```

### Understanding Results

| Metric | Meaning | Target |
|--------|---------|--------|
| `totalReturnPercent` | Total return percentage | Positive = profit |
| `winRate` | Win rate | 50%+ preferred |
| `maxDrawdown` | Maximum drawdown | Below 20% is safe |
| `sharpeRatio` | Sharpe ratio | Above 1 is good |
| `profitFactor` | Profit/loss ratio | 1.5+ preferred |
| `avgHoldingDays` | Average holding period | Depends on strategy |

### Realistic Simulation

```typescript
const result = runBacktest(candles, entry, exit, {
  capital: 1000000,
  commission: 0,          // Fixed commission
  commissionRate: 0.1,    // Commission rate 0.1%
  slippage: 0.05,         // Slippage 0.05%
  stopLoss: 5,            // Stop loss 5%
  takeProfit: 15,         // Take profit 15%
  trailingStop: 3,        // Trailing stop 3%
  taxRate: 20.315,        // Japan tax rate
});
```

### Tips

- Past performance doesn't guarantee future results
- Test over sufficient periods (multiple years)
- Always account for commissions and slippage
- Ensure you can tolerate the max drawdown
- Use validated conditions (`validatedGoldenCross`) for better accuracy

---

## Signal Scoring

### What is it?

Signal scoring combines multiple technical indicators into a single composite score. Instead of relying on a single indicator, you can weight and combine various signals to get a more robust entry/exit decision.

### Why Use Signal Scoring?

```
Single indicator = High false positive rate
Multiple indicators = Confirmation, higher accuracy

Score = Weighted sum of active signals
High score = Multiple signals align = Higher confidence
```

### ScoreBuilder

TrendCraft provides a fluent API to build custom scoring strategies:

```typescript
import { ScoreBuilder, calculateScore } from 'trendcraft';

const config = ScoreBuilder.create()
  .addPOConfirmation(3.0)      // Perfect Order (weight: 3.0)
  .addRsiOversold(30, 2.0)     // RSI < 30 (weight: 2.0)
  .addVolumeSpike(1.5, 1.5)    // Volume spike (weight: 1.5)
  .addMacdBullish(1.5)         // MACD bullish
  .setThresholds(70, 50, 30)   // strong, moderate, weak
  .build();

const result = calculateScore(candles, candles.length - 1, config);
```

### Available Signals

| Category | Signal | Description |
|----------|--------|-------------|
| **Momentum** | `addRsiOversold(threshold, weight)` | RSI below threshold |
| | `addRsiOverbought(threshold, weight)` | RSI above threshold |
| | `addMacdBullish(weight)` | MACD bullish crossover |
| | `addMacdBearish(weight)` | MACD bearish crossover |
| | `addStochOversold(threshold, weight)` | Stochastics oversold |
| | `addStochBullishCross(threshold, weight)` | Stoch bullish cross |
| **Trend** | `addPerfectOrderBullish(weight)` | MA Perfect Order |
| | `addPOConfirmation(weight)` | PO+ confirmation |
| | `addPullbackEntry(period, weight)` | Pullback to MA |
| | `addGoldenCross(short, long, weight)` | Golden cross |
| | `addPriceAboveEma(period, weight)` | Price above EMA |
| **Volume** | `addVolumeSpike(threshold, weight)` | Volume > threshold × avg |
| | `addVolumeAnomaly(zThreshold, weight)` | Statistical anomaly |
| | `addBullishVolumeTrend(weight)` | Volume confirms trend |
| | `addCmfPositive(threshold, weight)` | CMF positive |

### Score Interpretation

```
Score >= 70 → Strong signal (high confidence)
Score >= 50 → Moderate signal (consider with caution)
Score >= 30 → Weak signal (wait for more confirmation)
Score < 30  → No signal (no action recommended)
```

### Presets

TrendCraft provides pre-built scoring strategies:

| Preset | Focus | Best For |
|--------|-------|----------|
| `momentum` | RSI, MACD, Stochastics | Swing trading |
| `meanReversion` | Oversold conditions | Buying dips |
| `trendFollowing` | Perfect Order, Volume | Following trends |
| `balanced` | Mixed signals | General purpose |

```typescript
import { getPreset, scoreAbove } from 'trendcraft';

// Use preset in backtest
const result = TrendCraft.from(candles)
  .strategy()
    .entry(scoreAbove(70, "trendFollowing"))
    .exit(deadCross())
  .backtest({ capital: 1000000 });
```

### Tips

- Start with presets, then customize based on your trading style
- Higher weights = more important signals
- Don't use too many signals (5-7 is usually enough)
- Backtest your scoring strategy before using it live

---

## Position Sizing

### What is it?

Position sizing determines how much capital to allocate to each trade. Proper position sizing is crucial for risk management and long-term survival.

### Why It Matters

```
Too large position = High risk, potential account blowup
Too small position = Missed opportunities
Optimal position = Risk control + Growth potential
```

### Methods

TrendCraft provides four position sizing methods:

#### 1. Risk-Based Sizing

Calculate position size from your risk tolerance and stop distance:

```typescript
import { riskBasedSize } from 'trendcraft';

const result = riskBasedSize({
  accountSize: 100000,     // $100,000 account
  entryPrice: 50,          // Entry at $50
  stopLossPrice: 48,       // Stop at $48 (4% below entry)
  riskPercent: 1,          // Risk 1% of account ($1,000)
});

// Result: 500 shares ($25,000 position)
// If stopped out: lose $1,000 (1% of account)
```

**When to use:** Most common method. Good for any strategy with defined stop loss.

#### 2. ATR-Based Sizing

Use ATR (Average True Range) to set dynamic stop distance:

```typescript
import { atrBasedSize } from 'trendcraft';

const result = atrBasedSize({
  accountSize: 100000,
  entryPrice: 50,
  atrValue: 2.5,           // Current ATR = $2.50
  atrMultiplier: 2,        // Stop = 2 × ATR = $5
  riskPercent: 1,
});

// Stop at $45 (2 × ATR below entry)
// Position size adjusts to volatility
```

**When to use:** When you want stop distance to adapt to market volatility.

#### 3. Kelly Criterion

Calculate optimal position size based on historical win rate:

```typescript
import { kellySize, calculateKellyPercent } from 'trendcraft';

// Calculate optimal Kelly percentage
const kellyPct = calculateKellyPercent(0.6, 1.5);
// 60% win rate, 1.5 win/loss ratio → 33% Kelly

const result = kellySize({
  accountSize: 100000,
  entryPrice: 50,
  winRate: 0.6,
  winLossRatio: 1.5,
  kellyFraction: 0.5,      // Half Kelly (safer)
});
```

**When to use:** When you have reliable historical statistics. Always use half or quarter Kelly for safety.

#### 4. Fixed Fractional

Simple percentage-based allocation:

```typescript
import { fixedFractionalSize } from 'trendcraft';

const result = fixedFractionalSize({
  accountSize: 100000,
  entryPrice: 50,
  fractionPercent: 10,     // 10% of account per trade
});

// Position: $10,000 = 200 shares
```

**When to use:** Simple diversification. Good for portfolio allocation.

### Position Sizing Comparison

| Method | Pros | Cons |
|--------|------|------|
| **Risk-Based** | Controlled risk per trade | Requires defined stop |
| **ATR-Based** | Adapts to volatility | Needs ATR calculation |
| **Kelly** | Mathematically optimal | Requires accurate stats |
| **Fixed Fractional** | Simple, predictable | Doesn't consider risk |

### Tips

- **Never risk more than 1-2% per trade** for long-term survival
- **Use maxPositionPercent** to cap position size
- **ATR-based** is excellent for volatile markets
- **Half Kelly** is safer than full Kelly (less drawdown)
- **Fixed Fractional** works well for diversification across many positions

---

## ATR Risk Management

### What is it?

ATR (Average True Range) measures market volatility. ATR-based risk management uses this volatility measure to set dynamic stop losses and take profits that adapt to market conditions.

### Why Use ATR for Risk Management?

```
Fixed % stop = Same distance regardless of volatility
ATR-based stop = Adapts to current market volatility

Volatile market → Wider stops (avoid noise)
Calm market → Tighter stops (lock in profits)
```

### Chandelier Exit

A trailing stop that follows price using ATR:

```typescript
import { chandelierExit } from 'trendcraft';

const chandelier = chandelierExit(candles, {
  period: 22,      // ATR period
  multiplier: 3,   // 3x ATR from high/low
});

chandelier.forEach(({ time, value }) => {
  console.log(`Long stop: ${value.longStop}`);
  console.log(`Short stop: ${value.shortStop}`);
});
```

**How it works:**
- Long stop = Highest high - (multiplier × ATR)
- Short stop = Lowest low + (multiplier × ATR)
- Trails price, never moves against you

### ATR-Based Stop Levels

Calculate entry, stop, and take-profit levels:

```typescript
import { calculateAtrStops } from 'trendcraft';

const levels = calculateAtrStops({
  entryPrice: 100,
  atrValue: 2.5,
  stopMultiplier: 2,        // 2x ATR for stop
  takeProfitMultiplier: 3,  // 3x ATR for take-profit
  direction: 'long',
});

// Result:
// stopPrice: 95 (100 - 2 × 2.5)
// takeProfitPrice: 107.5 (100 + 3 × 2.5)
// riskRewardRatio: 1.5
```

### Using ATR in Backtesting

```typescript
import { TrendCraft, goldenCross, deadCross } from 'trendcraft';

const result = TrendCraft.from(candles)
  .strategy()
    .entry(goldenCross())
    .exit(deadCross())
  .backtest({
    capital: 1000000,
    atrRisk: {
      enabled: true,
      period: 14,            // ATR period
      stopMultiplier: 2,     // 2x ATR stop
      takeProfitMultiplier: 3, // 3x ATR take-profit
    },
  });
```

### ATR Multiplier Guidelines

| Multiplier | Use Case | Stop Width |
|------------|----------|------------|
| 1.0-1.5 | Aggressive (tight stops) | Narrow |
| 2.0-2.5 | Moderate (standard) | Medium |
| 3.0+ | Conservative (wide stops) | Wide |

### Tips

- **2x ATR** is a common starting point for stops
- **Higher multipliers** = fewer stop-outs but larger losses when hit
- **Risk:Reward ratio** should be at least 1:1.5 or 1:2
- **Chandelier Exit** works great as a trailing stop in trends
- **Combine with position sizing** for complete risk management

### Complete Risk Management Example

```typescript
import {
  atrBasedSize,
  calculateAtrStops,
  atr
} from 'trendcraft';

// Calculate ATR
const atrValues = atr(candles, { period: 14 });
const currentAtr = atrValues[atrValues.length - 1].value;

// Calculate position size
const position = atrBasedSize({
  accountSize: 100000,
  entryPrice: 50,
  atrValue: currentAtr,
  atrMultiplier: 2,
  riskPercent: 1,           // Risk 1% of account
});

// Calculate stop and take-profit
const levels = calculateAtrStops({
  entryPrice: 50,
  atrValue: currentAtr,
  stopMultiplier: 2,
  takeProfitMultiplier: 3,
  direction: 'long',
});

console.log(`Buy ${position.shares} shares at $50`);
console.log(`Stop: ${levels.stopPrice}`);
console.log(`Target: ${levels.takeProfitPrice}`);
console.log(`Risk/Reward: 1:${levels.riskRewardRatio.toFixed(1)}`);
```

---

## Signal Interpretation

### Combining Signals

No single indicator is perfect. Combine multiple signals for better accuracy:

```
Strong Buy Signal:
  ✓ Golden Cross (MA)
  ✓ RSI rising from oversold
  ✓ MACD bullish crossover
  ✓ Volume increasing
  ✓ ADX > 25 with +DI > -DI

Strong Sell Signal:
  ✓ Dead Cross (MA)
  ✓ RSI falling from overbought
  ✓ MACD bearish crossover
  ✓ Volume increasing
  ✓ ADX > 25 with -DI > +DI
```

### Understanding Divergence Signals

Divergence is a powerful but often misunderstood signal:

| Signal Type | Meaning | Reliability |
|-------------|---------|-------------|
| **Bullish Divergence** | Price: Lower Low, Indicator: Higher Low | Potential bottom |
| **Bearish Divergence** | Price: Higher High, Indicator: Lower High | Potential top |

**Important Notes:**
- Divergence = *potential* reversal, not guarantee
- Works better at extremes (overbought/oversold)
- Wait for confirmation (price actually reverses)
- Multiple divergences = stronger signal

### Market Context

Indicators behave differently in different market conditions:

| Market Type | Best Indicators | Avoid |
|-------------|-----------------|-------|
| **Trending** | MA, MACD, ADX | RSI extremes, Stochastics |
| **Ranging** | RSI, Stochastics, Bollinger | MA crossovers |
| **Volatile** | ATR, Bollinger Bands | Fixed stop-losses |
| **Low Volatility** | Squeeze detection | Breakout trades (wait) |

### Common Mistakes to Avoid

1. **Acting on single indicator** - Always seek confirmation
2. **Ignoring the trend** - Don't fight strong trends
3. **Overtrading overbought/oversold** - Strong trends stay extreme
4. **Ignoring volume** - Volume validates price moves
5. **Not waiting for confirmation** - Divergence needs follow-through

### Quick Reference: When to Use Each Indicator

| Want to Know | Use This |
|--------------|----------|
| Overall trend direction | MA (50, 200), Ichimoku Cloud |
| Short-term trend | MA (5, 20), MACD, Supertrend |
| Trend strength | ADX |
| Overbought/Oversold | RSI, Stochastics, MFI, CCI, Williams %R |
| Volatility | Bollinger Bands, ATR |
| Volume confirmation | OBV, MFI, VWAP, Volume Trend |
| Volume anomalies | Volume Anomaly Detection |
| Key price levels | Volume Profile (POC, VAH, VAL) |
| Potential reversals | Divergence (RSI, MACD, OBV, Volume) |
| Breakout setup | Bollinger Squeeze, Range-Bound |
| Sideways market | Range-Bound Detection |
| Support/Resistance | Pivot Points, Ichimoku (Cloud), Range Boundaries, Volume Profile |
| Momentum change | ROC, MACD |
| Higher timeframe context | MTF conditions (Weekly RSI, SMA, ADX) |
| Strategy validation | Backtesting |

---

## Volatility Regime

### What is it?

Volatility regime classification identifies the current market volatility environment to help you adjust your trading strategy accordingly. It combines ATR percentile and Bollinger Bandwidth percentile to classify markets into four regimes.

### Regimes

| Regime | Percentile | Characteristics |
|--------|------------|-----------------|
| `low` | ≤ 25 | Quiet market, tight ranges, good for mean-reversion |
| `normal` | 25-75 | Average volatility, most strategies work |
| `high` | 75-95 | Elevated volatility, use wider stops |
| `extreme` | ≥ 95 | Very high volatility, reduce position size |

### How to Read

```
regime = 'low'      → Consider range-bound or mean-reversion strategies
regime = 'normal'   → Standard strategy parameters
regime = 'high'     → Widen stops, reduce position size
regime = 'extreme'  → Very cautious, consider sitting out
```

### Trading Applications

```typescript
import { regimeIs, regimeNot, atrPercentAbove, and, goldenCross, bollingerTouch } from 'trendcraft';

// Range-bound strategies in low volatility
const rangeEntry = and(
  regimeIs('low'),
  bollingerTouch('lower')
);

// Avoid high volatility for trend strategies
const trendEntry = and(
  regimeNot('extreme'),
  goldenCross()
);

// Filter by ATR% for trend-following (volatile stocks only)
const volatileStocks = and(
  atrPercentAbove(2.3),  // Only volatile stocks
  perfectOrderBullish()
);
```

### ATR% Filtering

ATR% (ATR as percentage of price) is useful for screening stocks by volatility level:

```
ATR% < 1.5%  → Low volatility (bonds, utilities)
ATR% 1.5-2.3% → Moderate volatility
ATR% > 2.3%  → High volatility (good for trend-following)
ATR% > 3%    → Very volatile (tech, growth stocks)
```

### Tips

- **Low volatility**: Consider range-bound or mean-reversion strategies
- **High/Extreme volatility**: Use wider stops, smaller positions
- **ATR%**: Filter stocks by volatility level (2.3%+ is typically good for trend-following)
- **Regime changes**: Watch for volatility expansion/contraction as potential breakout signals

---

## Strategy Optimization

### What is it?

Strategy optimization helps you find the best parameters and conditions for your trading strategy through systematic testing. TrendCraft provides three optimization methods.

### Grid Search

Grid search tests all combinations of parameter values to find optimal settings.

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
    param('long', [25, 50, 75, 100]),
  ],
  {
    metric: 'sharpeRatio',
    constraints: [
      constraint('winRate', '>=', 40),
      constraint('maxDrawdown', '<=', 30),
    ],
    topN: 5
  }
);

console.log('Best parameters:', result.results[0].parameters);
console.log('Sharpe ratio:', result.results[0].metrics.sharpeRatio);
```

### Walk-Forward Analysis

Walk-forward analysis validates that optimized parameters work on out-of-sample data. This helps avoid overfitting.

**How it works:**
1. Divide data into in-sample (training) and out-of-sample (testing) periods
2. Optimize parameters on in-sample data
3. Test on out-of-sample data
4. Repeat for multiple periods

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
```

### Combination Search

Find the best entry/exit condition combinations from pools of conditions.

```typescript
import { combinationSearch, createEntryConditionPool, createExitConditionPool } from 'trendcraft';

const result = combinationSearch(
  candles,
  createEntryConditionPool(),
  createExitConditionPool(),
  { metric: 'sharpeRatio', topN: 20 }
);
```

### Tips

- **Start simple**: Optimize 2-3 parameters at a time, not everything
- **Use constraints**: Filter out unrealistic results (e.g., max drawdown > 50%)
- **Validate**: Always use walk-forward analysis to check for overfitting
- **Be skeptical**: Past performance doesn't guarantee future results

---

## Scaled Entry Strategies

### What is it?

Scaled entry (or split entry) divides your capital into multiple tranches instead of entering all at once. This can improve average entry price and reduce timing risk.

### Strategies

| Strategy | Description | Example (3 tranches) |
|----------|-------------|---------------------|
| `equal` | Equal weight per tranche | 33%, 33%, 33% |
| `pyramid` | Larger early tranches | 50%, 33%, 17% |
| `reverse-pyramid` | Larger later tranches | 17%, 33%, 50% |

### Interval Types

| Type | Description |
|------|-------------|
| `signal` | Add tranche on each entry signal |
| `price` | Add tranche when price drops by priceInterval % |

### Usage Example

```typescript
import { runBacktestScaled, goldenCross, deadCross } from 'trendcraft';

// Enter in 3 tranches, adding on 2% dips
const result = runBacktestScaled(candles, goldenCross(), deadCross(), {
  capital: 1000000,
  scaledEntry: {
    tranches: 3,
    strategy: 'pyramid',      // 50%, 33%, 17%
    intervalType: 'price',
    priceInterval: -2,        // Add on 2% dips
  },
});

// Signal-based: add on each golden cross
const result2 = runBacktestScaled(candles, goldenCross(), deadCross(), {
  capital: 1000000,
  scaledEntry: {
    tranches: 3,
    strategy: 'equal',
    intervalType: 'signal',
  },
});
```

### When to Use Each Strategy

| Strategy | Best For |
|----------|----------|
| **Pyramid** | High confidence in initial signal, want larger early exposure |
| **Equal** | Neutral approach, balanced risk |
| **Reverse-pyramid** | Uncertain about timing, want to average down |

### Tips

- **Pyramid** is good when you're confident in the initial signal
- **Reverse-pyramid** is good for averaging down on dips
- **Price-based intervals** work well in volatile markets
- **Signal-based intervals** work well for trend-following strategies
- Consider partial take-profit to lock in gains as position builds

---

## Real-Time Streaming

Batch indicators (`sma(candles, ...)`, `rsi(candles, ...)`, etc.) recompute from scratch every call. For live data — WebSocket ticks, paper-trading bots, alert dashboards — use the **incremental indicators** and the **live candle pipeline** introduced in v0.2.0.

### Incremental indicators

Every incremental factory keeps O(1) internal state and updates bar-by-bar:

```typescript
import { incremental } from 'trendcraft';

const rsi = incremental.createRsi({ period: 14 });
rsi.next(candle);      // advance state, returns { time, value }
rsi.peek(candle);      // preview without advancing (useful for forming bars)
const snap = rsi.getState();  // serialize for persistence

// Later: resume from the serialized state
const resumed = incremental.createRsi({ period: 14 }, { fromState: snap });
```

v0.2.0 ships 160+ factories across moving-average, momentum, trend, volatility, volume, price, and Wyckoff categories.

### `createLiveCandle` — one object for ticks, bars, and indicator snapshots

Writing your own candle aggregator and wiring it to a dozen indicators by hand is tedious. `createLiveCandle` bundles both:

```typescript
import { createLiveCandle, incremental } from 'trendcraft';

const live = createLiveCandle({
  intervalMs: 60_000,
  indicators: [
    { name: 'sma20', create: (s) => incremental.createSma({ period: 20 }, { fromState: s }) },
    { name: 'rsi14', create: (s) => incremental.createRsi({ period: 14 }, { fromState: s }) },
  ],
  history: historicalCandles,  // optional warm-up context
});

live.on('candleComplete', ({ candle, snapshot }) => {
  console.log('Closed:', candle.close, 'SMA20:', snapshot.sma20, 'RSI14:', snapshot.rsi14);
});

// Tick mode — feed raw trades
ws.on('trade', (t) => live.addTick(t));

// Or candle mode — feed formed bars from a data vendor
live.addCandle(bar);
live.addCandle(formingBar, { partial: true });
```

Events:

- `tick` fires on every ingested trade/bar with `{ candle, snapshot, isNewCandle }`
- `candleComplete` fires when a bar closes with `{ candle, snapshot }`

State is fully serializable via `live.getState()` so you can resume after a process restart.

### Indicator registries (`livePresets`, `indicatorPresets`)

If you're building something like an interactive dashboard or screener where users pick indicators by name, the preset registries save you from hard-coding a switch statement:

```typescript
import { livePresets, indicatorPresets } from 'trendcraft';

// Instantiate by string id
const smaFactory = livePresets.sma.createFactory({ period: 50 });
const smaIndicator = smaFactory(undefined);

// `indicatorPresets` adds a batch `compute` for one-shot static calculation
const rsiSeries = indicatorPresets.rsi.compute(candles, { period: 14 });
```

`livePresets` ships 76 entries (streaming-focused); `indicatorPresets` ships 95 with both streaming and batch paths.

### Series metadata (`SeriesMeta` / `tagSeries`)

Every built-in indicator output carries a non-enumerable `__meta` with display conventions — label, whether it belongs on the price scale, Y-range, reference lines:

```typescript
import { rsi } from 'trendcraft';

const r = rsi(candles, { period: 14 });
r.__meta; // { kind: 'rsi', label: 'RSI(14)', overlay: false, yRange: [0, 100], referenceLines: [30, 70] }
```

`kind` is the stable, parameter-independent identifier (matches `indicatorPresets` keys) — use it for filtering (`s.__meta?.kind === 'rsi'`). `label` is for display and changes with parameters.

Use `tagSeries` on your own indicators if you want the same conventions to flow downstream (into UIs, dashboards, renderers). Consumers that don't care about metadata can ignore it — the series is still a plain `{ time, value }[]`.

---

## Summary

Technical analysis is not about predicting the future—it's about understanding probabilities and managing risk. Use TrendCraft's indicators to:

1. **Identify trends** (MA, MACD, ADX, Ichimoku, Supertrend)
2. **Detect sideways markets** (Range-Bound Detection)
3. **Find entry/exit points** (RSI, Stochastics, CCI, Williams %R, crossovers)
4. **Confirm with volume** (OBV, MFI, VWAP)
5. **Advanced volume analysis** (Volume Anomaly, Volume Profile, Volume Trend)
6. **Assess volatility** (Bollinger Bands, ATR)
7. **Detect potential reversals** (divergence, squeeze, ROC)
8. **Find support/resistance** (Pivot Points, Ichimoku Cloud, Range Boundaries, Volume Profile POC)
9. **Multi-timeframe analysis** (Weekly/Monthly RSI, SMA, trend filters)
10. **Validate strategies** (Backtesting with preset conditions)

Remember: No indicator is perfect. Combine multiple tools, always manage risk, and never invest more than you can afford to lose.
