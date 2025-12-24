/**
 * MACD conditions
 */

import { macd } from "../../indicators/momentum/macd";
import type { PresetCondition } from "../../types";

// ============================================
// MACD Conditions
// ============================================

/**
 * MACD line crosses above signal line
 */
export function macdCrossUp(fast = 12, slow = 26, signal = 9): PresetCondition {
  const key = `macd_${fast}_${slow}_${signal}`;

  return {
    type: "preset",
    name: "macdCrossUp()",
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let macdData = indicators[key] as
        | { time: number; value: { macd: number | null; signal: number | null } }[]
        | undefined;

      if (!macdData) {
        macdData = macd(candles, { fastPeriod: fast, slowPeriod: slow, signalPeriod: signal });
        indicators[key] = macdData;
      }

      const curr = macdData[index]?.value;
      const prev = macdData[index - 1]?.value;

      if (
        !curr ||
        !prev ||
        curr.macd === null ||
        curr.signal === null ||
        prev.macd === null ||
        prev.signal === null
      ) {
        return false;
      }

      return prev.macd <= prev.signal && curr.macd > curr.signal;
    },
  };
}

/**
 * MACD line crosses below signal line
 */
export function macdCrossDown(fast = 12, slow = 26, signal = 9): PresetCondition {
  const key = `macd_${fast}_${slow}_${signal}`;

  return {
    type: "preset",
    name: "macdCrossDown()",
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let macdData = indicators[key] as
        | { time: number; value: { macd: number | null; signal: number | null } }[]
        | undefined;

      if (!macdData) {
        macdData = macd(candles, { fastPeriod: fast, slowPeriod: slow, signalPeriod: signal });
        indicators[key] = macdData;
      }

      const curr = macdData[index]?.value;
      const prev = macdData[index - 1]?.value;

      if (
        !curr ||
        !prev ||
        curr.macd === null ||
        curr.signal === null ||
        prev.macd === null ||
        prev.signal === null
      ) {
        return false;
      }

      return prev.macd >= prev.signal && curr.macd < curr.signal;
    },
  };
}
