/**
 * Indicator Performance Benchmarks
 */

import { bench, describe } from "vitest";
import { atr, bollingerBands, ema, macd, rsi, sma } from "../indicators";
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
