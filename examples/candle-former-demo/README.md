# CandleFormer Demo

A small-scale experiment using a pure TypeScript Transformer decoder to predict next-bar direction from candlestick sequences.

> **Note**: This is a research/educational prototype. Training is done entirely in JavaScript (no native dependencies), so it is intentionally slow. For production-scale training, consider using PyTorch and exporting weights to the `CandleFormerWeights` JSON format for inference with `candleFormer()`.

## Architecture

**MicroGPT-style Transformer Decoder** — fully implemented in TypeScript with no external dependencies.

```
Token Embedding + Position Embedding [+ Pattern Embedding]
  → [LayerNorm → Causal Self-Attention → Residual
     → LayerNorm → MLP (GELU) → Residual] × N layers
  → Output Head → 3-class softmax (bullish / bearish / neutral)
```

### Tokenization

**v2 Shape-Category Tokenizer**: 17 traditional candlestick shape categories × 4 volume bins = 69 tokens.

| Group | Shapes | Examples |
|---|---|---|
| Bullish (0-5) | marubozu, close_shaven, open_shaven, normal, small, long_upper | |
| Bearish (6-11) | marubozu, close_shaven, open_shaven, normal, small, long_lower | |
| Doji (12-16) | four_price, dragonfly, gravestone, long_legged, standard | |

### Dual Embedding (Pattern-Aware)

Optional feature that adds a second embedding layer for multi-candle candlestick patterns (engulfing, morning star, etc.). The final embedding is an element-wise sum:

```
embed = shapeEmbed[shapeId] + posEmbed[pos] + patternEmbed[patternId]
```

- Shape vocab: 69 (v2 tokenizer)
- Pattern vocab: 15 (14 multi-candle patterns + 1 "none")
- Single-candle patterns are excluded since they overlap with shape categories

## Setup

```bash
pnpm install
```

### Fetch Data

Requires Alpaca API credentials in `.env`:

```bash
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
```

```bash
pnpm fetch-data AAPL MSFT GOOG AMZN META NVDA AVGO CRM ADBE ORCL
```

## Usage

### Train

```bash
# Single stock
pnpm train aapl

# Multi-stock (combined training)
pnpm train aapl msft goog amzn meta nvda

# With pattern-aware dual embedding
pnpm train --patterns aapl
```

### Predict

```bash
pnpm predict aapl           # last 10 predictions
pnpm predict aapl 20        # last 20
pnpm predict --patterns aapl
```

### Backtest

```bash
pnpm backtest aapl
```

Splits data 70/30 (train/test), trains in-sample, then backtests out-of-sample with:
- Entry: bullish prediction (confidence ≥ 50%)
- Exit: bearish prediction (confidence ≥ 40%)

## Training Config

| Parameter | Value |
|---|---|
| Sequence length | 32 |
| Embedding dim | 32 |
| Attention heads | 4 |
| MLP hidden dim | 128 |
| Layers | 2 |
| Epochs | 500 (early stopping) |
| Patience | 25 |
| Batch size | 32 |
| Learning rate | 0.001 (warmup + cosine decay) |
| Label smoothing | 0.1 |
| Dropout | 0.1 |
| Weight decay | 0.01 |
| Gradient clipping | 1.0 |

## Experiment Results

**Dataset**: AAPL daily bars, ~1,415 candles (2020-2026), 90/10 train/val split.

### Accuracy Comparison

| Model | Val Accuracy | Val Loss | Train Loss | Epochs |
|---|---|---|---|---|
| Random baseline | 33.3% | — | — | — |
| v2 Shape Only | 44.9% | 0.9093 | 0.8359 | 32 (early stop) |
| **Dual Embedding** | **48.6%** | **0.9006** | 0.8466 | 32 (early stop) |

### Prediction Distribution (AAPL, full dataset)

| Model | Bullish | Bearish | Neutral |
|---|---|---|---|
| v2 Shape Only | 879 (62%) | 536 (38%) | 0 (0%) |
| Dual Embedding | 1,084 (77%) | 331 (23%) | 0 (0%) |

### Key Observations

- Both models beat random baseline (~33%) by a meaningful margin
- Dual Embedding adds +3.7% accuracy over shape-only, confirming that multi-candle pattern information is useful
- **Neutral predictions are absent** — the 0.1% neutral threshold likely makes neutral samples too rare in training data. Widening to 0.3-0.5% may help
- **Bullish bias** — reflects the 2020-2026 US equity uptrend in the training data
- **Fast overfitting** — val_loss starts rising by epoch 20, suggesting the model capacity exceeds what 1,415 candles can support
- **Training speed** — ~25s/epoch for 1,415 candles, ~260s/epoch for 14,144 candles (10 stocks). Pure JS is the bottleneck; inference is fast

### Potential Improvements

- Widen `neutralThreshold` (0.3-0.5%) for more balanced class distribution
- Simplify to 2-class (up/down) for higher accuracy
- Use more data (10+ years, or multi-stock)
- Train with PyTorch for speed, export weights for JS inference
- Tune model size down (1 layer, 16-dim) to reduce overfitting on small data

## API Integration

```typescript
import { trainCandleFormer, candleFormer } from "trendcraft";

// Train (with pattern-aware dual embedding)
const { weights, accuracy } = trainCandleFormer(candles, {
  epochs: 500,
  enablePatterns: true,
});

// Predict
const predictions = candleFormer(newCandles, { weights });
for (const p of predictions) {
  console.log(`${p.value.direction} (${p.value.confidence}%)`);
}

// Backtest
import { candleFormerBullish, candleFormerBearish, runBacktest } from "trendcraft";
const entry = candleFormerBullish(weights, 60);
const exit = candleFormerBearish(weights, 40);
const result = runBacktest(testCandles, entry, exit);
```

## File Structure

```
src/
├── train.ts              # Training script (CLI)
├── predict.ts            # Prediction script (CLI)
├── backtest-example.ts   # Backtest demo (CLI)
└── fetch-data.ts         # Data fetcher (Alpaca API)

data/
├── candles-*.json        # Historical candle data
├── weights-*.json        # Trained model weights (shape-only)
└── weights-*-patterns.json  # Trained model weights (dual embedding)
```

Core implementation lives in `src/ml/` of the trendcraft package:

```
src/ml/
├── tokenizer.ts   # Shape + pattern tokenization
├── model.ts       # Forward pass, weight serialization
├── backprop.ts    # Gradient computation
├── train.ts       # Training loop (Adam, LR schedule, early stopping)
├── tensor.ts      # 2D tensor operations
├── candle-former.ts  # Indicator wrapper
├── conditions.ts  # Backtest conditions
└── types.ts       # Type definitions
```
