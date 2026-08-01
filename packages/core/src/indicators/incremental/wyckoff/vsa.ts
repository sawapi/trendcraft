/**
 * Incremental VSA (Volume Spread Analysis)
 *
 * Classifies each bar based on the relationship between volume, spread (range),
 * and close position within the bar. Composes ATR (spread normalization) and
 * SMA (volume moving average) sub-indicators.
 *
 * Based on Richard Wyckoff's principles of reading the market through
 * volume and price action.
 *
 * State category: **Mixed** (an inner recursive ATR snapshot and an
 * inner windowed SMA snapshot composed with an own 11-bar candle
 * buffer — the current bar plus the 10 previous bars the 'test' rule
 * scans). `volumeMaPeriod` / `atrPeriod` shape the inner indicators
 * and are refused on resume. The four threshold params
 * (`highVolumeThreshold`, `lowVolumeThreshold`, `wideSpreadThreshold`,
 * `narrowSpreadThreshold`) are **resume-invariant** — they only
 * classify already-computed spread / volume ratios and never touch
 * state, so changing them on resume is mathematically safe.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { SmaState } from "../moving-average/sma";
import { createSma } from "../moving-average/sma";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";
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

/**
 * Bare state shape for VSA. Params (`volumeMaPeriod`, `atrPeriod`,
 * threshold params) live in `meta.params`; the inner ATR / SMA
 * snapshots are themselves `IndicatorSnapshot`s.
 */
export type VsaState = {
  atrState: IndicatorSnapshot<AtrState>;
  volumeSmaState: IndicatorSnapshot<SmaState>;
  candleBuffer: ReturnType<CircularBuffer<CandleEntry>["snapshot"]>;
  count: number;
};

/**
 * Per-indicator schema version. Bumped on any breaking state change.
 *
 * v2: candle buffer capacity grew from 10 to 11 (current bar + the 10
 * previous bars the 'test' rule scans). A v1 snapshot's buffer holds
 * only 10 bars, which perpetuates the 9-previous-bar window the fix
 * removed, so v1 snapshots are refused with a re-warm error.
 */
export const VSA_VERSION = 2;

type VsaParams = {
  volumeMaPeriod: number;
  atrPeriod: number;
  highVolumeThreshold: number;
  lowVolumeThreshold: number;
  wideSpreadThreshold: number;
  narrowSpreadThreshold: number;
};

export type VsaOptions = {
  volumeMaPeriod?: number;
  atrPeriod?: number;
  highVolumeThreshold?: number;
  lowVolumeThreshold?: number;
  wideSpreadThreshold?: number;
  narrowSpreadThreshold?: number;
};

const _nullValue: VsaValue = {
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

  // Stopping volume: high-volume down bar after a decline (low is the lowest of
  // the last 5 bars) whose result is dampened — it closes off its lows (upper
  // 2/3 of the range) or fails to produce a wide spread despite the volume
  // surge. Demand stepping in to absorb supply at a potential bottom.
  // A wide-spread bar closing near its lows is NOT stopping volume — that is
  // effort to fall (effortDown) or, at extreme volume, climacticAction.
  if (highVol && candle.close < candle.open && (closePosition >= 0.33 || !wideSpread)) {
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
    if (isLowest && lookback > 1) return "stoppingVolume";
  }

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

  // Effort down (effort to fall): high volume + wide spread + close in lower 1/3
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<VsaState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<VsaValue, IndicatorSnapshot<VsaState>> {
  const { params, state } = resolveResume<VsaParams, VsaState>({
    indicator: "vsa",
    version: VSA_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: {
      volumeMaPeriod: 20,
      atrPeriod: 14,
      highVolumeThreshold: 1.5,
      lowVolumeThreshold: 0.7,
      wideSpreadThreshold: 1.2,
      narrowSpreadThreshold: 0.7,
    },
    resumeInvariantParams: [
      "highVolumeThreshold",
      "lowVolumeThreshold",
      "wideSpreadThreshold",
      "narrowSpreadThreshold",
    ],
  });

  const volumeMaPeriod = params.volumeMaPeriod;
  const atrPeriod = params.atrPeriod;
  const highVolumeThreshold = params.highVolumeThreshold;
  const lowVolumeThreshold = params.lowVolumeThreshold;
  const wideSpreadThreshold = params.wideSpreadThreshold;
  const narrowSpreadThreshold = params.narrowSpreadThreshold;

  // The 'test' rule scans the 10 bars BEFORE the current one, and the
  // current bar is pushed before classification, so the buffer must
  // hold 11 entries. At 10, the push evicted the bar exactly 10 back
  // and the rule saw only 9 previous bars (batch scans i-10..i-1).
  const candleBufferSize = 11;

  let atrIndicator: ReturnType<typeof createAtr>;
  let volumeSma: ReturnType<typeof createSma>;
  let candleBuffer: CircularBuffer<CandleEntry>;
  let count: number;

  if (state !== null) {
    atrIndicator = createAtr({ period: atrPeriod }, { fromState: state.atrState });
    volumeSma = createSma(
      { period: volumeMaPeriod, source: "volume" },
      { fromState: state.volumeSmaState },
    );
    candleBuffer = CircularBuffer.fromSnapshot(state.candleBuffer);
    count = state.count;
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

  const indicator: IncrementalIndicator<VsaValue, IndicatorSnapshot<VsaState>> = {
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
      const _peekBufIndex = candleBuffer.length;

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

    getState(): IndicatorSnapshot<VsaState> {
      return makeSnapshot(
        "vsa",
        VSA_VERSION,
        {
          volumeMaPeriod,
          atrPeriod,
          highVolumeThreshold,
          lowVolumeThreshold,
          wideSpreadThreshold,
          narrowSpreadThreshold,
        },
        {
          atrState: atrIndicator.getState(),
          volumeSmaState: volumeSma.getState(),
          candleBuffer: candleBuffer.snapshot(),
          count,
        },
      );
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
