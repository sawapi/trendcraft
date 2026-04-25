import type { IndicatorManifest } from "../types";

export const TREND_MANIFESTS: IndicatorManifest[] = [
  {
    kind: "supertrend",
    displayName: "Supertrend",
    category: "trend",
    oneLiner: "ATR-bounded line that flips bullish/bearish as price crosses.",
    whenToUse: [
      "Visual trend direction with built-in stop level",
      "Simple flip-based trend systems",
      "Stop placement on trend-follow entries",
    ],
    signals: [
      "Supertrend flips green = bullish state begins",
      "Supertrend flips red = bearish state begins",
      "Price below red line = downtrend; above green = uptrend",
    ],
    pitfalls: [
      "Whipsaws hard in choppy ranges (this is its main weakness)",
      "Multiplier tuning matters more than period",
    ],
    synergy: ["ADX/Choppiness to disable Supertrend entries during chop"],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
    paramHints: {
      period: "10 default ATR period",
      multiplier: "3 default; 2 tighter, 4 wider",
    },
  },
  {
    kind: "parabolicSar",
    displayName: "Parabolic SAR",
    category: "trend",
    oneLiner: "Stop-and-reverse dots that accelerate as the trend extends.",
    whenToUse: ["Trailing stops on trend trades", "Visual trend direction at a glance"],
    signals: [
      "Dots flip from below to above price = trend reversal to down",
      "Dots flip from above to below price = trend reversal to up",
    ],
    pitfalls: [
      "Reverses prematurely in ranges or pullbacks",
      "Acceleration factor tuning is finicky",
    ],
    marketRegime: ["trending"],
    timeframe: ["intraday", "swing"],
  },
  {
    kind: "ichimoku",
    displayName: "Ichimoku Kinko Hyo",
    category: "trend",
    oneLiner: "Multi-component trend system: Tenkan, Kijun, Senkou A/B (cloud), Chikou.",
    whenToUse: [
      "All-in-one trend / momentum / support-resistance system",
      "Multi-timeframe trend bias on swing/position trades",
    ],
    signals: [
      "Price above cloud = bullish bias",
      "Price below cloud = bearish bias",
      "Price inside cloud = no trend / chop",
      "Tenkan/Kijun cross above cloud = strong bullish signal",
      "Cloud color change = future trend bias shift",
    ],
    pitfalls: [
      "Many components — risk of overfitting interpretations",
      "Lagging on fast reversals",
      "Originally designed for daily Japanese equities; tuning needed elsewhere",
    ],
    marketRegime: ["trending"],
    timeframe: ["swing", "position"],
  },
];
