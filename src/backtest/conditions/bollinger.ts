/**
 * Bollinger Bands conditions
 */

import { bollingerBands } from "../../indicators/volatility/bollinger-bands";
import type { NormalizedCandle, PresetCondition } from "../../types";

type BBData = {
  time: number;
  value: { upper: number | null; lower: number | null; middle: number | null };
}[];

/**
 * Get or calculate Bollinger Bands data with caching
 */
function getBBData(
  indicators: Record<string, unknown>,
  candles: NormalizedCandle[],
  period: number,
  stdDev: number,
): BBData {
  const key = `bb${period}`;
  let bbData = indicators[key] as BBData | undefined;

  if (!bbData) {
    bbData = bollingerBands(candles, { period, stdDev });
    indicators[key] = bbData;
  }

  return bbData;
}

// ============================================
// Bollinger Bands Conditions
// ============================================

/**
 * Price breaks out of Bollinger Band
 * @param band 'upper' or 'lower'
 */
export function bollingerBreakout(
  band: "upper" | "lower",
  period = 20,
  stdDev = 2,
): PresetCondition {
  return {
    type: "preset",
    name: `bollingerBreakout('${band}')`,
    evaluate: (indicators, candle, index, candles) => {
      const bbData = getBBData(indicators, candles, period, stdDev);
      const bb = bbData[index]?.value;
      if (!bb) return false;

      return band === "upper"
        ? bb.upper !== null && candle.close > bb.upper
        : bb.lower !== null && candle.close < bb.lower;
    },
  };
}

/**
 * Price touches Bollinger Band (within band, touching edge)
 * @param band 'upper' or 'lower'
 */
export function bollingerTouch(band: "upper" | "lower", period = 20, stdDev = 2): PresetCondition {
  return {
    type: "preset",
    name: `bollingerTouch('${band}')`,
    evaluate: (indicators, candle, index, candles) => {
      const bbData = getBBData(indicators, candles, period, stdDev);
      const bb = bbData[index]?.value;
      if (!bb || bb.upper === null || bb.lower === null || bb.middle === null) return false;

      const bandWidth = bb.upper - bb.lower;
      const tolerance = bandWidth * 0.02; // 2% tolerance

      return band === "upper"
        ? candle.high >= bb.upper - tolerance && candle.close <= bb.upper
        : candle.low <= bb.lower + tolerance && candle.close >= bb.lower;
    },
  };
}
