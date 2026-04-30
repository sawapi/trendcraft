# Chart Analysis Guide for LLM Agents

A systematic framework for technical chart analysis using `__chart` API + visual snapshots.
Designed for LLM agents operating via `agent-browser eval`.

## Analysis Workflow

Follow this top-down process: **Macro (weekly) → Micro (daily) → Synthesis**.

### Step 1: Load & Weekly Overview (Trend Context)

```js
__chart.loadCSV(csv, "7203.T")
__chart.setTimeframe("weekly")
__chart.setDisplayYears(5)
__chart.setOverlays(["sma25", "sma75", "ichimoku"])
__chart.setIndicators(["rsi"])
__chart.setZoom(0, 100)
__chart.snapshot() // Capture weekly chart
```

**What to evaluate from the snapshot:**

| Factor | Bullish | Neutral | Bearish |
|--------|---------|---------|---------|
| MA arrangement | SMA25 > SMA75, price above both | Intertwined / flat | SMA25 < SMA75, price below both |
| Ichimoku cloud | Price above cloud, cloud green | Price inside cloud | Price below cloud, cloud red |
| Cloud thickness | Thick cloud below = strong support | Thin cloud | Thick cloud above = strong resistance |
| RSI (weekly) | 50-65 in uptrend | Around 50 | 35-50 in downtrend |
| Price slope | Higher highs + higher lows | Flat / sideways | Lower highs + lower lows |

**Output:** Determine the primary trend direction → **Uptrend / Downtrend / Range**

---

### Step 2: Daily Chart with Overlays (Price Structure)

```js
__chart.setTimeframe("daily")
__chart.setOverlays(["bb", "sma25", "sma75", "supertrend"])
__chart.setIndicators([])
__chart.setZoom(85, 100) // Focus on recent ~3 months
__chart.snapshot()
```

**What to evaluate from the snapshot:**

| Factor | Bullish | Caution | Bearish |
|--------|---------|---------|---------|
| BB position | Walking upper band | Middle band | Walking lower band |
| BB width | Expanding (trend starting) | Squeezing (breakout soon) | Expanding after breakdown |
| SMA25 vs SMA75 | Golden cross or widening gap up | Converging | Death cross or widening gap down |
| Supertrend | Green (below price) | Just flipped | Red (above price) |
| Price vs SMA25 | Bouncing off SMA25 as support | Crossing back and forth | Rejected at SMA25 as resistance |

**Output:** Determine the current position in the trend → **Early / Middle / Late / Exhaustion / Reversal**

---

### Step 3: Daily Chart with Oscillators (Momentum & Volume)

```js
__chart.setOverlays(["bb"])
__chart.setIndicators(["rsi", "macd", "obv", "volumeAnomaly"])
__chart.snapshot()
```

**What to evaluate from the snapshot:**

**RSI:**
| Zone | Reading | Interpretation |
|------|---------|----------------|
| Overbought | > 70 | Caution if in uptrend; sell signal if in downtrend |
| Bullish momentum | 50-70 | Healthy uptrend territory |
| Neutral | ~50 | No directional bias |
| Bearish momentum | 30-50 | Downtrend territory |
| Oversold | < 30 | Bounce likely; buy signal if in uptrend |

**MACD:**
| Pattern | Signal |
|---------|--------|
| Histogram expanding positive | Strengthening bullish momentum |
| Histogram contracting positive | Momentum fading, potential peak |
| Signal line bullish cross | Buy signal (stronger if below zero line) |
| Signal line bearish cross | Sell signal (stronger if above zero line) |
| Bullish divergence (price lower low, MACD higher low) | Reversal up likely |
| Bearish divergence (price higher high, MACD lower high) | Reversal down likely |

**OBV:**
| Pattern | Signal |
|---------|--------|
| OBV rising with price | Volume confirms trend (healthy) |
| OBV flat while price rises | No volume support (suspect rally) |
| OBV diverging from price | Potential trend reversal |

**Volume Anomaly:**
| Pattern | Signal |
|---------|--------|
| Spike with trend continuation candle | Institutional participation, trend likely to continue |
| Spike with reversal candle (long wick / doji) | **Climax signal** — high probability of reversal or pause |
| Spike with gap-up/down next day | Momentum shift, watch for follow-through |
| Multiple consecutive spikes | Extreme volatility zone — reduce position size |

> **Lesson (verified 2026/02):** Volume anomaly detection is critical for identifying
> blow-off tops. A 2x+ volume spike combined with a long upper wick near resistance
> is a strong reversal warning, even when the broader trend is bullish.

---

### Step 4: Signal Check (Optional)

```js
__chart.setIndicators(["rsi"])
__chart.enableSignals(["cross", "divergence", "bbSqueeze"])
__chart.snapshot()
```

Check sidebar for recent signal events:
- **GC/DC**: Recent golden/death cross timing and distance
- **Divergence**: Any active RSI/MACD divergence
- **BB Squeeze**: Pending volatility breakout

**GC/DC reliability check:**
Look at the signal history in the sidebar. If you see multiple GC/DC events
marked as "(fake?)" in the recent past, the current GC/DC signal has **low
reliability**. In choppy/range-bound periods, GC/DC signals whipsaw frequently.

| Recent history | Reliability | Scoring weight |
|----------------|-------------|----------------|
| Clean signals (few fakes in last 6 months) | High | Full weight (±1) |
| Mixed (some fakes) | Medium | Half weight (±0.5) |
| Frequent fakes (3+ in last 3 months) | Low | **Ignore** (0) |

**Divergence timing nuance:**
Bearish divergence does NOT always mean immediate reversal. Common patterns:

| Scenario | What happens | Action |
|----------|-------------|--------|
| Bear Div + weakening momentum | Gradual top, price fades | Reduce on rallies |
| Bear Div + strong trend continues | **Blow-off top** — one last surge, then sharp reversal | Do NOT chase the surge; wait for reversal candle |
| Bear Div + volume spike at peak | Climax top — highest conviction reversal signal | Exit or tighten stop aggressively |

> **Lesson (verified 2026/02):** Bear Div on 1/15 was followed by a +7.9% blow-off
> rally before the sharp reversal on 2/9 (4,000→3,729 with 40M volume spike).
> Divergence flagged the *vulnerability*, not the *timing*.

---

### Step 4b: Valuation Check (Optional — requires PER/PBR in CSV)

```js
__chart.setOverlays([])
__chart.setIndicators(["per", "pbr"])
__chart.setSignals([])
__chart.setZoom(0, 100) // Full range to see historical valuation context
__chart.snapshot()
```

**What to evaluate from the snapshot:**

Compare the **current PER/PBR** against their historical range visible in the chart:

| Current vs History | Signal | Interpretation |
|--------------------|--------|----------------|
| Near historical low | Bullish | Undervalued relative to own history — upside potential |
| Middle of range | Neutral | Fair value zone |
| Near historical high | Bearish | Stretched valuation — limited upside, downside risk |
| Sharp recent spike/drop | Caution | Likely driven by earnings change, not price — investigate |

**Key nuances:**
- PER can drop sharply due to **earnings increase** (bullish) or rise due to **earnings decline** (bearish) — direction of change matters as much as the level
- PBR < 1.0 is generally considered "below book value" (deep value territory)
- Compare PER/PBR trends with price: if price is rising but PER is flat/falling, earnings growth is outpacing price → healthy
- Sector context matters: growth stocks (tech) naturally have higher PER than value stocks (banks)

---

### Step 5: Synthesis & Confluence Scoring

Combine findings from Steps 1-4 into a structured score:

| # | Factor | Question | Bull (+1) | Bear (-1) | Neutral (0) |
|---|--------|----------|-----------|-----------|-------------|
| 1 | Weekly Trend | Is the major trend favorable? | Uptrend | Downtrend | Range |
| 2 | MA Structure | Are MAs in favorable order? | Golden cross / perfect order | Death cross | Mixed |
| 3 | Price vs Cloud | Where is price relative to Ichimoku cloud? | Above | Below | Inside |
| 4 | Bollinger Bands | What's the BB state? | Upper band walk / expansion up | Lower band walk / expansion down | Squeeze |
| 5 | RSI Level | Is momentum favorable? | 50-70 (uptrend) or <30 (oversold bounce) | 30-50 (downtrend) or >70 (overbought) | ~50 |
| 6 | MACD Direction | Is MACD confirming? | Bullish cross / expanding histogram | Bearish cross / contracting histogram | Flat |
| 7 | Volume | Is volume confirming? | OBV rising + no anomaly spikes | OBV diverging or climax spike | Flat |
| 8 | Signals | Any active signals? | GC, bullish divergence | DC, bearish divergence | None |
| 9 | Valuation (optional) | PER/PBR vs historical range? | Near historical low | Near historical high | Mid-range |

> **Scoring adjustments:**
> - **Signal reliability**: If GC/DC has low reliability (frequent fakes), score as 0 instead of ±1. See Step 4 reliability table.
> - **Volume anomaly override**: A volume spike (2x+) with a reversal candle at a trend extreme overrides OBV direction. Score as **-1** (bearish) regardless of OBV trend.
> - **Divergence as modifier**: When bearish divergence is active, cap the maximum total score at **+4** (i.e., do not rate "Strong Bullish" while divergence is unresolved).

**Score interpretation:**

| Total | Assessment | Action |
|-------|-----------|--------|
| +6 to +8 | Strong Bullish | High conviction buy zone |
| +3 to +5 | Bullish | Buy on pullback to support |
| +1 to +2 | Slightly Bullish | Small position, tight stop |
| -1 to +1 | Neutral | Wait for clearer signal |
| -2 to -3 | Slightly Bearish | Reduce exposure |
| -4 to -5 | Bearish | Sell / short on rally |
| -6 to -8 | Strong Bearish | High conviction sell zone |

---

## Key Visual Patterns to Watch

When examining snapshots, look for these high-value patterns:

### Bullish
- **Ichimoku triple bullish**: Price above cloud + tenkan > kijun + chikou above price
- **BB squeeze breakout up**: After prolonged squeeze, price breaks above upper band with volume
- **RSI bullish divergence**: Price makes lower low but RSI makes higher low
- **Support bounce**: Price touches SMA75 or cloud top and bounces with volume

### Bearish
- **Ichimoku triple bearish**: Price below cloud + tenkan < kijun + chikou below price
- **BB squeeze breakdown**: After squeeze, price breaks below lower band
- **RSI bearish divergence**: Price makes higher high but RSI makes lower high
- **Resistance rejection**: Price touches SMA75 or cloud bottom from below and fails

### Reversal Warning
- **Blow-off top**: Rapid acceleration after bearish divergence + volume spike (2x+) + long upper wick at round number resistance → sharp reversal within 1-3 days *(verified: 7203.T 2026/02/09)*
- **Climax candle**: Extremely long candle + volume spike at trend extreme
- **Doji at key level**: Indecision candle at support/resistance
- **Triple divergence**: Divergence across RSI + MACD + OBV simultaneously

---

## Output Template

Use this structure for consistent analysis output:

```
## [Symbol] Analysis ([Date])

### 1. Trend Context (Weekly)
- Primary Trend: [Uptrend / Downtrend / Range]
- MA Arrangement: [Perfect Order Bull / Bear / Mixed]
- Ichimoku: [Above cloud / Inside / Below cloud]
- Weekly RSI: [Value] ([Zone])

### 2. Current Position (Daily)
- Phase: [Early trend / Mid trend / Late trend / Exhaustion / Reversal]
- Bollinger Bands: [Upper walk / Squeeze / Lower walk / Middle]
- Supertrend: [Bullish / Bearish] (flipped [N] bars ago)
- Key Support: [Level] | Key Resistance: [Level]

### 3. Momentum & Volume
- RSI(14): [Value] - [Interpretation]
- MACD: [Histogram direction] - [Signal cross status]
- OBV: [Rising/Flat/Falling] - [Confirms/Diverges from price]

### 4. Active Signals
- [List any GC/DC, divergence, squeeze signals]

### 4b. Valuation (if PER/PBR available)
- PER: [Value] ([Zone: low / mid / high] vs historical range)
- PBR: [Value] ([Zone])
- Trend: [PER rising = earnings declining / PER falling = earnings growing]

### 5. Confluence Score
| Factor | Signal | Score |
|--------|--------|-------|
| Weekly Trend | ... | +1/-1/0 |
| MA Structure | ... | +1/-1/0 |
| Ichimoku | ... | +1/-1/0 |
| BB State | ... | +1/-1/0 |
| RSI | ... | +1/-1/0 |
| MACD | ... | +1/-1/0 |
| Volume | ... | +1/-1/0 |
| Signals | ... | +1/-1/0 |
| **Total** | | **[X]** |

### 6. Assessment
- Bias: [Strong Bull / Bull / Neutral / Bear / Strong Bear]
- Confidence: [High / Medium / Low]
- Key Watch: [What would change this assessment]
```

---

## Quick Reference: API Sequence

```bash
# Full analysis in 4 snapshots:

# 1. Weekly trend
eval '__chart.setTimeframe("weekly"); __chart.setDisplayYears(5); __chart.setOverlays(["sma25","sma75","ichimoku"]); __chart.setIndicators(["rsi"]); __chart.setZoom(0,100); __chart.snapshot()'

# 2. Daily price structure
eval '__chart.setTimeframe("daily"); __chart.setOverlays(["bb","sma25","sma75","supertrend"]); __chart.setIndicators([]); __chart.setZoom(85,100); __chart.snapshot()'

# 3. Daily momentum & volume
eval '__chart.setOverlays(["bb"]); __chart.setIndicators(["rsi","macd","obv","volumeAnomaly"]); __chart.snapshot()'

# 4. Signal check (use screenshot instead of snapshot to capture sidebar signals)
eval '__chart.setIndicators(["rsi"]); __chart.setSignals(["cross","divergence","bbSqueeze"])'
# Then: agent-browser screenshot /tmp/signals.png
```

