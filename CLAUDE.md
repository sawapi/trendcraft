# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TrendCraft is a financial data analysis tool for processing stock/market data.

### Planned Features (from .plans/)
- Process daily OHLCV (Open, High, Low, Close, Volume) data
- Generate weekly and monthly timeframe aggregations
- Calculate technical indicators:
  - Moving averages: SMA, EMA (configurable periods)
  - RSI (Wilder method)
  - MACD (fast/slow/signal)
  - Bollinger Bands (mid, upper, lower, %b, bandwidth)
  - ATR (Wilder method)
  - Volume MA
  - Highest/Lowest over n periods
  - Returns (1-period, n-period, log returns)

## Development

This is a new project - no build system or tests are configured yet.