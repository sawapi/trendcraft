import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import {
  SHAPE_BEAR_CLOSE_SHAVEN,
  SHAPE_BEAR_LONG_LOWER,
  SHAPE_BEAR_MARUBOZU,
  SHAPE_BEAR_NORMAL,
  SHAPE_BEAR_OPEN_SHAVEN,
  SHAPE_BEAR_SMALL,
  SHAPE_BULL_CLOSE_SHAVEN,
  SHAPE_BULL_LONG_UPPER,
  SHAPE_BULL_MARUBOZU,
  SHAPE_BULL_NORMAL,
  SHAPE_BULL_OPEN_SHAVEN,
  SHAPE_BULL_SMALL,
  SHAPE_DRAGONFLY_DOJI,
  SHAPE_FOUR_PRICE_DOJI,
  SHAPE_GRAVESTONE_DOJI,
  SHAPE_LONG_LEGGED_DOJI,
  SHAPE_NAMES,
  SHAPE_STANDARD_DOJI,
  classToDirection,
  classifyDirection,
  classifyShape,
  computeVolumeRatios,
  padTokens,
  quantizeCandle,
  quantizeVolume,
  tokenizeCandles,
} from "../tokenizer";
import { PAD_TOKEN, VOCAB_SIZE } from "../types";

function makeCandle(overrides: Partial<NormalizedCandle> = {}): NormalizedCandle {
  return {
    time: 0,
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1000,
    ...overrides,
  };
}

describe("classifyShape", () => {
  // --- Bullish shapes ---

  it("bull_marubozu: large body, tiny shadows", () => {
    // bodyRatio = 20/21 ≈ 0.952, upper=0.5/21≈0.024, lower=0.5/21≈0.024
    const shape = classifyShape(makeCandle({ open: 90, close: 110, high: 110.5, low: 89.5 }));
    expect(shape).toBe(SHAPE_BULL_MARUBOZU);
  });

  it("bull_close_shaven: no upper shadow, lower shadow present", () => {
    // open=95, close=110, high=110, low=90 → body=15, range=20, upper=0, lower=5
    const shape = classifyShape(makeCandle({ open: 95, close: 110, high: 110, low: 90 }));
    expect(shape).toBe(SHAPE_BULL_CLOSE_SHAVEN);
  });

  it("bull_open_shaven: no lower shadow, upper shadow present", () => {
    // open=90, close=105, high=110, low=90 → body=15, range=20, upper=5, lower=0
    const shape = classifyShape(makeCandle({ open: 90, close: 105, high: 110, low: 90 }));
    expect(shape).toBe(SHAPE_BULL_OPEN_SHAVEN);
  });

  it("bull_normal: both shadows, large body", () => {
    // open=93, close=107, high=110, low=90 → body=14, range=20, ratio=0.7
    // upper=3/20=0.15, lower=3/20=0.15 → both > 0.05
    // upper(3) < body(14) → not long_upper
    const shape = classifyShape(makeCandle({ open: 93, close: 107, high: 110, low: 90 }));
    expect(shape).toBe(SHAPE_BULL_NORMAL);
  });

  it("bull_small: small body", () => {
    // open=100, close=103, high=110, low: 90 → body=3, range=20, ratio=0.15 < 0.35
    // upper=7/20=0.35 > 0.05, lower=10/20=0.5 > 0.05
    // upper(7) > body(3) → long_upper takes priority over small
    // Need: upper < body AND both shadows present AND ratio < 0.35
    // open=98, close=104, high=108, low=90 → body=6, range=18, ratio=0.333
    // upper=4, lower=8 → upper(4) < body(6), upper/range=0.22 > 0.05, lower/range=0.44 > 0.05
    const shape = classifyShape(makeCandle({ open: 98, close: 104, high: 108, low: 90 }));
    expect(shape).toBe(SHAPE_BULL_SMALL);
  });

  it("bull_long_upper: upper shadow > body (reversal hint)", () => {
    // open=90, close=95, high=110, low=89 → body=5, range=21, upper=15, lower=1
    // upper(15) > body(5) → long_upper
    const shape = classifyShape(makeCandle({ open: 90, close: 95, high: 110, low: 89 }));
    expect(shape).toBe(SHAPE_BULL_LONG_UPPER);
  });

  // --- Bearish shapes ---

  it("bear_marubozu: large body, tiny shadows", () => {
    // open=110, close=90, high=110.5, low=89.5 → bodyRatio=20/21≈0.952
    const shape = classifyShape(makeCandle({ open: 110, close: 90, high: 110.5, low: 89.5 }));
    expect(shape).toBe(SHAPE_BEAR_MARUBOZU);
  });

  it("bear_close_shaven: tiny lower shadow, upper present", () => {
    // For bearish: close < open, "close shaven" = tiny shadow at close side = lower (since close is lower)
    // open=105, close=90, high=110, low=90 → body=15, range=20, upper=5, lower=0
    const shape = classifyShape(makeCandle({ open: 105, close: 90, high: 110, low: 90 }));
    expect(shape).toBe(SHAPE_BEAR_CLOSE_SHAVEN);
  });

  it("bear_open_shaven: tiny upper shadow, lower present", () => {
    // open=110, close=95, high=110, low=90 → body=15, range=20, upper=0, lower=5
    const shape = classifyShape(makeCandle({ open: 110, close: 95, high: 110, low: 90 }));
    expect(shape).toBe(SHAPE_BEAR_OPEN_SHAVEN);
  });

  it("bear_normal: both shadows, large body", () => {
    // open=107, close=93, high=110, low=90 → body=14, range=20, ratio=0.7
    const shape = classifyShape(makeCandle({ open: 107, close: 93, high: 110, low: 90 }));
    expect(shape).toBe(SHAPE_BEAR_NORMAL);
  });

  it("bear_small: small body", () => {
    // open=104, close=98, high=108, low=90 → body=6, range=18, ratio=0.333
    // lower=8, upper=4 → lower(8) > body(6) → long_lower takes priority
    // Need: lower < body AND both shadows present AND ratio < 0.35
    // open=103, close=98, high=108, low=90 → body=5, range=18, ratio=0.278
    // upper=5, lower=8 → lower(8) > body(5) → still long_lower
    // open=103, close=99, high=107, low=93 → body=4, range=14, ratio=0.286
    // upper=4, lower=6 → lower(6) > body(4) → still long_lower
    // open=102, close=99, high=106, low=96 → body=3, range=10, ratio=0.3
    // upper=4, lower=3 → lower(3) < body(3)? No, equal. lower <= body → not long_lower
    // upper(4) > body(3)? Not relevant for bearish. upper/range=0.4 > 0.05, lower/range=0.3 > 0.05
    const shape = classifyShape(makeCandle({ open: 102, close: 99, high: 106, low: 96 }));
    expect(shape).toBe(SHAPE_BEAR_SMALL);
  });

  it("bear_long_lower: lower shadow > body (reversal hint)", () => {
    // open=110, close=105, high=111, low=90 → body=5, range=21, lower=15, upper=1
    const shape = classifyShape(makeCandle({ open: 110, close: 105, high: 111, low: 90 }));
    expect(shape).toBe(SHAPE_BEAR_LONG_LOWER);
  });

  // --- Doji shapes ---

  it("four_price_doji: all prices equal (range ≈ 0)", () => {
    const shape = classifyShape(makeCandle({ open: 100, close: 100, high: 100, low: 100 }));
    expect(shape).toBe(SHAPE_FOUR_PRICE_DOJI);
  });

  it("dragonfly_doji: long lower shadow, tiny upper", () => {
    // open=100, close=100.1, high=100.5, low=90 → body=0.1, range=10.5, ratio≈0.0095
    // upper=0.4, lower=10 → lower/upper=25 > 3
    const shape = classifyShape(makeCandle({ open: 100, close: 100.1, high: 100.5, low: 90 }));
    expect(shape).toBe(SHAPE_DRAGONFLY_DOJI);
  });

  it("gravestone_doji: long upper shadow, tiny lower", () => {
    // open=100, close=100.1, high=110, low=99.5 → body=0.1, range=10.5, ratio≈0.0095
    // upper=9.9, lower=0.5 → upper/lower=19.8 > 3
    const shape = classifyShape(makeCandle({ open: 100, close: 100.1, high: 110, low: 99.5 }));
    expect(shape).toBe(SHAPE_GRAVESTONE_DOJI);
  });

  it("long_legged_doji: both shadows > 30% of range", () => {
    // open=100, close=100.2, high=106, low=94 → body=0.2, range=12, ratio≈0.017
    // upper=5.8, lower=6 → both > 12*0.3=3.6
    // Check dominant: upper/lower=0.967, lower/upper=1.034 → neither > 3
    const shape = classifyShape(makeCandle({ open: 100, close: 100.2, high: 106, low: 94 }));
    expect(shape).toBe(SHAPE_LONG_LEGGED_DOJI);
  });

  it("standard_doji: default when no other doji condition", () => {
    // open=100, close=100.1, high=102, low=98 → body=0.1, range=4, ratio=0.025
    // upper=1.9, lower=2 → neither dominant (1.9/2=0.95, 2/1.9=1.05 → both < 3)
    // upper=1.9 > 4*0.3=1.2, lower=2 > 1.2 → long_legged would match...
    // Need: both shadows < range*0.3
    // open=100, close=100.1, high=101, low=99 → body=0.1, range=2, ratio=0.05 → not doji since >= 0.05
    // open=100, close=100.05, high=101, low=99 → body=0.05, range=2, ratio=0.025
    // upper=0.95, lower=1 → 0.95/1=0.95 < 3, 1/0.95=1.05 < 3
    // upper=0.95 > 2*0.3=0.6, lower=1 > 0.6 → long_legged
    // Need shadows < 30% of range. range needs to be larger relative to shadows.
    // open=100, close=100.1, high=102, low=97 → body=0.1, range=5, ratio=0.02
    // upper=1.9, lower=3 → lower/upper=1.58 < 3, upper/lower=0.63 < 3
    // upper=1.9 > 5*0.3=1.5 → long_legged. Still fails.
    // We need both < range*0.3. Make one shadow small.
    // open=100, close=100.1, high=101, low=97 → body=0.1, range=4, ratio=0.025
    // upper=0.9, lower=3 → lower/upper=3.33 > 3 → dragonfly
    // Make both shadows moderate but < 30%:
    // open=100, close=100.1, high=101.1, low=99 → body=0.1, range=2.1, ratio≈0.048
    // That's still < 0.05. upper=1, lower=1 → neither > 3x, both > 2.1*0.3=0.63 → long_legged
    // Hard to avoid long_legged with balanced shadows. Need one < 30%.
    // open=100, close=100.1, high=103, low=99 → body=0.1, range=4, ratio=0.025
    // upper=2.9, lower=1 → upper/lower=2.9 < 3, lower < 4*0.3=1.2 → not long_legged
    const shape = classifyShape(makeCandle({ open: 100, close: 100.1, high: 103, low: 99 }));
    expect(shape).toBe(SHAPE_STANDARD_DOJI);
  });
});

describe("SHAPE_NAMES", () => {
  it("has 17 entries", () => {
    expect(SHAPE_NAMES).toHaveLength(17);
  });

  it("maps shape IDs to correct names", () => {
    expect(SHAPE_NAMES[SHAPE_BULL_MARUBOZU]).toBe("bull_marubozu");
    expect(SHAPE_NAMES[SHAPE_BEAR_MARUBOZU]).toBe("bear_marubozu");
    expect(SHAPE_NAMES[SHAPE_FOUR_PRICE_DOJI]).toBe("four_price_doji");
    expect(SHAPE_NAMES[SHAPE_STANDARD_DOJI]).toBe("standard_doji");
  });
});

describe("quantizeCandle", () => {
  it("returns shape, volumeBin, and correct ID", () => {
    // bull_marubozu (shape=0), normal volume (bin=1)
    const token = quantizeCandle(makeCandle({ open: 90, close: 110, high: 110.5, low: 89.5 }));
    expect(token.shape).toBe(SHAPE_BULL_MARUBOZU);
    expect(token.volumeBin).toBe(1); // normal (default)
    expect(token.id).toBe(0 * 4 + 1);
  });

  it("volume ratio affects volumeBin", () => {
    const candle = makeCandle({ open: 90, close: 110, high: 110.5, low: 89.5 });
    expect(quantizeCandle(candle, 0.3).volumeBin).toBe(0); // low
    expect(quantizeCandle(candle, 1.0).volumeBin).toBe(1); // normal
    expect(quantizeCandle(candle, 2.0).volumeBin).toBe(2); // high
    expect(quantizeCandle(candle, 3.0).volumeBin).toBe(3); // spike
  });

  it("token ID = shape * 4 + volumeBin", () => {
    const candle = makeCandle({ open: 90, close: 110, high: 110.5, low: 89.5 }); // shape=0
    expect(quantizeCandle(candle, 0.3).id).toBe(0 * 4 + 0);
    expect(quantizeCandle(candle, 1.0).id).toBe(0 * 4 + 1);
    expect(quantizeCandle(candle, 2.0).id).toBe(0 * 4 + 2);
    expect(quantizeCandle(candle, 3.0).id).toBe(0 * 4 + 3);
  });

  it("all token IDs are in [0, VOCAB_SIZE-2] (PAD excluded)", () => {
    const candles = [
      makeCandle({ open: 90, close: 110, high: 110.5, low: 89.5 }), // bull marubozu
      makeCandle({ open: 110, close: 90, high: 110.5, low: 89.5 }), // bear marubozu
      makeCandle({ open: 100, close: 100.1, high: 106, low: 94 }), // doji
      makeCandle({ open: 100, close: 100, high: 100, low: 100 }), // four-price
    ];
    for (const c of candles) {
      for (const vr of [0.1, 0.5, 1.0, 1.5, 2.5, 5.0]) {
        const token = quantizeCandle(c, vr);
        expect(token.id).toBeGreaterThanOrEqual(0);
        expect(token.id).toBeLessThan(VOCAB_SIZE - 1); // -1 for PAD
      }
    }
  });
});

describe("quantizeVolume", () => {
  it("bins volume ratios correctly", () => {
    expect(quantizeVolume(0.0)).toBe(0); // low
    expect(quantizeVolume(0.3)).toBe(0); // low
    expect(quantizeVolume(0.49)).toBe(0); // low
    expect(quantizeVolume(0.5)).toBe(1); // normal
    expect(quantizeVolume(1.0)).toBe(1); // normal
    expect(quantizeVolume(1.49)).toBe(1); // normal
    expect(quantizeVolume(1.5)).toBe(2); // high
    expect(quantizeVolume(2.0)).toBe(2); // high
    expect(quantizeVolume(2.49)).toBe(2); // high
    expect(quantizeVolume(2.5)).toBe(3); // spike
    expect(quantizeVolume(10.0)).toBe(3); // spike
  });
});

describe("computeVolumeRatios", () => {
  it("returns ratio of 1.0 for single candle", () => {
    const candles = [makeCandle({ volume: 500 })];
    const ratios = computeVolumeRatios(candles);
    expect(ratios).toHaveLength(1);
    expect(ratios[0]).toBeCloseTo(1.0);
  });

  it("computes running average for initial candles (< period)", () => {
    const candles = [
      makeCandle({ time: 0, volume: 100 }),
      makeCandle({ time: 1, volume: 200 }),
      makeCandle({ time: 2, volume: 300 }),
    ];
    const ratios = computeVolumeRatios(candles, 20);
    expect(ratios[0]).toBeCloseTo(1.0);
    expect(ratios[1]).toBeCloseTo(200 / 150);
    expect(ratios[2]).toBeCloseTo(300 / 200);
  });

  it("uses sliding window after period candles", () => {
    const candles = [
      makeCandle({ time: 0, volume: 100 }),
      makeCandle({ time: 1, volume: 100 }),
      makeCandle({ time: 2, volume: 100 }),
      makeCandle({ time: 3, volume: 300 }),
      makeCandle({ time: 4, volume: 100 }),
    ];
    const ratios = computeVolumeRatios(candles, 3);
    expect(ratios[3]).toBeCloseTo(300 / (500 / 3));
  });

  it("handles zero volume gracefully", () => {
    const candles = [makeCandle({ time: 0, volume: 0 }), makeCandle({ time: 1, volume: 0 })];
    const ratios = computeVolumeRatios(candles);
    expect(ratios[0]).toBe(1.0);
    expect(ratios[1]).toBe(1.0);
  });
});

describe("tokenizeCandles", () => {
  it("returns token IDs for each candle", () => {
    const candles = [
      makeCandle({ time: 1, open: 90, close: 110, high: 110.5, low: 89.5 }),
      makeCandle({ time: 2, open: 110, close: 90, high: 110.5, low: 89.5 }),
      makeCandle({ time: 3, open: 100, close: 100, high: 100, low: 100 }),
    ];
    const tokens = tokenizeCandles(candles);
    expect(tokens).toHaveLength(3);
    expect(tokens.every((t) => t >= 0 && t < VOCAB_SIZE)).toBe(true);
  });

  it("volume variation produces different token IDs", () => {
    const candles = [
      makeCandle({ time: 0, open: 100, close: 110, high: 111, low: 99, volume: 100 }),
      makeCandle({ time: 1, open: 100, close: 110, high: 111, low: 99, volume: 100 }),
      makeCandle({ time: 2, open: 100, close: 110, high: 111, low: 99, volume: 1000 }), // 10x spike
    ];
    const tokens = tokenizeCandles(candles);
    expect(tokens[2]).not.toBe(tokens[0]);
  });
});

describe("classifyDirection", () => {
  it("bullish when next close > current close by threshold", () => {
    const current = makeCandle({ close: 100 });
    const next = makeCandle({ close: 101 });
    expect(classifyDirection(current, next, 0.001)).toBe(0);
  });

  it("bearish when next close < current close by threshold", () => {
    const current = makeCandle({ close: 100 });
    const next = makeCandle({ close: 99 });
    expect(classifyDirection(current, next, 0.001)).toBe(1);
  });

  it("neutral when change within threshold", () => {
    const current = makeCandle({ close: 100 });
    const next = makeCandle({ close: 100.05 });
    expect(classifyDirection(current, next, 0.001)).toBe(2);
  });
});

describe("classToDirection", () => {
  it("maps class indices to labels", () => {
    expect(classToDirection(0)).toBe("bullish");
    expect(classToDirection(1)).toBe("bearish");
    expect(classToDirection(2)).toBe("neutral");
  });
});

describe("padTokens", () => {
  it("pads short sequence with PAD_TOKEN", () => {
    const tokens = [1, 2, 3];
    const padded = padTokens(tokens, 5);
    expect(padded).toEqual([PAD_TOKEN, PAD_TOKEN, 1, 2, 3]);
  });

  it("truncates long sequence (keeps last seqLen)", () => {
    const tokens = [1, 2, 3, 4, 5];
    const truncated = padTokens(tokens, 3);
    expect(truncated).toEqual([3, 4, 5]);
  });

  it("returns exact copy when equal length", () => {
    const tokens = [1, 2, 3];
    expect(padTokens(tokens, 3)).toEqual([1, 2, 3]);
  });
});
