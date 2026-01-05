import { useMemo } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import type { Trade, PortfolioStats } from "../types";

interface RealtimeStats {
  totalPnl: number;
  totalPnlPercent: number;
  winRate: number;
  winCount: number;
  lossCount: number;
  totalTrades: number;
  profitFactor: number;
  maxDrawdown: number;
  avgHoldingDays: number;
  currentStreak: number; // positive = win streak, negative = lose streak
  avgMfeUtilization: number;
  buyHoldReturn: number | null;
  alpha: number | null;
}

function calculateRealtimeStats(
  tradeHistory: Trade[],
  initialCapital: number,
  startPrice: number | undefined,
  currentPrice: number | undefined
): RealtimeStats {
  const sellTrades = tradeHistory.filter(
    (t) => t.type === "SELL" && t.pnlPercent !== undefined
  );

  const emptyStats: RealtimeStats = {
    totalPnl: 0,
    totalPnlPercent: 0,
    winRate: 0,
    winCount: 0,
    lossCount: 0,
    totalTrades: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    avgHoldingDays: 0,
    currentStreak: 0,
    avgMfeUtilization: 0,
    buyHoldReturn: null,
    alpha: null,
  };

  if (sellTrades.length === 0) {
    // Buy&Hold計算（取引がなくても可能）
    if (startPrice && currentPrice) {
      emptyStats.buyHoldReturn = ((currentPrice - startPrice) / startPrice) * 100;
    }
    return emptyStats;
  }

  const totalPnl = sellTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalPnlPercent = (totalPnl / initialCapital) * 100;

  const wins = sellTrades.filter((t) => (t.pnlPercent || 0) > 0);
  const losses = sellTrades.filter((t) => (t.pnlPercent || 0) <= 0);

  const winRate = (wins.length / sellTrades.length) * 100;

  // Profit Factor
  const grossProfit = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999.99 : 0;

  // Max Drawdown
  let peak = initialCapital;
  let maxDrawdown = 0;
  let equity = initialCapital;

  sellTrades.forEach((t) => {
    equity += t.pnl || 0;
    if (equity > peak) peak = equity;
    const dd = ((peak - equity) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  // Average Holding Days
  const pairs: [Trade, Trade][] = [];
  let currentBuy: Trade | null = null;
  for (const trade of tradeHistory) {
    if (trade.type === "BUY") {
      currentBuy = trade;
    } else if (trade.type === "SELL" && currentBuy) {
      pairs.push([currentBuy, trade]);
      currentBuy = null;
    }
  }

  let totalHoldingDays = 0;
  pairs.forEach(([buy, sell]) => {
    const holdingMs = sell.date - buy.date;
    totalHoldingDays += holdingMs / (1000 * 60 * 60 * 24);
  });
  const avgHoldingDays = pairs.length > 0 ? totalHoldingDays / pairs.length : 0;

  // Current Streak
  let currentStreak = 0;
  for (let i = sellTrades.length - 1; i >= 0; i--) {
    const pnl = sellTrades[i].pnlPercent || 0;
    if (i === sellTrades.length - 1) {
      currentStreak = pnl > 0 ? 1 : -1;
    } else {
      const prevPnl = sellTrades[i + 1].pnlPercent || 0;
      const sameDirection = (pnl > 0 && prevPnl > 0) || (pnl <= 0 && prevPnl <= 0);
      if (sameDirection) {
        currentStreak += pnl > 0 ? 1 : -1;
      } else {
        break;
      }
    }
  }

  // MFE Utilization average
  const tradesWithMfeUtil = sellTrades.filter((t) => t.mfeUtilization !== undefined);
  const avgMfeUtilization = tradesWithMfeUtil.length > 0
    ? tradesWithMfeUtil.reduce((sum, t) => sum + (t.mfeUtilization || 0), 0) / tradesWithMfeUtil.length
    : 0;

  // Buy&Hold comparison
  let buyHoldReturn: number | null = null;
  let alpha: number | null = null;
  if (startPrice && currentPrice) {
    buyHoldReturn = ((currentPrice - startPrice) / startPrice) * 100;
    alpha = totalPnlPercent - buyHoldReturn;
  }

  return {
    totalPnl,
    totalPnlPercent,
    winRate,
    winCount: wins.length,
    lossCount: losses.length,
    totalTrades: sellTrades.length,
    profitFactor: isFinite(profitFactor) ? profitFactor : 999.99,
    maxDrawdown,
    avgHoldingDays,
    currentStreak,
    avgMfeUtilization,
    buyHoldReturn,
    alpha,
  };
}

export function StatsPanel() {
  const {
    tradeHistory,
    initialCapital,
    allCandles,
    startIndex,
    initialCandleCount,
    currentIndex,
    positions,
    getUnrealizedPnl,
    symbols,
    getPortfolioStats,
  } = useSimulatorStore();

  const stats = useMemo(() => {
    const simStartIndex = startIndex + initialCandleCount;
    const startPrice = allCandles[simStartIndex]?.close;
    const currentPrice = allCandles[currentIndex]?.close;
    return calculateRealtimeStats(tradeHistory, initialCapital, startPrice, currentPrice);
  }, [tradeHistory, initialCapital, allCandles, startIndex, initialCandleCount, currentIndex]);

  const unrealizedPnl = getUnrealizedPnl();

  // Total P&L including unrealized
  const totalWithUnrealized = stats.totalPnl + (unrealizedPnl?.pnl || 0);
  const totalPercentWithUnrealized = (totalWithUnrealized / initialCapital) * 100;

  const hasPosition = positions.length > 0;
  const hasTrades = stats.totalTrades > 0;

  // ポートフォリオ統計（複数銘柄の場合のみ）
  const portfolioStats: PortfolioStats | null = useMemo(() => {
    if (symbols.length <= 1) return null;
    return getPortfolioStats();
  }, [symbols, getPortfolioStats]);

  const hasMultipleSymbols = symbols.length > 1;

  return (
    <div className="stats-panel">
      <h3>リアルタイム統計</h3>

      <div className="stats-section">
        <div className="stats-row highlight">
          <span className="label">損益</span>
          <span className={`value ${totalWithUnrealized >= 0 ? "positive" : "negative"}`}>
            {totalWithUnrealized >= 0 ? "+" : ""}
            {Math.round(totalWithUnrealized).toLocaleString()}円
            <span className="percent">
              ({totalPercentWithUnrealized >= 0 ? "+" : ""}
              {totalPercentWithUnrealized.toFixed(2)}%)
            </span>
          </span>
        </div>

        {hasPosition && unrealizedPnl && (
          <div className="stats-row sub">
            <span className="label">含み損益</span>
            <span className={`value ${unrealizedPnl.pnl >= 0 ? "positive" : "negative"}`}>
              {unrealizedPnl.pnl >= 0 ? "+" : ""}
              {Math.round(unrealizedPnl.pnl).toLocaleString()}円
            </span>
          </div>
        )}

        {hasTrades && (
          <div className="stats-row sub">
            <span className="label">確定損益</span>
            <span className={`value ${stats.totalPnl >= 0 ? "positive" : "negative"}`}>
              {stats.totalPnl >= 0 ? "+" : ""}
              {Math.round(stats.totalPnl).toLocaleString()}円
            </span>
          </div>
        )}
      </div>

      {hasTrades && (
        <>
          <div className="stats-divider" />

          <div className="stats-section">
            <div className="stats-row">
              <span className="label">勝率</span>
              <span className="value">
                {stats.winRate.toFixed(1)}%
                <span className="sub-value">
                  ({stats.winCount}勝/{stats.lossCount}敗)
                </span>
              </span>
            </div>

            {stats.currentStreak !== 0 && (
              <div className="stats-row">
                <span className="label">{stats.currentStreak > 0 ? "連勝中" : "連敗中"}</span>
                <span className={`value ${stats.currentStreak > 0 ? "positive" : "negative"}`}>
                  {Math.abs(stats.currentStreak)}
                </span>
              </div>
            )}
          </div>

          <div className="stats-divider" />

          <div className="stats-section">
            <div className="stats-row">
              <span className="label">PF</span>
              <span className={`value ${stats.profitFactor >= 1 ? "positive" : "negative"}`}>
                {stats.profitFactor.toFixed(2)}
              </span>
            </div>

            <div className="stats-row">
              <span className="label">最大DD</span>
              <span className="value negative">
                -{stats.maxDrawdown.toFixed(2)}%
              </span>
            </div>

            <div className="stats-row">
              <span className="label">平均保有</span>
              <span className="value">{stats.avgHoldingDays.toFixed(1)}日</span>
            </div>

            {stats.avgMfeUtilization > 0 && (
              <div className="stats-row">
                <span className="label">MFE活用</span>
                <span className="value">{stats.avgMfeUtilization.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </>
      )}

      {stats.buyHoldReturn !== null && (
        <>
          <div className="stats-divider" />

          <div className="stats-section benchmark">
            <div className="stats-row">
              <span className="label">vs B&H</span>
              <span className={`value ${(stats.alpha || 0) >= 0 ? "positive" : "negative"}`}>
                {(stats.alpha || 0) >= 0 ? "+" : ""}
                {(stats.alpha || 0).toFixed(2)}%
              </span>
            </div>
            <div className="stats-row sub">
              <span className="label">B&H</span>
              <span className={`value ${stats.buyHoldReturn >= 0 ? "positive" : "negative"}`}>
                {stats.buyHoldReturn >= 0 ? "+" : ""}
                {stats.buyHoldReturn.toFixed(2)}%
              </span>
            </div>
          </div>
        </>
      )}

      {!hasTrades && !hasPosition && (
        <div className="no-stats">
          取引がありません
        </div>
      )}

      {/* ポートフォリオ統計（複数銘柄の場合のみ） */}
      {hasMultipleSymbols && portfolioStats && (
        <>
          <div className="stats-divider" />
          <h3>ポートフォリオ</h3>

          <div className="stats-section">
            <div className="stats-row highlight">
              <span className="label">全体損益</span>
              <span className={`value ${portfolioStats.totalPnl >= 0 ? "positive" : "negative"}`}>
                {portfolioStats.totalPnl >= 0 ? "+" : ""}
                {Math.round(portfolioStats.totalPnl).toLocaleString()}円
                <span className="percent">
                  ({portfolioStats.totalPnlPercent >= 0 ? "+" : ""}
                  {portfolioStats.totalPnlPercent.toFixed(2)}%)
                </span>
              </span>
            </div>
          </div>

          <div className="stats-section">
            <div className="portfolio-symbols">
              {portfolioStats.symbolStats.map((symbolStat) => (
                <div key={symbolStat.symbolId} className="stats-row sub">
                  <span className="label">{symbolStat.fileName}</span>
                  <span className={`value ${symbolStat.pnl >= 0 ? "positive" : "negative"}`}>
                    {symbolStat.pnl >= 0 ? "+" : ""}
                    {symbolStat.pnlPercent.toFixed(1)}%
                    <span className="sub-value">
                      ({symbolStat.allocation.toFixed(0)}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {portfolioStats.aggregatedStats.totalTradeCount > 0 && (
            <div className="stats-section">
              <div className="stats-row">
                <span className="label">全体勝率</span>
                <span className="value">
                  {portfolioStats.aggregatedStats.overallWinRate.toFixed(1)}%
                </span>
              </div>
              <div className="stats-row">
                <span className="label">総取引</span>
                <span className="value">{portfolioStats.aggregatedStats.totalTradeCount}回</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
