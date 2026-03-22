import { describe, expect, it } from "vitest";
import type { Trade } from "../../types";
import { type BehaviorEquityPoint, generateBehaviorInsights } from "../behavior-insights";

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    entryTime: Date.now(),
    entryPrice: 100,
    exitTime: Date.now() + 86400000,
    exitPrice: 105,
    return: 5,
    returnPercent: 5,
    holdingDays: 1,
    ...overrides,
  };
}

function makeWinTrade(returnPct = 5, holdingDays = 3): Trade {
  return makeTrade({
    returnPercent: returnPct,
    return: returnPct,
    holdingDays,
    exitPrice: 100 + returnPct,
    mfe: returnPct * 1.5,
    mae: -1,
    mfeUtilization: 66,
  });
}

function makeLossTrade(returnPct = -3, holdingDays = 3): Trade {
  return makeTrade({
    returnPercent: returnPct,
    return: returnPct,
    holdingDays,
    exitPrice: 100 + returnPct,
    mfe: 1,
    mae: returnPct,
    mfeUtilization: 20,
  });
}

describe("generateBehaviorInsights", () => {
  it("returns empty array for no trades", () => {
    expect(generateBehaviorInsights([])).toEqual([]);
  });

  it("returns empty array for a single trade", () => {
    const insights = generateBehaviorInsights([makeWinTrade()]);
    // Not enough trades for meaningful stats
    expect(insights.length).toBe(0);
  });

  it("detects high win rate as strength", () => {
    // 8 wins, 2 losses = 80% win rate
    const trades = [
      ...Array.from({ length: 8 }, () => makeWinTrade()),
      ...Array.from({ length: 2 }, () => makeLossTrade()),
    ];

    const insights = generateBehaviorInsights(trades);
    const winRateInsight = insights.find((i) => i.title === "Above-average win rate");
    expect(winRateInsight).toBeDefined();
    expect(winRateInsight?.type).toBe("strength");
  });

  it("detects low win rate as weakness", () => {
    // 2 wins, 8 losses = 20% win rate
    const trades = [
      ...Array.from({ length: 2 }, () => makeWinTrade()),
      ...Array.from({ length: 8 }, () => makeLossTrade()),
    ];

    const insights = generateBehaviorInsights(trades);
    const winRateInsight = insights.find((i) => i.title === "Low win rate");
    expect(winRateInsight).toBeDefined();
    expect(winRateInsight?.type).toBe("weakness");
  });

  it("detects positive profit factor", () => {
    // Big wins, small losses
    const trades = [
      ...Array.from({ length: 6 }, () => makeWinTrade(10)),
      ...Array.from({ length: 4 }, () => makeLossTrade(-2)),
    ];

    const insights = generateBehaviorInsights(trades);
    const pfInsight = insights.find((i) => i.title === "Positive profit factor");
    expect(pfInsight).toBeDefined();
    expect(pfInsight?.type).toBe("strength");
  });

  it("detects significant drawdown", () => {
    const trades = [makeWinTrade(), makeLossTrade()];
    const equityCurve: BehaviorEquityPoint[] = [
      { time: 1, equity: 10000, drawdownPercent: 0 },
      { time: 2, equity: 11000, drawdownPercent: 0 },
      { time: 3, equity: 8500, drawdownPercent: 15 },
    ];

    const insights = generateBehaviorInsights(trades, equityCurve);
    const ddInsight = insights.find((i) => i.title === "Significant drawdown");
    expect(ddInsight).toBeDefined();
    expect(ddInsight?.type).toBe("weakness");
  });

  it("detects good MFE utilization", () => {
    const trades = Array.from({ length: 5 }, () =>
      makeTrade({
        returnPercent: 5,
        return: 5,
        mfe: 7,
        mae: -1,
        mfeUtilization: 71,
      }),
    );

    const insights = generateBehaviorInsights(trades);
    const mfeInsight = insights.find((i) => i.title === "Good profit capture");
    expect(mfeInsight).toBeDefined();
    expect(mfeInsight?.type).toBe("strength");
  });

  it("detects low MFE utilization", () => {
    const trades = Array.from({ length: 5 }, () =>
      makeTrade({
        returnPercent: 2,
        return: 2,
        mfe: 10,
        mae: -1,
        mfeUtilization: 20,
      }),
    );

    const insights = generateBehaviorInsights(trades);
    const mfeInsight = insights.find((i) => i.title === "Low profit capture");
    expect(mfeInsight).toBeDefined();
    expect(mfeInsight?.type).toBe("weakness");
  });

  it("detects extended losing streaks", () => {
    const trades = [
      makeWinTrade(),
      makeLossTrade(),
      makeLossTrade(),
      makeLossTrade(),
      makeLossTrade(),
      makeWinTrade(),
    ];

    const insights = generateBehaviorInsights(trades);
    const streakInsight = insights.find((i) => i.title === "Extended losing streak");
    expect(streakInsight).toBeDefined();
    expect(streakInsight?.type).toBe("weakness");
  });

  it("detects strong winning streaks", () => {
    const trades = [
      makeWinTrade(),
      makeWinTrade(),
      makeWinTrade(),
      makeWinTrade(),
      makeWinTrade(),
      makeLossTrade(),
    ];

    const insights = generateBehaviorInsights(trades);
    const streakInsight = insights.find((i) => i.title === "Strong winning streaks");
    expect(streakInsight).toBeDefined();
    expect(streakInsight?.type).toBe("strength");
  });

  it("detects holding period patterns", () => {
    // Short trades win, long trades lose
    const trades = [
      makeWinTrade(5, 2),
      makeWinTrade(5, 3),
      makeWinTrade(5, 1),
      makeLossTrade(-3, 20),
      makeLossTrade(-3, 25),
      makeLossTrade(-3, 18),
    ];

    const insights = generateBehaviorInsights(trades);
    const holdingInsight = insights.find((i) => i.title === "Holding period pattern");
    expect(holdingInsight).toBeDefined();
    expect(holdingInsight?.type).toBe("info");
  });

  it("all insights have required fields", () => {
    const trades = [
      ...Array.from({ length: 7 }, () => makeWinTrade()),
      ...Array.from({ length: 3 }, () => makeLossTrade()),
    ];

    const insights = generateBehaviorInsights(trades);
    for (const insight of insights) {
      expect(insight.type).toMatch(/^(strength|weakness|info)$/);
      expect(typeof insight.title).toBe("string");
      expect(insight.title.length).toBeGreaterThan(0);
      expect(typeof insight.description).toBe("string");
      expect(insight.description.length).toBeGreaterThan(0);
    }
  });
});
