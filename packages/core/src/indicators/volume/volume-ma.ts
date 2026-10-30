/**
 * Volume Moving Average indicator
 */

import { ensureNormalized } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { assertOneOf, keywords } from "../../utils/validate-keyword";
import { assertPeriod } from "../../utils/validate-period";
import { VOLUME_MA_META } from "../indicator-meta";

const MA_TYPES = keywords<NonNullable<VolumeMaOptions["type"]>>()(["sma", "ema"]);

/**
 * Options for Volume MA calculation
 */
export type VolumeMaOptions = {
  period: number;
  type?: "sma" | "ema";
};

/**
 * Calculate Volume Moving Average
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Volume MA options (period, type='sma')
 * @returns Series of Volume MA values
 *
 * @example
 * ```ts
 * const vma20 = volumeMa(candles, { period: 20 });
 * const vmaEma = volumeMa(candles, { period: 20, type: 'ema' });
 * ```
 */
export function volumeMa(
  candles: Candle[] | NormalizedCandle[],
  options: VolumeMaOptions,
): Series<number | null> {
  const { period, type = "sma" } = options;

  assertPeriod("Volume MA period", period);
  assertOneOf("Volume MA type", type, MA_TYPES);

  // Normalize if needed
  const normalized = ensureNormalized(candles);
  const meta = withLabelParams(VOLUME_MA_META, [period, type === "ema" ? "EMA" : undefined]);

  if (normalized.length === 0) {
    return tagSeries([], meta);
  }

  if (type === "ema") {
    return tagSeries(calculateVolumeEma(normalized, period), meta);
  }

  return tagSeries(calculateVolumeSma(normalized, period), meta);
}

/**
 * Calculate Volume SMA
 */
function calculateVolumeSma(candles: NormalizedCandle[], period: number): Series<number | null> {
  const result: Series<number | null> = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push({ time: candles[i].time, value: null });
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[i - j].volume;
      }
      result.push({ time: candles[i].time, value: sum / period });
    }
  }

  return result;
}

/**
 * Calculate Volume EMA
 */
function calculateVolumeEma(candles: NormalizedCandle[], period: number): Series<number | null> {
  const result: Series<number | null> = [];
  const multiplier = 2 / (period + 1);

  let prevEma: number | null = null;

  for (let i = 0; i < candles.length; i++) {
    const volume = candles[i].volume;

    if (i < period - 1) {
      result.push({ time: candles[i].time, value: null });
    } else if (i === period - 1) {
      // First EMA is SMA
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[j].volume;
      }
      prevEma = sum / period;
      result.push({ time: candles[i].time, value: prevEma });
    } else {
      prevEma = volume * multiplier + (prevEma ?? 0) * (1 - multiplier);
      result.push({ time: candles[i].time, value: prevEma });
    }
  }

  return result;
}
