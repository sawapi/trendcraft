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
  hma: {
    description: "Hull Moving Average — fast, low-lag trend following",
    params: {
      period: { min: 5, max: 100, default: 9 },
    },
  },
  kama: {
    description: "Kaufman Adaptive Moving Average — adapts to volatility",
    params: {
      period: { min: 5, max: 50, default: 10 },
      fastPeriod: { min: 2, max: 10, default: 2 },
      slowPeriod: { min: 20, max: 50, default: 30 },
    },
  },
  t3: {
    description: "Tillson T3 — ultra-smooth moving average with minimal lag",
    params: {
      period: { min: 3, max: 30, default: 5 },
      vFactor: { min: 0.5, max: 1.0, default: 0.7, step: 0.1 },
    },
  },
  vwma: {
    description: "Volume-Weighted Moving Average — volume-weighted SMA",
    params: {
      period: { min: 5, max: 100, default: 20 },
    },
  },
  connorsRsi: {
    description: "Connors RSI — composite RSI + streak RSI + ROC percentile (0-100)",
    params: {
      rsiPeriod: { min: 2, max: 10, default: 3 },
      streakPeriod: { min: 2, max: 5, default: 2 },
      rocPeriod: { min: 50, max: 200, default: 100 },
    },
  },
  trix: {
    description: "TRIX — triple-smoothed EMA rate of change (momentum oscillator)",
    params: {
      period: { min: 5, max: 30, default: 15 },
      signalPeriod: { min: 5, max: 15, default: 9 },
    },
  },
  aroon: {
    description: "Aroon — trend strength via time since high/low (up, down, oscillator)",
    params: {
      period: { min: 10, max: 50, default: 25 },
    },
  },
  vortexIndicator: {
    description: "Vortex Indicator — trend direction via VI+ and VI- crossovers",
    params: {
      period: { min: 7, max: 30, default: 14 },
    },
  },
  cmo: {
    description: "Chande Momentum Oscillator — momentum (-100 to +100)",
    params: {
      period: { min: 5, max: 30, default: 14 },
    },
  },
  obv: {
    description: "On-Balance Volume — cumulative volume flow",
    params: {},
  },
  cmfIndicator: {
    description: "Chaikin Money Flow — buying/selling pressure (-1 to +1)",
    params: {
      period: { min: 10, max: 30, default: 20 },
    },
  },
  supertrend: {
    description: "Supertrend — ATR-based trend direction (bullish/bearish)",
    params: {
      period: { min: 5, max: 30, default: 10 },
      multiplier: { min: 1, max: 5, default: 3, step: 0.5 },
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
  // --- Bollinger Bands ---
  bollingerUpperTouch: {
    description: "Price touches or exceeds upper Bollinger Band",
    requiredIndicators: ["bollinger"],
  },
  bollingerLowerTouch: {
    description: "Price touches or drops below lower Bollinger Band",
    requiredIndicators: ["bollinger"],
  },
  bollingerBreakoutUp: {
    description: "Price breaks above upper Bollinger Band (breakout)",
    requiredIndicators: ["bollinger"],
  },
  priceAboveBollingerMiddle: {
    description: "Price is above Bollinger Bands middle (SMA)",
    requiredIndicators: ["bollinger"],
  },
  priceBelowBollingerMiddle: {
    description: "Price is below Bollinger Bands middle (SMA)",
    requiredIndicators: ["bollinger"],
  },
  // --- Stochastics ---
  stochBelow: {
    description: "Stochastic K is below threshold (oversold zone)",
    requiredIndicators: ["stochastics"],
    params: {
      threshold: { min: 10, max: 40, default: 20 },
    },
  },
  stochAbove: {
    description: "Stochastic K is above threshold (overbought zone)",
    requiredIndicators: ["stochastics"],
    params: {
      threshold: { min: 60, max: 95, default: 80 },
    },
  },
  stochCrossDown: {
    description: "Stochastic K crosses below D in overbought zone",
    requiredIndicators: ["stochastics"],
    params: {
      threshold: { min: 60, max: 95, default: 80 },
    },
  },
  // --- MACD ---
  macdHistogramRising: {
    description: "MACD histogram is rising (bullish momentum increasing)",
    requiredIndicators: ["macd"],
  },
  macdHistogramFalling: {
    description: "MACD histogram is falling (bearish momentum increasing)",
    requiredIndicators: ["macd"],
  },
  // --- DMI/ADX ---
  adxStrong: {
    description: "ADX above threshold (strong trend regardless of direction)",
    requiredIndicators: ["dmi"],
    params: {
      threshold: { min: 15, max: 50, default: 25 },
    },
  },
  dmiCrossUp: {
    description: "+DI crosses above -DI (bullish directional change)",
    requiredIndicators: ["dmi"],
  },
  // --- Volume ---
  cmfAbove: {
    description: "Chaikin Money Flow above threshold (buying pressure)",
    requiredIndicators: ["cmfIndicator"],
    params: {
      threshold: { min: -0.5, max: 0.5, default: 0 },
    },
  },
  cmfBelow: {
    description: "Chaikin Money Flow below threshold (selling pressure)",
    requiredIndicators: ["cmfIndicator"],
    params: {
      threshold: { min: -0.5, max: 0.5, default: 0 },
    },
  },
  obvRising: {
    description: "On-Balance Volume is trending up (accumulation)",
    requiredIndicators: ["obv"],
  },
  obvFalling: {
    description: "On-Balance Volume is trending down (distribution)",
    requiredIndicators: ["obv"],
  },
  volumeAboveAvg: {
    description: "Volume is above N times its moving average",
    params: {
      multiplier: { min: 1, max: 5, default: 1.5, step: 0.5 },
    },
  },
  // --- Volatility ---
  atrPercentAbove: {
    description: "ATR as % of price is above threshold (high volatility)",
    requiredIndicators: ["atr"],
    params: {
      threshold: { min: 0.5, max: 10, default: 2.3, step: 0.1 },
    },
  },
  atrPercentBelow: {
    description: "ATR as % of price is below threshold (low volatility)",
    requiredIndicators: ["atr"],
    params: {
      threshold: { min: 0.5, max: 10, default: 1.0, step: 0.1 },
    },
  },
  volatilityExpanding: {
    description: "ATR is expanding (volatility increasing)",
    requiredIndicators: ["atr"],
  },
  volatilityContracting: {
    description: "ATR is contracting (volatility decreasing)",
    requiredIndicators: ["atr"],
  },
  // --- Supertrend ---
  supertrendBullish: {
    description: "Supertrend direction is bullish (uptrend)",
    requiredIndicators: ["supertrend"],
  },
  supertrendBearish: {
    description: "Supertrend direction is bearish (downtrend)",
    requiredIndicators: ["supertrend"],
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
