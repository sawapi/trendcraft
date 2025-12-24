/**
 * Volume conditions
 */

import { volumeMa } from "../../indicators/volume/volume-ma";
import type { PresetCondition } from "../../types";

// ============================================
// Volume Conditions
// ============================================

/**
 * Volume above average (strong volume)
 * @param multiplier How many times the average (default: 1.5)
 */
export function volumeAboveAvg(multiplier = 1.5, period = 20): PresetCondition {
  const cacheKey = `volMa_${period}`;

  return {
    type: "preset",
    name: `volumeAboveAvg(${multiplier}x)`,
    evaluate: (indicators, candle, index, candles) => {
      let volMaData = indicators[cacheKey] as { time: number; value: number | null }[] | undefined;

      if (!volMaData) {
        volMaData = volumeMa(candles, { period });
        indicators[cacheKey] = volMaData;
      }

      const avgVol = volMaData[index]?.value;
      if (avgVol === null || avgVol === undefined) return false;

      return candle.volume > avgVol * multiplier;
    },
  };
}
