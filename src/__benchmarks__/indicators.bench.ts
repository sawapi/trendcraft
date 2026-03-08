/**
 * Indicator Performance Benchmarks
 */

import { bench, describe } from "vitest";
import { atr, bollingerBands, ema, macd, rsi, sma } from "../indicators";
import { dmi, stochRsi, stochastics } from "../indicators/momentum";
import { ichimoku, supertrend } from "../indicators/trend";
import { volumeProfileSeries } from "../indicators/volume";
import { generateCandles } from "./helpers";

const candles500 = generateCandles(500);
const candles2000 = generateCandles(2000);

describe("Indicators - 500 candles", () => {
  bench("SMA(20)", () => {
    sma(candles500, { period: 20 });
  });

  bench("EMA(20)", () => {
    ema(candles500, { period: 20 });
  });

  bench("RSI(14)", () => {
    rsi(candles500, { period: 14 });
  });

  bench("MACD(12,26,9)", () => {
    macd(candles500);
  });

  bench("Bollinger Bands(20,2)", () => {
    bollingerBands(candles500);
  });

  bench("ATR(14)", () => {
    atr(candles500);
  });
});

describe("Indicators - 2000 candles", () => {
  bench("SMA(20)", () => {
    sma(candles2000, { period: 20 });
  });

  bench("RSI(14)", () => {
    rsi(candles2000, { period: 14 });
  });

  bench("MACD(12,26,9)", () => {
    macd(candles2000);
  });

  bench("Bollinger Bands(20,2)", () => {
    bollingerBands(candles2000);
  });
});

describe("Compute-heavy indicators - 500 candles", () => {
  bench("Ichimoku(9,26,52)", () => {
    ichimoku(candles500);
  });

  bench("DMI/ADX(14)", () => {
    dmi(candles500);
  });

  bench("Supertrend(10,3)", () => {
    supertrend(candles500);
  });

  bench("Stochastics(14,3)", () => {
    stochastics(candles500);
  });

  bench("StochRSI(14,14,3,3)", () => {
    stochRsi(candles500);
  });

  bench("Volume Profile(20)", () => {
    volumeProfileSeries(candles500, { period: 20 });
  });
});

describe("Compute-heavy indicators - 2000 candles", () => {
  bench("Ichimoku(9,26,52)", () => {
    ichimoku(candles2000);
  });

  bench("DMI/ADX(14)", () => {
    dmi(candles2000);
  });

  bench("Supertrend(10,3)", () => {
    supertrend(candles2000);
  });

  bench("Stochastics(14,3)", () => {
    stochastics(candles2000);
  });

  bench("StochRSI(14,14,3,3)", () => {
    stochRsi(candles2000);
  });

  bench("Volume Profile(20)", () => {
    volumeProfileSeries(candles2000, { period: 20 });
  });
});
