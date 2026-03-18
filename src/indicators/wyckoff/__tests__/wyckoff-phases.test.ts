import { describe, it, expect } from "vitest";
import { wyckoffPhases } from "../wyckoff-phases";
import type { NormalizedCandle } from "../../../types";

function makeCandle(
  i: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
): NormalizedCandle {
  return {
    time: 1000000 + i * 86400000,
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * Build a synthetic accumulation sequence:
 * 1. Downtrend (20 bars) — establishes bearish context
 * 2. PS — Preliminary support with increased volume
 * 3. SC — Selling climax with extreme volume at lower price
 * 4. AR — Automatic rally establishing range high
 * 5. ST — Secondary test near SC with lower volume
 * 6. Spring — Price dips below range low and recovers
 * 7. SOS — Strong breakout above range high
 * 8. LPS — Pullback to midpoint
 */
function buildAccumulationSequence(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let idx = 0;

  // Downtrend: 25 bars from 120 down to ~95
  for (let i = 0; i < 25; i++) {
    const price = 120 - i * 1.0;
    candles.push(
      makeCandle(idx++, price + 0.5, price + 1.5, price - 1.5, price - 0.5, 1000),
    );
  }

  // PS area: swing low with high volume (around 95)
  candles.push(makeCandle(idx++, 96, 97, 93, 94, 3000)); // high vol swing low
  // Small bounce
  for (let i = 0; i < 5; i++) {
    candles.push(makeCandle(idx++, 94 + i * 0.3, 95 + i * 0.3, 93.5 + i * 0.3, 94.5 + i * 0.3, 800));
  }

  // SC: Selling climax — lower low with extreme volume
  candles.push(makeCandle(idx++, 94, 94.5, 89, 90, 6000)); // extreme vol, wide spread, close near low
  // Small bars after SC
  for (let i = 0; i < 3; i++) {
    candles.push(makeCandle(idx++, 90 + i * 0.5, 91 + i * 0.5, 89.5 + i * 0.5, 90.5 + i * 0.5, 500));
  }

  // AR: Automatic rally — strong move up establishing range high
  for (let i = 0; i < 6; i++) {
    const p = 91 + i * 1.5;
    candles.push(makeCandle(idx++, p, p + 1, p - 0.5, p + 0.8, 1500));
  }
  candles.push(makeCandle(idx++, 100, 102, 99.5, 101.5, 2000)); // swing high

  // Range bars
  for (let i = 0; i < 5; i++) {
    candles.push(makeCandle(idx++, 100 - i * 0.5, 101 - i * 0.5, 99 - i * 0.5, 99.5 - i * 0.5, 800));
  }

  // ST: Secondary test near SC low with reduced volume
  candles.push(makeCandle(idx++, 96, 96.5, 90.5, 91, 1200)); // near SC low, lower vol than SC

  // Range bars
  for (let i = 0; i < 8; i++) {
    const base = 92 + (i % 3) * 1.5;
    candles.push(makeCandle(idx++, base, base + 1, base - 1, base + 0.5, 900));
  }

  // Spring: dip below range low, close back inside
  candles.push(makeCandle(idx++, 91, 92, 88, 91.5, 800)); // low below rangeLow(89), close above

  // Recovery bars
  for (let i = 0; i < 5; i++) {
    const p = 92 + i * 2;
    candles.push(makeCandle(idx++, p, p + 1.5, p - 0.5, p + 1, 1800));
  }

  // SOS: breakout above range high (102)
  candles.push(makeCandle(idx++, 101, 105, 100.5, 104, 3500)); // bullish BOS above range

  // LPS: Pullback that holds above midpoint (~95)
  for (let i = 0; i < 3; i++) {
    candles.push(makeCandle(idx++, 103 - i, 104 - i, 102 - i, 102.5 - i, 1000));
  }
  candles.push(makeCandle(idx++, 99, 100, 97, 98, 900)); // swing low above midpoint

  // Markup continuation
  for (let i = 0; i < 5; i++) {
    const p = 99 + i * 2;
    candles.push(makeCandle(idx++, p, p + 2, p - 0.5, p + 1.5, 1500));
  }

  return candles;
}

describe("wyckoffPhases", () => {
  it("returns empty array for empty input", () => {
    expect(wyckoffPhases([])).toEqual([]);
  });

  it("returns correct length matching input", () => {
    const candles = buildAccumulationSequence();
    const result = wyckoffPhases(candles, { swingPeriod: 3 });
    expect(result).toHaveLength(candles.length);
  });

  it("starts in unknown phase", () => {
    const candles = buildAccumulationSequence();
    const result = wyckoffPhases(candles, { swingPeriod: 3 });
    expect(result[0].value.phase).toBe("unknown");
  });

  it("detects accumulation phase from downtrend", () => {
    const candles = buildAccumulationSequence();
    const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

    // Should eventually detect accumulation
    const phases = result.map((r) => r.value.phase);
    expect(phases).toContain("accumulation");
  });

  it("detects at least some Wyckoff events in accumulation sequence", () => {
    const candles = buildAccumulationSequence();
    const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

    // Find all detected events across the sequence
    const allEvents = new Set<string>();
    for (const r of result) {
      if (r.value.event) allEvents.add(r.value.event);
    }

    // At minimum, should detect PS (first event in accumulation)
    expect(allEvents.size).toBeGreaterThan(0);
  });

  it("increases confidence as more events are detected", () => {
    const candles = buildAccumulationSequence();
    const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

    // Find bars where events are detected
    const eventBars = result.filter((r) => r.value.event !== null);
    if (eventBars.length >= 2) {
      const first = eventBars[0].value.confidence;
      const last = eventBars[eventBars.length - 1].value.confidence;
      expect(last).toBeGreaterThanOrEqual(first);
    }
  });

  it("provides range boundaries when phase is detected", () => {
    const candles = buildAccumulationSequence();
    const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

    const accBars = result.filter((r) => r.value.phase === "accumulation");
    if (accBars.length > 0) {
      const lastAcc = accBars[accBars.length - 1].value;
      expect(lastAcc.rangeLow).not.toBeNull();
    }
  });

  it("eventsDetected accumulates over time", () => {
    const candles = buildAccumulationSequence();
    const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

    const accBars = result.filter((r) => r.value.phase !== "unknown");
    if (accBars.length > 10) {
      const earlyEvents = accBars[5].value.eventsDetected.length;
      const lateEvents = accBars[accBars.length - 1].value.eventsDetected.length;
      expect(lateEvents).toBeGreaterThanOrEqual(earlyEvents);
    }
  });

  it("handles short input without crashing", () => {
    const candles = [
      makeCandle(0, 100, 101, 99, 100.5, 1000),
      makeCandle(1, 100.5, 102, 100, 101, 1000),
      makeCandle(2, 101, 101.5, 100, 100.5, 1000),
    ];
    const result = wyckoffPhases(candles);
    expect(result).toHaveLength(3);
    expect(result[0].value.phase).toBe("unknown");
  });

  it("confidence stays between 0 and 100", () => {
    const candles = buildAccumulationSequence();
    const result = wyckoffPhases(candles, { swingPeriod: 3, minRangeBars: 5 });

    for (const r of result) {
      expect(r.value.confidence).toBeGreaterThanOrEqual(0);
      expect(r.value.confidence).toBeLessThanOrEqual(100);
    }
  });
});
