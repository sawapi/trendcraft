/**
 * Incremental VSA (Volume Spread Analysis)
 *
 * Classifies each bar based on the relationship between volume, spread (range),
 * and close position within the bar. Composes ATR (spread normalization) and
 * SMA (volume moving average) sub-indicators.
 *
 * Based on Richard Wyckoff's principles of reading the market through
 * volume and price action.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { SmaState } from "../moving-average/sma";
import { createSma } from "../moving-average/sma";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { makeCandle } from "../utils";
import type { AtrState } from "../volatility/atr";
import { createAtr } from "../volatility/atr";

/** VSA bar classification */
export type VsaBarType =
  | "noSupply"
  | "noDemand"
  | "stoppingVolume"
  | "climacticAction"
  | "test"
  | "upthrust"
  | "spring"
  | "absorption"
  | "effortUp"
  | "effortDown"
  | "normal";

/** VSA analysis result for a single bar */
export type VsaValue = {
  /** Classified bar type */
  barType: VsaBarType;
  /** Spread relative to ATR (1.0 = average) */
  spreadRelative: number;
  /** Close position within bar range (0 = low, 1 = high) */
  closePosition: number;
  /** Volume relative to moving average (1.0 = average) */
  volumeRelative: number;
  /** True when effort (volume) diverges from result (spread) */
  isEffortDivergence: boolean;
};

type CandleEntry = {
  high: number;
  low: number;
  open: number;
  close: number;
};

export type VsaState = {
  atrState: AtrState;
  volumeSmaState: SmaState;
  candleBuffer: ReturnType<CircularBuffer<CandleEntry>["snapshot"]>;
  volumeMaPeriod: number;
  atrPeriod: number;
  highVolumeThreshold: number;
  lowVolumeThreshold: number;
  wideSpreadThreshold: number;
  narrowSpreadThreshold: number;
  count: number;
};

export type VsaOptions = {
  volumeMaPeriod?: number;
  atrPeriod?: number;
  highVolumeThreshold?: number;
  lowVolumeThreshold?: number;
  wideSpreadThreshold?: number;
  narrowSpreadThreshold?: number;
};

const nullValue: VsaValue = {
  barType: "normal",
  spreadRelative: 1,
  closePosition: 0.5,
  volumeRelative: 1,
  isEffortDivergence: false,
};

/**
 * Classify a bar into a VSA bar type.
 * Priority: absorption > stoppingVolume > climactic > upthrust > spring > test > effort > noSupply/noDemand > normal
 */
function classifyBar(
  candle: CandleEntry,
  candleBuffer: CircularBuffer<CandleEntry>,
  bufferIndex: number,
  closePosition: number,
  highVol: boolean,
  lowVol: boolean,
  veryHighVol: boolean,
  wideSpread: boolean,
  narrowSpread: boolean,
  atrVal: number | null,
): VsaBarType {
  // Absorption: high volume squeezed into narrow spread
  if (highVol && narrowSpread) return "absorption";

  // Stopping volume: high volume with close in lower third
  if (highVol && closePosition < 0.33) return "stoppingVolume";

  // Climactic action: extreme volume + wide spread
  if (veryHighVol && wideSpread) return "climacticAction";

  // Upthrust: close below open, high is highest of last 5 bars, close in lower half
  if (candle.close < candle.open && closePosition < 0.5) {
    const lookback = Math.min(5, bufferIndex + 1);
    let isHighest = true;
    for (let j = bufferIndex - lookback + 1; j < bufferIndex; j++) {
      if (j >= 0 && j < candleBuffer.length) {
        if (candleBuffer.get(j).high >= candle.high) {
          isHighest = false;
          break;
        }
      }
    }
    if (isHighest && lookback > 1) return "upthrust";
  }

  // Spring: close above open, low is lowest of last 5 bars, close in upper half
  if (candle.close > candle.open && closePosition > 0.5) {
    const lookback = Math.min(5, bufferIndex + 1);
    let isLowest = true;
    for (let j = bufferIndex - lookback + 1; j < bufferIndex; j++) {
      if (j >= 0 && j < candleBuffer.length) {
        if (candleBuffer.get(j).low <= candle.low) {
          isLowest = false;
          break;
        }
      }
    }
    if (isLowest && lookback > 1) return "spring";
  }

  // Test: low volume near recent low (within ATR of lowest low in last 10 bars)
  if (lowVol && bufferIndex >= 1) {
    const lookback = Math.min(10, bufferIndex);
    let lowestLow = candle.low;
    for (let j = bufferIndex - lookback; j < bufferIndex; j++) {
      if (j >= 0 && j < candleBuffer.length) {
        const entryLow = candleBuffer.get(j).low;
        if (entryLow < lowestLow) lowestLow = entryLow;
      }
    }
    const tolerance = atrVal != null ? atrVal : (candle.high - candle.low) * 2;
    if (Math.abs(candle.low - lowestLow) <= tolerance) return "test";
  }

  // Effort up: high volume + wide spread + close in upper 2/3
  if (highVol && wideSpread && closePosition > 0.67) return "effortUp";

  // Effort down: high volume + wide spread + close in lower 1/3
  if (highVol && wideSpread && closePosition < 0.33) return "effortDown";

  // No supply: narrow spread + low volume + close in upper half
  if (narrowSpread && lowVol && closePosition > 0.5) return "noSupply";

  // No demand: narrow spread + low volume + close in lower half
  if (narrowSpread && lowVol && closePosition <= 0.5) return "noDemand";

  return "normal";
}

/**
 * Create an incremental VSA (Volume Spread Analysis) indicator
 *
 * Classifies each bar based on volume, spread, and close position to identify
 * supply/demand imbalances and potential reversals.
 *
 * @example
 * ```ts
 * const vsaInd = createVsa({ volumeMaPeriod: 20, atrPeriod: 14 });
 * for (const candle of stream) {
 *   const { value } = vsaInd.next(candle);
 *   if (vsaInd.isWarmedUp && value.barType !== 'normal') {
 *     console.log(`VSA signal: ${value.barType}`);
 *   }
 * }
 * ```
 */
export function createVsa(
  options: VsaOptions = {},
  warmUpOptions?: WarmUpOptions<VsaState>,
): IncrementalIndicator<VsaValue, VsaState> {
  const volumeMaPeriod = options.volumeMaPeriod ?? 20;
  const atrPeriod = options.atrPeriod ?? 14;
  const highVolumeThreshold = options.highVolumeThreshold ?? 1.5;
  const lowVolumeThreshold = options.lowVolumeThreshold ?? 0.7;
  const wideSpreadThreshold = options.wideSpreadThreshold ?? 1.2;
  const narrowSpreadThreshold = options.narrowSpreadThreshold ?? 0.7;

  // 10-bar candle buffer for test detection (needs lookback of 10)
  const candleBufferSize = 10;

  let atrIndicator: ReturnType<typeof createAtr>;
  let volumeSma: ReturnType<typeof createSma>;
  let candleBuffer: CircularBuffer<CandleEntry>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    atrIndicator = createAtr({ period: atrPeriod }, { fromState: s.atrState });
    volumeSma = createSma(
      { period: volumeMaPeriod, source: "volume" },
      { fromState: s.volumeSmaState },
    );
    candleBuffer = CircularBuffer.fromSnapshot(s.candleBuffer);
    count = s.count;
  } else {
    atrIndicator = createAtr({ period: atrPeriod });
    volumeSma = createSma({ period: volumeMaPeriod, source: "volume" });
    candleBuffer = new CircularBuffer<CandleEntry>(candleBufferSize);
    count = 0;
  }

  function computeMetrics(
    candle: NormalizedCandle,
    atrVal: number | null,
    volMaVal: number | null,
  ): { spreadRelative: number; closePosition: number; volumeRelative: number } {
    const range = candle.high - candle.low;
    const spreadRelative = atrVal != null && atrVal > 0 ? range / atrVal : 1;
    const closePosition = range > 0 ? (candle.close - candle.low) / range : 0.5;
    const volumeRelative = volMaVal != null && volMaVal > 0 ? candle.volume / volMaVal : 1;
    return { spreadRelative, closePosition, volumeRelative };
  }

  const indicator: IncrementalIndicator<VsaValue, VsaState> = {
    next(candle: NormalizedCandle) {
      count++;

      const atrResult = atrIndicator.next(candle);
      const volMaResult = volumeSma.next(candle);

      const entry: CandleEntry = {
        high: candle.high,
        low: candle.low,
        open: candle.open,
        close: candle.close,
      };
      candleBuffer.push(entry);

      const atrVal = atrResult.value;
      const volMaVal = volMaResult.value;

      const { spreadRelative, closePosition, volumeRelative } = computeMetrics(
        candle,
        atrVal,
        volMaVal,
      );

      const highVol = volumeRelative >= highVolumeThreshold;
      const lowVol = volumeRelative <= lowVolumeThreshold;
      const veryHighVol = volumeRelative >= 2.0;
      const wideSpread = spreadRelative >= wideSpreadThreshold;
      const narrowSpread = spreadRelative <= narrowSpreadThreshold;

      const isEffortDivergence = (highVol && narrowSpread) || (lowVol && wideSpread);

      // bufferIndex is the index of the current candle within the buffer
      const bufferIndex = candleBuffer.length - 1;

      const barType = classifyBar(
        entry,
        candleBuffer,
        bufferIndex,
        closePosition,
        highVol,
        lowVol,
        veryHighVol,
        wideSpread,
        narrowSpread,
        atrVal,
      );

      return {
        time: candle.time,
        value: { barType, spreadRelative, closePosition, volumeRelative, isEffortDivergence },
      };
    },

    peek(candle: NormalizedCandle) {
      const atrVal = atrIndicator.peek(candle).value;
      const volMaVal = volumeSma.peek(candle).value;

      const { spreadRelative, closePosition, volumeRelative } = computeMetrics(
        candle,
        atrVal,
        volMaVal,
      );

      const highVol = volumeRelative >= highVolumeThreshold;
      const lowVol = volumeRelative <= lowVolumeThreshold;
      const veryHighVol = volumeRelative >= 2.0;
      const wideSpread = spreadRelative >= wideSpreadThreshold;
      const narrowSpread = spreadRelative <= narrowSpreadThreshold;

      const isEffortDivergence = (highVol && narrowSpread) || (lowVol && wideSpread);

      // For peek, simulate a candle buffer with the new candle appended
      const entry: CandleEntry = {
        high: candle.high,
        low: candle.low,
        open: candle.open,
        close: candle.close,
      };

      // We can approximate using existing buffer length + 1 for index
      const peekBufIndex = candleBuffer.length;

      // For upthrust/spring/test we need lookback into the buffer.
      // Create a temporary wrapper that includes the peek candle.
      const tempBuf = new CircularBuffer<CandleEntry>(candleBufferSize);
      const startIdx = candleBuffer.isFull ? 1 : 0;
      for (let i = startIdx; i < candleBuffer.length; i++) {
        tempBuf.push(candleBuffer.get(i));
      }
      tempBuf.push(entry);
      const tempBufIndex = tempBuf.length - 1;

      const barType = classifyBar(
        entry,
        tempBuf,
        tempBufIndex,
        closePosition,
        highVol,
        lowVol,
        veryHighVol,
        wideSpread,
        narrowSpread,
        atrVal,
      );

      return {
        time: candle.time,
        value: { barType, spreadRelative, closePosition, volumeRelative, isEffortDivergence },
      };
    },

    getState(): VsaState {
      return {
        atrState: atrIndicator.getState(),
        volumeSmaState: volumeSma.getState(),
        candleBuffer: candleBuffer.snapshot(),
        volumeMaPeriod,
        atrPeriod,
        highVolumeThreshold,
        lowVolumeThreshold,
        wideSpreadThreshold,
        narrowSpreadThreshold,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return atrIndicator.isWarmedUp && volumeSma.isWarmedUp;
    },
  };

  // Warm up with historical data
  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
