/**
 * Hook for calculating overlay indicators (displayed on main chart)
 */

import { useMemo } from "react";
import type {
  NormalizedCandle,
  BollingerBandsValue,
  DonchianValue,
  KeltnerChannelValue,
  IchimokuValue,
  SupertrendValue,
  ParabolicSarValue,
} from "trendcraft";
import {
  sma,
  ema,
  wma,
  bollingerBands,
  donchianChannel,
  keltnerChannel,
  ichimoku,
  supertrend,
  parabolicSar,
} from "trendcraft";
import type { OverlayType } from "../types";
import { useChartStore } from "../store/chartStore";

/**
 * Overlay indicator data structure
 */
export interface OverlayData {
  // Moving Averages
  sma5?: (number | null)[];
  sma25?: (number | null)[];
  sma75?: (number | null)[];
  ema12?: (number | null)[];
  ema26?: (number | null)[];
  wma20?: (number | null)[];
  // Bands/Channels
  bb?: BollingerBandsValue[];
  donchian?: DonchianValue[];
  keltner?: KeltnerChannelValue[];
  // Trend
  ichimoku?: IchimokuValue[];
  supertrend?: SupertrendValue[];
  psar?: ParabolicSarValue[];
}

/**
 * Calculate overlay indicators based on candles and enabled overlays
 */
export function useOverlays(
  candles: NormalizedCandle[],
  enabledOverlays: OverlayType[]
): OverlayData {
  const indicatorParams = useChartStore((s) => s.indicatorParams);

  return useMemo(() => {
    if (candles.length === 0) {
      return {};
    }

    const data: OverlayData = {};
    const p = indicatorParams;

    // SMA 5
    if (enabledOverlays.includes("sma5")) {
      const series = sma(candles, { period: p.sma5Period });
      data.sma5 = series.map((s) => s.value);
    }

    // SMA 25
    if (enabledOverlays.includes("sma25")) {
      const series = sma(candles, { period: p.sma25Period });
      data.sma25 = series.map((s) => s.value);
    }

    // SMA 75
    if (enabledOverlays.includes("sma75")) {
      const series = sma(candles, { period: p.sma75Period });
      data.sma75 = series.map((s) => s.value);
    }

    // EMA 12
    if (enabledOverlays.includes("ema12")) {
      const series = ema(candles, { period: p.ema12Period });
      data.ema12 = series.map((s) => s.value);
    }

    // EMA 26
    if (enabledOverlays.includes("ema26")) {
      const series = ema(candles, { period: p.ema26Period });
      data.ema26 = series.map((s) => s.value);
    }

    // WMA 20
    if (enabledOverlays.includes("wma20")) {
      const series = wma(candles, { period: p.wma20Period });
      data.wma20 = series.map((s) => s.value);
    }

    // Bollinger Bands
    if (enabledOverlays.includes("bb")) {
      const series = bollingerBands(candles, { period: p.bbPeriod, stdDev: p.bbStdDev });
      data.bb = series.map((s) => s.value);
    }

    // Donchian Channel
    if (enabledOverlays.includes("donchian")) {
      const series = donchianChannel(candles, { period: p.donchianPeriod });
      data.donchian = series.map((s) => s.value);
    }

    // Keltner Channel
    if (enabledOverlays.includes("keltner")) {
      const series = keltnerChannel(candles, {
        emaPeriod: p.keltnerEmaPeriod,
        atrPeriod: p.keltnerAtrPeriod,
        multiplier: p.keltnerMultiplier,
      });
      data.keltner = series.map((s) => s.value);
    }

    // Ichimoku
    if (enabledOverlays.includes("ichimoku")) {
      const series = ichimoku(candles, {
        tenkanPeriod: p.ichimokuTenkan,
        kijunPeriod: p.ichimokuKijun,
        senkouBPeriod: p.ichimokuSenkou,
        displacement: p.ichimokuDisplacement,
      });
      data.ichimoku = series.map((s) => s.value);
    }

    // Supertrend
    if (enabledOverlays.includes("supertrend")) {
      const series = supertrend(candles, {
        period: p.supertrendPeriod,
        multiplier: p.supertrendMultiplier,
      });
      data.supertrend = series.map((s) => s.value);
    }

    // Parabolic SAR
    if (enabledOverlays.includes("psar")) {
      const series = parabolicSar(candles, { step: p.psarStep, max: p.psarMax });
      data.psar = series.map((s) => s.value);
    }

    return data;
  }, [candles, enabledOverlays, indicatorParams]);
}
