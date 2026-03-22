import type { ExitReason, Trade } from "../types";

export interface ExitReasonAnalysis {
  reason: ExitReason;
  count: number;
  winCount: number;
  winRate: number;
  avgPnl: number;
}

export interface HoldingPeriodAnalysis {
  label: string;
  count: number;
  winCount: number;
  winRate: number;
  avgPnl: number;
}

export interface MarketRegimeAnalysis {
  regime: "TREND_UP" | "TREND_DOWN" | "RANGE";
  label: string;
  count: number;
  winCount: number;
  winRate: number;
  avgPnl: number;
}

export interface DayOfWeekAnalysis {
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  label: string;
  entryCount: number;
  exitCount: number;
  entryWinCount: number;
  exitWinCount: number;
  entryWinRate: number;
  exitWinRate: number;
  avgEntryPnl: number;
  avgExitPnl: number;
}

export interface MonthAnalysis {
  month: number; // 1-12
  label: string;
  count: number;
  winCount: number;
  winRate: number;
  avgPnl: number;
}

export interface TradeAnalysis {
  exitReasons: ExitReasonAnalysis[];
  holdingPeriods: HoldingPeriodAnalysis[];
  marketRegimes: MarketRegimeAnalysis[];
  dayOfWeek: DayOfWeekAnalysis[];
  months: MonthAnalysis[];
}

function groupTradesIntoPairs(trades: Trade[]): [Trade, Trade][] {
  const pairs: [Trade, Trade][] = [];
  let currentBuy: Trade | null = null;

  for (const trade of trades) {
    if (trade.type === "BUY") {
      currentBuy = trade;
    } else if (trade.type === "SELL" && currentBuy) {
      pairs.push([currentBuy, trade]);
      currentBuy = null;
    }
  }

  return pairs;
}

export function analyzeTradesByExitReason(trades: Trade[]): ExitReasonAnalysis[] {
  const sellTrades = trades.filter((t) => t.type === "SELL" && t.pnlPercent !== undefined);

  const reasonMap = new Map<ExitReason, Trade[]>();

  for (const trade of sellTrades) {
    const reason = trade.exitReason || "MANUAL";
    if (!reasonMap.has(reason)) {
      reasonMap.set(reason, []);
    }
    reasonMap.get(reason)?.push(trade);
  }

  const results: ExitReasonAnalysis[] = [];

  for (const [reason, tradeList] of reasonMap) {
    const winTrades = tradeList.filter((t) => (t.pnlPercent || 0) > 0);
    const avgPnl = tradeList.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / tradeList.length;

    results.push({
      reason,
      count: tradeList.length,
      winCount: winTrades.length,
      winRate: (winTrades.length / tradeList.length) * 100,
      avgPnl,
    });
  }

  return results.sort((a, b) => b.count - a.count);
}

export function analyzeTradesByHoldingPeriod(trades: Trade[]): HoldingPeriodAnalysis[] {
  const pairs = groupTradesIntoPairs(trades);

  const periodBuckets = {
    "≤5d": { min: 0, max: 5, trades: [] as [Trade, Trade][] },
    "6-14d": { min: 6, max: 14, trades: [] as [Trade, Trade][] },
    "15-30d": { min: 15, max: 30, trades: [] as [Trade, Trade][] },
    "31d+": { min: 31, max: Number.POSITIVE_INFINITY, trades: [] as [Trade, Trade][] },
  };

  for (const [buy, sell] of pairs) {
    const holdingDays = (sell.date - buy.date) / (1000 * 60 * 60 * 24);

    for (const [, bucket] of Object.entries(periodBuckets)) {
      if (holdingDays >= bucket.min && holdingDays <= bucket.max) {
        bucket.trades.push([buy, sell]);
        break;
      }
    }
  }

  const results: HoldingPeriodAnalysis[] = [];

  for (const [label, bucket] of Object.entries(periodBuckets)) {
    if (bucket.trades.length === 0) continue;

    const winTrades = bucket.trades.filter(([_, sell]) => (sell.pnlPercent || 0) > 0);
    const avgPnl =
      bucket.trades.reduce((sum, [_, sell]) => sum + (sell.pnlPercent || 0), 0) /
      bucket.trades.length;

    results.push({
      label,
      count: bucket.trades.length,
      winCount: winTrades.length,
      winRate: (winTrades.length / bucket.trades.length) * 100,
      avgPnl,
    });
  }

  return results;
}

export function analyzeTradesByMarketRegime(trades: Trade[]): MarketRegimeAnalysis[] {
  // Use MarketContext at the time of buy
  const pairs = groupTradesIntoPairs(trades);

  const regimeMap = new Map<"TREND_UP" | "TREND_DOWN" | "RANGE", [Trade, Trade][]>();

  for (const [buy, sell] of pairs) {
    const regime = buy.marketContext?.regime || "RANGE";
    if (!regimeMap.has(regime)) {
      regimeMap.set(regime, []);
    }
    regimeMap.get(regime)?.push([buy, sell]);
  }

  const regimeLabels: Record<"TREND_UP" | "TREND_DOWN" | "RANGE", string> = {
    TREND_UP: "Uptrend",
    TREND_DOWN: "Downtrend",
    RANGE: "Range",
  };

  const results: MarketRegimeAnalysis[] = [];

  for (const [regime, tradeList] of regimeMap) {
    const winTrades = tradeList.filter(([_, sell]) => (sell.pnlPercent || 0) > 0);
    const avgPnl =
      tradeList.reduce((sum, [_, sell]) => sum + (sell.pnlPercent || 0), 0) / tradeList.length;

    results.push({
      regime,
      label: regimeLabels[regime],
      count: tradeList.length,
      winCount: winTrades.length,
      winRate: (winTrades.length / tradeList.length) * 100,
      avgPnl,
    });
  }

  return results.sort((a, b) => b.count - a.count);
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function analyzeTradesByDayOfWeek(trades: Trade[]): DayOfWeekAnalysis[] {
  const pairs = groupTradesIntoPairs(trades);

  // Analyze both by entry day-of-week and exit day-of-week
  const entryByDay = new Map<number, [Trade, Trade][]>();
  const exitByDay = new Map<number, [Trade, Trade][]>();

  for (const [buy, sell] of pairs) {
    const entryDow = new Date(buy.date).getDay();
    const exitDow = new Date(sell.date).getDay();

    if (!entryByDay.has(entryDow)) entryByDay.set(entryDow, []);
    entryByDay.get(entryDow)?.push([buy, sell]);

    if (!exitByDay.has(exitDow)) exitByDay.set(exitDow, []);
    exitByDay.get(exitDow)?.push([buy, sell]);
  }

  const results: DayOfWeekAnalysis[] = [];

  // Monday through Friday only (stock market closed on weekends)
  for (let dow = 1; dow <= 5; dow++) {
    const entryTrades = entryByDay.get(dow) || [];
    const exitTrades = exitByDay.get(dow) || [];

    const entryWins = entryTrades.filter(([_, sell]) => (sell.pnlPercent || 0) > 0);
    const exitWins = exitTrades.filter(([_, sell]) => (sell.pnlPercent || 0) > 0);

    const avgEntryPnl =
      entryTrades.length > 0
        ? entryTrades.reduce((sum, [_, sell]) => sum + (sell.pnlPercent || 0), 0) /
          entryTrades.length
        : 0;
    const avgExitPnl =
      exitTrades.length > 0
        ? exitTrades.reduce((sum, [_, sell]) => sum + (sell.pnlPercent || 0), 0) / exitTrades.length
        : 0;

    results.push({
      dayOfWeek: dow,
      label: DAY_LABELS[dow],
      entryCount: entryTrades.length,
      exitCount: exitTrades.length,
      entryWinCount: entryWins.length,
      exitWinCount: exitWins.length,
      entryWinRate: entryTrades.length > 0 ? (entryWins.length / entryTrades.length) * 100 : 0,
      exitWinRate: exitTrades.length > 0 ? (exitWins.length / exitTrades.length) * 100 : 0,
      avgEntryPnl,
      avgExitPnl,
    });
  }

  return results;
}

export function analyzeTradesByMonth(trades: Trade[]): MonthAnalysis[] {
  const pairs = groupTradesIntoPairs(trades);

  const monthMap = new Map<number, [Trade, Trade][]>();

  for (const [buy, sell] of pairs) {
    // Classify by entry month
    const month = new Date(buy.date).getMonth() + 1; // 1-12
    if (!monthMap.has(month)) {
      monthMap.set(month, []);
    }
    monthMap.get(month)?.push([buy, sell]);
  }

  const results: MonthAnalysis[] = [];

  for (let month = 1; month <= 12; month++) {
    const tradeList = monthMap.get(month) || [];
    if (tradeList.length === 0) continue;

    const winTrades = tradeList.filter(([_, sell]) => (sell.pnlPercent || 0) > 0);
    const avgPnl =
      tradeList.reduce((sum, [_, sell]) => sum + (sell.pnlPercent || 0), 0) / tradeList.length;

    results.push({
      month,
      label: MONTH_LABELS[month - 1],
      count: tradeList.length,
      winCount: winTrades.length,
      winRate: (winTrades.length / tradeList.length) * 100,
      avgPnl,
    });
  }

  return results;
}

export function analyzeAllTrades(trades: Trade[]): TradeAnalysis {
  return {
    exitReasons: analyzeTradesByExitReason(trades),
    holdingPeriods: analyzeTradesByHoldingPeriod(trades),
    marketRegimes: analyzeTradesByMarketRegime(trades),
    dayOfWeek: analyzeTradesByDayOfWeek(trades),
    months: analyzeTradesByMonth(trades),
  };
}
