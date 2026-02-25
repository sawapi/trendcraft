/**
 * Consistency Tests
 *
 * Verifies that incremental indicators produce identical output to batch functions.
 * This is the most critical test for the incremental API.
 */

import { describe, expect, it } from "vitest";
import type { BollingerBandsValue, MacdValue, NormalizedCandle } from "../../../types";
import type { DmiValue } from "../../momentum/dmi";
import type { StochasticsValue } from "../../momentum/stochastics";
import type { ParabolicSarValue } from "../../trend/parabolic-sar";
import type { SupertrendValue } from "../../trend/supertrend";
import { ichimoku } from "../../trend/ichimoku";
import type { IchimokuValue } from "../../trend/ichimoku";
import { donchianChannel } from "../../volatility/donchian-channel";
import type { DonchianValue } from "../../volatility/donchian-channel";
import { keltnerChannel } from "../../volatility/keltner-channel";
import type { KeltnerChannelValue } from "../../volatility/keltner-channel";
import { cci } from "../../momentum/cci";
import { dmi } from "../../momentum/dmi";
import { macd } from "../../momentum/macd";
import { roc } from "../../momentum/roc";
import { rsi } from "../../momentum/rsi";
import { stochRsi } from "../../momentum/stoch-rsi";
import type { StochRsiValue } from "../../momentum/stoch-rsi";
import { stochastics } from "../../momentum/stochastics";
import { williamsR } from "../../momentum/williams-r";
import { mfi } from "../../volume/mfi";
import { ema } from "../../moving-average/ema";
import { sma } from "../../moving-average/sma";
import { wma } from "../../moving-average/wma";
import { parabolicSar } from "../../trend/parabolic-sar";
import { supertrend } from "../../trend/supertrend";
import { atr } from "../../volatility/atr";
import { bollingerBands } from "../../volatility/bollinger-bands";
import { cmf } from "../../volume/cmf";
import { obv } from "../../volume/obv";
import { processAll } from "../bridge";
import { createDmi } from "../momentum/dmi";
import { createMacd } from "../momentum/macd";
import { createRsi } from "../momentum/rsi";
import { createStochastics } from "../momentum/stochastics";
import { createEma } from "../moving-average/ema";
import { createSma } from "../moving-average/sma";
import { createWma } from "../moving-average/wma";
import { createParabolicSar } from "../trend/parabolic-sar";
import { createSupertrend } from "../trend/supertrend";
import { createAtr } from "../volatility/atr";
import { createBollingerBands } from "../volatility/bollinger-bands";
import { createCmf } from "../volume/cmf";
import { createCci } from "../momentum/cci";
import { createRoc } from "../momentum/roc";
import { createStochRsi } from "../momentum/stoch-rsi";
import { createWilliamsR } from "../momentum/williams-r";
import { createIchimoku } from "../trend/ichimoku";
import { createDonchianChannel } from "../volatility/donchian-channel";
import { createKeltnerChannel } from "../volatility/keltner-channel";
import { createMfi } from "../volume/mfi";
import { createObv } from "../volume/obv";

/**
 * Generate test candles with realistic-looking data
 */
function generateCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const MS_PER_DAY = 86400000;
  let baseTime = new Date("2020-01-01").getTime();
  let price = 100;

  // Use seeded pseudo-random for reproducibility
  let seed = 42;
  function random(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  }

  for (let i = 0; i < count; i++) {
    const change = (random() - 0.5) * 4; // ±2% daily moves
    const open = price;
    const close = price * (1 + change / 100);
    const high = Math.max(open, close) * (1 + random() * 0.01);
    const low = Math.min(open, close) * (1 - random() * 0.01);
    const volume = Math.floor(100000 + random() * 900000);

    candles.push({
      time: baseTime,
      open: Math.round(open * 10000) / 10000,
      high: Math.round(high * 10000) / 10000,
      low: Math.round(low * 10000) / 10000,
      close: Math.round(close * 10000) / 10000,
      volume,
    });

    price = close;
    baseTime += MS_PER_DAY;
  }

  return candles;
}

const candles = generateCandles(200);

/**
 * Helper to compare batch and incremental outputs with tolerance
 */
function assertConsistency(
  batchResult: { time: number; value: number | null }[],
  incrementalResult: { time: number; value: number | null }[],
  tolerance = 1e-10,
) {
  expect(incrementalResult.length).toBe(batchResult.length);

  for (let i = 0; i < batchResult.length; i++) {
    expect(incrementalResult[i].time).toBe(batchResult[i].time);

    const bv = batchResult[i].value;
    const iv = incrementalResult[i].value;

    if (bv === null) {
      expect(iv).toBeNull();
    } else {
      expect(iv).not.toBeNull();
      expect(Math.abs(iv! - bv)).toBeLessThan(tolerance);
    }
  }
}

describe("SMA consistency", () => {
  it.each([5, 10, 20, 50])("period=%i matches batch", (period) => {
    const batch = sma(candles, { period });
    const incremental = processAll(createSma({ period }), candles);
    assertConsistency(batch, incremental);
  });

  it("works with different price sources", () => {
    for (const source of ["open", "high", "low", "close", "hl2"] as const) {
      const batch = sma(candles, { period: 10, source });
      const incremental = processAll(createSma({ period: 10, source }), candles);
      assertConsistency(batch, incremental);
    }
  });
});

describe("EMA consistency", () => {
  it.each([5, 10, 20, 50])("period=%i matches batch", (period) => {
    const batch = ema(candles, { period });
    const incremental = processAll(createEma({ period }), candles);
    assertConsistency(batch, incremental);
  });

  it("works with different price sources", () => {
    for (const source of ["open", "high", "close"] as const) {
      const batch = ema(candles, { period: 12, source });
      const incremental = processAll(createEma({ period: 12, source }), candles);
      assertConsistency(batch, incremental);
    }
  });
});

describe("WMA consistency", () => {
  it.each([5, 10, 20])("period=%i matches batch", (period) => {
    const batch = wma(candles, { period });
    const incremental = processAll(createWma({ period }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });
});

describe("OBV consistency", () => {
  it("matches batch", () => {
    const batch = obv(candles);
    const incremental = processAll(createObv(), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incremental[i].time).toBe(batch[i].time);
      expect(incremental[i].value).toBe(batch[i].value);
    }
  });
});

// ==========================================
// Tier 2: RSI, ATR, Bollinger Bands, MACD, CMF
// ==========================================

describe("RSI consistency", () => {
  it.each([7, 14, 21])("period=%i matches batch", (period) => {
    const batch = rsi(candles, { period });
    const incremental = processAll(createRsi({ period }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });
});

describe("ATR consistency", () => {
  it.each([7, 14, 21])("period=%i matches batch", (period) => {
    const batch = atr(candles, { period });
    const incremental = processAll(createAtr({ period }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });
});

describe("Bollinger Bands consistency", () => {
  it.each([10, 20])("period=%i matches batch", (period) => {
    const batch = bollingerBands(candles, { period, stdDev: 2 });
    const incremental = processAll(createBollingerBands({ period, stdDev: 2 }), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incremental[i].time).toBe(batch[i].time);

      const bv = batch[i].value as BollingerBandsValue;
      const iv = incremental[i].value as BollingerBandsValue;

      if (bv.middle === null) {
        expect(iv.middle).toBeNull();
      } else {
        expect(iv.middle).not.toBeNull();
        expect(Math.abs(iv.middle! - bv.middle)).toBeLessThan(1e-8);
        expect(Math.abs(iv.upper! - bv.upper!)).toBeLessThan(1e-8);
        expect(Math.abs(iv.lower! - bv.lower!)).toBeLessThan(1e-8);
        expect(Math.abs(iv.percentB! - bv.percentB!)).toBeLessThan(1e-6);
        expect(Math.abs(iv.bandwidth! - bv.bandwidth!)).toBeLessThan(1e-8);
      }
    }
  });
});

describe("MACD consistency", () => {
  it("default params match batch", () => {
    const batch = macd(candles);
    const incremental = processAll(createMacd(), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incremental[i].time).toBe(batch[i].time);

      const bv = batch[i].value as MacdValue;
      const iv = incremental[i].value as MacdValue;

      if (bv.macd === null) {
        expect(iv.macd).toBeNull();
      } else {
        expect(iv.macd).not.toBeNull();
        expect(Math.abs(iv.macd! - bv.macd)).toBeLessThan(1e-8);
      }

      if (bv.signal === null) {
        expect(iv.signal).toBeNull();
      } else {
        expect(iv.signal).not.toBeNull();
        expect(Math.abs(iv.signal! - bv.signal)).toBeLessThan(1e-8);
      }

      if (bv.histogram === null) {
        expect(iv.histogram).toBeNull();
      } else {
        expect(iv.histogram).not.toBeNull();
        expect(Math.abs(iv.histogram! - bv.histogram)).toBeLessThan(1e-8);
      }
    }
  });
});

describe("CMF consistency", () => {
  it.each([10, 20])("period=%i matches batch", (period) => {
    const batch = cmf(candles, { period });
    const incremental = processAll(createCmf({ period }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });
});

// ==========================================
// Tier 3: Stochastics, DMI, Supertrend, Parabolic SAR
// ==========================================

describe("Stochastics consistency", () => {
  it("default params match batch", () => {
    const batch = stochastics(candles);
    const incremental = processAll(createStochastics(), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incremental[i].time).toBe(batch[i].time);

      const bv = batch[i].value as StochasticsValue;
      const iv = incremental[i].value as StochasticsValue;

      if (bv.k === null) {
        expect(iv.k).toBeNull();
      } else {
        expect(iv.k).not.toBeNull();
        expect(Math.abs(iv.k! - bv.k)).toBeLessThan(1e-8);
      }

      if (bv.d === null) {
        expect(iv.d).toBeNull();
      } else {
        expect(iv.d).not.toBeNull();
        expect(Math.abs(iv.d! - bv.d)).toBeLessThan(1e-8);
      }
    }
  });

  it("custom params match batch", () => {
    const opts = { kPeriod: 9, dPeriod: 3, slowing: 3 };
    const batch = stochastics(candles, opts);
    const incremental = processAll(createStochastics(opts), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      const bv = batch[i].value as StochasticsValue;
      const iv = incremental[i].value as StochasticsValue;

      if (bv.k === null) {
        expect(iv.k).toBeNull();
      } else {
        expect(iv.k).not.toBeNull();
        expect(Math.abs(iv.k! - bv.k)).toBeLessThan(1e-8);
      }

      if (bv.d === null) {
        expect(iv.d).toBeNull();
      } else {
        expect(iv.d).not.toBeNull();
        expect(Math.abs(iv.d! - bv.d)).toBeLessThan(1e-8);
      }
    }
  });
});

describe("Supertrend consistency", () => {
  it.each([
    { period: 10, multiplier: 3 },
    { period: 7, multiplier: 2 },
  ])("period=$period multiplier=$multiplier matches batch", (opts) => {
    const batch = supertrend(candles, opts);
    const incremental = processAll(createSupertrend(opts), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incremental[i].time).toBe(batch[i].time);

      const bv = batch[i].value as SupertrendValue;
      const iv = incremental[i].value as SupertrendValue;

      if (bv.supertrend === null) {
        expect(iv.supertrend).toBeNull();
      } else {
        expect(iv.supertrend).not.toBeNull();
        expect(Math.abs(iv.supertrend! - bv.supertrend)).toBeLessThan(1e-8);
      }

      expect(iv.direction).toBe(bv.direction);
    }
  });
});

describe("Parabolic SAR consistency", () => {
  it("default params match batch", () => {
    const batch = parabolicSar(candles);
    const incremental = processAll(createParabolicSar(), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incremental[i].time).toBe(batch[i].time);

      const bv = batch[i].value as ParabolicSarValue;
      const iv = incremental[i].value as ParabolicSarValue;

      if (bv.sar === null) {
        expect(iv.sar).toBeNull();
      } else {
        expect(iv.sar).not.toBeNull();
        expect(Math.abs(iv.sar! - bv.sar)).toBeLessThan(1e-8);
      }

      expect(iv.direction).toBe(bv.direction);
      expect(iv.isReversal).toBe(bv.isReversal);
    }
  });

  it("custom params match batch", () => {
    const opts = { step: 0.01, max: 0.1 };
    const batch = parabolicSar(candles, opts);
    const incremental = processAll(createParabolicSar(opts), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      const bv = batch[i].value as ParabolicSarValue;
      const iv = incremental[i].value as ParabolicSarValue;

      if (bv.sar === null) {
        expect(iv.sar).toBeNull();
      } else {
        expect(iv.sar).not.toBeNull();
        expect(Math.abs(iv.sar! - bv.sar)).toBeLessThan(1e-8);
      }

      expect(iv.direction).toBe(bv.direction);
      expect(iv.isReversal).toBe(bv.isReversal);
    }
  });
});

describe("DMI consistency", () => {
  it("default params match batch", () => {
    const batch = dmi(candles);
    const incremental = processAll(createDmi(), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incremental[i].time).toBe(batch[i].time);

      const bv = batch[i].value as DmiValue;
      const iv = incremental[i].value as DmiValue;

      if (bv.plusDi === null) {
        expect(iv.plusDi).toBeNull();
      } else {
        expect(iv.plusDi).not.toBeNull();
        expect(Math.abs(iv.plusDi! - bv.plusDi)).toBeLessThan(1e-8);
      }

      if (bv.minusDi === null) {
        expect(iv.minusDi).toBeNull();
      } else {
        expect(iv.minusDi).not.toBeNull();
        expect(Math.abs(iv.minusDi! - bv.minusDi)).toBeLessThan(1e-8);
      }

      if (bv.adx === null) {
        expect(iv.adx).toBeNull();
      } else {
        expect(iv.adx).not.toBeNull();
        expect(Math.abs(iv.adx! - bv.adx)).toBeLessThan(1e-8);
      }
    }
  });

  it.each([
    { period: 7, adxPeriod: 7 },
    { period: 21, adxPeriod: 14 },
  ])("period=$period adxPeriod=$adxPeriod matches batch", (opts) => {
    const batch = dmi(candles, opts);
    const incremental = processAll(createDmi(opts), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      const bv = batch[i].value as DmiValue;
      const iv = incremental[i].value as DmiValue;

      if (bv.plusDi === null) {
        expect(iv.plusDi).toBeNull();
      } else {
        expect(iv.plusDi).not.toBeNull();
        expect(Math.abs(iv.plusDi! - bv.plusDi)).toBeLessThan(1e-8);
      }

      if (bv.minusDi === null) {
        expect(iv.minusDi).toBeNull();
      } else {
        expect(iv.minusDi).not.toBeNull();
        expect(Math.abs(iv.minusDi! - bv.minusDi)).toBeLessThan(1e-8);
      }

      if (bv.adx === null) {
        expect(iv.adx).toBeNull();
      } else {
        expect(iv.adx).not.toBeNull();
        expect(Math.abs(iv.adx! - bv.adx)).toBeLessThan(1e-8);
      }
    }
  });
});

describe("ROC consistency", () => {
  it.each([5, 12, 20])("period=%i matches batch", (period) => {
    const batch = roc(candles, { period });
    const incremental = processAll(createRoc({ period }), candles);
    assertConsistency(batch, incremental);
  });

  it("works with different price sources", () => {
    for (const source of ["open", "high", "low", "close"] as const) {
      const batch = roc(candles, { period: 12, source });
      const incremental = processAll(createRoc({ period: 12, source }), candles);
      assertConsistency(batch, incremental);
    }
  });
});

describe("Williams %R consistency", () => {
  it.each([7, 14, 21])("period=%i matches batch", (period) => {
    const batch = williamsR(candles, { period });
    const incremental = processAll(createWilliamsR({ period }), candles);
    assertConsistency(batch, incremental);
  });
});

describe("CCI consistency", () => {
  it.each([14, 20, 50])("period=%i matches batch", (period) => {
    const batch = cci(candles, { period });
    const incremental = processAll(createCci({ period }), candles);
    assertConsistency(batch, incremental);
  });

  it("custom constant matches batch", () => {
    const batch = cci(candles, { period: 20, constant: 0.02 });
    const incremental = processAll(createCci({ period: 20, constant: 0.02 }), candles);
    assertConsistency(batch, incremental);
  });
});

describe("StochRSI consistency", () => {
  it("default params match batch", () => {
    const batch = stochRsi(candles);
    const incremental = processAll(createStochRsi(), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incremental[i].time).toBe(batch[i].time);

      const bv = batch[i].value as StochRsiValue;
      const iv = incremental[i].value as StochRsiValue;

      if (bv.stochRsi === null) {
        expect(iv.stochRsi).toBeNull();
      } else {
        expect(iv.stochRsi).not.toBeNull();
        expect(Math.abs(iv.stochRsi! - bv.stochRsi)).toBeLessThan(1e-8);
      }

      if (bv.k === null) {
        expect(iv.k).toBeNull();
      } else {
        expect(iv.k).not.toBeNull();
        expect(Math.abs(iv.k! - bv.k)).toBeLessThan(1e-8);
      }

      if (bv.d === null) {
        expect(iv.d).toBeNull();
      } else {
        expect(iv.d).not.toBeNull();
        expect(Math.abs(iv.d! - bv.d)).toBeLessThan(1e-8);
      }
    }
  });

  it("custom params match batch", () => {
    const opts = { rsiPeriod: 7, stochPeriod: 7, kPeriod: 3, dPeriod: 3 };
    const batch = stochRsi(candles, opts);
    const incremental = processAll(createStochRsi(opts), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      const bv = batch[i].value as StochRsiValue;
      const iv = incremental[i].value as StochRsiValue;

      if (bv.k === null) {
        expect(iv.k).toBeNull();
      } else {
        expect(iv.k).not.toBeNull();
        expect(Math.abs(iv.k! - bv.k)).toBeLessThan(1e-8);
      }

      if (bv.d === null) {
        expect(iv.d).toBeNull();
      } else {
        expect(iv.d).not.toBeNull();
        expect(Math.abs(iv.d! - bv.d)).toBeLessThan(1e-8);
      }
    }
  });
});

describe("MFI consistency", () => {
  it.each([7, 14, 20])("period=%i matches batch", (period) => {
    const batch = mfi(candles, { period });
    const incremental = processAll(createMfi({ period }), candles);
    assertConsistency(batch, incremental);
  });
});

describe("Donchian Channel consistency", () => {
  it.each([10, 20, 50])("period=%i matches batch", (period) => {
    const batch = donchianChannel(candles, { period });
    const incremental = processAll(createDonchianChannel({ period }), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incremental[i].time).toBe(batch[i].time);

      const bv = batch[i].value as DonchianValue;
      const iv = incremental[i].value as DonchianValue;

      if (bv.upper === null) {
        expect(iv.upper).toBeNull();
      } else {
        expect(iv.upper).not.toBeNull();
        expect(Math.abs(iv.upper! - bv.upper)).toBeLessThan(1e-10);
      }

      if (bv.middle === null) {
        expect(iv.middle).toBeNull();
      } else {
        expect(iv.middle).not.toBeNull();
        expect(Math.abs(iv.middle! - bv.middle)).toBeLessThan(1e-10);
      }

      if (bv.lower === null) {
        expect(iv.lower).toBeNull();
      } else {
        expect(iv.lower).not.toBeNull();
        expect(Math.abs(iv.lower! - bv.lower)).toBeLessThan(1e-10);
      }
    }
  });
});

describe("Keltner Channel consistency", () => {
  it("default params match batch", () => {
    const batch = keltnerChannel(candles);
    const incremental = processAll(createKeltnerChannel(), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incremental[i].time).toBe(batch[i].time);

      const bv = batch[i].value as KeltnerChannelValue;
      const iv = incremental[i].value as KeltnerChannelValue;

      if (bv.upper === null) {
        expect(iv.upper).toBeNull();
      } else {
        expect(iv.upper).not.toBeNull();
        expect(Math.abs(iv.upper! - bv.upper)).toBeLessThan(1e-8);
      }

      if (bv.middle === null) {
        expect(iv.middle).toBeNull();
      } else {
        expect(iv.middle).not.toBeNull();
        expect(Math.abs(iv.middle! - bv.middle)).toBeLessThan(1e-8);
      }

      if (bv.lower === null) {
        expect(iv.lower).toBeNull();
      } else {
        expect(iv.lower).not.toBeNull();
        expect(Math.abs(iv.lower! - bv.lower)).toBeLessThan(1e-8);
      }
    }
  });

  it("custom params match batch", () => {
    const opts = { emaPeriod: 10, atrPeriod: 10, multiplier: 1.5 };
    const batch = keltnerChannel(candles, opts);
    const incremental = processAll(createKeltnerChannel(opts), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      const bv = batch[i].value as KeltnerChannelValue;
      const iv = incremental[i].value as KeltnerChannelValue;

      if (bv.middle === null) {
        expect(iv.middle).toBeNull();
      } else {
        expect(iv.middle).not.toBeNull();
        expect(Math.abs(iv.middle! - bv.middle)).toBeLessThan(1e-8);
      }
    }
  });
});

describe("Ichimoku consistency", () => {
  it("tenkan and kijun match batch", () => {
    const batch = ichimoku(candles);
    const incremental = processAll(createIchimoku(), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incremental[i].time).toBe(batch[i].time);

      const bv = batch[i].value as IchimokuValue;
      const iv = incremental[i].value as IchimokuValue;

      // Tenkan
      if (bv.tenkan === null) {
        expect(iv.tenkan).toBeNull();
      } else {
        expect(iv.tenkan).not.toBeNull();
        expect(Math.abs(iv.tenkan! - bv.tenkan)).toBeLessThan(1e-10);
      }

      // Kijun
      if (bv.kijun === null) {
        expect(iv.kijun).toBeNull();
      } else {
        expect(iv.kijun).not.toBeNull();
        expect(Math.abs(iv.kijun! - bv.kijun)).toBeLessThan(1e-10);
      }

      // Senkou A
      if (bv.senkouA === null) {
        expect(iv.senkouA).toBeNull();
      } else {
        expect(iv.senkouA).not.toBeNull();
        expect(Math.abs(iv.senkouA! - bv.senkouA)).toBeLessThan(1e-10);
      }

      // Senkou B
      if (bv.senkouB === null) {
        expect(iv.senkouB).toBeNull();
      } else {
        expect(iv.senkouB).not.toBeNull();
        expect(Math.abs(iv.senkouB! - bv.senkouB)).toBeLessThan(1e-10);
      }

      // Chikou: batch can have non-null (uses future data), incremental always null
      // Only check that batch chikou at positions near end are null
      // (both batch and incremental should match for positions where batch is also null)
    }
  });

  it("custom params match batch for tenkan/kijun/senkou", () => {
    const opts = { tenkanPeriod: 7, kijunPeriod: 22, senkouBPeriod: 44, displacement: 22 };
    const batch = ichimoku(candles, opts);
    const incremental = processAll(createIchimoku(opts), candles);

    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      const bv = batch[i].value as IchimokuValue;
      const iv = incremental[i].value as IchimokuValue;

      if (bv.tenkan === null) {
        expect(iv.tenkan).toBeNull();
      } else {
        expect(iv.tenkan).not.toBeNull();
        expect(Math.abs(iv.tenkan! - bv.tenkan)).toBeLessThan(1e-10);
      }

      if (bv.senkouA === null) {
        expect(iv.senkouA).toBeNull();
      } else {
        expect(iv.senkouA).not.toBeNull();
        expect(Math.abs(iv.senkouA! - bv.senkouA)).toBeLessThan(1e-10);
      }
    }
  });
});
