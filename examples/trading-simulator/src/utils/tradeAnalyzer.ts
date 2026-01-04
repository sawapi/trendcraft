import type { Trade, ExitReason } from "../types";

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
  dayOfWeek: number; // 0=日曜, 1=月曜, ..., 6=土曜
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
    reasonMap.get(reason)!.push(trade);
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
    "~5日": { min: 0, max: 5, trades: [] as [Trade, Trade][] },
    "6~14日": { min: 6, max: 14, trades: [] as [Trade, Trade][] },
    "15~30日": { min: 15, max: 30, trades: [] as [Trade, Trade][] },
    "31日~": { min: 31, max: Infinity, trades: [] as [Trade, Trade][] },
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
    const avgPnl = bucket.trades.reduce((sum, [_, sell]) => sum + (sell.pnlPercent || 0), 0) / bucket.trades.length;

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
  // Buy時点のMarketContextを使用
  const pairs = groupTradesIntoPairs(trades);

  const regimeMap = new Map<"TREND_UP" | "TREND_DOWN" | "RANGE", [Trade, Trade][]>();

  for (const [buy, sell] of pairs) {
    const regime = buy.marketContext?.regime || "RANGE";
    if (!regimeMap.has(regime)) {
      regimeMap.set(regime, []);
    }
    regimeMap.get(regime)!.push([buy, sell]);
  }

  const regimeLabels: Record<"TREND_UP" | "TREND_DOWN" | "RANGE", string> = {
    TREND_UP: "上昇トレンド",
    TREND_DOWN: "下降トレンド",
    RANGE: "レンジ相場",
  };

  const results: MarketRegimeAnalysis[] = [];

  for (const [regime, tradeList] of regimeMap) {
    const winTrades = tradeList.filter(([_, sell]) => (sell.pnlPercent || 0) > 0);
    const avgPnl = tradeList.reduce((sum, [_, sell]) => sum + (sell.pnlPercent || 0), 0) / tradeList.length;

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

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

export function analyzeTradesByDayOfWeek(trades: Trade[]): DayOfWeekAnalysis[] {
  const pairs = groupTradesIntoPairs(trades);

  // エントリー曜日別とイグジット曜日別の両方を分析
  const entryByDay = new Map<number, [Trade, Trade][]>();
  const exitByDay = new Map<number, [Trade, Trade][]>();

  for (const [buy, sell] of pairs) {
    const entryDow = new Date(buy.date).getDay();
    const exitDow = new Date(sell.date).getDay();

    if (!entryByDay.has(entryDow)) entryByDay.set(entryDow, []);
    entryByDay.get(entryDow)!.push([buy, sell]);

    if (!exitByDay.has(exitDow)) exitByDay.set(exitDow, []);
    exitByDay.get(exitDow)!.push([buy, sell]);
  }

  const results: DayOfWeekAnalysis[] = [];

  // 月曜から金曜のみ（株式市場は週末休み）
  for (let dow = 1; dow <= 5; dow++) {
    const entryTrades = entryByDay.get(dow) || [];
    const exitTrades = exitByDay.get(dow) || [];

    const entryWins = entryTrades.filter(([_, sell]) => (sell.pnlPercent || 0) > 0);
    const exitWins = exitTrades.filter(([_, sell]) => (sell.pnlPercent || 0) > 0);

    const avgEntryPnl = entryTrades.length > 0
      ? entryTrades.reduce((sum, [_, sell]) => sum + (sell.pnlPercent || 0), 0) / entryTrades.length
      : 0;
    const avgExitPnl = exitTrades.length > 0
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
    // エントリー月で分類
    const month = new Date(buy.date).getMonth() + 1; // 1-12
    if (!monthMap.has(month)) {
      monthMap.set(month, []);
    }
    monthMap.get(month)!.push([buy, sell]);
  }

  const results: MonthAnalysis[] = [];

  for (let month = 1; month <= 12; month++) {
    const tradeList = monthMap.get(month) || [];
    if (tradeList.length === 0) continue;

    const winTrades = tradeList.filter(([_, sell]) => (sell.pnlPercent || 0) > 0);
    const avgPnl = tradeList.reduce((sum, [_, sell]) => sum + (sell.pnlPercent || 0), 0) / tradeList.length;

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
