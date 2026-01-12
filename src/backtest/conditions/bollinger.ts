/**
 * Bollinger Bands conditions
 */

import { bollingerBands } from "../../indicators/volatility/bollinger-bands";
import type { PresetCondition } from "../../types";

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
  const key = `bb${period}`;

  return {
    type: "preset",
    name: `bollingerBreakout('${band}')`,
    evaluate: (indicators, candle, index, candles) => {
      let bbData = indicators[key] as
        | { time: number; value: { upper: number | null; lower: number | null } }[]
        | undefined;

      if (!bbData) {
        bbData = bollingerBands(candles, { period, stdDev });
        indicators[key] = bbData;
      }

      const bb = bbData[index]?.value;
      if (!bb) return false;

      if (band === "upper") {
        return bb.upper !== null && candle.close > bb.upper;
      }
      return bb.lower !== null && candle.close < bb.lower;
    },
  };
}

/**
 * Price touches Bollinger Band (within band, touching edge)
 * @param band 'upper' or 'lower'
 */
export function bollingerTouch(band: "upper" | "lower", period = 20, stdDev = 2): PresetCondition {
  const key = `bb${period}`;

  return {
    type: "preset",
    name: `bollingerTouch('${band}')`,
    evaluate: (indicators, candle, index, candles) => {
      let bbData = indicators[key] as
        | {
            time: number;
            value: { upper: number | null; lower: number | null; middle: number | null };
          }[]
        | undefined;

      if (!bbData) {
        bbData = bollingerBands(candles, { period, stdDev });
        indicators[key] = bbData;
      }

      const bb = bbData[index]?.value;
      if (!bb || bb.upper === null || bb.lower === null || bb.middle === null) return false;

      const bandWidth = bb.upper - bb.lower;
      const tolerance = bandWidth * 0.02; // 2% tolerance

      if (band === "upper") {
        return candle.high >= bb.upper - tolerance && candle.close <= bb.upper;
      }
      return candle.low <= bb.lower + tolerance && candle.close >= bb.lower;
    },
  };
}
