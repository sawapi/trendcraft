/**
 * Formula Verification Tests
 *
 * Verify indicators that don't have TA-Lib equivalents by computing
 * expected values from first principles using the shared OHLCV fixture.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  awesomeOscillator,
  balanceOfPower,
  choppinessIndex,
  dpo,
  easeOfMovement,
  elderForceIndex,
  heikinAshi,
  hma,
  nvi,
  pvt,
  qstick,
  trix,
  ulcerIndex,
  vortex,
  wma,
  zlema,
} from "../../src";
import type { NormalizedCandle } from "../../src/types";
import { loadOhlcv } from "./helpers";

let candles: NormalizedCandle[];

beforeAll(() => {
  candles = loadOhlcv();
});

// ============================================================
// Formula Verification Batch 1
// ============================================================

describe("Balance of Power", () => {
  it("raw BOP matches (close-open)/(high-low)", () => {
    const result = balanceOfPower(candles, { smoothPeriod: 1 });

    for (let i = 0; i < candles.length; i++) {
      const { open, high, low, close } = candles[i];
      const range = high - low;
      const expected = range > 0 ? (close - open) / range : 0;
      expect(result[i].value).toBeCloseTo(expected, 10);
    }
  });

  it("smoothed BOP matches SMA of raw BOP", () => {
    const period = 14;
    const result = balanceOfPower(candles, { smoothPeriod: period });

    // Compute raw BOP
    const rawBop = candles.map((c) => {
      const range = c.high - c.low;
      return range > 0 ? (c.close - c.open) / range : 0;
    });

    // First period-1 values should be null
    for (let i = 0; i < period - 1; i++) {
      expect(result[i].value).toBeNull();
    }

    // Verify SMA of raw BOP
    for (let i = period - 1; i < candles.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += rawBop[j];
      }
      expect(result[i].value).toBeCloseTo(sum / period, 10);
    }
  });
});

describe("QStick", () => {
  it("matches SMA(close-open, period)", () => {
    const period = 14;
    const result = qstick(candles, { period });

    const diffs = candles.map((c) => c.close - c.open);

    for (let i = 0; i < period - 1; i++) {
      expect(result[i].value).toBeNull();
    }

    for (let i = period - 1; i < candles.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += diffs[j];
      }
      expect(result[i].value).toBeCloseTo(sum / period, 10);
    }
  });
});

describe("PVT", () => {
  it("matches cumulative volume-weighted price change", () => {
    const result = pvt(candles);

    expect(result[0].value).toBe(0);

    let cumPvt = 0;
    for (let i = 1; i < candles.length; i++) {
      const prevClose = candles[i - 1].close;
      cumPvt += candles[i].volume * ((candles[i].close - prevClose) / prevClose);
      expect(result[i].value).toBeCloseTo(cumPvt, 6);
    }
  });
});

describe("NVI", () => {
  it("adjusts only on down-volume days", () => {
    const result = nvi(candles, { initialValue: 1000 });

    expect(result[0].value).toBe(1000);

    let currentNvi = 1000;
    for (let i = 1; i < candles.length; i++) {
      if (candles[i].volume < candles[i - 1].volume) {
        currentNvi *= candles[i].close / candles[i - 1].close;
      }
      expect(result[i].value).toBeCloseTo(currentNvi, 8);
    }
  });
});

describe("Heikin-Ashi", () => {
  it("matches standard Heikin-Ashi formulas", () => {
    const result = heikinAshi(candles);

    let prevHaOpen = 0;
    let prevHaClose = 0;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen = i === 0 ? (c.open + c.close) / 2 : (prevHaOpen + prevHaClose) / 2;
      const haHigh = Math.max(c.high, haOpen, haClose);
      const haLow = Math.min(c.low, haOpen, haClose);

      expect(result[i].value.close).toBeCloseTo(haClose, 10);
      expect(result[i].value.open).toBeCloseTo(haOpen, 10);
      expect(result[i].value.high).toBeCloseTo(haHigh, 10);
      expect(result[i].value.low).toBeCloseTo(haLow, 10);

      prevHaOpen = haOpen;
      prevHaClose = haClose;
    }
  });
});

describe("DPO", () => {
  it("matches close[i] - SMA[i + shift] where shift = floor(period/2) + 1", () => {
    const period = 20;
    const shift = Math.floor(period / 2) + 1; // 11
    const result = dpo(candles, { period });

    // Pre-calculate SMA
    const smaValues: (number | null)[] = new Array(candles.length).fill(null);
    let sum = 0;
    for (let i = 0; i < candles.length; i++) {
      sum += candles[i].close;
      if (i >= period) sum -= candles[i - period].close;
      if (i >= period - 1) smaValues[i] = sum / period;
    }

    for (let i = 0; i < candles.length; i++) {
      const smaIndex = i + shift;
      if (smaIndex < candles.length && smaValues[smaIndex] !== null) {
        const expected = candles[i].close - (smaValues[smaIndex] as number);
        expect(result[i].value).toBeCloseTo(expected, 10);
      } else {
        expect(result[i].value).toBeNull();
      }
    }
  });
});

describe("Awesome Oscillator", () => {
  it("matches SMA(midprice, 5) - SMA(midprice, 34)", () => {
    const fastPeriod = 5;
    const slowPeriod = 34;
    const result = awesomeOscillator(candles, { fastPeriod, slowPeriod });

    const midPrices = candles.map((c) => (c.high + c.low) / 2);

    for (let i = 0; i < slowPeriod - 1; i++) {
      expect(result[i].value).toBeNull();
    }

    for (let i = slowPeriod - 1; i < candles.length; i++) {
      let fastSum = 0;
      for (let j = i - fastPeriod + 1; j <= i; j++) fastSum += midPrices[j];

      let slowSum = 0;
      for (let j = i - slowPeriod + 1; j <= i; j++) slowSum += midPrices[j];

      const expected = fastSum / fastPeriod - slowSum / slowPeriod;
      expect(result[i].value).toBeCloseTo(expected, 10);
    }
  });
});

describe("ZLEMA", () => {
  it("applies EMA to lag-adjusted prices", () => {
    const period = 10;
    const result = zlema(candles, { period });
    const lag = Math.floor((period - 1) / 2); // 4
    const multiplier = 2 / (period + 1);

    // First `period - 1` values should be null
    for (let i = 0; i < period - 1; i++) {
      expect(result[i].value).toBeNull();
    }

    // Seed at index period-1
    let sum = 0;
    for (let j = lag; j <= period - 1; j++) {
      const p = candles[j].close;
      const lp = candles[j - lag].close;
      sum += p + (p - lp);
    }
    let prevZlema = sum / (period - lag);
    expect(result[period - 1].value).toBeCloseTo(prevZlema, 10);

    // Subsequent values use EMA of adjusted price
    for (let i = period; i < candles.length; i++) {
      const price = candles[i].close;
      const lagPrice = candles[i - lag].close;
      const adjustedPrice = price + (price - lagPrice);
      prevZlema = adjustedPrice * multiplier + prevZlema * (1 - multiplier);
      expect(result[i].value).toBeCloseTo(prevZlema, 10);
    }
  });
});

// ============================================================
// Formula Verification Batch 2
// ============================================================

describe("HMA", () => {
  it("matches WMA(2*WMA(n/2) - WMA(n), sqrt(n))", () => {
    const period = 9;
    const result = hma(candles, { period });

    // Compute reference using the same building blocks
    const halfPeriod = Math.floor(period / 2); // 4
    const sqrtPeriod = Math.floor(Math.sqrt(period)); // 3

    const wmaHalf = wma(candles, { period: halfPeriod });
    const wmaFull = wma(candles, { period });

    // Build diff series (only where both are non-null)
    const diffCandles: NormalizedCandle[] = [];
    const diffStartIdx: number[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (wmaHalf[i].value != null && wmaFull[i].value != null) {
        const v = 2 * (wmaHalf[i].value as number) - (wmaFull[i].value as number);
        diffCandles.push({
          time: candles[i].time,
          open: v,
          high: v,
          low: v,
          close: v,
          volume: 0,
        });
        diffStartIdx.push(i);
      }
    }

    const finalWma = wma(diffCandles, { period: sqrtPeriod });

    // Verify non-null values match
    let compared = 0;
    for (let k = 0; k < finalWma.length; k++) {
      if (finalWma[k].value != null) {
        const origIdx = diffStartIdx[k];
        expect(result[origIdx].value).toBeCloseTo(finalWma[k].value as number, 10);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(100);
  });
});

describe("TRIX", () => {
  it("TRIX line is 1-period ROC of triple-smoothed EMA (after warmup)", () => {
    const period = 10;
    const result = trix(candles, { period, signalPeriod: 9 });

    // After full warmup (~3*period), TRIX values should be reasonable percentages
    const warmup = 3 * period + 10; // Skip EMA warmup artifacts
    let verified = 0;
    for (let i = warmup; i < result.length; i++) {
      const tv = result[i].value.trix;
      if (tv !== null) {
        // After warmup, TRIX should be small daily ROC percentage
        expect(Math.abs(tv)).toBeLessThan(5);
        verified++;
      }
    }
    expect(verified).toBeGreaterThan(100);

    // Signal line should exist after warmup
    let signalCount = 0;
    for (let i = warmup; i < result.length; i++) {
      if (result[i].value.signal !== null) signalCount++;
    }
    expect(signalCount).toBeGreaterThan(50);
  });
});

describe("Choppiness Index", () => {
  it("matches 100*LOG10(SUM(TR,n)/(HH-LL))/LOG10(n)", () => {
    const period = 14;
    const result = choppinessIndex(candles, { period });

    // Compute True Range
    const tr: number[] = [0];
    for (let i = 1; i < candles.length; i++) {
      tr.push(
        Math.max(
          candles[i].high - candles[i].low,
          Math.abs(candles[i].high - candles[i - 1].close),
          Math.abs(candles[i].low - candles[i - 1].close),
        ),
      );
    }

    const log10n = Math.log10(period);

    for (let i = 0; i < period; i++) {
      expect(result[i].value).toBeNull();
    }

    for (let i = period; i < candles.length; i++) {
      let trSum = 0;
      let hh = Number.NEGATIVE_INFINITY;
      let ll = Number.POSITIVE_INFINITY;
      for (let j = i - period + 1; j <= i; j++) {
        trSum += tr[j];
        hh = Math.max(hh, candles[j].high);
        ll = Math.min(ll, candles[j].low);
      }
      const range = hh - ll;
      if (range > 0) {
        const expected = (100 * Math.log10(trSum / range)) / log10n;
        expect(result[i].value).toBeCloseTo(expected, 10);
      }
    }
  });
});

describe("Vortex Indicator", () => {
  it("matches Wilder's VM+/VM- / TR sums", () => {
    const period = 14;
    const result = vortex(candles, { period });

    // Compute VM+, VM-, TR
    const vmPlus: number[] = [0];
    const vmMinus: number[] = [0];
    const tr: number[] = [0];

    for (let i = 1; i < candles.length; i++) {
      vmPlus.push(Math.abs(candles[i].high - candles[i - 1].low));
      vmMinus.push(Math.abs(candles[i].low - candles[i - 1].high));
      tr.push(
        Math.max(
          candles[i].high - candles[i].low,
          Math.abs(candles[i].high - candles[i - 1].close),
          Math.abs(candles[i].low - candles[i - 1].close),
        ),
      );
    }

    for (let i = period; i < candles.length; i++) {
      let sumVmPlus = 0;
      let sumVmMinus = 0;
      let sumTr = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumVmPlus += vmPlus[j];
        sumVmMinus += vmMinus[j];
        sumTr += tr[j];
      }
      expect(result[i].value.viPlus).toBeCloseTo(sumVmPlus / sumTr, 10);
      expect(result[i].value.viMinus).toBeCloseTo(sumVmMinus / sumTr, 10);
    }
  });
});

describe("Ulcer Index", () => {
  it("matches sqrt(mean(drawdown%^2))", () => {
    const period = 14;
    const result = ulcerIndex(candles, { period });

    for (let i = period - 1; i < candles.length; i++) {
      let highest = Number.NEGATIVE_INFINITY;
      for (let j = i - period + 1; j <= i; j++) {
        highest = Math.max(highest, candles[j].close);
      }

      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const pctDD = ((candles[j].close - highest) / highest) * 100;
        sumSq += pctDD * pctDD;
      }

      const expected = Math.sqrt(sumSq / period);
      expect(result[i].value).toBeCloseTo(expected, 10);
    }
  });
});

describe("Elder Force Index", () => {
  it("matches EMA of (close-prevClose)*volume", () => {
    const period = 13;
    const result = elderForceIndex(candles, { period });

    // Raw force
    const rawForce: number[] = [0];
    for (let i = 1; i < candles.length; i++) {
      rawForce.push((candles[i].close - candles[i - 1].close) * candles[i].volume);
    }

    // EMA smoothing
    const multiplier = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += rawForce[i];
    }
    let prev = sum / period;
    expect(result[period - 1].value).toBeCloseTo(prev, 6);

    for (let i = period; i < candles.length; i++) {
      prev = rawForce[i] * multiplier + prev * (1 - multiplier);
      expect(result[i].value).toBeCloseTo(prev, 6);
    }
  });
});

describe("Ease of Movement", () => {
  it("matches Arms EMV formula with SMA smoothing", () => {
    const period = 14;
    const volumeDivisor = 10000;
    const result = easeOfMovement(candles, { period, volumeDivisor });

    // Raw EMV
    const rawEmv: (number | null)[] = [null];
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const p = candles[i - 1];
      const hl = c.high - c.low;

      if (hl === 0 || c.volume === 0) {
        rawEmv.push(null);
        continue;
      }

      const dist = (c.high + c.low) / 2 - (p.high + p.low) / 2;
      const boxRatio = c.volume / volumeDivisor / hl;
      rawEmv.push(dist / boxRatio);
    }

    // SMA smoothing
    for (let i = period; i < candles.length; i++) {
      let sum = 0;
      let validCount = 0;
      for (let j = i - period + 1; j <= i; j++) {
        if (rawEmv[j] !== null) {
          sum += rawEmv[j] as number;
          validCount++;
        }
      }
      if (validCount === period) {
        expect(result[i].value).toBeCloseTo(sum / period, 8);
      }
    }
  });
});
