import type { Trade, SimulatorStats } from "../types";
import { formatDate } from "./fileParser";
import { AVAILABLE_INDICATORS, PRICE_TYPE_LABELS } from "../types";

interface ReportData {
  fileName: string;
  startDate: number;
  endDate: number;
  initialCapital: number;
  enabledIndicators: string[];
  tradeHistory: Trade[];
}

export function generateMarkdownReport(data: ReportData): string {
  const stats = calculateStats(data.tradeHistory, data.initialCapital);
  const finalCapital = data.initialCapital + stats.totalPnl;

  const lines: string[] = [];

  // Header
  lines.push("# 売買シミュレーションレポート");
  lines.push("");

  // Session Info
  lines.push("## セッション情報");
  lines.push("");
  lines.push(`- **銘柄**: ${data.fileName}`);
  lines.push(
    `- **期間**: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}`
  );
  lines.push(`- **初期資金**: ${data.initialCapital.toLocaleString()}`);
  lines.push(`- **最終資金**: ${finalCapital.toLocaleString()}`);
  lines.push("");

  // Performance Summary
  lines.push("## パフォーマンス");
  lines.push("");
  lines.push("| 指標 | 値 |");
  lines.push("|------|------|");
  lines.push(
    `| 総利益率 | ${stats.totalPnlPercent >= 0 ? "+" : ""}${stats.totalPnlPercent.toFixed(2)}% |`
  );
  lines.push(`| 勝率 | ${stats.winRate.toFixed(1)}% |`);
  lines.push(`| 取引回数 | ${stats.totalTrades} |`);
  lines.push(`| 勝ち | ${stats.winCount} |`);
  lines.push(`| 負け | ${stats.lossCount} |`);
  lines.push(
    `| 平均利益 | ${stats.avgWin >= 0 ? "+" : ""}${stats.avgWin.toFixed(2)}% |`
  );
  lines.push(`| 平均損失 | ${stats.avgLoss.toFixed(2)}% |`);
  lines.push(`| 最大ドローダウン | ${stats.maxDrawdown.toFixed(2)}% |`);
  lines.push(`| プロフィットファクター | ${stats.profitFactor.toFixed(2)} |`);
  lines.push("");

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
    if (buy.memo) {
      lines.push(`- メモ: "${buy.memo}"`);
    }
    lines.push("");

    if (sell) {
      lines.push(`**SELL** @ ${formatDate(sell.date)}`);
      lines.push(`- 価格: ${sell.price.toLocaleString()} (${PRICE_TYPE_LABELS[sell.priceType]})`);
      lines.push(`- 株数: ${sell.shares}`);
      lines.push(
        `- 損益: ${sell.pnlPercent !== undefined && sell.pnlPercent >= 0 ? "+" : ""}${sell.pnlPercent?.toFixed(2)}% (${sell.pnl !== undefined && sell.pnl >= 0 ? "+" : ""}${sell.pnl?.toLocaleString()}円)`
      );
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
  lines.push(
    `Generated: ${new Date().toLocaleString("ja-JP")}  `
  );
  lines.push("TrendCraft Trading Simulator");

  return lines.join("\n");
}

function calculateStats(trades: Trade[], initialCapital: number): SimulatorStats {
  const sellTrades = trades.filter(
    (t) => t.type === "SELL" && t.pnlPercent !== undefined
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
    };
  }

  const totalPnl = sellTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalPnlPercent = (totalPnl / initialCapital) * 100;

  const wins = sellTrades.filter((t) => (t.pnlPercent || 0) > 0);
  const losses = sellTrades.filter((t) => (t.pnlPercent || 0) <= 0);

  const winRate =
    sellTrades.length > 0 ? (wins.length / sellTrades.length) * 100 : 0;

  const avgWin =
    wins.length > 0
      ? wins.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / wins.length
      : 0;

  const avgLoss =
    losses.length > 0
      ? losses.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / losses.length
      : 0;

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
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

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
    profitFactor: isFinite(profitFactor) ? profitFactor : 999.99,
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

export function downloadReport(markdown: string, fileName: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
