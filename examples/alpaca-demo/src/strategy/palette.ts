/**
 * Strategy Palette — catalog of available indicators and conditions
 *
 * Defines what building blocks the LLM can use when creating or
 * modifying strategies, along with safe parameter bounds.
 */

export type ParamRange = {
  min: number;
  max: number;
  default: number;
  step?: number;
};

export type IndicatorDef = {
  description: string;
  params: Record<string, ParamRange>;
};

export type ConditionDef = {
  description: string;
  requiredIndicators?: string[];
  params?: Record<string, ParamRange | "indicatorKey">;
};

/**
 * Available indicators that can be used in strategy templates
 */
export const INDICATOR_PALETTE: Record<string, IndicatorDef> = {
  rsi: {
    description: "Relative Strength Index — momentum oscillator (0-100)",
    params: {
      period: { min: 5, max: 30, default: 14 },
    },
  },
  macd: {
    description: "MACD — trend-following momentum (histogram, signal, macd)",
    params: {
      fastPeriod: { min: 5, max: 20, default: 12 },
      slowPeriod: { min: 15, max: 40, default: 26 },
      signalPeriod: { min: 5, max: 15, default: 9 },
    },
  },
  bollinger: {
    description: "Bollinger Bands — volatility bands around SMA",
    params: {
      period: { min: 10, max: 50, default: 20 },
      stdDev: { min: 1, max: 3, default: 2, step: 0.5 },
    },
  },
  ema: {
    description: "Exponential Moving Average",
    params: {
      period: { min: 3, max: 200, default: 9 },
    },
  },
  sma: {
    description: "Simple Moving Average",
    params: {
      period: { min: 3, max: 200, default: 20 },
    },
  },
  vwap: {
    description: "Volume-Weighted Average Price (intraday)",
    params: {},
  },
  atr: {
    description: "Average True Range — volatility measure",
    params: {
      period: { min: 5, max: 30, default: 14 },
    },
  },
  stochastics: {
    description: "Stochastic Oscillator — K and D lines",
    params: {
      kPeriod: { min: 5, max: 21, default: 14 },
      dPeriod: { min: 3, max: 7, default: 3 },
    },
  },
  dmi: {
    description: "Directional Movement Index — ADX, +DI, -DI",
    params: {
      period: { min: 7, max: 30, default: 14 },
    },
  },
  keltner: {
    description: "Keltner Channel — ATR-based volatility bands around EMA",
    params: {
      period: { min: 10, max: 50, default: 20 },
      multiplier: { min: 1, max: 4, default: 2, step: 0.5 },
    },
  },
  regime: {
    description:
      "Volatility regime detector — classifies volatility (low/normal/high), " +
      "trend (bullish/bearish/sideways), and trend strength (ADX). " +
      "Use with regimeFilter condition to gate trades by market regime.",
    params: {
      atrPeriod: { min: 5, max: 30, default: 14 },
      bbPeriod: { min: 10, max: 50, default: 20 },
      dmiPeriod: { min: 7, max: 30, default: 14 },
      lookback: { min: 30, max: 200, default: 100 },
    },
  },
};

/**
 * Available conditions that can be used in entry/exit rules
 */
export const CONDITION_PALETTE: Record<string, ConditionDef> = {
  rsiBelow: {
    description: "RSI is below threshold (oversold)",
    requiredIndicators: ["rsi"],
    params: {
      threshold: { min: 10, max: 50, default: 30 },
    },
  },
  rsiAbove: {
    description: "RSI is above threshold (overbought)",
    requiredIndicators: ["rsi"],
    params: {
      threshold: { min: 50, max: 90, default: 70 },
    },
  },
  macdPositive: {
    description: "MACD histogram is positive (bullish momentum)",
    requiredIndicators: ["macd"],
  },
  macdNegative: {
    description: "MACD histogram is negative (bearish momentum)",
    requiredIndicators: ["macd"],
  },
  priceAbove: {
    description: "Price is above a named indicator",
    params: {
      indicatorKey: "indicatorKey",
    },
  },
  priceBelow: {
    description: "Price is below a named indicator",
    params: {
      indicatorKey: "indicatorKey",
    },
  },
  smaGoldenCross: {
    description: "Short SMA crosses above long SMA",
    requiredIndicators: ["sma"],
  },
  smaDeadCross: {
    description: "Short SMA crosses below long SMA",
    requiredIndicators: ["sma"],
  },
  indicatorAbove: {
    description: "An indicator value is above a numeric threshold",
    params: {
      indicatorKey: "indicatorKey",
      threshold: { min: -100, max: 100, default: 0 },
    },
  },
  indicatorBelow: {
    description: "An indicator value is below a numeric threshold",
    params: {
      indicatorKey: "indicatorKey",
      threshold: { min: -100, max: 100, default: 0 },
    },
  },
  dmiBullish: {
    description: "+DI > -DI and ADX >= threshold (bullish trend)",
    requiredIndicators: ["dmi"],
    params: {
      threshold: { min: 15, max: 50, default: 25 },
    },
  },
  dmiBearish: {
    description: "-DI > +DI and ADX >= threshold (bearish trend)",
    requiredIndicators: ["dmi"],
    params: {
      threshold: { min: 15, max: 50, default: 25 },
    },
  },
  priceBelowVwap: {
    description: "Price is below VWAP (institutional average cost)",
    requiredIndicators: ["vwap"],
  },
  priceAboveVwap: {
    description: "Price is above VWAP (institutional average cost)",
    requiredIndicators: ["vwap"],
  },
  priceBelowKeltnerLower: {
    description: "Price is below Keltner Channel lower band",
    requiredIndicators: ["keltner"],
  },
  priceAboveKeltnerMiddle: {
    description: "Price is above Keltner Channel middle (EMA)",
    requiredIndicators: ["keltner"],
  },
  emaCrossUp: {
    description: "Short EMA crosses above long EMA (bullish crossover)",
    requiredIndicators: ["ema"],
  },
  emaCrossDown: {
    description: "Short EMA crosses below long EMA (bearish crossover)",
    requiredIndicators: ["ema"],
  },
  stochOversoldCrossUp: {
    description: "Stochastic K crosses above D in oversold zone",
    requiredIndicators: ["stochastics"],
    params: {
      threshold: { min: 10, max: 40, default: 20 },
    },
  },
  stochOverbought: {
    description: "Stochastic K is above overbought threshold",
    requiredIndicators: ["stochastics"],
    params: {
      threshold: { min: 60, max: 95, default: 80 },
    },
  },
  regimeFilter: {
    description:
      "Market regime filter — only allow trades in specified volatility/trend conditions. " +
      "Requires a 'regime' indicator in the pipeline (type: 'regime', name: 'regime').",
    params: {
      key: "indicatorKey",
    },
  },
};

/**
 * Signal lifecycle parameter ranges
 */
export const SIGNAL_LIFECYCLE_PALETTE: Record<string, ParamRange> = {
  cooldownBars: { min: 1, max: 20, default: 3 },
  debounceBars: { min: 1, max: 10, default: 2 },
  expiryBars: { min: 5, max: 50, default: 20 },
};

/**
 * Advanced exit strategy parameter ranges
 */
export const EXIT_STRATEGY_PALETTE = {
  atrTrailingStop: {
    period: { min: 5, max: 30, default: 14 } as ParamRange,
    multiplier: { min: 1, max: 5, default: 2, step: 0.5 } as ParamRange,
  },
  partialTakeProfit: {
    threshold: { min: 1, max: 20, default: 5 } as ParamRange,
    portion: { min: 10, max: 80, default: 50, step: 10 } as ParamRange,
  },
  breakEvenStop: {
    triggerPercent: { min: 1, max: 10, default: 3 } as ParamRange,
    offset: { min: 0, max: 2, default: 0.5, step: 0.1 } as ParamRange,
  },
};

/**
 * Sizing methods available for position management
 */
export const SIZING_METHODS = ["risk-based", "fixed-fractional", "full-capital", "kelly"] as const;

/**
 * Return the full palette for LLM context
 */
export function getPalette() {
  return {
    indicators: INDICATOR_PALETTE,
    conditions: CONDITION_PALETTE,
    sizingMethods: SIZING_METHODS,
    signalLifecycle: SIGNAL_LIFECYCLE_PALETTE,
    exitStrategies: EXIT_STRATEGY_PALETTE,
  };
}
