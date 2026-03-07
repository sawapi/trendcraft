import { beforeAll, describe, expect, it } from "vitest";
import {
  atr,
  bollingerBands,
  cci,
  dmi,
  donchianChannel,
  ema,
  fastStochastics,
  highest,
  kama,
  keltnerChannel,
  lowest,
  macd,
  mfi,
  obv,
  parabolicSar,
  roc,
  rsi,
  sma,
  stochRsi,
  stochastics,
  t3,
  williamsR,
  wma,
} from "../../src";
import type { NormalizedCandle, Series } from "../../src/types";
import { assertSeriesMatch, isSingleTestCase, loadFixture, loadOhlcv } from "./helpers";

let candles: NormalizedCandle[];

beforeAll(() => {
  candles = loadOhlcv();
});

// ============================================================
// Phase 1: Direct-match indicators
// ============================================================

describe("SMA", () => {
  it.each([
    { period: 20, decimals: 10 },
    { period: 5, decimals: 10 },
  ])("sma(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("sma");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = sma(candles, { period });
    assertSeriesMatch(result, tc.values, decimals, `SMA(${period})`);
  });
});

describe("EMA", () => {
  it.each([
    { period: 12, decimals: 6 },
    { period: 26, decimals: 6 },
  ])("ema(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("ema");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = ema(candles, { period });
    assertSeriesMatch(result, tc.values, decimals, `EMA(${period})`);
  });
});

describe("WMA", () => {
  it.each([
    { period: 10, decimals: 8 },
    { period: 20, decimals: 8 },
  ])("wma(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("wma");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = wma(candles, { period });
    assertSeriesMatch(result, tc.values, decimals, `WMA(${period})`);
  });
});

describe("RSI", () => {
  it.each([
    { period: 14, decimals: 6 },
    { period: 7, decimals: 6 },
  ])("rsi(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("rsi");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = rsi(candles, { period });
    assertSeriesMatch(result, tc.values, decimals, `RSI(${period})`);
  });
});

describe("ATR", () => {
  it.each([
    { period: 14, decimals: 8 },
    { period: 7, decimals: 8 },
  ])("atr(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("atr");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = atr(candles, { period });
    assertSeriesMatch(result, tc.values, decimals, `ATR(${period})`);
  });
});

describe("CCI", () => {
  it.each([
    { period: 20, decimals: 6 },
    { period: 14, decimals: 6 },
  ])("cci(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("cci");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = cci(candles, { period });
    assertSeriesMatch(result, tc.values, decimals, `CCI(${period})`);
  });
});

describe("Williams %R", () => {
  it.each([
    { period: 14, decimals: 6 },
    { period: 7, decimals: 6 },
  ])(
    "williamsR(period=$period) matches TA-Lib within $decimals decimals",
    ({ period, decimals }) => {
      const fixture = loadFixture("williams-r");
      const tc = fixture.test_cases.find((t) => t.params.period === period);
      if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

      const result = williamsR(candles, { period });
      assertSeriesMatch(result, tc.values, decimals, `WilliamsR(${period})`);
    },
  );
});

describe("ROC", () => {
  it.each([
    { period: 12, decimals: 6 },
    { period: 9, decimals: 6 },
  ])("roc(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("roc");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = roc(candles, { period });
    assertSeriesMatch(result, tc.values, decimals, `ROC(${period})`);
  });
});

describe("OBV", () => {
  it("obv() matches TA-Lib (normalized)", () => {
    const fixture = loadFixture("obv");
    const tc = fixture.test_cases[0];
    if (!isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = obv(candles);
    assertSeriesMatch(result, tc.values, 0, "OBV");
  });
});

describe("Highest", () => {
  it.each([
    { period: 20, decimals: 10 },
    { period: 10, decimals: 10 },
  ])("highest(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("highest");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = highest(candles, period);
    assertSeriesMatch(result, tc.values, decimals, `Highest(${period})`);
  });
});

describe("Lowest", () => {
  it.each([
    { period: 20, decimals: 10 },
    { period: 10, decimals: 10 },
  ])("lowest(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("lowest");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = lowest(candles, period);
    assertSeriesMatch(result, tc.values, decimals, `Lowest(${period})`);
  });
});

// ============================================================
// Phase 2: Composite output indicators
// ============================================================

describe("MACD", () => {
  // MACD = EMA(fast) - EMA(slow). TA-Lib's internal MACD computes EMA(12)
  // starting from index 0 while EMA(26) starts at index 25, causing the
  // EMA(12) seed to include more pre-warmup values. This creates slight
  // divergence that converges exponentially (~1 decimal per 15 indices).
  it("macd(12,26,9) matches TA-Lib within 3 decimals (after warmup)", () => {
    const fixture = loadFixture("macd");
    const tc = fixture.test_cases[0];
    if (isSingleTestCase(tc)) throw new Error("Expected composite test case");

    const result = macd(candles, { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });

    const macdValues = result.map((r) => ({ time: r.time, value: r.value.macd }));
    const signalValues = result.map((r) => ({ time: r.time, value: r.value.signal }));
    const histValues = result.map((r) => ({ time: r.time, value: r.value.histogram }));

    assertSeriesMatch(macdValues, tc.values.macd, 3, "MACD line", 75);
    assertSeriesMatch(signalValues, tc.values.signal, 3, "MACD signal", 75);
    assertSeriesMatch(histValues, tc.values.histogram, 3, "MACD histogram", 75);
  });
});

describe("Fast Stochastics", () => {
  it("fastStochastics(14,3) matches TA-Lib within 4 decimals", () => {
    const fixture = loadFixture("fast-stochastics");
    const tc = fixture.test_cases[0];
    if (isSingleTestCase(tc)) throw new Error("Expected composite test case");

    const result = fastStochastics(candles, { kPeriod: 14, dPeriod: 3 });

    const kValues = result.map((r) => ({ time: r.time, value: r.value.k }));
    const dValues = result.map((r) => ({ time: r.time, value: r.value.d }));

    assertSeriesMatch(kValues, tc.values.k, 4, "Fast %K");
    assertSeriesMatch(dValues, tc.values.d, 4, "Fast %D");
  });
});

describe("Slow Stochastics", () => {
  it("stochastics(14,3,3) matches TA-Lib within 4 decimals", () => {
    const fixture = loadFixture("stochastics");
    const tc = fixture.test_cases[0];
    if (isSingleTestCase(tc)) throw new Error("Expected composite test case");

    const result = stochastics(candles, { kPeriod: 14, dPeriod: 3, slowing: 3 });

    const kValues = result.map((r) => ({ time: r.time, value: r.value.k }));
    const dValues = result.map((r) => ({ time: r.time, value: r.value.d }));

    assertSeriesMatch(kValues, tc.values.k, 4, "Slow %K");
    assertSeriesMatch(dValues, tc.values.d, 4, "Slow %D");
  });
});

describe("MFI", () => {
  it.each([
    { period: 14, decimals: 6 },
    { period: 10, decimals: 6 },
  ])("mfi(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("mfi");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = mfi(candles, { period });
    assertSeriesMatch(result, tc.values, decimals, `MFI(${period})`);
  });
});

describe("DMI", () => {
  it("dmi(14) matches TA-Lib within 8 decimals", () => {
    const fixture = loadFixture("dmi");
    const tc = fixture.test_cases[0];
    if (isSingleTestCase(tc)) throw new Error("Expected composite test case");

    const result = dmi(candles, { period: 14 });

    const plusDiValues = result.map((r) => ({ time: r.time, value: r.value.plusDi }));
    const minusDiValues = result.map((r) => ({ time: r.time, value: r.value.minusDi }));
    const adxValues = result.map((r) => ({ time: r.time, value: r.value.adx }));

    assertSeriesMatch(plusDiValues, tc.values.plusDi, 8, "+DI");
    assertSeriesMatch(minusDiValues, tc.values.minusDi, 8, "-DI");
    assertSeriesMatch(adxValues, tc.values.adx, 8, "ADX");
  });
});

describe("Donchian Channel", () => {
  it("donchianChannel(20) matches TA-Lib within 10 decimals", () => {
    const fixture = loadFixture("donchian-channel");
    const tc = fixture.test_cases[0];
    if (isSingleTestCase(tc)) throw new Error("Expected composite test case");

    const result = donchianChannel(candles, { period: 20 });

    const upperValues = result.map((r) => ({ time: r.time, value: r.value.upper }));
    const middleValues = result.map((r) => ({ time: r.time, value: r.value.middle }));
    const lowerValues = result.map((r) => ({ time: r.time, value: r.value.lower }));

    assertSeriesMatch(upperValues, tc.values.upper, 10, "Donchian upper");
    assertSeriesMatch(middleValues, tc.values.middle, 10, "Donchian middle");
    assertSeriesMatch(lowerValues, tc.values.lower, 10, "Donchian lower");
  });
});

describe("StochRSI", () => {
  it("stochRsi(14,14,3,3) matches TA-Lib within 4 decimals", () => {
    const fixture = loadFixture("stoch-rsi");
    const tc = fixture.test_cases[0];
    if (isSingleTestCase(tc)) throw new Error("Expected composite test case");

    const result = stochRsi(candles, { rsiPeriod: 14, stochPeriod: 14, kPeriod: 3, dPeriod: 3 });

    const kValues = result.map((r) => ({ time: r.time, value: r.value.k }));
    const dValues = result.map((r) => ({ time: r.time, value: r.value.d }));

    assertSeriesMatch(kValues, tc.values.k, 4, "StochRSI %K");
    assertSeriesMatch(dValues, tc.values.d, 4, "StochRSI %D");
  });
});

describe("Keltner Channel", () => {
  it("keltnerChannel(20,10,2) matches TA-Lib within 6 decimals", () => {
    const fixture = loadFixture("keltner-channel");
    const tc = fixture.test_cases[0];
    if (isSingleTestCase(tc)) throw new Error("Expected composite test case");

    const result = keltnerChannel(candles, { emaPeriod: 20, atrPeriod: 10, multiplier: 2 });

    const upperValues = result.map((r) => ({ time: r.time, value: r.value.upper }));
    const middleValues = result.map((r) => ({ time: r.time, value: r.value.middle }));
    const lowerValues = result.map((r) => ({ time: r.time, value: r.value.lower }));

    assertSeriesMatch(middleValues, tc.values.middle, 6, "Keltner middle");
    assertSeriesMatch(upperValues, tc.values.upper, 6, "Keltner upper");
    assertSeriesMatch(lowerValues, tc.values.lower, 6, "Keltner lower");
  });
});

// ============================================================
// Phase 3: Known discrepancy indicators
// ============================================================

describe("Bollinger Bands", () => {
  it("bollingerBands(20,2) matches TA-Lib within 8 decimals", () => {
    const fixture = loadFixture("bollinger-bands");
    const tc = fixture.test_cases[0];
    if (isSingleTestCase(tc)) throw new Error("Expected composite test case");

    const result = bollingerBands(candles, { period: 20, stdDev: 2 });

    const upperValues = result.map((r) => ({ time: r.time, value: r.value.upper }));
    const middleValues = result.map((r) => ({ time: r.time, value: r.value.middle }));
    const lowerValues = result.map((r) => ({ time: r.time, value: r.value.lower }));

    assertSeriesMatch(middleValues, tc.values.middle, 10, "BB middle");
    assertSeriesMatch(upperValues, tc.values.upper, 8, "BB upper");
    assertSeriesMatch(lowerValues, tc.values.lower, 8, "BB lower");
  });
});

describe("KAMA", () => {
  it.each([
    { period: 10, decimals: 6 },
    { period: 20, decimals: 6 },
  ])("kama(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("kama");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = kama(candles, { period });
    assertSeriesMatch(result, tc.values, decimals, `KAMA(${period})`);
  });
});

describe("T3", () => {
  it.each([
    { period: 5, decimals: 4 },
    { period: 8, decimals: 4 },
  ])("t3(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("t3");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = t3(candles, { period, vFactor: 0.7 });
    assertSeriesMatch(result, tc.values, decimals, `T3(${period})`);
  });
});

describe("Parabolic SAR", () => {
  it("parabolicSar(0.02, 0.2) matches TA-Lib within 8 decimals", () => {
    const fixture = loadFixture("parabolic-sar");
    const tc = fixture.test_cases[0];
    if (!isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = parabolicSar(candles, { step: 0.02, max: 0.2 });

    const sarValues = result.map((r) => ({ time: r.time, value: r.value.sar }));
    assertSeriesMatch(sarValues, tc.values, 8, "Parabolic SAR");
  });
});
