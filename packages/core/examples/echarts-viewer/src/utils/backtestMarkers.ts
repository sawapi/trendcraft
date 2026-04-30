/**
 * Trade markers for backtest visualization
 */

import type { NormalizedCandle, Trade } from "trendcraft";

// biome-ignore lint/suspicious/noExplicitAny: ECharts internal type
type MarkPointItem = any;

/**
 * Format timestamp to date string
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * Create trade markers for backtest visualization.
 * Returns both execution markers (▲/▼) and signal markers (◇).
 *
 * - Execution markers: placed on the bar where the trade was filled
 * - Signal markers: placed on the previous bar where the condition fired
 *   (backtest evaluates at bar N close, executes at bar N+1 open)
 */
export function createTradeMarkers(
  trades: Trade[],
  candles: NormalizedCandle[],
  dates: string[],
): MarkPointItem[] {
  if (!trades || trades.length === 0) return [];

  // Build time to index map
  const timeToIdx = new Map<number, number>();
  candles.forEach((c, i) => timeToIdx.set(c.time, i));

  const markers: MarkPointItem[] = [];

  for (const trade of trades) {
    // Entry execution marker
    const entryIdx = timeToIdx.get(trade.entryTime);
    if (entryIdx !== undefined) {
      const entryCandle = candles[entryIdx];
      markers.push({
        name: "Entry",
        coord: [dates[entryIdx], entryCandle.low * 0.995],
        symbol: "triangle",
        symbolSize: 14,
        itemStyle: { color: "#26a69a" },
        label: {
          show: true,
          formatter: "B",
          color: "#fff",
          fontSize: 8,
          position: "inside",
        },
      });

      // Entry signal marker (previous bar)
      const signalIdx = entryIdx - 1;
      if (signalIdx >= 0) {
        const signalCandle = candles[signalIdx];
        markers.push({
          name: "Entry Signal",
          coord: [dates[signalIdx], signalCandle.low * 0.992],
          symbol: "diamond",
          symbolSize: 10,
          itemStyle: { color: "transparent", borderColor: "#26a69a", borderWidth: 2 },
          label: { show: false },
        });
      }
    }

    // Exit execution marker
    const exitIdx = timeToIdx.get(trade.exitTime);
    if (exitIdx !== undefined) {
      const exitCandle = candles[exitIdx];
      const isPartial = trade.isPartial;
      markers.push({
        name: isPartial ? "Partial Exit" : "Exit",
        coord: [dates[exitIdx], exitCandle.high * 1.005],
        symbol: "triangle",
        symbolSize: isPartial ? 10 : 14,
        symbolRotate: 180,
        itemStyle: { color: isPartial ? "#ffd93d" : "#ef5350" },
        label: {
          show: true,
          formatter: isPartial ? "P" : "S",
          color: isPartial ? "#000" : "#fff",
          fontSize: 8,
          position: "inside",
        },
      });

      // Exit signal marker (previous bar) — skip for partial exits
      if (!isPartial) {
        const signalIdx = exitIdx - 1;
        if (signalIdx >= 0) {
          const signalCandle = candles[signalIdx];
          markers.push({
            name: "Exit Signal",
            coord: [dates[signalIdx], signalCandle.high * 1.008],
            symbol: "diamond",
            symbolSize: 10,
            symbolRotate: 0,
            itemStyle: { color: "transparent", borderColor: "#ef5350", borderWidth: 2 },
            label: { show: false },
          });
        }
      }
    }
  }

  return markers;
}

/**
 * Create markArea data for trade holding periods.
 * Shades the background between entry and exit bars.
 */
export function createTradeAreas(
  trades: Trade[],
  dates: string[],
  candles: NormalizedCandle[],
): MarkPointItem[][] {
  if (!trades || trades.length === 0) return [];

  const timeToIdx = new Map<number, number>();
  candles.forEach((c, i) => timeToIdx.set(c.time, i));

  const areas: MarkPointItem[][] = [];

  for (const trade of trades) {
    if (trade.isPartial) continue;
    const entryIdx = timeToIdx.get(trade.entryTime);
    const exitIdx = timeToIdx.get(trade.exitTime);
    if (entryIdx === undefined || exitIdx === undefined) continue;

    const isProfit = trade.returnPercent >= 0;
    areas.push([
      {
        xAxis: dates[entryIdx],
        itemStyle: {
          color: isProfit ? "rgba(38, 166, 154, 0.06)" : "rgba(239, 83, 80, 0.06)",
        },
      },
      { xAxis: dates[exitIdx] },
    ]);
  }

  return areas;
}

/**
 * Build equity curve data from backtest result
 */
export function buildEquityCurve(
  trades: Trade[],
  capital: number,
  candles: NormalizedCandle[],
): Array<{ time: number; equity: number; date: string }> {
  if (!trades || trades.length === 0) return [];

  const equityData: Array<{ time: number; equity: number; date: string }> = [];

  // Start with initial capital
  const firstTradeTime = trades[0].entryTime;
  const startTime = candles.find((c) => c.time >= firstTradeTime)?.time ?? firstTradeTime;
  equityData.push({ time: startTime, equity: capital, date: formatDate(startTime) });

  let currentEquity = capital;
  for (const trade of trades) {
    currentEquity += trade.return;
    equityData.push({
      time: trade.exitTime,
      equity: currentEquity,
      date: formatDate(trade.exitTime),
    });
  }

  return equityData;
}
