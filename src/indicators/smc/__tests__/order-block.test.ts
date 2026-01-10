import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import {
  orderBlock,
  getActiveOrderBlocks,
  getNearestOrderBlock,
} from "../order-block";

const makeCandles = (
  data: Array<{ o: number; h: number; l: number; c: number; v?: number }>,
): NormalizedCandle[] =>
  data.map((d, i) => ({
    time: 1700000000000 + i * 86400000,
    open: d.o,
    high: d.h,
    low: d.l,
    close: d.c,
    volume: d.v ?? 1000,
  }));

describe("orderBlock", () => {
  describe("Bullish Order Block", () => {
    it("should detect bullish OB on bullish BOS", () => {
      // Create a scenario where:
      // 1. We have a swing high that gets confirmed
      // 2. Price breaks above the swing high (bullish BOS)
      // 3. The last bearish candle before BOS becomes the OB
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 }, // 0 - neutral
        { o: 101, h: 110, l: 100, c: 108 }, // 1 - swing high at 110
        { o: 108, h: 106, l: 103, c: 104 }, // 2 - pullback (bearish)
        { o: 104, h: 103, l: 100, c: 101 }, // 3 - bearish - THIS should be OB
        { o: 101, h: 102, l: 99, c: 100 }, // 4 - neutral/bearish
        { o: 100, h: 115, l: 99, c: 112 }, // 5 - bullish BOS (breaks 110)
      ]);

      const result = orderBlock(candles, { swingPeriod: 1 });

      // Find the bar where OB was created
      const obBar = result.find((r) => r.value.newOrderBlock !== null);
      expect(obBar).toBeDefined();
      expect(obBar?.value.newOrderBlock?.type).toBe("bullish");
    });

    it("should mark OB zone with candle high/low", () => {
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 },
        { o: 101, h: 110, l: 100, c: 108 }, // swing high
        { o: 108, h: 106, l: 103, c: 104 }, // bearish - potential OB
        { o: 104, h: 103, l: 100, c: 101 },
        { o: 101, h: 115, l: 100, c: 112 }, // bullish BOS
      ]);

      const result = orderBlock(candles, { swingPeriod: 1 });
      const obBar = result.find((r) => r.value.newOrderBlock !== null);

      if (obBar?.value.newOrderBlock) {
        // OB should have high and low of the candle
        expect(obBar.value.newOrderBlock.high).toBeGreaterThan(0);
        expect(obBar.value.newOrderBlock.low).toBeGreaterThan(0);
        expect(obBar.value.newOrderBlock.high).toBeGreaterThan(
          obBar.value.newOrderBlock.low,
        );
      }
    });
  });

  describe("Bearish Order Block", () => {
    it("should detect bearish OB on bearish BOS", () => {
      // Create a scenario where:
      // 1. We have a swing low that gets confirmed
      // 2. Price breaks below the swing low (bearish BOS)
      // 3. The last bullish candle before BOS becomes the OB
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 }, // 0 - neutral
        { o: 101, h: 103, l: 90, c: 92 }, // 1 - swing low at 90
        { o: 92, h: 98, l: 91, c: 96 }, // 2 - bounce (bullish)
        { o: 96, h: 100, l: 95, c: 99 }, // 3 - bullish - THIS should be OB
        { o: 99, h: 101, l: 98, c: 100 }, // 4 - neutral
        { o: 100, h: 98, l: 85, c: 86 }, // 5 - bearish BOS (breaks 90)
      ]);

      const result = orderBlock(candles, { swingPeriod: 1 });

      // Find the bar where OB was created
      const obBar = result.find((r) => r.value.newOrderBlock !== null);
      expect(obBar).toBeDefined();
      expect(obBar?.value.newOrderBlock?.type).toBe("bearish");
    });
  });

  describe("Mitigation", () => {
    it("should mark OB as mitigated when price returns to zone (partial)", () => {
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 }, // 0
        { o: 101, h: 110, l: 100, c: 108 }, // 1 - swing high
        { o: 108, h: 107, l: 103, c: 104 }, // 2 - bearish (OB candidate)
        { o: 104, h: 103, l: 100, c: 101 }, // 3
        { o: 101, h: 115, l: 100, c: 112 }, // 4 - bullish BOS
        { o: 112, h: 118, l: 110, c: 116 }, // 5 - price moving up
        { o: 116, h: 117, l: 105, c: 106 }, // 6 - price returns to OB zone
      ]);

      const result = orderBlock(candles, { swingPeriod: 1, partialMitigation: true });

      // Check if any OB was mitigated
      const mitigationBar = result.find(
        (r) => r.value.mitigatedThisBar.length > 0,
      );
      expect(mitigationBar).toBeDefined();
      expect(mitigationBar?.value.mitigatedThisBar[0].mitigated).toBe(true);
    });

    it("should NOT mark OB as mitigated on its own candle bar", () => {
      // OB candle is at index 2, BOS happens at index 4
      // At index 2, OB should not check for mitigation
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 },
        { o: 101, h: 110, l: 100, c: 108 }, // swing high at 110
        { o: 108, h: 107, l: 103, c: 104 }, // bearish - OB zone 103-107
        { o: 104, h: 103, l: 100, c: 101 },
        { o: 101, h: 115, l: 108, c: 112 }, // BOS - low at 108, doesn't touch OB zone (103-107)
        { o: 112, h: 118, l: 110, c: 116 }, // price moving up, away from OB
      ]);

      const result = orderBlock(candles, { swingPeriod: 1 });
      const bosBar = result.find((r) => r.value.newOrderBlock !== null);
      const lastBar = result[result.length - 1];

      // OB should be created
      expect(bosBar?.value.newOrderBlock).toBeDefined();
      // OB should still be active (not mitigated yet)
      expect(lastBar.value.activeOrderBlocks.length).toBeGreaterThanOrEqual(1);
    });

    it("should remove mitigated OBs from active list", () => {
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 },
        { o: 101, h: 110, l: 100, c: 108 }, // swing high
        { o: 108, h: 107, l: 103, c: 104 }, // bearish
        { o: 104, h: 103, l: 100, c: 101 },
        { o: 101, h: 115, l: 100, c: 112 }, // BOS
        { o: 112, h: 118, l: 110, c: 116 },
        { o: 116, h: 117, l: 100, c: 102 }, // returns to OB zone
        { o: 102, h: 105, l: 100, c: 104 }, // after mitigation
      ]);

      const result = orderBlock(candles, { swingPeriod: 1 });
      const lastBar = result[result.length - 1];

      // The mitigated OB should not be in the active list
      const bullishOBs = lastBar.value.activeOrderBlocks.filter(
        (ob) => ob.type === "bullish",
      );
      expect(bullishOBs.every((ob) => !ob.mitigated)).toBe(true);
    });
  });

  describe("Active Order Blocks Tracking", () => {
    it("should track active OBs", () => {
      // Create BOS to generate OB, ensure price stays away from OB zone
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 },
        { o: 101, h: 110, l: 100, c: 108 }, // swing high at 110
        { o: 108, h: 107, l: 103, c: 104 }, // bearish - OB zone 103-107
        { o: 104, h: 103, l: 100, c: 101 },
        { o: 101, h: 115, l: 108, c: 112 }, // BOS (low 108 doesn't touch OB 103-107)
        { o: 112, h: 120, l: 110, c: 118 }, // price stays above OB
        { o: 118, h: 125, l: 115, c: 123 }, // price continues up
      ]);

      const result = orderBlock(candles, { swingPeriod: 1 });
      const lastBar = result[result.length - 1];

      // Should have at least 1 OB tracked
      expect(lastBar.value.activeOrderBlocks.length).toBeGreaterThanOrEqual(1);
    });

    it("should respect maxActiveOBs limit", () => {
      // Create many OBs to test the limit
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 },
        { o: 101, h: 110, l: 100, c: 108 },
        { o: 108, h: 107, l: 103, c: 104 },
        { o: 104, h: 103, l: 100, c: 101 },
        { o: 101, h: 115, l: 100, c: 112 }, // BOS 1
        { o: 112, h: 120, l: 111, c: 118 },
        { o: 118, h: 116, l: 113, c: 114 },
        { o: 114, h: 113, l: 110, c: 111 },
        { o: 111, h: 125, l: 110, c: 123 }, // BOS 2
        { o: 123, h: 130, l: 122, c: 128 },
        { o: 128, h: 126, l: 123, c: 124 },
        { o: 124, h: 123, l: 120, c: 121 },
        { o: 121, h: 135, l: 120, c: 133 }, // BOS 3
      ]);

      const result = orderBlock(candles, { swingPeriod: 1, maxActiveOBs: 2 });
      const lastBar = result[result.length - 1];

      expect(lastBar.value.activeOrderBlocks.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Price at OB Zone", () => {
    it("should detect when price is at bullish OB zone (partialMitigation=false)", () => {
      // OB is the LAST bearish candle before BOS.
      // With partialMitigation=false, price must go through entire OB to mitigate.
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 }, // 0
        { o: 101, h: 110, l: 100, c: 108 }, // 1 - swing high at 110
        { o: 108, h: 107, l: 103, c: 104 }, // 2 - bearish
        { o: 104, h: 105, l: 100, c: 101 }, // 3 - bearish (last before BOS) - OB zone: high=105, low=100
        { o: 101, h: 115, l: 106, c: 112 }, // 4 - BOS (low 106 doesn't touch OB zone 100-105)
        { o: 112, h: 118, l: 110, c: 116 }, // 5 - price moves up
        { o: 116, h: 117, l: 102, c: 108 }, // 6 - price dips to 102, inside OB zone (100-105), but > 100 (low of OB)
      ]);

      const result = orderBlock(candles, { swingPeriod: 1, partialMitigation: false });
      const lastBar = result[result.length - 1];

      // Price is at OB zone but hasn't fully mitigated (didn't go below 100)
      expect(lastBar.value.atBullishOB).toBe(true);
    });

    it("should detect when price is at bearish OB zone (partialMitigation=false)", () => {
      // OB is the LAST bullish candle before bearish BOS.
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 }, // 0
        { o: 101, h: 103, l: 90, c: 92 }, // 1 - swing low at 90
        { o: 92, h: 97, l: 91, c: 95 }, // 2 - bullish
        { o: 95, h: 100, l: 94, c: 99 }, // 3 - bullish (last before BOS) - OB zone: high=100, low=94
        { o: 99, h: 93, l: 85, c: 86 }, // 4 - bearish BOS (high 93 doesn't touch OB zone 94-100)
        { o: 86, h: 88, l: 84, c: 87 }, // 5 - price stays down
        { o: 87, h: 97, l: 86, c: 93 }, // 6 - price rises to 97, inside OB zone (94-100), but < 100 (high of OB)
      ]);

      const result = orderBlock(candles, { swingPeriod: 1, partialMitigation: false });
      const lastBar = result[result.length - 1];

      // Price is at OB zone but hasn't fully mitigated (didn't go above 100)
      expect(lastBar.value.atBearishOB).toBe(true);
    });
  });

  describe("Volume Filter", () => {
    it("should filter OBs by volume ratio", () => {
      // Create candles with varying volume
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101, v: 1000 },
        { o: 101, h: 110, l: 100, c: 108, v: 1000 }, // swing high
        { o: 108, h: 107, l: 103, c: 104, v: 500 }, // LOW volume bearish
        { o: 104, h: 103, l: 100, c: 101, v: 1000 },
        { o: 101, h: 115, l: 100, c: 112, v: 1000 }, // BOS
      ]);

      const result = orderBlock(candles, {
        swingPeriod: 1,
        minVolumeRatio: 1.5, // Require 1.5x average volume
      });

      // OB should not be created due to low volume
      const obBar = result.find((r) => r.value.newOrderBlock !== null);
      expect(obBar).toBeUndefined();
    });

    it("should create OB when volume meets threshold", () => {
      // Need enough candles for volumePeriod to calculate MA
      // OB is the LAST bearish candle before BOS, so that one needs high volume
      const candles = makeCandles([
        { o: 95, h: 97, l: 94, c: 96, v: 1000 },
        { o: 96, h: 98, l: 95, c: 97, v: 1000 },
        { o: 97, h: 99, l: 96, c: 98, v: 1000 },
        { o: 98, h: 100, l: 97, c: 99, v: 1000 },
        { o: 99, h: 101, l: 98, c: 100, v: 1000 },
        { o: 100, h: 102, l: 99, c: 101, v: 1000 },
        { o: 101, h: 110, l: 100, c: 108, v: 1000 }, // swing high
        { o: 108, h: 107, l: 103, c: 104, v: 1000 }, // bearish
        { o: 104, h: 105, l: 100, c: 101, v: 2500 }, // HIGH volume bearish (last before BOS) - 2.5x avg
        { o: 101, h: 115, l: 106, c: 112, v: 1000 }, // BOS (low at 106, above OB zone 100-105)
      ]);

      const result = orderBlock(candles, {
        swingPeriod: 1,
        volumePeriod: 5,
        minVolumeRatio: 1.5,
      });

      const obBar = result.find((r) => r.value.newOrderBlock !== null);
      expect(obBar).toBeDefined();
    });
  });

  describe("Strength Calculation", () => {
    it("should assign strength score to OB", () => {
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 },
        { o: 101, h: 110, l: 100, c: 108 },
        { o: 108, h: 107, l: 103, c: 104 },
        { o: 104, h: 103, l: 100, c: 101 },
        { o: 101, h: 115, l: 100, c: 112 },
      ]);

      const result = orderBlock(candles, { swingPeriod: 1 });
      const obBar = result.find((r) => r.value.newOrderBlock !== null);

      expect(obBar?.value.newOrderBlock?.strength).toBeGreaterThanOrEqual(0);
      expect(obBar?.value.newOrderBlock?.strength).toBeLessThanOrEqual(100);
    });
  });

  describe("Edge Cases", () => {
    it("should return empty array for empty input", () => {
      const result = orderBlock([]);
      expect(result).toEqual([]);
    });

    it("should handle insufficient data", () => {
      const candles = makeCandles([{ o: 100, h: 102, l: 99, c: 101 }]);
      const result = orderBlock(candles, { swingPeriod: 1 });
      expect(result.length).toBe(1);
    });

    it("should throw for invalid swingPeriod", () => {
      const candles = makeCandles([{ o: 100, h: 102, l: 99, c: 101 }]);
      expect(() => orderBlock(candles, { swingPeriod: 0 })).toThrow(
        "swingPeriod must be at least 1",
      );
    });

    it("should throw for invalid volumePeriod", () => {
      const candles = makeCandles([{ o: 100, h: 102, l: 99, c: 101 }]);
      expect(() => orderBlock(candles, { volumePeriod: 0 })).toThrow(
        "volumePeriod must be at least 1",
      );
    });

    it("should throw for negative minVolumeRatio", () => {
      const candles = makeCandles([{ o: 100, h: 102, l: 99, c: 101 }]);
      expect(() => orderBlock(candles, { minVolumeRatio: -1 })).toThrow(
        "minVolumeRatio must be non-negative",
      );
    });

    it("should throw for invalid maxActiveOBs", () => {
      const candles = makeCandles([{ o: 100, h: 102, l: 99, c: 101 }]);
      expect(() => orderBlock(candles, { maxActiveOBs: 0 })).toThrow(
        "maxActiveOBs must be at least 1",
      );
    });
  });
});

describe("getActiveOrderBlocks", () => {
  it("should return active bullish and bearish OBs", () => {
    const candles = makeCandles([
      { o: 100, h: 102, l: 99, c: 101 },
      { o: 101, h: 110, l: 100, c: 108 },
      { o: 108, h: 107, l: 103, c: 104 },
      { o: 104, h: 103, l: 100, c: 101 },
      { o: 101, h: 115, l: 100, c: 112 },
    ]);

    const { bullish, bearish } = getActiveOrderBlocks(candles, { swingPeriod: 1 });

    expect(Array.isArray(bullish)).toBe(true);
    expect(Array.isArray(bearish)).toBe(true);
  });

  it("should return empty arrays for empty input", () => {
    const { bullish, bearish } = getActiveOrderBlocks([]);
    expect(bullish).toEqual([]);
    expect(bearish).toEqual([]);
  });
});

describe("getNearestOrderBlock", () => {
  it("should return nearest OB to current price", () => {
    const candles = makeCandles([
      { o: 100, h: 102, l: 99, c: 101 },
      { o: 101, h: 110, l: 100, c: 108 },
      { o: 108, h: 107, l: 103, c: 104 },
      { o: 104, h: 103, l: 100, c: 101 },
      { o: 101, h: 115, l: 100, c: 112 },
    ]);

    const nearest = getNearestOrderBlock(candles, { swingPeriod: 1 });

    // If there's an active OB, it should be returned
    if (nearest) {
      expect(nearest.type).toMatch(/bullish|bearish/);
    }
  });

  it("should return null for empty input", () => {
    const nearest = getNearestOrderBlock([]);
    expect(nearest).toBeNull();
  });
});
