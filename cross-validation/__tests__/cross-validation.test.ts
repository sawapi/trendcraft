import { beforeAll, describe, expect, it } from "vitest";
import {
  adl,
  adxr,
  aroon,
  atr,
  bollingerBands,
  cci,
  cmo,
  dema,
  dmi,
  donchianChannel,
  ema,
  fastStochastics,
  highest,
  kama,
  keltnerChannel,
  linearRegression,
  lowest,
  macd,
  medianPrice,
  mfi,
  obv,
  parabolicSar,
  ppo,
  roc,
  rsi,
  sma,
  standardDeviation,
  stochRsi,
  stochastics,
  t3,
  tema,
  typicalPrice,
  ultimateOscillator,
  weightedClose,
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
// Batch A: Trivial 1:1 mapping indicators
// ============================================================

describe("DEMA", () => {
  it.each([
    { period: 20, decimals: 6 },
    { period: 10, decimals: 6 },
  ])("dema(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("dema");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = dema(candles, { period });
    assertSeriesMatch(result, tc.values, decimals, `DEMA(${period})`);
  });
});

describe("TEMA", () => {
  it.each([
    { period: 20, decimals: 6 },
    { period: 10, decimals: 6 },
  ])("tema(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("tema");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = tema(candles, { period });
    assertSeriesMatch(result, tc.values, decimals, `TEMA(${period})`);
  });
});

describe("Standard Deviation", () => {
  it.each([
    { period: 20, decimals: 9 },
    { period: 10, decimals: 9 },
  ])(
    "standardDeviation(period=$period) matches TA-Lib within $decimals decimals",
    ({ period, decimals }) => {
      const fixture = loadFixture("stddev");
      const tc = fixture.test_cases.find((t) => t.params.period === period);
      if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

      const result = standardDeviation(candles, { period });
      assertSeriesMatch(result, tc.values, decimals, `StdDev(${period})`);
    },
  );
});

describe("Median Price", () => {
  it("medianPrice() matches TA-Lib within 10 decimals", () => {
    const fixture = loadFixture("medprice");
    const tc = fixture.test_cases[0];
    if (!isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = medianPrice(candles);
    assertSeriesMatch(result, tc.values, 10, "MedianPrice");
  });
});

describe("Typical Price", () => {
  it("typicalPrice() matches TA-Lib within 10 decimals", () => {
    const fixture = loadFixture("typprice");
    const tc = fixture.test_cases[0];
    if (!isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = typicalPrice(candles);
    assertSeriesMatch(result, tc.values, 10, "TypicalPrice");
  });
});

describe("Weighted Close", () => {
  it("weightedClose() matches TA-Lib within 10 decimals", () => {
    const fixture = loadFixture("wclprice");
    const tc = fixture.test_cases[0];
    if (!isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = weightedClose(candles);
    assertSeriesMatch(result, tc.values, 10, "WeightedClose");
  });
});

describe("ADL", () => {
  it("adl() matches TA-Lib within 0 decimals", () => {
    const fixture = loadFixture("ad");
    const tc = fixture.test_cases[0];
    if (!isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = adl(candles);
    assertSeriesMatch(result, tc.values, 0, "ADL");
  });
});

describe("CMO", () => {
  it.each([
    { period: 14, decimals: 6 },
    { period: 9, decimals: 6 },
  ])("cmo(period=$period) matches TA-Lib within $decimals decimals", ({ period, decimals }) => {
    const fixture = loadFixture("cmo");
    const tc = fixture.test_cases.find((t) => t.params.period === period);
    if (!tc || !isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = cmo(candles, { period });
    assertSeriesMatch(result, tc.values, decimals, `CMO(${period})`);
  });
});

// ============================================================
// Batch B: Composite / parameter-mapping indicators
// ============================================================

describe("Aroon", () => {
  it("aroon(25) matches TA-Lib within 6 decimals", () => {
    const fixture = loadFixture("aroon");
    const tc = fixture.test_cases[0];
    if (isSingleTestCase(tc)) throw new Error("Expected composite test case");

    const result = aroon(candles, { period: 25 });

    const upValues = result.map((r) => ({ time: r.time, value: r.value.up }));
    const downValues = result.map((r) => ({ time: r.time, value: r.value.down }));
    const oscValues = result.map((r) => ({ time: r.time, value: r.value.oscillator }));

    assertSeriesMatch(upValues, tc.values.up, 6, "Aroon Up");
    assertSeriesMatch(downValues, tc.values.down, 6, "Aroon Down");
    assertSeriesMatch(oscValues, tc.values.oscillator, 6, "Aroon Oscillator");
  });
});

describe("PPO", () => {
  it("ppo(12,26,9) matches TA-Lib within 3 decimals (after warmup)", () => {
    const fixture = loadFixture("ppo");
    const tc = fixture.test_cases[0];
    if (isSingleTestCase(tc)) throw new Error("Expected composite test case");

    const result = ppo(candles, { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });

    const ppoValues = result.map((r) => ({
      time: r.time,
      value: r.value === null ? null : r.value.ppo,
    }));
    const signalValues = result.map((r) => ({
      time: r.time,
      value: r.value === null ? null : r.value.signal,
    }));
    const histValues = result.map((r) => ({
      time: r.time,
      value: r.value === null ? null : r.value.histogram,
    }));

    assertSeriesMatch(ppoValues, tc.values.ppo, 3, "PPO line", 75);
    assertSeriesMatch(signalValues, tc.values.signal, 3, "PPO signal", 75);
    assertSeriesMatch(histValues, tc.values.histogram, 3, "PPO histogram", 75);
  });
});

describe("ADXR", () => {
  it("adxr(14) matches TA-Lib within 8 decimals", () => {
    const fixture = loadFixture("adxr");
    const tc = fixture.test_cases[0];
    if (!isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = adxr(candles, { period: 14 });
    assertSeriesMatch(result, tc.values, 8, "ADXR(14)");
  });
});

describe("Ultimate Oscillator", () => {
  it("ultimateOscillator(7,14,28) matches TA-Lib within 6 decimals", () => {
    const fixture = loadFixture("ultosc");
    const tc = fixture.test_cases[0];
    if (!isSingleTestCase(tc)) throw new Error("Expected single test case");

    const result = ultimateOscillator(candles, { period1: 7, period2: 14, period3: 28 });
    assertSeriesMatch(result, tc.values, 6, "UltOsc(7,14,28)");
  });
});

describe("Linear Regression", () => {
  it("linearRegression(14) value and slope match TA-Lib within 6 decimals", () => {
    const fixture = loadFixture("linearreg");
    const tc = fixture.test_cases[0];
    if (isSingleTestCase(tc)) throw new Error("Expected composite test case");

    const result = linearRegression(candles, { period: 14 });

    const valueResults = result.map((r) => ({
      time: r.time,
      value: r.value === null ? null : r.value.value,
    }));
    const slopeResults = result.map((r) => ({
      time: r.time,
      value: r.value === null ? null : r.value.slope,
    }));

    assertSeriesMatch(valueResults, tc.values.value, 6, "LinReg value");
    assertSeriesMatch(slopeResults, tc.values.slope, 6, "LinReg slope");
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
