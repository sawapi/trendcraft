/**
 * Convert daily candles to higher timeframes (weekly, monthly)
 */
import type { NormalizedCandle } from "trendcraft";

export type Timeframe = "daily" | "weekly" | "monthly";

function getWeekKey(time: number): string {
  const d = new Date(time);
  // ISO week: Monday-based
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${weekNum}`;
}

function getMonthKey(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function convertTimeframe(
  candles: NormalizedCandle[],
  timeframe: Timeframe,
): NormalizedCandle[] {
  if (timeframe === "daily") return candles;

  const keyFn = timeframe === "weekly" ? getWeekKey : getMonthKey;
  const groups = new Map<string, NormalizedCandle[]>();

  for (const c of candles) {
    const key = keyFn(c.time);
    const group = groups.get(key);
    if (group) {
      group.push(c);
    } else {
      groups.set(key, [c]);
    }
  }

  const result: NormalizedCandle[] = [];
  for (const group of groups.values()) {
    if (group.length === 0) continue;
    result.push({
      time: group[0].time, // First day of the period
      open: group[0].open,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, c) => sum + c.volume, 0),
    });
  }

  return result;
}
