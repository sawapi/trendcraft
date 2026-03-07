# Alpaca Demo — Multi-Agent Paper Trading System

A multi-agent trading system that uses TrendCraft's streaming module with Alpaca Markets' paper trading API. Features an LLM-powered self-improvement cycle that analyzes trade-level data, detects market regimes, and tracks the outcomes of its own recommendations.

## Architecture

```
Layer 1: Backtest Tournament
  Strategies → Historical data (Alpaca REST) → TrendCraft backtest → Ranking + Monte Carlo

Layer 2: Paper Trading
  Top strategies → Alpaca WebSocket → TrendCraft ManagedSession → Alpaca Paper Orders

Layer 3: Self-Improvement Cycle
  Trade details + Market regime → LLM Review → Safety validation → Apply changes → Outcome tracking
```

### Self-Improvement Cycle

The system runs a closed-loop feedback cycle to continuously improve strategy performance:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Self-Improvement Cycle                      │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Collect  │───>│ Analyze  │───>│  Apply   │───>│  Track   │  │
│  │  Data     │    │  (LLM)   │    │  Changes │    │ Outcomes │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       ▲                                               │         │
│       └───────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

1. **Collect** — Per-trade MFE/MAE/exit reasons, market regime (volatility + trend), aggregate metrics
2. **Analyze** — LLM receives full context and recommends parameter adjustments, agent kills/revives, or new strategies
3. **Apply** — Safety layer validates changes (±20%/day limit, palette bounds, cumulative drift cap, per-strategy cooldown, weekly cap). Walk-Forward + Monte Carlo gates for new strategies
4. **Track** — Outcomes are evaluated after 5 business days using benchmark-relative scoring. Auto-rollback triggers after 2 consecutive degraded verdicts

## Setup

### Prerequisites

- Node.js 18+
- pnpm
- Alpaca Markets account (paper trading)
- Anthropic API key (for LLM review)

### Installation

```bash
cd examples/alpaca-demo
pnpm install
```

### Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description | Source |
|----------|-------------|--------|
| `ALPACA_API_KEY` | Alpaca API key | [Alpaca Dashboard](https://app.alpaca.markets/signup) |
| `ALPACA_API_SECRET` | Alpaca API secret | Same as above |
| `ALPACA_BASE_URL` | Paper trading endpoint | `https://paper-api.alpaca.markets` |
| `ALPACA_DATA_URL` | Market data endpoint | `https://data.alpaca.markets` |
| `ALPACA_STREAM_URL` | WebSocket endpoint | `wss://stream.data.alpaca.markets/v2/iex` |
| `ANTHROPIC_API_KEY` | Anthropic API key (for LLM review) | [Anthropic Console](https://console.anthropic.com/) |

## Usage

### Backtest Tournament

Run all strategies against historical data and see rankings:

```bash
# Default: 6 months, daily bars
pnpm run backtest

# Custom options
pnpm run backtest -- --symbols AAPL,SPY --period 3 --capital 50000 --timeframe 1Hour
```

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --symbols <list>` | Comma-separated symbol list | Default symbols |
| `-p, --period <months>` | Lookback period in months | `6` |
| `-c, --capital <amount>` | Initial capital per strategy | `100000` |
| `-t, --timeframe <tf>` | Bar timeframe (`1Min`, `5Min`, `1Hour`, `1Day`) | `1Day` |

### Live Paper Trading

Start live paper trading with WebSocket real-time data:

```bash
# Single strategy, dry run (no real orders)
pnpm run dev -- live --strategy rsi-mean-reversion --symbol AAPL --dry-run

# All strategies on default symbols
pnpm run dev -- live --all --dry-run

# Paper trading (sends real orders to Alpaca paper account)
pnpm run dev -- live --all

# Disable automatic daily review
pnpm run dev -- live --all --no-auto-review
```

| Option | Description | Default |
|--------|-------------|---------|
| `-S, --strategy <id>` | Single strategy ID | — |
| `-s, --symbol <symbol>` | Single symbol | — |
| `--symbols <list>` | Comma-separated symbol list | First 2 default symbols |
| `-a, --all` | Use all strategies | — |
| `-d, --dry-run` | Dry run (no real orders) | `false` |
| `-c, --capital <amount>` | Capital per agent | `100000` |
| `--no-auto-review` | Disable automatic daily review | Enabled |

When running in live mode, the system:
- Saves agent state every 5 minutes
- Prints leaderboard every hour
- Reconciles positions with Alpaca every 15 minutes (non-dry-run)
- Writes heartbeat for crash recovery (dead-man's switch)
- **Schedules automatic daily review at 16:05 ET** (unless `--no-auto-review`)

### Daily Review

Generate performance reports and get LLM recommendations:

```bash
# Report only (no LLM API call needed)
pnpm run dev -- review --report-only

# Generate report + LLM review (preview mode)
pnpm run dev -- review

# Generate report + LLM review + apply changes
pnpm run dev -- review --apply

# Review from backtest results (no live state needed)
pnpm run dev -- review --from-backtest --symbols SPY --period 3

# Include more history context for LLM
pnpm run dev -- review --apply --days 14
```

| Option | Description | Default |
|--------|-------------|---------|
| `--report-only` | Generate report only (no LLM API call) | — |
| `--apply` | Apply validated LLM recommendations | Preview only |
| `--days <n>` | Days of review history for LLM context | `7` |
| `--from-backtest` | Review backtest results instead of live state | — |
| `-s, --symbols <list>` | Symbols for backtest review | `SPY` |
| `-p, --period <months>` | Backtest lookback period | `3` |
| `-t, --timeframe <tf>` | Backtest timeframe | `1Day` |
| `-c, --capital <amount>` | Capital for backtest | `100000` |

### Status & Management

```bash
# Show agent leaderboard from saved state
pnpm run dev -- status

# Manually promote/demote an agent
pnpm run dev -- promote --agent rsi-mean-reversion:AAPL --tier live
```

## Self-Improvement Cycle Details

### Trade-Level Analysis

Each agent exposes per-trade data via `getTrades()`, providing the LLM with:

- **Entry/exit prices and times**
- **Exit reason**: `signal`, `stopLoss`, `takeProfit`, `trailing`, `breakeven`, `scaleOut`, `timeExit`, `endOfData`
- **MFE** (Max Favorable Excursion): Highest unrealized profit % during the trade
- **MAE** (Max Adverse Excursion): Largest unrealized loss % during the trade
- **MFE Utilization**: `actual return / MFE` — how much of the maximum available profit was captured

Example LLM context:

```
Recent Trades:
  #1: LONG $150.00→$155.00 (+3.3%) exit:takeProfit MFE:4.1% MAE:-0.8% util:81% 5bars
  #2: LONG $148.50→$146.00 (-1.7%) exit:stopLoss MFE:0.5% MAE:-2.0% util:0% 2bars
  Analysis: exits=[takeProfit:1 stopLoss:1] avgMFEUtil:40%
```

### Market Regime Detection

The review system fetches 60+ days of daily bars and computes:

| Metric | Method | Classification |
|--------|--------|---------------|
| **Volatility regime** | ATR(14) percentile over 60-day lookback | `low` (≤25th), `normal` (25-75th), `high` (≥75th) |
| **Trend direction** | EMA(20) vs EMA(50) spread | `bullish` (>+0.5%), `bearish` (<-0.5%), `sideways` (within ±0.5%) |
| **Trend strength** | Absolute EMA spread × 10, capped at 100 | 0-100 scale |

Example LLM context:

```
Market Context:
- SPY: $520.30 (-0.85%) | Vol: high (ATR: 1.8%) | Trend: bearish (ADX: 35)
```

### Outcome Tracking

After applying LLM recommendations, the system tracks whether they improved performance:

1. Each applied action records the strategy's score at the time of application
2. After **5 business days** (reduced market noise), the system evaluates performance
3. **Benchmark-relative scoring**: Score changes are adjusted for overall market movement, so strategies aren't penalized for market-wide declines
4. Verdict: `improved` (relative delta > +3), `degraded` (< -3), or `neutral`
5. Outcome history is fed back to the LLM in subsequent reviews

Example LLM context:

```
Outcomes:
  - adjust_params(rsi-mean-reversion): IMPROVED (score: 45→52) [relative: +5.2, mkt: +1.8%]
  - adjust_params(macd-trend): DEGRADED (score: 60→55) [relative: -6.1, mkt: +1.1%]
```

#### Auto-Rollback

If a strategy receives **2 consecutive "degraded" verdicts**, the system automatically rolls back its parameter overrides to the original preset. This prevents runaway degradation from compounding LLM errors.

#### Buy & Hold Benchmark

Backtest review reports include Buy & Hold returns for each symbol, providing a baseline. Strategies should ideally outperform B&H on a risk-adjusted basis.

The LLM is instructed to:
- Consider reversing **degraded** actions
- Apply successful patterns from **improved** actions to other underperforming strategies
- Compare strategy returns against the B&H benchmark

### Automatic Review Scheduling

When running in `live` mode, a daily review is automatically scheduled at **16:05 ET** (5 minutes after US market close):

- Skips weekends (Saturday/Sunday)
- Skips if a review has already been run today
- Uses `--apply` mode to automatically apply validated changes
- Disable with `--no-auto-review` flag

## Strategies

| ID | Name | Description |
|----|------|-------------|
| `rsi-mean-reversion` | RSI Mean Reversion | Buy when RSI(14) < 30, sell when RSI(14) > 70 |
| `macd-trend` | MACD Trend Following | Enter on MACD bullish cross, exit on bearish cross |
| `bollinger-squeeze` | Bollinger Squeeze | Buy at lower BB + RSI < 40, sell at upper BB or RSI > 70 |
| `vwap-bounce` | VWAP Bounce | Buy near VWAP support with RSI confirmation, sell at EMA(9) |

The LLM can also **create new strategies** from the available indicator/condition palette, subject to backtest validation gates.

### Advanced Exit Strategies

Strategies support these exit mechanisms (configurable per strategy):

| Exit Type | Description |
|-----------|-------------|
| ATR Trailing Stop | Volatility-adaptive trailing stop (`atrTrailingStop: { period, multiplier }`) |
| Partial Take Profit | Take partial profits at threshold (`partialTakeProfit: { threshold, portion }`) |
| Breakeven Stop | Move stop to breakeven after trigger (`breakEvenStop: { triggerPercent, offset }`) |
| Signal Lifecycle | Cooldown bars, debounce bars, expiry bars to filter whipsaw signals |

## Safety & Validation

All LLM recommendations pass through a multi-layer safety pipeline:

| Gate | Constraint |
|------|-----------|
| Parameter range | All values must stay within palette min/max bounds |
| Daily change limit | ±20% maximum parameter change per day |
| Cumulative drift cap | ±50% maximum drift from original preset values |
| Rate limits | 1 kill, 1 revive, 1 create per day |
| Change frequency | Same strategy cannot be modified within 3 days |
| Weekly cap | Maximum 3 parameter adjustments per week |
| Auto-rollback | 2 consecutive "degraded" verdicts → revert to original preset |
| Backtest gate | New strategies require score ≥ 30 |
| Walk-Forward Analysis | OOS Sharpe > 0 and WFA efficiency > 0.5 |
| Monte Carlo | Statistical significance validation |

## Promotion Criteria

| Metric | Promote | Demote |
|--------|---------|--------|
| Sharpe Ratio | ≥ 0.8 | — |
| Win Rate | ≥ 40% | — |
| Max Drawdown | ≤ 15% | > 25% |
| Trade Count | ≥ 15 | — |
| Profit Factor | ≥ 1.1 | — |
| Daily Loss | — | < -$10,000 |
| Eval Period | ≥ 3 days | — |

## Data Files

The system persists state and review data in the `data/` directory:

| File | Purpose |
|------|---------|
| `data/state.json` | Agent states, metrics, session state |
| `data/strategy-overrides.json` | LLM-applied parameter overrides |
| `data/custom-strategies.json` | LLM-created strategy templates |
| `data/heartbeat.json` | Dead-man's switch for crash recovery |
| `data/reviews/{date}.json` | Daily report (JSON) |
| `data/reviews/{date}.md` | Daily report (Markdown) |
| `data/reviews/{date}-review.json` | LLM review record with applied/rejected actions |

## Project Structure

```
src/
├── index.ts                    # CLI entry (commander)
├── config/                     # Environment, symbols, market hours, promotion thresholds
├── strategy/                   # Strategy definitions, templates, palette, compiler
│   ├── template.ts             # Preset templates + override system
│   ├── palette.ts              # Available indicators and conditions
│   ├── compiler.ts             # Template → StrategyDefinition compiler
│   └── factory.ts              # Strategy → ManagedSession factory
├── agent/                      # Agent (strategy × symbol) and AgentManager
│   ├── agent.ts                # Agent wrapper with getTrades(), getMetrics()
│   └── manager.ts              # Multi-agent orchestrator
├── alpaca/                     # REST client, WebSocket, historical data, cache
├── executor/                   # Paper, dry-run, and reconciliation executors
├── backtest/                   # Tournament runner, scorer, WFA, Monte Carlo
├── tracker/                    # Performance tracking and leaderboard
├── persistence/                # JSON file state persistence
├── review/                     # Self-improvement cycle
│   ├── report-generator.ts     # Daily report with trade details
│   ├── llm-prompt.ts           # System/user prompt with regime + trades + outcomes
│   ├── llm-client.ts           # Claude API wrapper
│   ├── safety.ts               # Multi-layer validation pipeline
│   ├── applier.ts              # Action application + WFA/MC gates
│   ├── history.ts              # Review record persistence
│   ├── outcome-tracker.ts      # Recommendation outcome evaluation
│   └── scheduler.ts            # Automatic 16:05 ET daily review
└── commands/                   # CLI command handlers
    ├── backtest.ts
    ├── live.ts                 # Live trading + auto-review scheduler
    ├── review.ts               # Review cycle + regime detection
    ├── status.ts
    └── promote.ts
```
