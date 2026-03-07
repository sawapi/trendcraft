# Alpaca Demo — Multi-Agent Paper Trading System

A multi-agent trading system that uses TrendCraft's streaming module with Alpaca Markets' paper trading API.

## Architecture

```
Layer 1: Backtest Tournament
  Multiple strategies -> Historical data (Alpaca REST) -> TrendCraft backtest -> Ranking

Layer 2: Paper Trading
  Top strategies -> Alpaca WebSocket -> TrendCraft ManagedSession -> Alpaca Paper Orders

Layer 3: Production (future)
  Successful paper agents -> Live account (endpoint swap)
```

## Setup

1. Create an Alpaca account at https://app.alpaca.markets/signup
2. Copy `.env.example` to `.env` and fill in your API credentials
3. Install dependencies:

```bash
pnpm install
```

## Usage

### Backtest Tournament

Run all strategies against historical data and see rankings:

```bash
# Default: 6 months, daily bars, all default symbols
pnpm run backtest

# Custom options
pnpm run backtest -- --symbols AAPL,SPY --period 3 --capital 50000 --timeframe 1Hour
```

### Live Paper Trading

Start live paper trading with WebSocket real-time data:

```bash
# Single strategy, dry run (no real orders)
pnpm run dev -- live --strategy rsi-mean-reversion --symbol AAPL --dry-run

# All strategies on default symbols
pnpm run dev -- live --all --dry-run

# Paper trading (sends real orders to Alpaca paper account)
pnpm run dev -- live --all
```

### Status & Management

```bash
# Show agent leaderboard from saved state
pnpm run dev -- status

# Manually promote/demote an agent
pnpm run dev -- promote --agent rsi-mean-reversion:AAPL --tier live
```

## Strategies

| ID | Description |
|----|-------------|
| `rsi-mean-reversion` | Buy RSI < 30, sell RSI > 70 |
| `macd-trend` | Enter on MACD bullish cross, exit on bearish cross |
| `bollinger-squeeze` | Buy at lower BB + RSI < 40, sell at upper BB or RSI > 70 |

## Promotion Criteria

| Metric | Promote | Demote |
|--------|---------|--------|
| Sharpe Ratio | >= 0.8 | — |
| Win Rate | >= 40% | — |
| Max Drawdown | <= 15% | > 25% |
| Trade Count | >= 15 | — |
| Profit Factor | >= 1.1 | — |
| Daily Loss | — | < -$10,000 |
| Eval Period | >= 3 days | — |

## Project Structure

```
src/
├── index.ts              # CLI entry (commander)
├── config/               # Environment, symbols, promotion thresholds
├── strategy/             # Strategy definitions and presets
├── agent/                # Agent (strategy x symbol) and AgentManager
├── alpaca/               # REST client, WebSocket, historical data
├── executor/             # Paper and dry-run order executors
├── backtest/             # Tournament runner and composite scorer
├── tracker/              # Performance tracking and leaderboard
├── persistence/          # JSON file state persistence
└── commands/             # CLI command handlers
```
