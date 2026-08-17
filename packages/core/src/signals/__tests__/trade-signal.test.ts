/**
 * Tests for Trade Signal Converters (Feature 1)
 */
import { describe, expect, it } from "vitest";
import type { PipelineResult } from "../../streaming/types";
import type { ScoreBreakdown } from "../../types/scoring";
import type { SqueezeSignal } from "../bollinger-squeeze";
import type { CrossSignalQuality } from "../cross";
import type { DivergenceSignal } from "../divergence";
import { detectChannel } from "../patterns/channel";
import type { PatternSignal, PatternType } from "../patterns/types";
import { PATTERN_BIAS } from "../patterns/types";
import {
  fromCrossSignal,
  fromDivergenceSignal,
  fromPatternSignal,
  fromPipelineResult,
  fromScoreResult,
  fromSqueezeSignal,
} from "../trade-signal/converters";

describe("fromCrossSignal", () => {
  const goldenSignal: CrossSignalQuality = {
    time: 1000,
    type: "golden",
    isFake: false,
    score: 85,
    details: {
      volumeConfirmed: true,
      trendConfirmed: true,
      holdingConfirmed: true,
      pricePositionConfirmed: true,
      daysUntilReverse: null,
    },
  };

  it("converts golden cross to BUY/LONG signal", () => {
    const result = fromCrossSignal(goldenSignal, 100);
    expect(result.action).toBe("BUY");
    expect(result.direction).toBe("LONG");
    expect(result.confidence).toBe(85);
    expect(result.time).toBe(1000);
    expect(result.prices?.entry).toBe(100);
    expect(result.reasons[0].source).toBe("cross");
    expect(result.reasons[0].name).toBe("goldenCross");
  });

  it("converts dead cross to SELL/SHORT signal", () => {
    const deadSignal: CrossSignalQuality = {
      ...goldenSignal,
      type: "dead",
      score: 60,
    };
    const result = fromCrossSignal(deadSignal);
    expect(result.action).toBe("SELL");
    expect(result.direction).toBe("SHORT");
    expect(result.confidence).toBe(60);
    expect(result.prices).toBeUndefined();
  });

  it("marks fake signals in metadata", () => {
    const fakeSignal = { ...goldenSignal, isFake: true };
    const result = fromCrossSignal(fakeSignal);
    expect(result.metadata?.isFake).toBe(true);
    expect(result.reasons[0].detail).toBe("potential fake signal");
  });
});

describe("fromDivergenceSignal", () => {
  it("converts bullish divergence to BUY", () => {
    const signal: DivergenceSignal = {
      time: 2000,
      confirmedAt: 2500,
      confirmedIdx: 15,
      type: "bullish",
      kind: "regular",
      firstIdx: 5,
      secondIdx: 10,
      price: { first: 100, second: 95 },
      indicator: { first: 30, second: 35 },
    };
    const result = fromDivergenceSignal(signal, 95);
    expect(result.action).toBe("BUY");
    expect(result.direction).toBe("LONG");
    expect(result.confidence).toBe(60);
    expect(result.prices?.entry).toBe(95);
  });

  it("converts bearish divergence to SELL", () => {
    const signal: DivergenceSignal = {
      time: 3000,
      confirmedAt: 3500,
      confirmedIdx: 15,
      type: "bearish",
      kind: "regular",
      firstIdx: 5,
      secondIdx: 10,
      price: { first: 100, second: 110 },
      indicator: { first: 70, second: 65 },
    };
    const result = fromDivergenceSignal(signal);
    expect(result.action).toBe("SELL");
    expect(result.direction).toBe("SHORT");
  });

  it("stamps the trade signal at confirmedAt, not at the pivot bar", () => {
    const signal: DivergenceSignal = {
      time: 2000,
      confirmedAt: 2500,
      confirmedIdx: 15,
      type: "bullish",
      kind: "regular",
      firstIdx: 5,
      secondIdx: 10,
      price: { first: 100, second: 95 },
      indicator: { first: 30, second: 35 },
    };
    const result = fromDivergenceSignal(signal, 95);
    expect(result.time).toBe(2500);
    expect(result.id).toBe("divergence-regular-bullish-2500");
    // The pivot bar stays available as annotation metadata
    expect(result.metadata?.pivotTime).toBe(2000);
    expect(result.metadata?.secondIdx).toBe(10);
  });
});

describe("fromSqueezeSignal", () => {
  it("converts squeeze signal with default LONG direction", () => {
    const signal: SqueezeSignal = {
      time: 4000,
      type: "squeeze",
      bandwidth: 0.02,
      percentile: 3,
    };
    const result = fromSqueezeSignal(signal);
    expect(result.action).toBe("BUY");
    expect(result.direction).toBe("LONG");
    expect(result.confidence).toBe(97); // 100 - 3
  });

  it("supports SHORT direction", () => {
    const signal: SqueezeSignal = {
      time: 4000,
      type: "squeeze",
      bandwidth: 0.02,
      percentile: 3,
    };
    const result = fromSqueezeSignal(signal, "SHORT", 150);
    expect(result.action).toBe("SELL");
    expect(result.direction).toBe("SHORT");
    expect(result.prices?.entry).toBe(150);
  });
});

describe("fromPatternSignal", () => {
  it("converts double_bottom to BUY with price levels", () => {
    const signal: PatternSignal = {
      time: 5000,
      detectableTime: 5000,
      confirmTime: 5000,
      type: "double_bottom",
      pattern: {
        startTime: 4000,
        endTime: 5000,
        keyPoints: [],
        target: 120,
        stopLoss: 90,
        height: 10,
      },
      confidence: 72,
      confirmed: true,
    };
    const result = fromPatternSignal(signal, 100);
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.action).toBe("BUY");
    expect(result.direction).toBe("LONG");
    expect(result.confidence).toBe(72);
    expect(result.prices?.entry).toBe(100);
    expect(result.prices?.takeProfit).toBe(120);
    expect(result.prices?.stopLoss).toBe(90);
  });

  it("converts double_top to SELL", () => {
    const signal: PatternSignal = {
      time: 6000,
      detectableTime: 6000,
      type: "double_top",
      pattern: { startTime: 5000, endTime: 6000, keyPoints: [] },
      confidence: 65,
      confirmed: false,
    };
    const result = fromPatternSignal(signal);
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.action).toBe("SELL");
    expect(result.direction).toBe("SHORT");
    expect(result.metadata?.confirmed).toBe(false);
  });

  it("stamps a confirmed pattern at confirmTime, not at the pivot bar", () => {
    const signal: PatternSignal = {
      time: 5000,
      detectableTime: 5500,
      confirmTime: 7000,
      type: "double_bottom",
      pattern: { startTime: 4000, endTime: 5000, keyPoints: [] },
      confidence: 72,
      confirmed: true,
    };
    const result = fromPatternSignal(signal);
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.time).toBe(7000);
    expect(result.id).toBe("pattern-double_bottom-7000");
    expect(result.metadata?.patternTime).toBe(5000);
  });

  it("stamps an unconfirmed pattern at detectableTime", () => {
    const signal: PatternSignal = {
      time: 5000,
      detectableTime: 5500,
      type: "double_top",
      pattern: { startTime: 4000, endTime: 5000, keyPoints: [] },
      confidence: 65,
      confirmed: false,
    };
    const result = fromPatternSignal(signal);
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.time).toBe(5500);
    expect(result.metadata?.patternTime).toBe(5000);
  });

  // Regression: the direction used to come from a three-entry allowlist local to
  // fromPatternSignal, so 9 of the 12 bullish pattern types were emitted as
  // SELL/SHORT, and the 4 directionless types were forced short too. The
  // expectations below are written out independently of PATTERN_BIAS so they pin
  // both the converter and the table.
  const EXPECTED_BIAS: Record<PatternType, "bullish" | "bearish" | "neutral"> = {
    double_top: "bearish",
    double_bottom: "bullish",
    head_shoulders: "bearish",
    inverse_head_shoulders: "bullish",
    cup_handle: "bullish",
    triangle_symmetrical: "neutral",
    triangle_ascending: "bullish",
    triangle_descending: "bearish",
    rising_wedge: "bearish",
    falling_wedge: "bullish",
    channel_ascending: "neutral",
    channel_descending: "neutral",
    channel_horizontal: "neutral",
    bull_flag: "bullish",
    bear_flag: "bearish",
    bull_pennant: "bullish",
    bear_pennant: "bearish",
    gartley_bullish: "bullish",
    gartley_bearish: "bearish",
    butterfly_bullish: "bullish",
    butterfly_bearish: "bearish",
    bat_bullish: "bullish",
    bat_bearish: "bearish",
    crab_bullish: "bullish",
    crab_bearish: "bearish",
    shark_bullish: "bullish",
    shark_bearish: "bearish",
  };

  const patternOf = (type: PatternType): PatternSignal => ({
    time: 5000,
    detectableTime: 5000,
    confirmTime: 5000,
    type,
    pattern: { startTime: 4000, endTime: 5000, keyPoints: [] },
    confidence: 70,
    confirmed: true,
  });

  it("PATTERN_BIAS covers every PatternType exactly once", () => {
    expect(Object.keys(PATTERN_BIAS).sort()).toEqual(Object.keys(EXPECTED_BIAS).sort());
    for (const [type, bias] of Object.entries(EXPECTED_BIAS)) {
      expect(PATTERN_BIAS[type as PatternType]).toBe(bias);
    }
  });

  it.each(
    (Object.keys(EXPECTED_BIAS) as PatternType[]).map((t) => [t, EXPECTED_BIAS[t]] as const),
  )("maps %s (%s) to the matching action", (type, bias) => {
    const result = fromPatternSignal(patternOf(type), 100);

    if (bias === "neutral") {
      expect(result).toBeNull();
      return;
    }

    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.action).toBe(bias === "bullish" ? "BUY" : "SELL");
    expect(result.direction).toBe(bias === "bullish" ? "LONG" : "SHORT");
  });

  it("does not classify a bullish pattern as a short", () => {
    // The specific shape of the old bug: named-bullish types fell through the
    // allowlist and came out as SELL/SHORT.
    for (const type of [
      "bull_flag",
      "bull_pennant",
      "gartley_bullish",
      "butterfly_bullish",
      "bat_bullish",
      "crab_bullish",
      "shark_bullish",
      "triangle_ascending",
      "falling_wedge",
    ] as PatternType[]) {
      const result = fromPatternSignal(patternOf(type), 100);
      expect(result?.action, `${type} should not be a SELL`).toBe("BUY");
      expect(result?.direction, `${type} should not be a SHORT`).toBe("LONG");
    }
  });

  // A triangle or channel accepts a breakout either way, and target/stopLoss are
  // measured from the direction it actually took. The shape's bias must not
  // override that.
  it.each([
    ["channel_ascending", "down", "SELL", "SHORT"],
    ["channel_descending", "up", "BUY", "LONG"],
    ["triangle_ascending", "down", "SELL", "SHORT"],
    ["triangle_descending", "up", "BUY", "LONG"],
  ] as const)("a %s that broke %s is a %s", (type, breakoutDirection, action, direction) => {
    const result = fromPatternSignal({ ...patternOf(type as PatternType), breakoutDirection }, 100);
    expect(result?.action).toBe(action);
    expect(result?.direction).toBe(direction);
  });

  it.each([
    ["triangle_symmetrical", "up", "BUY"],
    ["triangle_symmetrical", "down", "SELL"],
    ["channel_horizontal", "up", "BUY"],
    ["channel_ascending", "down", "SELL"],
  ] as const)("a confirmed %s that broke %s becomes a %s instead of null", (type, breakoutDirection, action) => {
    const signal = { ...patternOf(type as PatternType), breakoutDirection };
    expect(fromPatternSignal(signal, 100)?.action).toBe(action);
    // Without the breakout there is still nothing to trade.
    expect(fromPatternSignal(patternOf(type as PatternType), 100)).toBeNull();
  });

  // `confirmed` and `breakoutDirection` are set together by every detector, but
  // the public type lets a hand-built or deserialized signal carry one without
  // the other. An unconfirmed pattern must not be read as having broken out.
  it("ignores breakoutDirection on an unconfirmed signal", () => {
    const neutral = {
      ...patternOf("channel_horizontal"),
      confirmed: false,
      breakoutDirection: "up" as const,
    };
    expect(fromPatternSignal(neutral, 100)).toBeNull();

    // A directional shape falls back to its bias rather than the phantom breakout.
    const bearish = {
      ...patternOf("double_top"),
      confirmed: false,
      breakoutDirection: "up" as const,
    };
    expect(fromPatternSignal(bearish, 100)?.action).toBe("SELL");
  });

  // The integration the unit tests above cannot cover: a signal built by a real
  // detector, whose target/stopLoss come from the breakout it actually found.
  it("keeps action consistent with the target/stopLoss the detector measured", () => {
    const DAY = 86400000;
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const lower = (i: number) => 100 + i;
    const upper = (i: number) => 110 + i;
    for (let i = 0; i < 30; i++) {
      const touchUpper = i % 6 === 2;
      const touchLower = i % 6 === 5;
      const c = touchUpper
        ? upper(i) - 0.2
        : touchLower
          ? lower(i) + 0.2
          : (upper(i) + lower(i)) / 2;
      closes.push(c);
      highs.push(touchUpper ? upper(i) : c + 1);
      lows.push(touchLower ? lower(i) : c - 1);
    }
    // An ascending channel — a bullish shape — that breaks DOWN.
    for (let i = 30; i < 34; i++) {
      const c = lower(i) - 8;
      closes.push(c);
      highs.push(c + 1);
      lows.push(c - 1);
    }
    const candles = closes.map((close, i) => ({
      time: Date.UTC(2024, 0, 1) + i * DAY,
      open: close,
      high: highs[i],
      low: lows[i],
      close,
      volume: 1000,
    }));

    const confirmed = detectChannel(candles, { swingLookback: 2, minPoints: 3 }).filter(
      (p) => p.type === "channel_ascending" && p.confirmed,
    );
    expect(confirmed.length).toBeGreaterThan(0);

    for (const p of confirmed) {
      expect(p.breakoutDirection).toBe("down");
      const sig = fromPatternSignal(p, 100);
      expect(sig).not.toBeNull();
      if (sig === null) continue;
      const { takeProfit, stopLoss } = sig.prices ?? {};
      expect(takeProfit).toBeDefined();
      expect(stopLoss).toBeDefined();
      if (takeProfit === undefined || stopLoss === undefined) continue;
      // A BUY must aim above its stop and a SELL below it — the invariant the
      // shape-only classification violated (BUY with takeProfit 112, stop 140).
      if (sig.action === "BUY") {
        expect(takeProfit).toBeGreaterThan(stopLoss);
      } else {
        expect(takeProfit).toBeLessThan(stopLoss);
      }
    }
  });
});

describe("fromScoreResult", () => {
  const breakdown: ScoreBreakdown = {
    rawScore: 0.72,
    normalizedScore: 72,
    maxScore: 50,
    strength: "strong" as const,
    activeSignals: 1,
    totalSignals: 2,
    contributions: [
      {
        name: "rsiOversold",
        displayName: "RSI Oversold",
        rawValue: 1,
        score: 30,
        weight: 30,
        isActive: true,
      },
      {
        name: "macdBullish",
        displayName: "MACD Bullish",
        rawValue: 0,
        score: 0,
        weight: 20,
        isActive: false,
      },
    ],
  };

  it("converts score to signal", () => {
    const result = fromScoreResult(breakdown, 7000, { entryPrice: 100 });
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe(72);
    expect(result?.reasons.length).toBe(1); // Only active signals
    expect(result?.reasons[0].name).toBe("rsiOversold");
  });

  it("returns null when below threshold", () => {
    const result = fromScoreResult(breakdown, 7000, { minScore: 80 });
    expect(result).toBeNull();
  });

  it("supports custom direction", () => {
    const result = fromScoreResult(breakdown, 7000, { direction: "SHORT" });
    expect(result?.action).toBe("SELL");
    expect(result?.direction).toBe("SHORT");
  });
});

describe("fromPipelineResult", () => {
  it("converts entry signal", () => {
    const result: PipelineResult = {
      snapshot: { rsi14: 25 },
      entrySignal: true,
      exitSignal: false,
      signals: [],
    };
    const signal = fromPipelineResult(result, 8000, 100);
    expect(signal).not.toBeNull();
    expect(signal?.action).toBe("BUY");
    expect(signal?.reasons).toContainEqual({ source: "pipeline", name: "entry" });
  });

  it("converts exit signal", () => {
    const result: PipelineResult = {
      snapshot: { rsi14: 75 },
      entrySignal: false,
      exitSignal: true,
      signals: [],
    };
    const signal = fromPipelineResult(result, 9000);
    expect(signal?.action).toBe("CLOSE");
  });

  it("returns null when no signals", () => {
    const result: PipelineResult = {
      snapshot: {},
      entrySignal: false,
      exitSignal: false,
      signals: [],
    };
    const signal = fromPipelineResult(result, 10000);
    expect(signal).toBeNull();
  });

  it("includes named signals in reasons", () => {
    const result: PipelineResult = {
      snapshot: {},
      entrySignal: false,
      exitSignal: false,
      signals: ["squeeze_breakout"],
    };
    const signal = fromPipelineResult(result, 11000);
    expect(signal?.reasons).toContainEqual({ source: "pipeline", name: "squeeze_breakout" });
  });
});
