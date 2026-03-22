import { describe, expect, it } from "vitest";
import type { Candle } from "../../../types";
import { getIctKillZones, killZones } from "../kill-zones";
import { sessionBreakout } from "../session-breakout";
import { defineSession, detectSessions, getIctSessions } from "../session-definition";
import { sessionStats } from "../session-stats";

/**
 * Helper: create a candle at a specific UTC hour:minute.
 * Uses milliseconds for time (matching normalized candle format).
 */
function makeCandle(
  hour: number,
  minute: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 100,
  dayOffset = 0,
): Candle {
  // 2024-01-15 as base date (a Monday), time in ms
  const base = Date.UTC(2024, 0, 15 + dayOffset, hour, minute, 0);
  return { time: base, open, high, low, close, volume };
}

/**
 * Helper: generate candles at 30-min intervals spanning hours [startHour, endHour).
 */
function generateCandles(
  startHour: number,
  endHour: number,
  basePrice: number,
  volume = 100,
  dayOffset = 0,
): Candle[] {
  const candles: Candle[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (const m of [0, 30]) {
      const price = basePrice + Math.random() * 2 - 1;
      candles.push(makeCandle(h, m, price, price + 1, price - 1, price + 0.5, volume, dayOffset));
    }
  }
  return candles;
}

describe("defineSession", () => {
  it("creates correct session definition", () => {
    const session = defineSession("Pre-Market", 8, 0, 9, 30);
    expect(session).toEqual({
      name: "Pre-Market",
      startHour: 8,
      startMinute: 0,
      endHour: 9,
      endMinute: 30,
    });
  });
});

describe("getIctSessions", () => {
  it("returns 4 sessions", () => {
    const sessions = getIctSessions();
    expect(sessions).toHaveLength(4);
    expect(sessions.map((s) => s.name)).toEqual(["Asia", "London", "NY AM", "NY PM"]);
  });

  it("has correct UTC times for Asia session", () => {
    const asia = getIctSessions()[0];
    expect(asia.startHour).toBe(0);
    expect(asia.startMinute).toBe(0);
    expect(asia.endHour).toBe(5);
    expect(asia.endMinute).toBe(0);
  });
});

describe("detectSessions", () => {
  it("returns empty for empty candles", () => {
    expect(detectSessions([])).toEqual([]);
  });

  it("correctly assigns bars to sessions based on UTC time", () => {
    const candles = [
      makeCandle(1, 0, 100, 102, 99, 101), // Asia
      makeCandle(3, 0, 101, 103, 100, 102), // Asia
      makeCandle(6, 0, 102, 104, 101, 103), // Outside all sessions
      makeCandle(8, 0, 103, 105, 102, 104), // London
      makeCandle(14, 0, 104, 106, 103, 105), // NY AM
    ];

    const result = detectSessions(candles);
    expect(result).toHaveLength(5);

    // Asia bars
    expect(result[0].value.session).toBe("Asia");
    expect(result[0].value.inSession).toBe(true);
    expect(result[1].value.session).toBe("Asia");
    expect(result[1].value.inSession).toBe(true);

    // Outside session
    expect(result[2].value.session).toBeNull();
    expect(result[2].value.inSession).toBe(false);

    // London
    expect(result[3].value.session).toBe("London");
    expect(result[3].value.inSession).toBe(true);

    // NY AM
    expect(result[4].value.session).toBe("NY AM");
    expect(result[4].value.inSession).toBe(true);
  });

  it("tracks sessionOpen/High/Low correctly", () => {
    const candles = [
      makeCandle(1, 0, 100, 105, 98, 102), // Asia bar 0
      makeCandle(1, 30, 102, 110, 97, 108), // Asia bar 1
      makeCandle(2, 0, 108, 112, 99, 106), // Asia bar 2
    ];

    const result = detectSessions(candles);

    // Bar 0: session just started
    expect(result[0].value.barIndex).toBe(0);
    expect(result[0].value.sessionOpen).toBe(100);
    expect(result[0].value.sessionHigh).toBe(105);
    expect(result[0].value.sessionLow).toBe(98);

    // Bar 1: session high/low updated
    expect(result[1].value.barIndex).toBe(1);
    expect(result[1].value.sessionOpen).toBe(100);
    expect(result[1].value.sessionHigh).toBe(110);
    expect(result[1].value.sessionLow).toBe(97);

    // Bar 2: session high/low updated again
    expect(result[2].value.barIndex).toBe(2);
    expect(result[2].value.sessionOpen).toBe(100);
    expect(result[2].value.sessionHigh).toBe(112);
    expect(result[2].value.sessionLow).toBe(97);
  });

  it("resets session tracking when session changes", () => {
    const candles = [
      makeCandle(4, 0, 100, 110, 90, 105), // Asia
      makeCandle(6, 0, 105, 115, 95, 110), // Outside
      makeCandle(7, 0, 110, 120, 100, 115), // London
    ];

    const result = detectSessions(candles);

    // Asia
    expect(result[0].value.session).toBe("Asia");
    expect(result[0].value.sessionOpen).toBe(100);

    // Outside — null fields
    expect(result[1].value.session).toBeNull();
    expect(result[1].value.sessionOpen).toBeNull();
    expect(result[1].value.sessionHigh).toBeNull();
    expect(result[1].value.sessionLow).toBeNull();
    expect(result[1].value.barIndex).toBe(0);

    // London — fresh start
    expect(result[2].value.session).toBe("London");
    expect(result[2].value.sessionOpen).toBe(110);
    expect(result[2].value.sessionHigh).toBe(120);
    expect(result[2].value.sessionLow).toBe(100);
    expect(result[2].value.barIndex).toBe(0);
  });

  it("works with custom sessions", () => {
    const custom = [defineSession("Morning", 6, 0, 12, 0)];
    const candles = [
      makeCandle(5, 0, 100, 101, 99, 100.5), // Outside
      makeCandle(6, 0, 100, 102, 99, 101), // Morning
      makeCandle(12, 0, 101, 103, 100, 102), // Outside
    ];

    const result = detectSessions(candles, custom);
    expect(result[0].value.session).toBeNull();
    expect(result[1].value.session).toBe("Morning");
    expect(result[2].value.session).toBeNull();
  });
});

describe("getIctKillZones", () => {
  it("returns 4 kill zones", () => {
    const zones = getIctKillZones();
    expect(zones).toHaveLength(4);
    expect(zones.map((z) => z.name)).toEqual([
      "Asian KZ",
      "London Open KZ",
      "NY Open KZ",
      "London Close KZ",
    ]);
  });

  it("each zone has a characteristic", () => {
    const zones = getIctKillZones();
    for (const zone of zones) {
      expect(zone.characteristic).toBeTruthy();
    }
  });
});

describe("killZones", () => {
  it("returns empty for empty candles", () => {
    expect(killZones([])).toEqual([]);
  });

  it("detects when in/out of kill zone", () => {
    const candles = [
      makeCandle(2, 0, 100, 101, 99, 100.5), // Asian KZ (00:00-05:00)
      makeCandle(6, 0, 100, 101, 99, 100.5), // Outside all KZs
      makeCandle(7, 30, 100, 101, 99, 100.5), // London Open KZ (07:00-09:00)
      makeCandle(13, 0, 100, 101, 99, 100.5), // NY Open KZ (12:00-14:00)
      makeCandle(16, 0, 100, 101, 99, 100.5), // London Close KZ (15:00-17:00)
      makeCandle(22, 0, 100, 101, 99, 100.5), // Outside all KZs
    ];

    const result = killZones(candles);
    expect(result).toHaveLength(6);

    // Asian KZ
    expect(result[0].value.zone).toBe("Asian KZ");
    expect(result[0].value.inKillZone).toBe(true);
    expect(result[0].value.characteristic).toBe("Range formation, accumulation");

    // Outside
    expect(result[1].value.zone).toBeNull();
    expect(result[1].value.inKillZone).toBe(false);
    expect(result[1].value.characteristic).toBeNull();

    // London Open KZ
    expect(result[2].value.zone).toBe("London Open KZ");
    expect(result[2].value.inKillZone).toBe(true);

    // NY Open KZ
    expect(result[3].value.zone).toBe("NY Open KZ");
    expect(result[3].value.inKillZone).toBe(true);

    // London Close KZ
    expect(result[4].value.zone).toBe("London Close KZ");
    expect(result[4].value.inKillZone).toBe(true);

    // Outside
    expect(result[5].value.zone).toBeNull();
    expect(result[5].value.inKillZone).toBe(false);
  });

  it("boundary: bar at exact end time is outside", () => {
    // London Open KZ ends at 09:00 — a bar at 09:00 should be outside
    const candles = [
      makeCandle(8, 59, 100, 101, 99, 100.5), // Last minute inside
      makeCandle(9, 0, 100, 101, 99, 100.5), // Exact end — outside
    ];

    const result = killZones(candles);
    expect(result[0].value.inKillZone).toBe(true);
    expect(result[1].value.inKillZone).toBe(false);
  });
});

describe("sessionStats", () => {
  it("returns empty for empty candles", () => {
    expect(sessionStats([])).toEqual([]);
  });

  it("computes correct averages for a single session type", () => {
    // Create candles only in Asia session (00:00-05:00)
    const sessions = [defineSession("Asia", 0, 0, 5, 0)];

    // Day 1: 2 bars in Asia
    const candles: Candle[] = [
      makeCandle(1, 0, 100, 110, 90, 105, 200, 0), // bullish
      makeCandle(2, 0, 105, 115, 95, 100, 300, 0), // bearish
      // Gap outside session
      makeCandle(6, 0, 100, 101, 99, 100, 100, 0),
      // Day 2: 2 bars in Asia
      makeCandle(1, 0, 100, 108, 92, 106, 400, 1), // bullish
      makeCandle(2, 0, 106, 112, 94, 100, 600, 1), // bearish
    ];

    const result = sessionStats(candles, { sessions, lookback: 20 });
    expect(result).toHaveLength(1);
    expect(result[0].session).toBe("Asia");

    // Day 1 occurrence: high=115, low=90, range=25, volume=200+300=500
    // Day 2 occurrence: high=112, low=92, range=20, volume=400+600=1000
    expect(result[0].avgRange).toBe((25 + 20) / 2); // 22.5
    expect(result[0].avgVolume).toBe((500 + 1000) / 2); // 750

    // 2 bullish out of 4 total bars
    expect(result[0].bullishPercent).toBe(0.5);
    expect(result[0].barCount).toBe(4);
  });

  it("returns zero stats for sessions with no matching candles", () => {
    const sessions = [defineSession("Night", 22, 0, 23, 0)];
    const candles = [makeCandle(10, 0, 100, 101, 99, 100.5)];

    const result = sessionStats(candles, { sessions });
    expect(result).toHaveLength(1);
    expect(result[0].avgRange).toBe(0);
    expect(result[0].avgVolume).toBe(0);
    expect(result[0].barCount).toBe(0);
  });
});

describe("sessionBreakout", () => {
  it("returns empty for empty candles", () => {
    expect(sessionBreakout([])).toEqual([]);
  });

  it("detects breakout above after session ends", () => {
    const sessions = [defineSession("Test", 1, 0, 3, 0)];
    const candles: Candle[] = [
      // Session: high=110, low=90
      makeCandle(1, 0, 100, 110, 90, 105, 100),
      makeCandle(2, 0, 105, 108, 92, 102, 100),
      // After session: breakout above 110
      makeCandle(4, 0, 108, 115, 107, 112, 100),
    ];

    const result = sessionBreakout(candles, { sessions });
    expect(result).toHaveLength(3);

    // During session — no completed session yet
    expect(result[0].value.fromSession).toBeNull();
    expect(result[0].value.breakout).toBeNull();

    // After session: close=112 > rangeHigh=110
    expect(result[2].value.fromSession).toBe("Test");
    expect(result[2].value.breakout).toBe("above");
    expect(result[2].value.rangeHigh).toBe(110);
    expect(result[2].value.rangeLow).toBe(90);
  });

  it("detects breakout below after session ends", () => {
    const sessions = [defineSession("Test", 1, 0, 3, 0)];
    const candles: Candle[] = [
      // Session: high=110, low=90
      makeCandle(1, 0, 100, 110, 90, 105, 100),
      makeCandle(2, 0, 105, 108, 92, 102, 100),
      // After session: breakout below 90
      makeCandle(4, 0, 92, 93, 85, 88, 100),
    ];

    const result = sessionBreakout(candles, { sessions });

    // close=88 < rangeLow=90
    expect(result[2].value.breakout).toBe("below");
    expect(result[2].value.rangeLow).toBe(90);
  });

  it("no breakout when price stays within range", () => {
    const sessions = [defineSession("Test", 1, 0, 3, 0)];
    const candles: Candle[] = [
      makeCandle(1, 0, 100, 110, 90, 105, 100),
      // After session: close within range
      makeCandle(4, 0, 100, 105, 95, 100, 100),
    ];

    const result = sessionBreakout(candles, { sessions });
    expect(result[1].value.fromSession).toBe("Test");
    expect(result[1].value.breakout).toBeNull();
    expect(result[1].value.rangeHigh).toBe(110);
    expect(result[1].value.rangeLow).toBe(90);
  });

  it("updates to most recent completed session", () => {
    const sessions = [defineSession("S1", 1, 0, 3, 0), defineSession("S2", 5, 0, 7, 0)];
    const candles: Candle[] = [
      // S1: high=110, low=90
      makeCandle(1, 0, 100, 110, 90, 105, 100),
      // Gap
      makeCandle(4, 0, 108, 115, 107, 112, 100), // breakout above S1
      // S2: high=120, low=100
      makeCandle(5, 0, 105, 120, 100, 115, 100),
      // After S2
      makeCandle(8, 0, 115, 125, 114, 122, 100), // breakout above S2
    ];

    const result = sessionBreakout(candles, { sessions });

    // After S1
    expect(result[1].value.fromSession).toBe("S1");
    expect(result[1].value.breakout).toBe("above");

    // After S2 — should reference S2
    expect(result[3].value.fromSession).toBe("S2");
    expect(result[3].value.breakout).toBe("above");
    expect(result[3].value.rangeHigh).toBe(120);
  });
});
