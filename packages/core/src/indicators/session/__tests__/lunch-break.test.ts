/**
 * Tests for SessionDefinition.breaks (intra-session lunch break).
 */

import { describe, expect, it } from "vitest";
import type { Candle } from "../../../types";
import { sessionBreakout } from "../session-breakout";
import { detectSessions, getJpxSessions } from "../session-definition";
import { sessionStats } from "../session-stats";

/**
 * Build 1-minute bars from 00:00 UTC for the given count of bars.
 * Start time is 2026-01-05 (Mon) 00:00:00 UTC.
 */
function makeMinuteBars(count: number, startEpoch = Date.UTC(2026, 0, 5, 0, 0, 0)): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const price = 1000 + i;
    out.push({
      time: startEpoch + i * 60_000,
      open: price,
      high: price + 2,
      low: price - 2,
      close: price + 1,
      volume: 100,
    });
  }
  return out;
}

describe("SessionDefinition breaks — JPX lunch", () => {
  const sessions = getJpxSessions();

  it("detectSessions marks break bars as inSession=false but keeps session name", () => {
    // 9h of bars = 540 minute-bars starting at 00:00 UTC
    const candles = makeMinuteBars(9 * 60);
    const info = detectSessions(candles, sessions);

    // 00:00 UTC → inside JPX morning (09:00 JST)
    expect(info[0].value.session).toBe("JPX");
    expect(info[0].value.inSession).toBe(true);

    // 02:30 UTC (= 11:30 JST) → break begins
    const breakStart = info[2 * 60 + 30];
    expect(breakStart.value.session).toBe("JPX");
    expect(breakStart.value.inSession).toBe(false);

    // 03:00 UTC (= 12:00 JST) → still in break
    const midBreak = info[3 * 60];
    expect(midBreak.value.inSession).toBe(false);

    // 03:30 UTC (= 12:30 JST) → break ends, afternoon session
    const afterBreak = info[3 * 60 + 30];
    expect(afterBreak.value.session).toBe("JPX");
    expect(afterBreak.value.inSession).toBe(true);

    // 06:00 UTC (= 15:00 JST) → still in session (closes at 15:30)
    const beforeClose = info[6 * 60];
    expect(beforeClose.value.session).toBe("JPX");
    expect(beforeClose.value.inSession).toBe(true);

    // 06:30 UTC (= 15:30 JST) → session ends
    const sessionEnd = info[6 * 60 + 30];
    expect(sessionEnd.value.session).toBeNull();
    expect(sessionEnd.value.inSession).toBe(false);
  });

  it("detectSessions preserves sessionOpen across the break", () => {
    const candles = makeMinuteBars(9 * 60);
    const info = detectSessions(candles, sessions);

    const openAt1Hour = info[60].value.sessionOpen;
    const openAfterBreak = info[3 * 60 + 30].value.sessionOpen;
    expect(openAfterBreak).toBe(openAt1Hour);
    expect(openAfterBreak).not.toBeNull();
  });

  it("detectSessions does not advance barIndex during break", () => {
    const candles = makeMinuteBars(9 * 60);
    const info = detectSessions(candles, sessions);

    // barIndex at 02:29 UTC (last bar before break) vs at 03:30 UTC (first bar after break)
    const lastBeforeBreak = info[2 * 60 + 29].value.barIndex;
    const firstAfterBreak = info[3 * 60 + 30].value.barIndex;
    // Break is 60 minutes; firstAfterBreak should be lastBeforeBreak + 1
    expect(firstAfterBreak).toBe(lastBeforeBreak + 1);
  });

  it("sessionStats treats JPX as one occurrence with break bars excluded", () => {
    const candles = makeMinuteBars(9 * 60);
    const stats = sessionStats(candles, { sessions, lookback: 10 });
    expect(stats).toHaveLength(1);
    const jpx = stats[0];
    expect(jpx.session).toBe("JPX");
    // 6.5h window = 390 bars. Break 60 bars. Expect 330 bars counted.
    expect(jpx.barCount).toBe(330);
  });

  it("sessionBreakout uses full-session range (excluding break) as reference", () => {
    // Extend to multi-day so a completed session exists before a breakout can fire.
    const twoDays = makeMinuteBars(24 * 60 * 2);
    const bo = sessionBreakout(twoDays, { sessions });
    // After session end (06:30 UTC on day 1), fromSession should be "JPX".
    const atDay1End = bo[6 * 60 + 31];
    expect(atDay1End.value.fromSession).toBe("JPX");
    expect(atDay1End.value.rangeHigh).not.toBeNull();
    expect(atDay1End.value.rangeLow).not.toBeNull();
  });
});

describe("SessionDefinition breaks — backward compatibility", () => {
  it("sessions without breaks behave exactly as before", () => {
    const candles = makeMinuteBars(24 * 60);
    const sessionsNoBreak = [
      {
        name: "Custom",
        startHour: 9,
        startMinute: 0,
        endHour: 15,
        endMinute: 0,
      },
    ];
    const info = detectSessions(candles, sessionsNoBreak);
    const stats = sessionStats(candles, { sessions: sessionsNoBreak, lookback: 10 });
    // 09:00–15:00 = 6h = 360 bars
    expect(stats[0].barCount).toBe(360);
    // All in-window bars should report inSession=true
    const inWindowBars = info.filter((p) => p.value.session === "Custom");
    expect(inWindowBars.every((p) => p.value.inSession)).toBe(true);
  });
});
