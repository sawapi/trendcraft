# TrendCraft Beginner's Guide

A practical guide to understanding technical indicators and trading signals.

## Table of Contents

- [Moving Averages](#moving-averages)
- [RSI (Relative Strength Index)](#rsi-relative-strength-index)
- [MACD](#macd)
- [Stochastics](#stochastics)
- [Bollinger Bands](#bollinger-bands)
- [DMI/ADX](#dmiadx)
- [Volume Indicators](#volume-indicators)
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
| Overall trend direction | MA (50, 200) |
| Short-term trend | MA (5, 20), MACD |
| Trend strength | ADX |
| Overbought/Oversold | RSI, Stochastics, MFI |
| Volatility | Bollinger Bands, ATR |
| Volume confirmation | OBV, MFI |
| Potential reversals | Divergence (RSI, MACD, OBV) |
| Breakout setup | Bollinger Squeeze |

---

## Summary

Technical analysis is not about predicting the future—it's about understanding probabilities and managing risk. Use TrendCraft's indicators to:

1. **Identify trends** (MA, MACD, ADX)
2. **Find entry/exit points** (RSI, Stochastics, crossovers)
3. **Confirm with volume** (OBV, MFI)
4. **Assess volatility** (Bollinger Bands, ATR)
5. **Detect potential reversals** (divergence, squeeze)

Remember: No indicator is perfect. Combine multiple tools, always manage risk, and never invest more than you can afford to lose.
