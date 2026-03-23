/**
 * Simple indicator implementations for the demo.
 * In production, use `import { sma, rsi, macd, bollingerBands } from 'trendcraft'` instead.
 */

import type { CandleData, DataPoint } from "@trendcraft/chart";

export function computeSMA(candles: CandleData[], period: number): DataPoint<number | null>[] {
  const result: DataPoint<number | null>[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push({ time: candles[i].time, value: null });
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    result.push({ time: candles[i].time, value: sum / period });
  }
  return result;
}

function computeEMA(candles: CandleData[], period: number): DataPoint<number | null>[] {
  const result: DataPoint<number | null>[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push({ time: candles[i].time, value: null });
      continue;
    }
    if (ema === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
      ema = sum / period;
    } else {
      ema = candles[i].close * k + ema * (1 - k);
    }
    result.push({ time: candles[i].time, value: ema });
  }
  return result;
}

export function computeRSI(candles: CandleData[], period = 14): DataPoint<number | null>[] {
  const result: DataPoint<number | null>[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      result.push({ time: candles[i].time, value: null });
      continue;
    }
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push({ time: candles[i].time, value: 100 - 100 / (1 + rs) });
      } else {
        result.push({ time: candles[i].time, value: null });
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push({ time: candles[i].time, value: 100 - 100 / (1 + rs) });
    }
  }
  return result;
}

type MacdValue = { macd: number | null; signal: number | null; histogram: number | null };

export function computeMACD(candles: CandleData[]): DataPoint<MacdValue>[] {
  const ema12 = computeEMA(candles, 12);
  const ema26 = computeEMA(candles, 26);
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    const e12 = ema12[i]?.value;
    const e26 = ema26[i]?.value;
    macdLine.push(e12 != null && e26 != null ? e12 - e26 : null);
  }
  const signalPeriod = 9;
  const k = 2 / (signalPeriod + 1);
  let signalEma: number | null = null;
  let count = 0;
  const result: DataPoint<MacdValue>[] = [];
  for (let i = 0; i < candles.length; i++) {
    const m = macdLine[i];
    if (m === null) {
      result.push({ time: candles[i].time, value: { macd: null, signal: null, histogram: null } });
      continue;
    }
    if (signalEma === null) {
      count++;
      if (count < signalPeriod) {
        result.push({ time: candles[i].time, value: { macd: m, signal: null, histogram: null } });
        continue;
      }
      let sum = 0;
      let cnt = 0;
      for (let j = 0; j <= i; j++) {
        if (macdLine[j] !== null) {
          sum += macdLine[j] as number;
          cnt++;
          if (cnt === signalPeriod) break;
        }
      }
      signalEma = sum / signalPeriod;
    } else {
      signalEma = m * k + signalEma * (1 - k);
    }
    result.push({
      time: candles[i].time,
      value: { macd: m, signal: signalEma, histogram: m - signalEma },
    });
  }
  return result;
}

type BbValue = { upper: number | null; middle: number | null; lower: number | null };

export function computeBB(candles: CandleData[], period = 20, mult = 2): DataPoint<BbValue>[] {
  const sma = computeSMA(candles, period);
  const result: DataPoint<BbValue>[] = [];
  for (let i = 0; i < candles.length; i++) {
    const m = sma[i]?.value;
    if (m === null || m === undefined) {
      result.push({ time: candles[i].time, value: { upper: null, middle: null, lower: null } });
      continue;
    }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = candles[j].close - m;
      sumSq += diff * diff;
    }
    const std = Math.sqrt(sumSq / period);
    result.push({
      time: candles[i].time,
      value: { upper: m + mult * std, middle: m, lower: m - mult * std },
    });
  }
  return result;
}
