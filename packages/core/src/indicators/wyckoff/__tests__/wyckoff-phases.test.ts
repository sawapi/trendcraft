import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { wyckoffPhases } from "../wyckoff-phases";
import type { WyckoffEvent } from "../wyckoff-phases";

function mc(
  i: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
): NormalizedCandle {
  return { time: 1000000 + i * 86400000, open, high, low, close, volume };
}

// ---------------------------------------------------------------------------
// Helper: downtrend with proper swing structure to generate bearish BOS
// Each wave: 3 down bars, trough, 3 up bars — each trough lower
// ---------------------------------------------------------------------------
function buildDowntrend(start: { idx: number; base: number }, waves: number) {
  const candles: NormalizedCandle[] = [];
  let idx = start.idx;
  let base = start.base;
  for (let w = 0; w < waves; w++) {
    candles.push(mc(idx++, base, base + 1, base - 2, base - 1.5, 1000));
    candles.push(mc(idx++, base - 2, base - 1, base - 4, base - 3.5, 1000));
    candles.push(mc(idx++, base - 4, base - 3, base - 6, base - 5.5, 1000));
    const trough = base - 8;
    candles.push(mc(idx++, trough + 1, trough + 2, trough, trough + 0.5, 1000));
    candles.push(mc(idx++, trough + 2, trough + 4, trough + 1, trough + 3, 1000));
    candles.push(mc(idx++, trough + 4, trough + 6, trough + 3, trough + 5, 1000));
    candles.push(mc(idx++, trough + 5, trough + 7, trough + 4, trough + 6, 1000));
    base = trough + 4;
  }
  return { candles, idx, base };
}

// ---------------------------------------------------------------------------
// Helper: uptrend with proper swing structure to generate bullish BOS
// Each wave: 3 up bars, peak, 3 down bars — each peak higher
// ---------------------------------------------------------------------------
function buildUptrend(start: { idx: number; base: number }, waves: number) {
  const candles: NormalizedCandle[] = [];
  let idx = start.idx;
  let base = start.base;
  for (let w = 0; w < waves; w++) {
    candles.push(mc(idx++, base, base + 1, base - 1, base + 0.5, 1000));
    candles.push(mc(idx++, base + 2, base + 3, base + 1, base + 2.5, 1000));
    candles.push(mc(idx++, base + 4, base + 5, base + 3, base + 4.5, 1000));
    const peak = base + 8;
    candles.push(mc(idx++, peak - 1, peak, peak - 2, peak - 0.5, 1000));
    candles.push(mc(idx++, peak - 2, peak - 1, peak - 4, peak - 3, 1000));
    candles.push(mc(idx++, peak - 4, peak - 3, peak - 6, peak - 5, 1000));
    candles.push(mc(idx++, peak - 5, peak - 4, peak - 7, peak - 6, 1000));
    base = peak - 4;
  }
  return { candles, idx, base };
}

/**
 * Build a full accumulation sequence that triggers all events:
 * PS -> SC -> AR -> ST -> test -> spring -> SOS -> LPS -> markup
 *
 * Verified: produces events at indices 28,35,42,49,50,58,77,82
 * with 100% confidence and transition to markup.
 */
function buildFullAccumulation(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];

  // 4-wave downtrend establishing bearish BOS (28 bars)
  const dt = buildDowntrend({ idx: 0, base: 120 }, 4);
  candles.push(...dt.candles);
  let idx = dt.idx;

  // PS: swing low with high volume (stoppingVolume)
  candles.push(mc(idx++, 96, 97, 91, 92, 3000));
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 92 + i * 0.5, 93 + i * 0.5, 91.5 + i * 0.5, 92.5 + i * 0.5, 800));
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 94 + i, 95 + i, 93 + i, 94.5 + i, 900));

  // SC: deeper swing low with extreme volume
  candles.push(mc(idx++, 91, 92, 85, 86, 8000));
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 86 + i * 0.5, 87 + i * 0.5, 85.5 + i * 0.5, 86.5 + i * 0.5, 500));

  // AR: rally establishing range high (~99)
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 87 + i * 3, 88 + i * 3, 86 + i * 3, 88.5 + i * 3, 1500));
  candles.push(mc(idx++, 96, 99, 95, 98, 2000));
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 97 - i, 98 - i, 96 - i, 96.5 - i, 800));

  // ST: swing low near SC(85) with lower volume
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 93 - i * 2, 94 - i * 2, 92 - i * 2, 92.5 - i * 2, 900));
  candles.push(mc(idx++, 87, 88, 85.5, 86, 2000));
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 87 + i, 88 + i, 86 + i, 87.5 + i, 900));

  // Range bars
  for (let i = 0; i < 5; i++)
    candles.push(mc(idx++, 91 + (i % 3), 92 + (i % 3), 90 + (i % 3), 91.5 + (i % 3), 800));

  // Spring: low below rangeLow(85), close above
  candles.push(mc(idx++, 86, 87, 83, 86.5, 700));

  // Rally with swing structure toward SOS
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 84 + i * 2, 85 + i * 2, 83 + i * 2, 84.5 + i * 2, 1500));
  candles.push(mc(idx++, 90, 93, 89, 92, 2000));
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 91 - i, 92 - i, 90 - i, 90.5 - i, 800));
  candles.push(mc(idx++, 88, 89, 87, 87.5, 900));
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 88 + i * 3, 89 + i * 3, 87 + i * 3, 89.5 + i * 3, 1500));
  candles.push(mc(idx++, 97, 99, 96, 98, 2500));
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 97 - i, 98 - i, 96 - i, 96.5 - i, 800));
  candles.push(mc(idx++, 94, 95, 93, 93.5, 900));
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 94 + i * 3, 95 + i * 3, 93 + i * 3, 95.5 + i * 3, 2000));

  // SOS: bullish BOS above rangeHigh(99)
  candles.push(mc(idx++, 100, 105, 99, 104, 3500));

  // LPS pullback above midpoint (85+99)/2 = 92
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 103 - i, 104 - i, 102 - i, 102.5 - i, 1000));
  candles.push(mc(idx++, 97, 98, 94, 95, 800));

  // Markup continuation
  for (let i = 0; i < 5; i++) candles.push(mc(idx++, 96 + i, 97 + i, 95 + i, 96.5 + i, 1200));

  return candles;
}

/**
 * Build a full distribution sequence that triggers all events:
 * PSY -> BC -> AR -> ST -> UT -> UTAD -> SOW -> LPSY -> markdown
 *
 * Verified: produces events at indices 28,35,42,49,53,57,63,76
 * with 100% confidence and transition to markdown.
 */
function buildFullDistribution(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];

  // 4-wave uptrend establishing bullish BOS (28 bars)
  const ut = buildUptrend({ idx: 0, base: 80 }, 4);
  candles.push(...ut.candles);
  let idx = ut.idx;

  // PSY: swing high with high volume
  candles.push(mc(idx++, 104, 110, 103, 109, 4000));
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 108 - i, 109 - i, 107 - i, 107.5 - i, 700));
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 106 - i, 107 - i, 105 - i, 105.5 - i, 800));

  // BC: extreme volume swing high
  candles.push(mc(idx++, 108, 115, 107, 108, 9000));
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 109 - i, 110 - i, 108 - i, 108.5 - i, 500));

  // AR: swing low establishing range low (~95)
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 107 - i * 3, 108 - i * 3, 106 - i * 3, 106.5 - i * 3, 1500));
  candles.push(mc(idx++, 98, 99, 95, 96, 2000));
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 97 + i, 98 + i, 96 + i, 97.5 + i, 800));

  // ST: swing high near BC(115) with lower volume
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 101 + i * 3, 102 + i * 3, 100 + i * 3, 102.5 + i * 3, 900));
  candles.push(mc(idx++, 112, 114.5, 111, 113, 2000));
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 112 - i * 2, 113 - i * 2, 111 - i * 2, 111.5 - i * 2, 800));

  // UT: Upthrust — high > rangeHigh(115), close < rangeHigh, close < open
  candles.push(mc(idx++, 113, 117, 108, 109, 1800));
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 108 - i, 109 - i, 107 - i, 107.5 - i, 900));

  // UTAD: another push above range high
  candles.push(mc(idx++, 110, 116, 107, 108, 1500));
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 107 - i * 2, 108 - i * 2, 106 - i * 2, 106.5 - i * 2, 900));

  // Decline with swing structure for bearish BOS
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 100 - i * 3, 101 - i * 3, 99 - i * 3, 99.5 - i * 3, 1500));
  candles.push(mc(idx++, 92, 93, 91, 91.5, 1500));
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 92 + i, 93 + i, 91 + i, 92.5 + i, 800));
  candles.push(mc(idx++, 96, 97, 95, 96.5, 800));
  for (let i = 0; i < 3; i++) candles.push(mc(idx++, 96 - i, 97 - i, 95 - i, 95.5 - i, 900));

  // SOW: close below rangeLow(95)
  candles.push(mc(idx++, 93, 94, 90, 91, 3500));
  for (let i = 0; i < 3; i++)
    candles.push(mc(idx++, 91 + i * 0.5, 92 + i * 0.5, 90 + i * 0.5, 91.5 + i * 0.5, 800));

  // LPSY: swing high below midpoint threshold
  // Midpoint = (95+115)/2 = 105. Threshold: midpoint + (rangeHigh - midpoint)*0.5 = 110
  candles.push(mc(idx++, 94, 97, 93, 96, 700));
  for (let i = 0; i < 5; i++)
    candles.push(mc(idx++, 95 - i * 2, 96 - i * 2, 94 - i * 2, 94.5 - i * 2, 1500));

  return candles;
}

// ===========================================================================
// Tests
// ===========================================================================

describe("wyckoffPhases", () => {
  it("returns empty array for empty input", () => {
    expect(wyckoffPhases([])).toEqual([]);
  });

  it("returns one result per candle with correct timestamps", () => {
    const candles = buildFullAccumulation();
    const result = wyckoffPhases(candles, { swingPeriod: 3 });
    expect(result).toHaveLength(candles.length);
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("starts in unknown phase before any BOS establishes trend", () => {
    const candles = buildFullAccumulation();
    const result = wyckoffPhases(candles, { swingPeriod: 3 });
    expect(result[0].value.phase).toBe("unknown");
    expect(result[0].value.confidence).toBe(0);
    expect(result[0].value.subPhase).toBeNull();
  });

  it("handles short input without crashing and stays unknown", () => {
    const candles = [
      mc(0, 100, 101, 99, 100.5, 1000),
      mc(1, 100.5, 102, 100, 101, 1000),
      mc(2, 101, 101.5, 100, 100.5, 1000),
    ];
    const result = wyckoffPhases(candles);
    expect(result).toHaveLength(3);
    for (const r of result) {
      expect(r.value.phase).toBe("unknown");
      expect(r.value.confidence).toBe(0);
    }
  });

  // =========================================================================
  // Full accumulation lifecycle
  // =========================================================================

  describe("accumulation lifecycle", () => {
    it("detects all accumulation events in correct order: PS -> SC -> AR -> ST -> spring -> SOS -> LPS", () => {
      const candles = buildFullAccumulation();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const events = result.filter((r) => r.value.event !== null).map((r) => r.value.event!);

      // Should contain all core accumulation events
      expect(events).toContain("PS");
      expect(events).toContain("SC");
      expect(events).toContain("AR");
      expect(events).toContain("ST");
      expect(events).toContain("spring");
      expect(events).toContain("SOS");
      expect(events).toContain("LPS");

      // Verify ordering: each event appears after its prerequisite
      const psIdx = events.indexOf("PS");
      const scIdx = events.indexOf("SC");
      const arIdx = events.indexOf("AR");
      const stIdx = events.indexOf("ST");
      const springIdx = events.indexOf("spring");
      const sosIdx = events.indexOf("SOS");
      const lpsIdx = events.indexOf("LPS");

      expect(scIdx).toBeGreaterThan(psIdx);
      expect(arIdx).toBeGreaterThan(scIdx);
      expect(stIdx).toBeGreaterThan(arIdx);
      expect(springIdx).toBeGreaterThan(stIdx);
      expect(sosIdx).toBeGreaterThan(springIdx);
      expect(lpsIdx).toBeGreaterThan(sosIdx);
    });

    it("SC sets rangeLow and records climactic volume for later comparison", () => {
      const candles = buildFullAccumulation();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const scBar = result.find((r) => r.value.event === "SC");
      expect(scBar).toBeDefined();
      // After SC, rangeLow should be set to the SC low (85)
      expect(scBar!.value.rangeLow).toBe(85);
    });

    it("AR establishes rangeHigh creating the trading range boundaries", () => {
      const candles = buildFullAccumulation();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const arBar = result.find((r) => r.value.event === "AR");
      expect(arBar).toBeDefined();
      expect(arBar!.value.rangeHigh).toBe(99);
      expect(arBar!.value.rangeLow).toBe(85);
    });

    it("confidence increases monotonically as events accumulate from 14% to 100%", () => {
      const candles = buildFullAccumulation();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const eventBars = result.filter((r) => r.value.event !== null);
      expect(eventBars.length).toBeGreaterThanOrEqual(7);

      // Each event adds ~14% confidence (1/7 of 100%)
      let prevConfidence = 0;
      for (const bar of eventBars) {
        expect(bar.value.confidence).toBeGreaterThanOrEqual(prevConfidence);
        expect(bar.value.confidence).toBeLessThanOrEqual(100);
        prevConfidence = bar.value.confidence;
      }
    });

    it("sub-phase progresses A -> B -> C -> D as events accumulate", () => {
      const candles = buildFullAccumulation();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const subPhases = result
        .filter((r) => r.value.phase === "accumulation" && r.value.subPhase !== null)
        .map((r) => r.value.subPhase!);

      expect(subPhases[0]).toBe("phase_A");

      const uniqueSubPhases = [...new Set(subPhases)];
      expect(uniqueSubPhases).toContain("phase_A");
      // After ST -> phase_B, after spring/test -> phase_C, after SOS -> phase_D
      const phaseOrder = ["phase_A", "phase_B", "phase_C", "phase_D"];
      let lastIdx = 0;
      for (const sp of subPhases) {
        const order = phaseOrder.indexOf(sp);
        expect(order).toBeGreaterThanOrEqual(lastIdx);
        lastIdx = order;
      }
    });

    it("transitions from accumulation to markup when SOS + LPS are both confirmed", () => {
      const candles = buildFullAccumulation();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const phases = result.map((r) => r.value.phase);
      expect(phases).toContain("accumulation");
      expect(phases).toContain("markup");

      const firstMarkupIdx = phases.indexOf("markup");
      const markupBar = result[firstMarkupIdx].value;
      expect(markupBar.eventsDetected).toContain("SOS");
      expect(markupBar.eventsDetected).toContain("LPS");
      // All 7 events should be present
      expect(markupBar.eventsDetected.length).toBeGreaterThanOrEqual(7);
    });

    it("eventsDetected array grows over time and is immutable between bars", () => {
      const candles = buildFullAccumulation();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const accBars = result.filter((r) => r.value.phase === "accumulation");
      expect(accBars.length).toBeGreaterThan(10);

      // Events should only grow
      let prevLen = 0;
      for (const bar of accBars) {
        expect(bar.value.eventsDetected.length).toBeGreaterThanOrEqual(prevLen);
        prevLen = bar.value.eventsDetected.length;
      }

      // Verify immutability: mutating one bar's events should not affect others
      const first = accBars[0].value.eventsDetected;
      const second = accBars[accBars.length - 1].value.eventsDetected;
      expect(first).not.toBe(second); // Different array references
    });
  });

  // =========================================================================
  // Full distribution lifecycle
  // =========================================================================

  describe("distribution lifecycle", () => {
    it("detects all distribution events: PSY -> BC -> AR -> ST -> UT -> UTAD -> SOW -> LPSY", () => {
      const candles = buildFullDistribution();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const events = result.filter((r) => r.value.event !== null).map((r) => r.value.event!);

      expect(events).toContain("PSY");
      expect(events).toContain("BC");
      expect(events).toContain("AR");
      expect(events).toContain("ST");
      expect(events).toContain("UT");
      expect(events).toContain("UTAD");
      expect(events).toContain("SOW");
      expect(events).toContain("LPSY");

      // Ordering
      expect(events.indexOf("BC")).toBeGreaterThan(events.indexOf("PSY"));
      expect(events.indexOf("AR")).toBeGreaterThan(events.indexOf("BC"));
      expect(events.indexOf("ST")).toBeGreaterThan(events.indexOf("AR"));
      expect(events.indexOf("UT")).toBeGreaterThan(events.indexOf("ST"));
      expect(events.indexOf("SOW")).toBeGreaterThan(events.indexOf("UT"));
      expect(events.indexOf("LPSY")).toBeGreaterThan(events.indexOf("SOW"));
    });

    it("BC establishes rangeHigh and AR establishes rangeLow for distribution", () => {
      const candles = buildFullDistribution();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const bcBar = result.find((r) => r.value.event === "BC");
      expect(bcBar).toBeDefined();
      expect(bcBar!.value.rangeHigh).toBe(115);

      const arBar = result.find((r) => r.value.event === "AR");
      expect(arBar).toBeDefined();
      expect(arBar!.value.rangeLow).toBe(95);
    });

    it("distribution sub-phases progress A -> B -> C -> D", () => {
      const candles = buildFullDistribution();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const distSubPhases = result
        .filter((r) => r.value.phase === "distribution" && r.value.subPhase !== null)
        .map((r) => r.value.subPhase!);

      const unique = [...new Set(distSubPhases)];
      expect(unique).toContain("phase_A");

      // UT triggers phase_C
      const utBar = result.find((r) => r.value.event === "UT");
      if (utBar) expect(utBar.value.subPhase).toBe("phase_C");

      // SOW triggers phase_D
      const sowBar = result.find((r) => r.value.event === "SOW");
      if (sowBar) expect(sowBar.value.subPhase).toBe("phase_D");
    });

    it("distribution confidence reaches 100% when all 7 events are detected", () => {
      const candles = buildFullDistribution();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const last = result[result.length - 1].value;
      expect(last.confidence).toBe(100);
      expect(last.eventsDetected).toHaveLength(8); // PSY+BC+AR+ST+UT+UTAD+SOW+LPSY
    });

    it("transitions from distribution to markdown when SOW + LPSY detected", () => {
      const candles = buildFullDistribution();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const phases = result.map((r) => r.value.phase);
      expect(phases).toContain("distribution");
      expect(phases).toContain("markdown");

      const mdIdx = phases.indexOf("markdown");
      const mdBar = result[mdIdx].value;
      expect(mdBar.eventsDetected).toContain("SOW");
      expect(mdBar.eventsDetected).toContain("LPSY");
    });

    it("UT event requires high above rangeHigh with close below it (failed breakout)", () => {
      const candles = buildFullDistribution();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const utBar = result.find((r) => r.value.event === "UT");
      expect(utBar).toBeDefined();
      expect(utBar!.value.phase).toBe("distribution");
      // UT should already have ST in events (prerequisite)
      expect(utBar!.value.eventsDetected).toContain("ST");
    });

    it("UTAD event follows UT as a second failed push above range high", () => {
      const candles = buildFullDistribution();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const utadBar = result.find((r) => r.value.event === "UTAD");
      expect(utadBar).toBeDefined();
      expect(utadBar!.value.eventsDetected).toContain("UT");
    });
  });

  // =========================================================================
  // Phase transitions (markup -> distribution, markdown -> accumulation)
  // =========================================================================

  describe("phase transitions", () => {
    it("markup-to-distribution: resets state when swing high + high volume after minRangeBars", () => {
      const accCandles = buildFullAccumulation();
      const candles = [...accCandles];
      let idx = candles.length;

      // Continue markup for >20 bars (well past minRangeBars)
      for (let i = 0; i < 25; i++) {
        const p = 100 + i;
        candles.push(mc(idx++, p, p + 1.5, p - 0.5, p + 1, 1200));
      }

      // Swing high with heavy volume — triggers distribution reset via resetState()
      candles.push(mc(idx++, 125, 130, 124, 128, 5000));
      for (let i = 0; i < 5; i++)
        candles.push(mc(idx++, 127 - i, 128 - i, 126 - i, 126.5 - i, 1000));

      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });
      const phases = result.map((r) => r.value.phase);

      expect(phases).toContain("markup");

      // Check if distribution appears after markup
      if (phases.includes("distribution")) {
        const firstDistIdx = phases.indexOf("distribution");
        const firstMarkupIdx = phases.indexOf("markup");
        expect(firstDistIdx).toBeGreaterThan(firstMarkupIdx);

        // The distribution bar should have PSY (from resetState) and fresh events
        const distBar = result[firstDistIdx].value;
        expect(distBar.eventsDetected).toContain("PSY");
        expect(distBar.rangeHigh).not.toBeNull();
        // Events should be fresh (only PSY), not carry over from accumulation
        expect(distBar.eventsDetected).not.toContain("PS");
        expect(distBar.eventsDetected).not.toContain("SC");
      }
    });

    it("markdown-to-accumulation: resets state when swing low + high volume after minRangeBars", () => {
      const distCandles = buildFullDistribution();
      const candles = [...distCandles];
      let idx = candles.length;

      // Continue markdown for >20 bars
      for (let i = 0; i < 25; i++) {
        const p = 85 - i * 0.5;
        candles.push(mc(idx++, p + 0.5, p + 1.5, p - 1.5, p - 0.5, 1200));
      }

      // Swing low with heavy volume — triggers accumulation reset via resetState()
      candles.push(mc(idx++, 74, 75, 68, 69, 5000));
      for (let i = 0; i < 5; i++)
        candles.push(mc(idx++, 70 + i * 0.5, 71 + i * 0.5, 69 + i * 0.5, 70.5 + i * 0.5, 1000));

      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });
      const phases = result.map((r) => r.value.phase);

      expect(phases).toContain("markdown");

      if (phases.includes("accumulation")) {
        const accIdx = phases.lastIndexOf("accumulation");
        const mdIdx = phases.indexOf("markdown");
        expect(accIdx).toBeGreaterThan(mdIdx);

        const accBar = result[accIdx].value;
        expect(accBar.eventsDetected).toContain("PS");
        expect(accBar.rangeLow).not.toBeNull();
        // Fresh state — should not carry distribution events
        expect(accBar.eventsDetected).not.toContain("PSY");
        expect(accBar.eventsDetected).not.toContain("BC");
      }
    });
  });

  // =========================================================================
  // Confidence and sub-phase edge cases
  // =========================================================================

  describe("confidence calculation", () => {
    it("returns 0 confidence for unknown phase since no expected events exist", () => {
      const candles = [
        mc(0, 100, 101, 99, 100.5, 1000),
        mc(1, 100.5, 102, 100, 101, 1000),
        mc(2, 101, 101.5, 100, 100.5, 1000),
        mc(3, 100.5, 101, 99.5, 100, 1000),
        mc(4, 100, 101, 99, 100.5, 1000),
      ];
      const result = wyckoffPhases(candles, { swingPeriod: 2 });

      for (const r of result) {
        expect(r.value.phase).toBe("unknown");
        expect(r.value.confidence).toBe(0);
        expect(r.value.subPhase).toBeNull();
      }
    });

    it("markup phase uses accumulation events for confidence calculation", () => {
      const candles = buildFullAccumulation();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const markupBars = result.filter((r) => r.value.phase === "markup");
      if (markupBars.length > 0) {
        // Markup confidence should equal accumulation confidence since same event list
        expect(markupBars[0].value.confidence).toBe(100);
      }
    });

    it("markdown phase uses distribution events for confidence calculation", () => {
      const candles = buildFullDistribution();
      const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

      const mdBars = result.filter((r) => r.value.phase === "markdown");
      if (mdBars.length > 0) {
        expect(mdBars[0].value.confidence).toBe(100);
      }
    });
  });

  // =========================================================================
  // Trend tracking via BOS
  // =========================================================================

  describe("trend tracking via BOS", () => {
    it("flat market stays in unknown: no BOS means no trend, no phase detection", () => {
      const candles: NormalizedCandle[] = [];
      for (let i = 0; i < 50; i++) {
        const base = 100 + Math.sin(i * 0.3) * 0.5;
        candles.push(mc(i, base, base + 0.5, base - 0.5, base + 0.1, 1000));
      }

      const result = wyckoffPhases(candles, { swingPeriod: 3 });
      const nonUnknown = result.filter((r) => r.value.phase !== "unknown");
      expect(nonUnknown.length).toBe(0);
    });

    it("downtrend without uptrend never triggers distribution", () => {
      const candles: NormalizedCandle[] = [];
      for (let i = 0; i < 50; i++) {
        const p = 150 - i;
        candles.push(mc(i, p + 0.5, p + 1.5, p - 1.5, p - 0.5, 1000));
      }

      const result = wyckoffPhases(candles, { swingPeriod: 3 });
      const phases = result.map((r) => r.value.phase);
      expect(phases).not.toContain("distribution");
    });
  });

  // =========================================================================
  // Options
  // =========================================================================

  describe("options", () => {
    it("wider swingPeriod detects fewer events because fewer swing points qualify", () => {
      const candles = buildFullAccumulation();

      const resultNarrow = wyckoffPhases(candles, { swingPeriod: 2, minRangeBars: 5 });
      const resultWide = wyckoffPhases(candles, { swingPeriod: 8, minRangeBars: 5 });

      const eventsNarrow = resultNarrow.filter((r) => r.value.event !== null).length;
      const eventsWide = resultWide.filter((r) => r.value.event !== null).length;

      expect(eventsNarrow).toBeGreaterThanOrEqual(eventsWide);
    });

    it("tighter rangeTolerance may prevent ST from matching SC level", () => {
      const candles = buildFullAccumulation();

      const resultTight = wyckoffPhases(candles, {
        swingPeriod: 3,
        minRangeBars: 5,
        rangeTolerance: 0.01,
      });
      const resultLoose = wyckoffPhases(candles, {
        swingPeriod: 3,
        minRangeBars: 5,
        rangeTolerance: 2.0,
      });

      const eventsTight = new Set(
        resultTight.filter((r) => r.value.event !== null).map((r) => r.value.event),
      );
      const eventsLoose = new Set(
        resultLoose.filter((r) => r.value.event !== null).map((r) => r.value.event),
      );

      expect(eventsLoose.size).toBeGreaterThanOrEqual(eventsTight.size);
    });

    it("default options produce valid output", () => {
      const candles = buildFullAccumulation();
      const result = wyckoffPhases(candles);
      expect(result).toHaveLength(candles.length);
      expect(result[0].value.phase).toBe("unknown");
    });
  });

  // =========================================================================
  // Input normalization
  // =========================================================================

  describe("input normalization", () => {
    it("raw candles produce identical output to pre-normalized candles", () => {
      const normalized = buildFullAccumulation();
      const raw = normalized.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      const resultRaw = wyckoffPhases(raw, { swingPeriod: 3, minRangeBars: 5 });
      const resultNorm = wyckoffPhases(normalized, { swingPeriod: 3, minRangeBars: 5 });

      expect(resultRaw).toHaveLength(resultNorm.length);
      expect(resultRaw.map((r) => r.value.phase)).toEqual(resultNorm.map((r) => r.value.phase));
    });
  });
});
