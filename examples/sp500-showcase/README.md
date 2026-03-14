# S&P 500 Backtest Showcase

Real-world backtest showcase using US ETF data (SPY, QQQ, IWM, DIA, sector ETFs).

Demonstrates TrendCraft's full analysis pipeline:
- **5 strategies** compared across 8 ETFs (10 years of daily data)
- **Robustness scoring** — Monte Carlo + trade consistency + drawdown resilience
- **Alpha decay analysis** — rolling IC, hit rate, CUSUM structural breaks
- **Pairs trading** — SPY vs QQQ cointegration, spread, and signals
- **Cross-asset correlation** — full correlation matrix

## Quick Start

```bash
# 1. Set Alpaca API credentials (or use alpaca-demo/.env)
export ALPACA_API_KEY=your_key
export ALPACA_API_SECRET=your_secret

# 2. Fetch data
npx tsx fetch-data.ts

# 3. Run showcase
npx tsx run-showcase.ts
```

The report is saved to `reports/showcase-report.md`.

## Data

Data files are **not included** in the repository (`.gitignore`).
Each user fetches data using their own API credentials.
Generated reports are committed as showcase artifacts.

## Strategies

| Strategy | Entry | Exit | Risk |
|----------|-------|------|------|
| Golden Cross | SMA 5/25 golden cross | Dead cross | 5% SL |
| RSI Mean Reversion | RSI < 30 | RSI > 70 | 3% trailing |
| Perfect Order Trend | Bullish perfect order | Collapse | 7% SL |
| MACD Momentum | MACD signal crossover | Signal cross down | 4% SL |
| Bollinger Breakout | Upper band breakout | Lower band break | 3% SL + 5% trail |
