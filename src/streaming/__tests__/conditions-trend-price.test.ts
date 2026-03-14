/**
 * Trend, Price, Perfect Order, Keltner, Donchian Streaming Conditions Tests
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import {
  donchianBreakoutHigh,
  donchianBreakoutLow,
  donchianMiddleCrossDown,
  donchianMiddleCrossUp,
} from "../conditions/donchian";
import { keltnerBreakout, keltnerSqueeze, keltnerTouch } from "../conditions/keltner";
import {
  perfectOrderBearish,
  perfectOrderBullish,
  perfectOrderCollapsed,
  perfectOrderForming,
} from "../conditions/perfect-order";
import { newHigh, newLow, priceDroppedAtr, priceGainedAtr } from "../conditions/price";
import {
  ichimokuBearish,
  ichimokuBullish,
  sarFlip,
  supertrendBearish,
  supertrendBullish,
  supertrendFlip,
} from "../conditions/trend";

const candle: NormalizedCandle = {
  time: 1000,
  open: 100,
  high: 105,
  low: 95,
  close: 102,
  volume: 1000,
};

// ==========================================
// Trend conditions
// ==========================================

describe("supertrendBullish / supertrendBearish", () => {
  it("detects bullish", () => {
    expect(
      supertrendBullish().evaluate({ supertrend: { direction: 1, supertrend: 98 } }, candle),
    ).toBe(true);
  });

  it("detects bearish", () => {
    expect(
      supertrendBearish().evaluate({ supertrend: { direction: -1, supertrend: 108 } }, candle),
    ).toBe(true);
  });
});

describe("supertrendFlip", () => {
  it("detects direction change", () => {
    const cond = supertrendFlip();
    cond.evaluate({ supertrend: { direction: 1 } }, candle);
    expect(cond.evaluate({ supertrend: { direction: -1 } }, candle)).toBe(true);
  });

  it("returns false when direction unchanged", () => {
    const cond = supertrendFlip();
    cond.evaluate({ supertrend: { direction: 1 } }, candle);
    expect(cond.evaluate({ supertrend: { direction: 1 } }, candle)).toBe(false);
  });
});

describe("ichimokuBullish / ichimokuBearish", () => {
  it("detects bullish (above cloud)", () => {
    expect(ichimokuBullish().evaluate({ ichimoku: { senkouA: 90, senkouB: 95 } }, candle)).toBe(
      true,
    );
  });

  it("detects bearish (below cloud)", () => {
    const lowCandle = { ...candle, close: 85 };
    expect(ichimokuBearish().evaluate({ ichimoku: { senkouA: 90, senkouB: 95 } }, lowCandle)).toBe(
      true,
    );
  });
});

describe("sarFlip", () => {
  it("detects SAR direction change", () => {
    const cond = sarFlip();
    cond.evaluate({ parabolicSar: { direction: 1, sar: 98 } }, candle);
    expect(cond.evaluate({ parabolicSar: { direction: -1, sar: 105 } }, candle)).toBe(true);
  });
});

// ==========================================
// Price conditions
// ==========================================

describe("priceDroppedAtr / priceGainedAtr", () => {
  it("detects price drop > ATR", () => {
    const cond = priceDroppedAtr(1.0);
    cond.evaluate({ atr: 2 }, { ...candle, close: 105 });
    expect(cond.evaluate({ atr: 2 }, { ...candle, close: 102 })).toBe(true); // dropped 3 > 2
  });

  it("detects price gain > ATR", () => {
    const cond = priceGainedAtr(1.0);
    cond.evaluate({ atr: 2 }, { ...candle, close: 100 });
    expect(cond.evaluate({ atr: 2 }, { ...candle, close: 103 })).toBe(true); // gained 3 > 2
  });
});

describe("newHigh / newLow", () => {
  it("detects new high", () => {
    const cond = newHigh();
    cond.evaluate({ donchian: { upper: 100, middle: 95, lower: 90 } }, candle);
    expect(
      cond.evaluate({ donchian: { upper: 104, middle: 97, lower: 90 } }, { ...candle, high: 106 }),
    ).toBe(true);
  });

  it("detects new low", () => {
    const cond = newLow();
    cond.evaluate({ donchian: { upper: 110, middle: 100, lower: 95 } }, candle);
    expect(
      cond.evaluate({ donchian: { upper: 108, middle: 99, lower: 94 } }, { ...candle, low: 93 }),
    ).toBe(true);
  });
});

// ==========================================
// Perfect Order conditions
// ==========================================

describe("perfectOrderBullish", () => {
  it("detects bullish alignment", () => {
    expect(
      perfectOrderBullish().evaluate(
        {
          emaRibbon: { values: [110, 105, 100, 95, 90], bullish: true, expanding: true },
        },
        candle,
      ),
    ).toBe(true);
  });

  it("returns false for non-bullish", () => {
    expect(
      perfectOrderBullish().evaluate(
        {
          emaRibbon: { values: [90, 95, 100, 105, 110], bullish: false, expanding: false },
        },
        candle,
      ),
    ).toBe(false);
  });
});

describe("perfectOrderBearish", () => {
  it("detects bearish alignment", () => {
    expect(
      perfectOrderBearish().evaluate(
        {
          emaRibbon: { values: [90, 95, 100, 105, 110], bullish: false, expanding: false },
        },
        candle,
      ),
    ).toBe(true);
  });
});

describe("perfectOrderForming / perfectOrderCollapsed", () => {
  it("detects forming", () => {
    expect(
      perfectOrderForming().evaluate(
        {
          emaRibbon: { values: [105, 100, 95], bullish: true, expanding: true },
        },
        candle,
      ),
    ).toBe(true);
  });

  it("detects collapsed", () => {
    expect(
      perfectOrderCollapsed().evaluate(
        {
          emaRibbon: { values: [100, 100, 100], bullish: false, expanding: false },
        },
        candle,
      ),
    ).toBe(true);
  });
});

// ==========================================
// Keltner conditions
// ==========================================

describe("keltnerBreakout", () => {
  it("detects upper breakout", () => {
    expect(
      keltnerBreakout("upper").evaluate(
        { keltner: { upper: 101, middle: 100, lower: 99 } },
        candle,
      ),
    ).toBe(true);
  });

  it("detects lower breakout", () => {
    const lowCandle = { ...candle, close: 94 };
    expect(
      keltnerBreakout("lower").evaluate(
        { keltner: { upper: 110, middle: 100, lower: 95 } },
        lowCandle,
      ),
    ).toBe(true);
  });
});

describe("keltnerTouch", () => {
  it("detects price near upper band", () => {
    expect(
      keltnerTouch("upper", 0.5).evaluate(
        { keltner: { upper: 102.3, middle: 100, lower: 97.7 } },
        candle,
      ),
    ).toBe(true);
  });
});

describe("keltnerSqueeze (TTM)", () => {
  it("detects BB inside Keltner", () => {
    expect(
      keltnerSqueeze().evaluate(
        {
          bb: { upper: 102, lower: 98, middle: 100, bandwidth: 0.04, percentB: 0.5 },
          keltner: { upper: 105, lower: 95, middle: 100 },
        },
        candle,
      ),
    ).toBe(true);
  });

  it("returns false when BB outside Keltner", () => {
    expect(
      keltnerSqueeze().evaluate(
        {
          bb: { upper: 110, lower: 90, middle: 100, bandwidth: 0.2, percentB: 0.5 },
          keltner: { upper: 105, lower: 95, middle: 100 },
        },
        candle,
      ),
    ).toBe(false);
  });
});

// ==========================================
// Donchian conditions
// ==========================================

describe("donchianBreakoutHigh / donchianBreakoutLow", () => {
  it("detects upper breakout", () => {
    expect(
      donchianBreakoutHigh().evaluate({ donchian: { upper: 101, middle: 98, lower: 95 } }, candle),
    ).toBe(true);
  });

  it("detects lower breakout", () => {
    const lowCandle = { ...candle, close: 93 };
    expect(
      donchianBreakoutLow().evaluate(
        { donchian: { upper: 105, middle: 100, lower: 95 } },
        lowCandle,
      ),
    ).toBe(true);
  });
});

describe("donchianMiddleCrossUp / donchianMiddleCrossDown", () => {
  it("detects cross above middle", () => {
    const cond = donchianMiddleCrossUp();
    cond.evaluate({ donchian: { upper: 110, middle: 103, lower: 90 } }, { ...candle, close: 100 });
    expect(
      cond.evaluate(
        { donchian: { upper: 110, middle: 103, lower: 90 } },
        { ...candle, close: 105 },
      ),
    ).toBe(true);
  });

  it("detects cross below middle", () => {
    const cond = donchianMiddleCrossDown();
    cond.evaluate({ donchian: { upper: 110, middle: 103, lower: 90 } }, { ...candle, close: 105 });
    expect(
      cond.evaluate(
        { donchian: { upper: 110, middle: 103, lower: 90 } },
        { ...candle, close: 100 },
      ),
    ).toBe(true);
  });
});
