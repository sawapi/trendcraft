import type { IndicatorSnapshot, MarketContext, SimulatorStats, Trade } from "../types";
import {
  AVAILABLE_INDICATORS,
  EXIT_REASON_LABELS,
  EXIT_TRIGGER_LABELS,
  PRICE_TYPE_LABELS,
} from "../types";
import { formatDate } from "./fileParser";

// インジケーター値をフォーマット
function formatIndicatorValue(value: number | null | undefined, decimals = 2): string {
  if (value == null) return "-";
  return value.toFixed(decimals);
}

// インジケータースナップショットをMarkdown形式でフォーマット
function formatIndicatorSnapshot(indicators: IndicatorSnapshot | undefined): string {
  if (!indicators) return "";

  const parts: string[] = [];

  // MA系
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

// マーケットコンテキストをMarkdown形式でフォーマット
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
  startPrice?: number; // Buy&Hold比較用
  endPrice?: number; // Buy&Hold比較用
  commissionRate?: number;
  slippageBps?: number;
  taxRate?: number; // 譲渡益税率
  totalTradingDays?: number; // シミュレーション期間の営業日数（marketExposure計算用）
}

// Extended stats interface for advanced metrics
interface ExtendedStats extends SimulatorStats {
  sharpeRatio: number;
  avgHoldingDays: number;
  maxWinStreak: number;
  maxLoseStreak: number;
  avgMfe: number;
  avgMae: number;
  avgMfeUtilization: number; // MFE活用度の平均
  marketExposure: number; // 市場滞在率(%)
  totalPositionDays: number; // 合計ポジション保有日数
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
  lines.push("# 売買シミュレーションレポート");
  lines.push("");

  // Session Info
  lines.push("## セッション情報");
  lines.push("");
  lines.push(`- **銘柄**: ${data.fileName}`);
  lines.push(`- **期間**: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}`);
  lines.push(`- **初期資金**: ${data.initialCapital.toLocaleString()}`);
  lines.push(`- **最終資金**: ${finalCapital.toLocaleString()}`);
  if (data.commissionRate || data.slippageBps || data.taxRate) {
    const costParts = [];
    if (data.commissionRate) costParts.push(`手数料${data.commissionRate}%`);
    if (data.slippageBps) costParts.push(`スリッページ${data.slippageBps}bps`);
    if (data.taxRate) costParts.push(`税率${data.taxRate}%`);
    lines.push(`- **コスト設定**: ${costParts.join(" / ")}`);
  }
  lines.push("");

  // Performance Summary
  lines.push("## パフォーマンス");
  lines.push("");
  lines.push("| 指標 | 値 |");
  lines.push("|------|------|");
  lines.push(
    `| 総利益率 | ${stats.totalPnlPercent >= 0 ? "+" : ""}${stats.totalPnlPercent.toFixed(2)}% |`,
  );
  lines.push(`| 勝率 | ${stats.winRate.toFixed(1)}% |`);
  lines.push(`| 取引回数 | ${stats.totalTrades} |`);
  lines.push(`| 勝ち | ${stats.winCount} |`);
  lines.push(`| 負け | ${stats.lossCount} |`);
  lines.push(`| 平均利益 | ${stats.avgWin >= 0 ? "+" : ""}${stats.avgWin.toFixed(2)}% |`);
  lines.push(`| 平均損失 | ${stats.avgLoss.toFixed(2)}% |`);
  lines.push(`| 最大ドローダウン | ${stats.maxDrawdown.toFixed(2)}% |`);
  lines.push(`| プロフィットファクター | ${stats.profitFactor.toFixed(2)} |`);
  lines.push(`| シャープレシオ | ${stats.sharpeRatio.toFixed(2)} |`);
  lines.push(`| 平均保有日数 | ${stats.avgHoldingDays.toFixed(1)}日 |`);
  lines.push(`| 最大連勝 | ${stats.maxWinStreak} |`);
  lines.push(`| 最大連敗 | ${stats.maxLoseStreak} |`);
  if (stats.avgMfe !== 0 || stats.avgMae !== 0) {
    lines.push(`| 平均MFE | +${stats.avgMfe.toFixed(2)}% |`);
    lines.push(`| 平均MAE | ${stats.avgMae.toFixed(2)}% |`);
    if (stats.avgMfeUtilization !== 0) {
      lines.push(`| 平均MFE活用度 | ${stats.avgMfeUtilization.toFixed(1)}% |`);
    }
  }
  if (stats.marketExposure > 0) {
    lines.push(`| 市場滞在率 | ${stats.marketExposure.toFixed(1)}% |`);
    lines.push(`| 合計保有日数 | ${stats.totalPositionDays.toFixed(0)}日 |`);
  }
  if (stats.totalCommission > 0 || stats.totalSlippage > 0 || stats.totalTax > 0) {
    if (stats.grossPnl !== stats.totalPnl) {
      lines.push(
        `| 粗利益 | ${stats.grossPnl >= 0 ? "+" : ""}${stats.grossPnl.toLocaleString()}円 |`,
      );
    }
    if (stats.totalCommission > 0) {
      lines.push(`| 総手数料 | ${stats.totalCommission.toLocaleString()}円 |`);
    }
    if (stats.totalSlippage > 0) {
      lines.push(`| 総スリッページ | ${stats.totalSlippage.toLocaleString()}円 |`);
    }
    if (stats.totalTax > 0) {
      lines.push(`| 総税金 | ${stats.totalTax.toLocaleString()}円 |`);
    }
    lines.push(
      `| 税引後損益 | ${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toLocaleString()}円 |`,
    );
  }
  lines.push("");

  // Buy&Hold Comparison
  if (data.startPrice && data.endPrice) {
    const buyHoldReturn = ((data.endPrice - data.startPrice) / data.startPrice) * 100;
    const alpha = stats.totalPnlPercent - buyHoldReturn;
    lines.push("## ベンチマーク比較");
    lines.push("");
    lines.push("| 指標 | 値 |");
    lines.push("|------|------|");
    lines.push(
      `| 戦略リターン | ${stats.totalPnlPercent >= 0 ? "+" : ""}${stats.totalPnlPercent.toFixed(2)}% |`,
    );
    lines.push(`| Buy&Hold | ${buyHoldReturn >= 0 ? "+" : ""}${buyHoldReturn.toFixed(2)}% |`);
    lines.push(`| Alpha | ${alpha >= 0 ? "+" : ""}${alpha.toFixed(2)}% |`);
    lines.push("");
  }

  // Trade History
  lines.push("## 取引履歴");
  lines.push("");

  const trades = groupTradesIntoPairs(data.tradeHistory);
  trades.forEach((pair, index) => {
    const [buy, sell] = pair;

    lines.push(`### #${index + 1}`);
    lines.push("");
    lines.push(`**BUY** @ ${formatDate(buy.date)}`);
    lines.push(`- 価格: ${buy.price.toLocaleString()} (${PRICE_TYPE_LABELS[buy.priceType]})`);
    lines.push(`- 株数: ${buy.shares}`);

    // インジケーター値
    const buyIndicators = formatIndicatorSnapshot(buy.indicators);
    if (buyIndicators) {
      lines.push(`- インジケーター: ${buyIndicators}`);
    }

    // マーケットコンテキスト
    const buyContext = formatMarketContext(buy.marketContext);
    if (buyContext) {
      lines.push(`- 相場状況: ${buyContext}`);
    }

    if (buy.memo) {
      lines.push(`- メモ: "${buy.memo}"`);
    }
    lines.push("");

    if (sell) {
      lines.push(`**SELL** @ ${formatDate(sell.date)}`);
      lines.push(`- 価格: ${sell.price.toLocaleString()} (${PRICE_TYPE_LABELS[sell.priceType]})`);
      lines.push(`- 株数: ${sell.shares}`);

      // exitReason & exitTrigger
      if (sell.exitReason) {
        let reasonText = EXIT_REASON_LABELS[sell.exitReason];
        if (sell.exitTrigger) {
          reasonText += ` (${EXIT_TRIGGER_LABELS[sell.exitTrigger]})`;
        }
        lines.push(`- 理由: ${reasonText}`);
      }

      // 税金がある場合は詳細表示
      if (sell.tax !== undefined && sell.tax > 0) {
        lines.push(
          `- 粗利益: ${sell.grossPnl !== undefined && sell.grossPnl >= 0 ? "+" : ""}${sell.grossPnl?.toLocaleString()}円`,
        );
        lines.push(`- 税金: ${sell.tax.toLocaleString()}円`);
        lines.push(
          `- 税引後損益: ${sell.afterTaxPnl !== undefined && sell.afterTaxPnl >= 0 ? "+" : ""}${sell.afterTaxPnl?.toLocaleString()}円 (${sell.pnlPercent !== undefined && sell.pnlPercent >= 0 ? "+" : ""}${sell.pnlPercent?.toFixed(2)}%)`,
        );
      } else {
        lines.push(
          `- 損益: ${sell.pnlPercent !== undefined && sell.pnlPercent >= 0 ? "+" : ""}${sell.pnlPercent?.toFixed(2)}% (${sell.pnl !== undefined && sell.pnl >= 0 ? "+" : ""}${sell.pnl?.toLocaleString()}円)`,
        );
      }

      // MFE/MAE
      if (sell.mfe !== undefined && sell.mae !== undefined) {
        let mfeMaeText = `+${sell.mfe.toFixed(2)}% / ${sell.mae.toFixed(2)}%`;
        if (sell.mfeUtilization !== undefined) {
          mfeMaeText += ` (活用度: ${sell.mfeUtilization.toFixed(1)}%)`;
        }
        lines.push(`- MFE/MAE: ${mfeMaeText}`);
      }

      // コスト情報
      if (sell.commission || sell.slippage) {
        const costParts = [];
        if (sell.commission)
          costParts.push(`手数料${Math.round(sell.commission).toLocaleString()}円`);
        if (sell.slippage)
          costParts.push(`スリッページ${(sell.slippage * sell.shares).toLocaleString()}円`);
        lines.push(`- コスト: ${costParts.join(" / ")}`);
      }

      // インジケーター値
      const sellIndicators = formatIndicatorSnapshot(sell.indicators);
      if (sellIndicators) {
        lines.push(`- インジケーター: ${sellIndicators}`);
      }

      // マーケットコンテキスト
      const sellContext = formatMarketContext(sell.marketContext);
      if (sellContext) {
        lines.push(`- 相場状況: ${sellContext}`);
      }

      if (sell.memo) {
        lines.push(`- メモ: "${sell.memo}"`);
      }
      lines.push("");
    }
  });

  // Indicators Used
  lines.push("## 使用インジケーター");
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
  lines.push(`Generated: ${new Date().toLocaleString("ja-JP")}  `);
  lines.push("TrendCraft Trading Simulator");

  return lines.join("\n");
}

function calculateExtendedStats(
  trades: Trade[],
  initialCapital: number,
  totalTradingDays?: number,
): ExtendedStats {
  const sellTrades = trades.filter((t) => t.type === "SELL" && t.pnlPercent !== undefined);

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

  // MFE/MAE平均を計算
  const tradesWithMfe = sellTrades.filter((t) => t.mfe !== undefined);
  const avgMfe =
    tradesWithMfe.length > 0
      ? tradesWithMfe.reduce((sum, t) => sum + (t.mfe || 0), 0) / tradesWithMfe.length
      : 0;
  const avgMae =
    tradesWithMfe.length > 0
      ? tradesWithMfe.reduce((sum, t) => sum + (t.mae || 0), 0) / tradesWithMfe.length
      : 0;

  // MFE活用度の平均を計算
  const tradesWithMfeUtilization = sellTrades.filter((t) => t.mfeUtilization !== undefined);
  const avgMfeUtilization =
    tradesWithMfeUtilization.length > 0
      ? tradesWithMfeUtilization.reduce((sum, t) => sum + (t.mfeUtilization || 0), 0) /
        tradesWithMfeUtilization.length
      : 0;

  // 市場滞在率を計算（totalHoldingDays は既に計算済み）
  const totalPositionDays = totalHoldingDays;
  const marketExposure =
    totalTradingDays && totalTradingDays > 0 ? (totalPositionDays / totalTradingDays) * 100 : 0;

  // 総コストを計算
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
  lines.push(
    "取引番号,種別,日付,価格,株数,約定方法,損益,損益率,SMA25,SMA75,RSI,MACD,相場状況,メモ",
  );

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

  // Buy&Hold計算
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
// ポートフォリオレポート（複数銘柄対応）
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
  lines.push("# ポートフォリオ売買シミュレーションレポート");
  lines.push("");

  // Session Info
  lines.push("## セッション情報");
  lines.push("");
  lines.push(`- 銘柄数: ${data.symbols.length}`);
  lines.push(`- 初期資金: ${data.initialCapital.toLocaleString()}円`);

  // 期間（全銘柄の共通期間を表示）
  const allStartDates = data.symbols.map((s) => s.startDate).filter((d) => d > 0);
  const allEndDates = data.symbols.map((s) => s.endDate).filter((d) => d > 0);
  if (allStartDates.length > 0 && allEndDates.length > 0) {
    const startDate = Math.max(...allStartDates);
    const endDate = Math.min(...allEndDates);
    lines.push(`- 期間: ${formatDate(startDate)} - ${formatDate(endDate)}`);
  }
  lines.push("");

  // ポートフォリオサマリー
  lines.push("## ポートフォリオサマリー");
  lines.push("");

  // 各銘柄の統計を計算
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

  // ポートフォリオ全体の統計
  const totalPnl = symbolSummaries.reduce((sum, s) => sum + s.totalPnl, 0);
  const totalPnlPercent = (totalPnl / data.initialCapital) * 100;
  const totalTrades = symbolSummaries.reduce((sum, s) => sum + s.totalTrades, 0);
  const totalWins = data.symbols.reduce((sum, s) => {
    return sum + s.tradeHistory.filter((t) => t.type === "SELL" && (t.pnl || 0) > 0).length;
  }, 0);
  const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  // Buy&Hold平均
  const symbolsWithBuyHold = symbolSummaries.filter((s) => s.buyHoldReturn !== undefined);
  const avgBuyHoldReturn =
    symbolsWithBuyHold.length > 0
      ? symbolsWithBuyHold.reduce((sum, s) => sum + (s.buyHoldReturn || 0), 0) /
        symbolsWithBuyHold.length
      : undefined;
  const avgAlpha = avgBuyHoldReturn !== undefined ? totalPnlPercent - avgBuyHoldReturn : undefined;

  lines.push("### 全体パフォーマンス");
  lines.push("");
  lines.push("| 指標 | 値 |");
  lines.push("|------|------|");
  lines.push(
    `| 総損益 | ${totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()}円 (${totalPnlPercent >= 0 ? "+" : ""}${totalPnlPercent.toFixed(2)}%) |`,
  );
  lines.push(`| 最終資産 | ${(data.initialCapital + totalPnl).toLocaleString()}円 |`);
  lines.push(`| 総取引回数 | ${totalTrades}回 |`);
  lines.push(`| 全体勝率 | ${overallWinRate.toFixed(1)}% |`);
  if (avgBuyHoldReturn !== undefined) {
    lines.push(
      `| Buy&Hold平均 | ${avgBuyHoldReturn >= 0 ? "+" : ""}${avgBuyHoldReturn.toFixed(2)}% |`,
    );
    lines.push(
      `| 平均Alpha | ${avgAlpha !== undefined && avgAlpha >= 0 ? "+" : ""}${avgAlpha?.toFixed(2)}% |`,
    );
  }
  lines.push("");

  // 銘柄別サマリーテーブル
  lines.push("### 銘柄別パフォーマンス");
  lines.push("");
  lines.push("| 銘柄 | 取引回数 | 勝率 | 損益 | 損益率 | B&H | Alpha |");
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
      `| ${s.fileName} | ${s.totalTrades}回 | ${s.winRate.toFixed(1)}% | ${pnlSign}${s.totalPnl.toLocaleString()}円 | ${pnlPctSign}${s.totalPnlPercent.toFixed(2)}% | ${bhStr} | ${alphaStr} |`,
    );
  });
  lines.push("");

  // 各銘柄の詳細
  lines.push("---");
  lines.push("");
  lines.push("## 銘柄別詳細");
  lines.push("");

  data.symbols.forEach((symbol, index) => {
    lines.push(`### ${index + 1}. ${symbol.fileName}`);
    lines.push("");

    const stats = calculateExtendedStats(
      symbol.tradeHistory,
      data.initialCapital,
      symbol.totalTradingDays,
    );

    lines.push("| 指標 | 値 |");
    lines.push("|------|------|");
    lines.push(`| 取引回数 | ${stats.totalTrades}回 (${stats.winCount}勝${stats.lossCount}敗) |`);
    lines.push(`| 勝率 | ${stats.winRate.toFixed(1)}% |`);
    lines.push(
      `| 総損益 | ${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toLocaleString()}円 (${stats.totalPnlPercent >= 0 ? "+" : ""}${stats.totalPnlPercent.toFixed(2)}%) |`,
    );
    lines.push(`| 平均勝ち | ${stats.avgWin >= 0 ? "+" : ""}${stats.avgWin.toFixed(2)}% |`);
    lines.push(`| 平均負け | ${stats.avgLoss.toFixed(2)}% |`);
    lines.push(`| PF | ${stats.profitFactor.toFixed(2)} |`);
    lines.push(`| 最大DD | ${stats.maxDrawdown.toFixed(2)}% |`);
    if (stats.avgMfe > 0 || stats.avgMae < 0) {
      lines.push(`| 平均MFE/MAE | +${stats.avgMfe.toFixed(2)}% / ${stats.avgMae.toFixed(2)}% |`);
    }
    if (stats.avgMfeUtilization > 0) {
      lines.push(`| MFE活用度 | ${stats.avgMfeUtilization.toFixed(1)}% |`);
    }
    lines.push("");

    // 取引履歴（簡略版）
    const pairs = groupTradesIntoPairs(symbol.tradeHistory);
    if (pairs.length > 0) {
      lines.push("**取引履歴:**");
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
          lines.push(`${pairIndex + 1}. ${formatDate(buy.date)} → (保有中)`);
        }
      });
      lines.push("");
    }
  });

  // インジケーター
  lines.push("## 使用インジケーター");
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
  lines.push(`Generated: ${new Date().toLocaleString("ja-JP")}  `);
  lines.push("TrendCraft Trading Simulator - Portfolio Report");

  return lines.join("\n");
}

export function generatePortfolioCSVReport(data: PortfolioReportData): string {
  const lines: string[] = [];

  // Header
  lines.push("銘柄,取引番号,種別,日付,価格,株数,約定方法,損益,損益率,メモ");

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
