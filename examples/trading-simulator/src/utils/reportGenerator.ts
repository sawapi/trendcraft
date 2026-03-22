import type { IndicatorSnapshot, MarketContext, SimulatorStats, Trade } from "../types";
import {
  AVAILABLE_INDICATORS,
  EXIT_REASON_LABELS,
  EXIT_TRIGGER_LABELS,
  PRICE_TYPE_LABELS,
} from "../types";
import { formatDate } from "./fileParser";

// Format indicator value
function formatIndicatorValue(value: number | null | undefined, decimals = 2): string {
  if (value == null) return "-";
  return value.toFixed(decimals);
}

// Format indicator snapshot as Markdown
function formatIndicatorSnapshot(indicators: IndicatorSnapshot | undefined): string {
  if (!indicators) return "";

  const parts: string[] = [];

  // MA
  if (indicators.sma25 != null) {
    parts.push(`SMA25: ${formatIndicatorValue(indicators.sma25, 0)}`);
  }
  if (indicators.sma75 != null) {
    parts.push(`SMA75: ${formatIndicatorValue(indicators.sma75, 0)}`);
  }

  // RSI
  if (indicators.rsi != null) {
    parts.push(`RSI: ${formatIndicatorValue(indicators.rsi, 1)}`);
  }

  // MACD
  if (indicators.macdHist != null) {
    const sign = indicators.macdHist >= 0 ? "+" : "";
    parts.push(`MACD: ${sign}${formatIndicatorValue(indicators.macdHist, 1)}`);
  }

  // BB
  if (indicators.bbUpper != null && indicators.bbLower != null) {
    parts.push(
      `BB: ${formatIndicatorValue(indicators.bbLower, 0)}-${formatIndicatorValue(indicators.bbUpper, 0)}`,
    );
  }

  return parts.length > 0 ? parts.join(" | ") : "";
}

// Format market context as Markdown
function formatMarketContext(context: MarketContext | undefined): string {
  if (!context) return "";
  return context.description;
}

interface ReportData {
  fileName: string;
  startDate: number;
  endDate: number;
  initialCapital: number;
  enabledIndicators: string[];
  tradeHistory: Trade[];
  startPrice?: number; // For Buy&Hold comparison
  endPrice?: number; // For Buy&Hold comparison
  commissionRate?: number;
  slippageBps?: number;
  taxRate?: number; // Capital gains tax rate
  totalTradingDays?: number; // Trading days in sim period (for marketExposure)
}

// Extended stats interface for advanced metrics
interface ExtendedStats extends SimulatorStats {
  sharpeRatio: number;
  avgHoldingDays: number;
  maxWinStreak: number;
  maxLoseStreak: number;
  avgMfe: number;
  avgMae: number;
  avgMfeUtilization: number; // Average MFE utilization
  marketExposure: number; // Market exposure (%)
  totalPositionDays: number; // Total position holding days
  totalCommission: number;
  totalSlippage: number;
  totalTax: number;
  grossPnl: number;
}

export function generateMarkdownReport(data: ReportData): string {
  const stats = calculateExtendedStats(
    data.tradeHistory,
    data.initialCapital,
    data.totalTradingDays,
  );
  const finalCapital = data.initialCapital + stats.totalPnl;

  const lines: string[] = [];

  // Header
  lines.push("# Trading Simulation Report");
  lines.push("");

  // Session Info
  lines.push("## Session Info");
  lines.push("");
  lines.push(`- **Symbol**: ${data.fileName}`);
  lines.push(`- **Period**: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}`);
  lines.push(`- **Initial Capital**: ${data.initialCapital.toLocaleString()}`);
  lines.push(`- **Final Capital**: ${finalCapital.toLocaleString()}`);
  if (data.commissionRate || data.slippageBps || data.taxRate) {
    const costParts = [];
    if (data.commissionRate) costParts.push(`Commission ${data.commissionRate}%`);
    if (data.slippageBps) costParts.push(`Slippage ${data.slippageBps}bps`);
    if (data.taxRate) costParts.push(`Tax ${data.taxRate}%`);
    lines.push(`- **Cost Settings**: ${costParts.join(" / ")}`);
  }
  lines.push("");

  // Performance Summary
  lines.push("## Performance");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|------|------|");
  lines.push(
    `| Total Return | ${stats.totalPnlPercent >= 0 ? "+" : ""}${stats.totalPnlPercent.toFixed(2)}% |`,
  );
  lines.push(`| Win Rate | ${stats.winRate.toFixed(1)}% |`);
  lines.push(`| Trades | ${stats.totalTrades} |`);
  lines.push(`| Wins | ${stats.winCount} |`);
  lines.push(`| Losses | ${stats.lossCount} |`);
  lines.push(`| Avg Win | ${stats.avgWin >= 0 ? "+" : ""}${stats.avgWin.toFixed(2)}% |`);
  lines.push(`| Avg Loss | ${stats.avgLoss.toFixed(2)}% |`);
  lines.push(`| Max Drawdown | ${stats.maxDrawdown.toFixed(2)}% |`);
  lines.push(`| Profit Factor | ${stats.profitFactor.toFixed(2)} |`);
  lines.push(`| Sharpe Ratio | ${stats.sharpeRatio.toFixed(2)} |`);
  lines.push(`| Avg Holding Days | ${stats.avgHoldingDays.toFixed(1)}d |`);
  lines.push(`| Max Win Streak | ${stats.maxWinStreak} |`);
  lines.push(`| Max Lose Streak | ${stats.maxLoseStreak} |`);
  if (stats.avgMfe !== 0 || stats.avgMae !== 0) {
    lines.push(`| Avg MFE | +${stats.avgMfe.toFixed(2)}% |`);
    lines.push(`| Avg MAE | ${stats.avgMae.toFixed(2)}% |`);
    if (stats.avgMfeUtilization !== 0) {
      lines.push(`| Avg MFE Util | ${stats.avgMfeUtilization.toFixed(1)}% |`);
    }
  }
  if (stats.marketExposure > 0) {
    lines.push(`| Market Exposure | ${stats.marketExposure.toFixed(1)}% |`);
    lines.push(`| Total Position Days | ${stats.totalPositionDays.toFixed(0)}d |`);
  }
  if (stats.totalCommission > 0 || stats.totalSlippage > 0 || stats.totalTax > 0) {
    if (stats.grossPnl !== stats.totalPnl) {
      lines.push(
        `| Gross P&L | ${stats.grossPnl >= 0 ? "+" : ""}${stats.grossPnl.toLocaleString()} |`,
      );
    }
    if (stats.totalCommission > 0) {
      lines.push(`| Total Commission | ${stats.totalCommission.toLocaleString()} |`);
    }
    if (stats.totalSlippage > 0) {
      lines.push(`| Total Slippage | ${stats.totalSlippage.toLocaleString()} |`);
    }
    if (stats.totalTax > 0) {
      lines.push(`| Total Tax | ${stats.totalTax.toLocaleString()} |`);
    }
    lines.push(
      `| After-Tax P&L | ${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toLocaleString()} |`,
    );
  }
  lines.push("");

  // Buy&Hold Comparison
  if (data.startPrice && data.endPrice) {
    const buyHoldReturn = ((data.endPrice - data.startPrice) / data.startPrice) * 100;
    const alpha = stats.totalPnlPercent - buyHoldReturn;
    lines.push("## Benchmark Comparison");
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("|------|------|");
    lines.push(
      `| Strategy Return | ${stats.totalPnlPercent >= 0 ? "+" : ""}${stats.totalPnlPercent.toFixed(2)}% |`,
    );
    lines.push(`| Buy&Hold | ${buyHoldReturn >= 0 ? "+" : ""}${buyHoldReturn.toFixed(2)}% |`);
    lines.push(`| Alpha | ${alpha >= 0 ? "+" : ""}${alpha.toFixed(2)}% |`);
    lines.push("");
  }

  // Trade History
  lines.push("## Trade History");
  lines.push("");

  const trades = groupTradesIntoPairs(data.tradeHistory);
  trades.forEach((pair, index) => {
    const [buy, sell] = pair;

    lines.push(`### #${index + 1}`);
    lines.push("");
    lines.push(`**BUY** @ ${formatDate(buy.date)}`);
    lines.push(`- Price: ${buy.price.toLocaleString()} (${PRICE_TYPE_LABELS[buy.priceType]})`);
    lines.push(`- Shares: ${buy.shares}`);

    // Indicator values
    const buyIndicators = formatIndicatorSnapshot(buy.indicators);
    if (buyIndicators) {
      lines.push(`- Indicators: ${buyIndicators}`);
    }

    // Market context
    const buyContext = formatMarketContext(buy.marketContext);
    if (buyContext) {
      lines.push(`- Market: ${buyContext}`);
    }

    if (buy.memo) {
      lines.push(`- Memo: "${buy.memo}"`);
    }
    lines.push("");

    if (sell) {
      lines.push(`**SELL** @ ${formatDate(sell.date)}`);
      lines.push(`- Price: ${sell.price.toLocaleString()} (${PRICE_TYPE_LABELS[sell.priceType]})`);
      lines.push(`- Shares: ${sell.shares}`);

      // exitReason & exitTrigger
      if (sell.exitReason) {
        let reasonText = EXIT_REASON_LABELS[sell.exitReason];
        if (sell.exitTrigger) {
          reasonText += ` (${EXIT_TRIGGER_LABELS[sell.exitTrigger]})`;
        }
        lines.push(`- Reason: ${reasonText}`);
      }

      // Show cost details if tax exists
      if (sell.tax !== undefined && sell.tax > 0) {
        lines.push(
          `- Gross P&L: ${sell.grossPnl !== undefined && sell.grossPnl >= 0 ? "+" : ""}${sell.grossPnl?.toLocaleString()}`,
        );
        lines.push(`- Tax: ${sell.tax.toLocaleString()}`);
        lines.push(
          `- After-Tax P&L: ${sell.afterTaxPnl !== undefined && sell.afterTaxPnl >= 0 ? "+" : ""}${sell.afterTaxPnl?.toLocaleString()} (${sell.pnlPercent !== undefined && sell.pnlPercent >= 0 ? "+" : ""}${sell.pnlPercent?.toFixed(2)}%)`,
        );
      } else {
        lines.push(
          `- P&L: ${sell.pnlPercent !== undefined && sell.pnlPercent >= 0 ? "+" : ""}${sell.pnlPercent?.toFixed(2)}% (${sell.pnl !== undefined && sell.pnl >= 0 ? "+" : ""}${sell.pnl?.toLocaleString()})`,
        );
      }

      // MFE/MAE
      if (sell.mfe !== undefined && sell.mae !== undefined) {
        let mfeMaeText = `+${sell.mfe.toFixed(2)}% / ${sell.mae.toFixed(2)}%`;
        if (sell.mfeUtilization !== undefined) {
          mfeMaeText += ` (util: ${sell.mfeUtilization.toFixed(1)}%)`;
        }
        lines.push(`- MFE/MAE: ${mfeMaeText}`);
      }

      // Cost info
      if (sell.commission || sell.slippage) {
        const costParts = [];
        if (sell.commission)
          costParts.push(`Commission ¥${Math.round(sell.commission).toLocaleString()}`);
        if (sell.slippage)
          costParts.push(`Slippage ¥${(sell.slippage * sell.shares).toLocaleString()}`);
        lines.push(`- Cost: ${costParts.join(" / ")}`);
      }

      // Indicator values
      const sellIndicators = formatIndicatorSnapshot(sell.indicators);
      if (sellIndicators) {
        lines.push(`- Indicators: ${sellIndicators}`);
      }

      // Market context
      const sellContext = formatMarketContext(sell.marketContext);
      if (sellContext) {
        lines.push(`- Market: ${sellContext}`);
      }

      if (sell.memo) {
        lines.push(`- Memo: "${sell.memo}"`);
      }
      lines.push("");
    }
  });

  // Indicators Used
  lines.push("## Indicators Used");
  lines.push("");
  const indicatorLabels = data.enabledIndicators.map((key) => {
    const found = AVAILABLE_INDICATORS.find((i) => i.key === key);
    return found ? found.label : key;
  });
  indicatorLabels.forEach((label) => {
    lines.push(`- ${label}`);
  });
  lines.push("");

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}  `);
  lines.push("TrendCraft Trading Simulator");

  return lines.join("\n");
}

function calculateExtendedStats(
  trades: Trade[],
  initialCapital: number,
  totalTradingDays?: number,
): ExtendedStats {
  const sellTrades = trades.filter(
    (t) => (t.type === "SELL" || t.type === "BUY_TO_COVER") && t.pnlPercent !== undefined,
  );

  if (sellTrades.length === 0) {
    return {
      totalTrades: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
      avgWin: 0,
      avgLoss: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      avgHoldingDays: 0,
      maxWinStreak: 0,
      maxLoseStreak: 0,
      avgMfe: 0,
      avgMae: 0,
      avgMfeUtilization: 0,
      marketExposure: 0,
      totalPositionDays: 0,
      totalCommission: 0,
      totalSlippage: 0,
      totalTax: 0,
      grossPnl: 0,
    };
  }

  const totalPnl = sellTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalPnlPercent = (totalPnl / initialCapital) * 100;

  const wins = sellTrades.filter((t) => (t.pnlPercent || 0) > 0);
  const losses = sellTrades.filter((t) => (t.pnlPercent || 0) <= 0);

  const winRate = sellTrades.length > 0 ? (wins.length / sellTrades.length) * 100 : 0;

  const avgWin =
    wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / wins.length : 0;

  const avgLoss =
    losses.length > 0 ? losses.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / losses.length : 0;

  // Calculate max drawdown
  let peak = initialCapital;
  let maxDrawdown = 0;
  let equity = initialCapital;

  sellTrades.forEach((t) => {
    equity += t.pnl || 0;
    if (equity > peak) {
      peak = equity;
    }
    const drawdown = ((peak - equity) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  // Calculate profit factor
  const grossProfit = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0));
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : 0;

  // Calculate Sharpe Ratio (simplified: using trade returns)
  const returns = sellTrades.map((t) => t.pnlPercent || 0);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  // Calculate average holding days
  const pairs = groupTradesIntoPairs(trades);
  let totalHoldingDays = 0;
  let completedTrades = 0;
  pairs.forEach(([buy, sell]) => {
    if (sell) {
      const holdingMs = sell.date - buy.date;
      const holdingDays = holdingMs / (1000 * 60 * 60 * 24);
      totalHoldingDays += holdingDays;
      completedTrades++;
    }
  });
  const avgHoldingDays = completedTrades > 0 ? totalHoldingDays / completedTrades : 0;

  // Calculate max win/lose streaks
  let maxWinStreak = 0;
  let maxLoseStreak = 0;
  let currentWinStreak = 0;
  let currentLoseStreak = 0;

  sellTrades.forEach((t) => {
    if ((t.pnlPercent || 0) > 0) {
      currentWinStreak++;
      currentLoseStreak = 0;
      if (currentWinStreak > maxWinStreak) {
        maxWinStreak = currentWinStreak;
      }
    } else {
      currentLoseStreak++;
      currentWinStreak = 0;
      if (currentLoseStreak > maxLoseStreak) {
        maxLoseStreak = currentLoseStreak;
      }
    }
  });

  // Calculate MFE/MAE averages
  const tradesWithMfe = sellTrades.filter((t) => t.mfe !== undefined);
  const avgMfe =
    tradesWithMfe.length > 0
      ? tradesWithMfe.reduce((sum, t) => sum + (t.mfe || 0), 0) / tradesWithMfe.length
      : 0;
  const avgMae =
    tradesWithMfe.length > 0
      ? tradesWithMfe.reduce((sum, t) => sum + (t.mae || 0), 0) / tradesWithMfe.length
      : 0;

  // Calculate average MFE utilization
  const tradesWithMfeUtilization = sellTrades.filter((t) => t.mfeUtilization !== undefined);
  const avgMfeUtilization =
    tradesWithMfeUtilization.length > 0
      ? tradesWithMfeUtilization.reduce((sum, t) => sum + (t.mfeUtilization || 0), 0) /
        tradesWithMfeUtilization.length
      : 0;

  // Calculate market exposure (totalHoldingDays already computed)
  const totalPositionDays = totalHoldingDays;
  const marketExposure =
    totalTradingDays && totalTradingDays > 0 ? (totalPositionDays / totalTradingDays) * 100 : 0;

  // Calculate total costs
  const totalCommission = trades.reduce((sum, t) => sum + (t.commission || 0), 0);
  const totalSlippage = trades.reduce((sum, t) => sum + (t.slippage || 0) * t.shares, 0);
  const totalTax = sellTrades.reduce((sum, t) => sum + (t.tax || 0), 0);
  const grossPnl = sellTrades.reduce((sum, t) => sum + (t.grossPnl || 0), 0);

  return {
    totalTrades: sellTrades.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRate,
    totalPnl,
    totalPnlPercent,
    avgWin,
    avgLoss,
    maxDrawdown,
    profitFactor: Number.isFinite(profitFactor) ? profitFactor : 999.99,
    sharpeRatio,
    avgHoldingDays,
    maxWinStreak,
    maxLoseStreak,
    avgMfe,
    avgMae,
    avgMfeUtilization,
    marketExposure,
    totalPositionDays,
    totalCommission,
    totalSlippage,
    totalTax,
    grossPnl,
  };
}

function groupTradesIntoPairs(trades: Trade[]): [Trade, Trade | null][] {
  const pairs: [Trade, Trade | null][] = [];
  let currentBuy: Trade | null = null;

  for (const trade of trades) {
    if (trade.type === "BUY") {
      currentBuy = trade;
    } else if (trade.type === "SELL" && currentBuy) {
      pairs.push([currentBuy, trade]);
      currentBuy = null;
    }
  }

  // If there's an open position
  if (currentBuy) {
    pairs.push([currentBuy, null]);
  }

  return pairs;
}

export function downloadReport(
  content: string,
  fileName: string,
  mimeType = "text/markdown;charset=utf-8",
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateCSVReport(data: ReportData): string {
  const lines: string[] = [];

  // Header
  lines.push("Trade#,Type,Date,Price,Shares,Execution,P&L,P&L%,SMA25,SMA75,RSI,MACD,Market,Memo");

  // Trade rows
  data.tradeHistory.forEach((trade, index) => {
    const ind = trade.indicators;
    const row = [
      index + 1,
      trade.type,
      formatDate(trade.date),
      trade.price,
      trade.shares,
      PRICE_TYPE_LABELS[trade.priceType],
      trade.pnl !== undefined ? trade.pnl : "",
      trade.pnlPercent !== undefined ? `${trade.pnlPercent.toFixed(2)}%` : "",
      ind?.sma25 != null ? Math.round(ind.sma25) : "",
      ind?.sma75 != null ? Math.round(ind.sma75) : "",
      ind?.rsi != null ? ind.rsi.toFixed(1) : "",
      ind?.macdHist != null ? ind.macdHist.toFixed(2) : "",
      `"${(trade.marketContext?.description || "").replace(/"/g, '""')}"`,
      `"${(trade.memo || "").replace(/"/g, '""')}"`,
    ];
    lines.push(row.join(","));
  });

  return lines.join("\n");
}

export function generateJSONReport(data: ReportData): string {
  const stats = calculateExtendedStats(
    data.tradeHistory,
    data.initialCapital,
    data.totalTradingDays,
  );
  const finalCapital = data.initialCapital + stats.totalPnl;

  // Buy&Hold calculation
  let buyHoldReturn: number | undefined;
  let alpha: number | undefined;
  if (data.startPrice && data.endPrice) {
    buyHoldReturn = ((data.endPrice - data.startPrice) / data.startPrice) * 100;
    alpha = stats.totalPnlPercent - buyHoldReturn;
  }

  const report = {
    session: {
      fileName: data.fileName,
      startDate: formatDate(data.startDate),
      endDate: formatDate(data.endDate),
      initialCapital: data.initialCapital,
      finalCapital,
      enabledIndicators: data.enabledIndicators,
      commissionRate: data.commissionRate,
      slippageBps: data.slippageBps,
      taxRate: data.taxRate,
    },
    performance: {
      totalPnl: stats.totalPnl,
      totalPnlPercent: stats.totalPnlPercent,
      winRate: stats.winRate,
      totalTrades: stats.totalTrades,
      winCount: stats.winCount,
      lossCount: stats.lossCount,
      avgWin: stats.avgWin,
      avgLoss: stats.avgLoss,
      maxDrawdown: stats.maxDrawdown,
      profitFactor: stats.profitFactor,
      sharpeRatio: stats.sharpeRatio,
      avgHoldingDays: stats.avgHoldingDays,
      maxWinStreak: stats.maxWinStreak,
      maxLoseStreak: stats.maxLoseStreak,
      avgMfe: stats.avgMfe,
      avgMae: stats.avgMae,
      avgMfeUtilization: stats.avgMfeUtilization,
      marketExposure: stats.marketExposure,
      totalPositionDays: stats.totalPositionDays,
      totalCommission: stats.totalCommission,
      totalSlippage: stats.totalSlippage,
      totalTax: stats.totalTax,
      grossPnl: stats.grossPnl,
    },
    benchmark:
      buyHoldReturn !== undefined
        ? {
            buyHoldReturn,
            alpha,
          }
        : undefined,
    trades: data.tradeHistory.map((trade) => ({
      type: trade.type,
      date: formatDate(trade.date),
      price: trade.price,
      effectivePrice: trade.effectivePrice,
      shares: trade.shares,
      priceType: trade.priceType,
      pnl: trade.pnl,
      pnlPercent: trade.pnlPercent,
      grossPnl: trade.grossPnl,
      netPnl: trade.netPnl,
      tax: trade.tax,
      afterTaxPnl: trade.afterTaxPnl,
      commission: trade.commission,
      slippage: trade.slippage,
      exitReason: trade.exitReason,
      exitTrigger: trade.exitTrigger,
      mfe: trade.mfe,
      mae: trade.mae,
      mfeUtilization: trade.mfeUtilization,
      memo: trade.memo,
      indicators: trade.indicators
        ? {
            sma25: trade.indicators.sma25,
            sma75: trade.indicators.sma75,
            rsi: trade.indicators.rsi,
            macdHist: trade.indicators.macdHist,
            bbUpper: trade.indicators.bbUpper,
            bbLower: trade.indicators.bbLower,
          }
        : undefined,
      marketContext: trade.marketContext
        ? {
            trend: trade.marketContext.trend,
            trendStrength: trade.marketContext.trendStrength,
            regime: trade.marketContext.regime,
            confidence: trade.marketContext.confidence,
            rsiZone: trade.marketContext.rsiZone,
            macdSignal: trade.marketContext.macdSignal,
            description: trade.marketContext.description,
          }
        : undefined,
    })),
    generatedAt: new Date().toISOString(),
  };

  return JSON.stringify(report, null, 2);
}

// ===========================================
// Portfolio report (multi-symbol)
// ===========================================

export interface SymbolReportData extends ReportData {
  symbolId: string;
}

export interface PortfolioReportData {
  symbols: SymbolReportData[];
  initialCapital: number;
  enabledIndicators: string[];
  commissionRate?: number;
  slippageBps?: number;
  taxRate?: number;
}

interface SymbolSummary {
  fileName: string;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercent: number;
  buyHoldReturn?: number;
  alpha?: number;
}

export function generatePortfolioMarkdownReport(data: PortfolioReportData): string {
  const lines: string[] = [];

  // Header
  lines.push("# Portfolio Trading Simulation Report");
  lines.push("");

  // Session Info
  lines.push("## Session Info");
  lines.push("");
  lines.push(`- Symbols: ${data.symbols.length}`);
  lines.push(`- Initial Capital: ¥${data.initialCapital.toLocaleString()}`);

  // Period (common range across all symbols)
  const allStartDates = data.symbols.map((s) => s.startDate).filter((d) => d > 0);
  const allEndDates = data.symbols.map((s) => s.endDate).filter((d) => d > 0);
  if (allStartDates.length > 0 && allEndDates.length > 0) {
    const startDate = Math.max(...allStartDates);
    const endDate = Math.min(...allEndDates);
    lines.push(`- Period: ${formatDate(startDate)} - ${formatDate(endDate)}`);
  }
  lines.push("");

  // Portfolio summary
  lines.push("## Portfolio Summary");
  lines.push("");

  // Calculate stats for each symbol
  const symbolSummaries: SymbolSummary[] = data.symbols.map((symbol) => {
    const stats = calculateExtendedStats(
      symbol.tradeHistory,
      data.initialCapital,
      symbol.totalTradingDays,
    );
    let buyHoldReturn: number | undefined;
    let alpha: number | undefined;
    if (symbol.startPrice && symbol.endPrice && symbol.startPrice > 0) {
      buyHoldReturn = ((symbol.endPrice - symbol.startPrice) / symbol.startPrice) * 100;
      alpha = stats.totalPnlPercent - buyHoldReturn;
    }
    return {
      fileName: symbol.fileName,
      totalTrades: stats.totalTrades,
      winRate: stats.winRate,
      totalPnl: stats.totalPnl,
      totalPnlPercent: stats.totalPnlPercent,
      buyHoldReturn,
      alpha,
    };
  });

  // Portfolio-wide stats
  const totalPnl = symbolSummaries.reduce((sum, s) => sum + s.totalPnl, 0);
  const totalPnlPercent = (totalPnl / data.initialCapital) * 100;
  const totalTrades = symbolSummaries.reduce((sum, s) => sum + s.totalTrades, 0);
  const totalWins = data.symbols.reduce((sum, s) => {
    return (
      sum +
      s.tradeHistory.filter(
        (t) => (t.type === "SELL" || t.type === "BUY_TO_COVER") && (t.pnl || 0) > 0,
      ).length
    );
  }, 0);
  const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  // Buy&Hold average
  const symbolsWithBuyHold = symbolSummaries.filter((s) => s.buyHoldReturn !== undefined);
  const avgBuyHoldReturn =
    symbolsWithBuyHold.length > 0
      ? symbolsWithBuyHold.reduce((sum, s) => sum + (s.buyHoldReturn || 0), 0) /
        symbolsWithBuyHold.length
      : undefined;
  const avgAlpha = avgBuyHoldReturn !== undefined ? totalPnlPercent - avgBuyHoldReturn : undefined;

  lines.push("### Overall Performance");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|------|------|");
  lines.push(
    `| Total P&L | ${totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()} (${totalPnlPercent >= 0 ? "+" : ""}${totalPnlPercent.toFixed(2)}%) |`,
  );
  lines.push(`| Final Capital | ${(data.initialCapital + totalPnl).toLocaleString()} |`);
  lines.push(`| Total Trades | ${totalTrades} |`);
  lines.push(`| Overall Win Rate | ${overallWinRate.toFixed(1)}% |`);
  if (avgBuyHoldReturn !== undefined) {
    lines.push(
      `| Avg Buy&Hold | ${avgBuyHoldReturn >= 0 ? "+" : ""}${avgBuyHoldReturn.toFixed(2)}% |`,
    );
    lines.push(
      `| Avg Alpha | ${avgAlpha !== undefined && avgAlpha >= 0 ? "+" : ""}${avgAlpha?.toFixed(2)}% |`,
    );
  }
  lines.push("");

  // Per-symbol summary table
  lines.push("### Per-Symbol Performance");
  lines.push("");
  lines.push("| Symbol | Trades | Win Rate | P&L | P&L% | B&H | Alpha |");
  lines.push("|------|---------|------|------|--------|-----|-------|");

  symbolSummaries.forEach((s) => {
    const pnlSign = s.totalPnl >= 0 ? "+" : "";
    const pnlPctSign = s.totalPnlPercent >= 0 ? "+" : "";
    const bhStr =
      s.buyHoldReturn !== undefined
        ? `${s.buyHoldReturn >= 0 ? "+" : ""}${s.buyHoldReturn.toFixed(1)}%`
        : "-";
    const alphaStr =
      s.alpha !== undefined ? `${s.alpha >= 0 ? "+" : ""}${s.alpha.toFixed(1)}%` : "-";
    lines.push(
      `| ${s.fileName} | ${s.totalTrades} | ${s.winRate.toFixed(1)}% | ${pnlSign}${s.totalPnl.toLocaleString()} | ${pnlPctSign}${s.totalPnlPercent.toFixed(2)}% | ${bhStr} | ${alphaStr} |`,
    );
  });
  lines.push("");

  // Per-symbol details
  lines.push("---");
  lines.push("");
  lines.push("## Per-Symbol Details");
  lines.push("");

  data.symbols.forEach((symbol, index) => {
    lines.push(`### ${index + 1}. ${symbol.fileName}`);
    lines.push("");

    const stats = calculateExtendedStats(
      symbol.tradeHistory,
      data.initialCapital,
      symbol.totalTradingDays,
    );

    lines.push("| Metric | Value |");
    lines.push("|------|------|");
    lines.push(`| Trades | ${stats.totalTrades} (${stats.winCount}W/${stats.lossCount}L) |`);
    lines.push(`| Win Rate | ${stats.winRate.toFixed(1)}% |`);
    lines.push(
      `| Total P&L | ${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toLocaleString()} (${stats.totalPnlPercent >= 0 ? "+" : ""}${stats.totalPnlPercent.toFixed(2)}%) |`,
    );
    lines.push(`| Avg Win | ${stats.avgWin >= 0 ? "+" : ""}${stats.avgWin.toFixed(2)}% |`);
    lines.push(`| Avg Loss | ${stats.avgLoss.toFixed(2)}% |`);
    lines.push(`| PF | ${stats.profitFactor.toFixed(2)} |`);
    lines.push(`| Max DD | ${stats.maxDrawdown.toFixed(2)}% |`);
    if (stats.avgMfe > 0 || stats.avgMae < 0) {
      lines.push(`| Avg MFE/MAE | +${stats.avgMfe.toFixed(2)}% / ${stats.avgMae.toFixed(2)}% |`);
    }
    if (stats.avgMfeUtilization > 0) {
      lines.push(`| MFE Util | ${stats.avgMfeUtilization.toFixed(1)}% |`);
    }
    lines.push("");

    // Trade history (summary)
    const pairs = groupTradesIntoPairs(symbol.tradeHistory);
    if (pairs.length > 0) {
      lines.push("**Trade History:**");
      lines.push("");
      pairs.forEach(([buy, sell], pairIndex) => {
        if (sell) {
          const pnlStr =
            sell.pnlPercent !== undefined
              ? `${sell.pnlPercent >= 0 ? "+" : ""}${sell.pnlPercent.toFixed(2)}%`
              : "-";
          lines.push(
            `${pairIndex + 1}. ${formatDate(buy.date)} → ${formatDate(sell.date)}: ${pnlStr}`,
          );
        } else {
          lines.push(`${pairIndex + 1}. ${formatDate(buy.date)} → (open)`);
        }
      });
      lines.push("");
    }
  });

  // Indicators
  lines.push("## Indicators Used");
  lines.push("");
  const indicatorLabels = data.enabledIndicators.map((key) => {
    const found = AVAILABLE_INDICATORS.find((i) => i.key === key);
    return found ? found.label : key;
  });
  indicatorLabels.forEach((label) => {
    lines.push(`- ${label}`);
  });
  lines.push("");

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}  `);
  lines.push("TrendCraft Trading Simulator - Portfolio Report");

  return lines.join("\n");
}

export function generatePortfolioCSVReport(data: PortfolioReportData): string {
  const lines: string[] = [];

  // Header
  lines.push("Symbol,Trade#,Type,Date,Price,Shares,Execution,P&L,P&L%,Memo");

  // Trade rows for all symbols
  data.symbols.forEach((symbol) => {
    symbol.tradeHistory.forEach((trade, index) => {
      const row = [
        `"${symbol.fileName}"`,
        index + 1,
        trade.type,
        formatDate(trade.date),
        trade.price,
        trade.shares,
        PRICE_TYPE_LABELS[trade.priceType],
        trade.pnl !== undefined ? trade.pnl : "",
        trade.pnlPercent !== undefined ? `${trade.pnlPercent.toFixed(2)}%` : "",
        `"${(trade.memo || "").replace(/"/g, '""')}"`,
      ];
      lines.push(row.join(","));
    });
  });

  return lines.join("\n");
}

export function generatePortfolioJSONReport(data: PortfolioReportData): string {
  const symbolReports = data.symbols.map((symbol) => {
    const stats = calculateExtendedStats(
      symbol.tradeHistory,
      data.initialCapital,
      symbol.totalTradingDays,
    );
    let buyHoldReturn: number | undefined;
    let alpha: number | undefined;
    if (symbol.startPrice && symbol.endPrice && symbol.startPrice > 0) {
      buyHoldReturn = ((symbol.endPrice - symbol.startPrice) / symbol.startPrice) * 100;
      alpha = stats.totalPnlPercent - buyHoldReturn;
    }
    return {
      fileName: symbol.fileName,
      period: {
        startDate: formatDate(symbol.startDate),
        endDate: formatDate(symbol.endDate),
      },
      performance: {
        totalPnl: stats.totalPnl,
        totalPnlPercent: stats.totalPnlPercent,
        winRate: stats.winRate,
        totalTrades: stats.totalTrades,
        winCount: stats.winCount,
        lossCount: stats.lossCount,
        profitFactor: stats.profitFactor,
        maxDrawdown: stats.maxDrawdown,
        avgMfe: stats.avgMfe,
        avgMae: stats.avgMae,
        avgMfeUtilization: stats.avgMfeUtilization,
      },
      benchmark:
        buyHoldReturn !== undefined
          ? {
              buyHoldReturn,
              alpha,
            }
          : undefined,
      trades: symbol.tradeHistory.map((trade) => ({
        type: trade.type,
        date: formatDate(trade.date),
        price: trade.price,
        shares: trade.shares,
        pnl: trade.pnl,
        pnlPercent: trade.pnlPercent,
        memo: trade.memo,
      })),
    };
  });

  // Portfolio totals
  const totalPnl = symbolReports.reduce((sum, s) => sum + s.performance.totalPnl, 0);
  const totalPnlPercent = (totalPnl / data.initialCapital) * 100;
  const totalTrades = symbolReports.reduce((sum, s) => sum + s.performance.totalTrades, 0);
  const totalWins = symbolReports.reduce((sum, s) => sum + s.performance.winCount, 0);

  const report = {
    portfolio: {
      symbolCount: data.symbols.length,
      initialCapital: data.initialCapital,
      finalCapital: data.initialCapital + totalPnl,
      totalPnl,
      totalPnlPercent,
      totalTrades,
      overallWinRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
    },
    symbols: symbolReports,
    config: {
      enabledIndicators: data.enabledIndicators,
      commissionRate: data.commissionRate,
      slippageBps: data.slippageBps,
      taxRate: data.taxRate,
    },
    generatedAt: new Date().toISOString(),
  };

  return JSON.stringify(report, null, 2);
}
