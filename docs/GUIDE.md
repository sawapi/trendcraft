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
- [Backtesting](#backtesting)
- [Signal Interpretation](#signal-interpretation)

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
| Volume confirmation | OBV, MFI, VWAP |
| Potential reversals | Divergence (RSI, MACD, OBV) |
| Breakout setup | Bollinger Squeeze |
| Support/Resistance | Pivot Points, Ichimoku (Cloud) |
| Momentum change | ROC, MACD |
| Strategy validation | Backtesting |

---

## Summary

Technical analysis is not about predicting the future—it's about understanding probabilities and managing risk. Use TrendCraft's indicators to:

1. **Identify trends** (MA, MACD, ADX, Ichimoku, Supertrend)
2. **Find entry/exit points** (RSI, Stochastics, CCI, Williams %R, crossovers)
3. **Confirm with volume** (OBV, MFI, VWAP)
4. **Assess volatility** (Bollinger Bands, ATR)
5. **Detect potential reversals** (divergence, squeeze, ROC)
6. **Find support/resistance** (Pivot Points, Ichimoku Cloud)
7. **Validate strategies** (Backtesting with preset conditions)

Remember: No indicator is perfect. Combine multiple tools, always manage risk, and never invest more than you can afford to lose.
