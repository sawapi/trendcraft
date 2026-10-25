/**
 * A session whose clock fields cannot describe a window used to put every bar
 * outside the session, so session-anchored indicators returned all nulls with
 * no error. Every session-aware indicator now rejects such a definition.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { createVwap } from "../incremental/volume/vwap";
import { openingRange } from "../price/opening-range";
import type { SessionDefinition } from "../session/session-definition";
import { twap } from "../volume/twap";
import { vwap } from "../volume/vwap";

const HOUR = 3_600_000;
const candles: NormalizedCandle[] = Array.from({ length: 48 }, (_, i) => ({
  time: Date.UTC(2024, 0, 2) + i * HOUR,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1000,
}));

const valid: SessionDefinition = {
  name: "NY",
  startHour: 14,
  startMinute: 30,
  endHour: 21,
  endMinute: 0,
};

const bad = (s: unknown) => s as SessionDefinition;

describe("session definition validation", () => {
  it.each([
    ["an empty object", {}, /session\.startHour must be an integer from 0 to 23/],
    ["a string hour", { ...valid, startHour: "x" }, /session\.startHour/],
    [
      "an hour past 23",
      { ...valid, endHour: 30 },
      /session\.endHour must be an integer from 0 to 23, got 30/,
    ],
    ["a fractional minute", { ...valid, startMinute: 7.5 }, /session\.startMinute .* 0 to 59/],
    [
      "a malformed break",
      { ...valid, breaks: [{ startHour: 17 }] },
      /session\.breaks\[0\]\.startMinute/,
    ],
    [
      "non-array breaks",
      { ...valid, breaks: { startHour: 1 } },
      /session\.breaks must be an array/,
    ],
  ])("rejects %s", (_label, session, message) => {
    expect(() => vwap(candles, { session: bad(session) })).toThrow(message);
  });

  it("applies to every session-aware indicator", () => {
    const session = bad({});
    expect(() => twap(candles, { session })).toThrow(/session\.startHour/);
    expect(() => openingRange(candles, { session })).toThrow(/session\.startHour/);
    const inc = createVwap({ session });
    expect(() => inc.next(candles[0])).toThrow(/session\.startHour/);
  });

  it("re-checks a session object that was changed after it was first used", () => {
    const session = { ...valid };
    vwap(candles, { session });
    session.startHour = 30;
    expect(() => vwap(candles, { session })).toThrow(/session\.startHour .* got 30/);
  });

  it("accepts a valid session, with breaks", () => {
    const withBreak = {
      ...valid,
      breaks: [{ startHour: 17, startMinute: 0, endHour: 17, endMinute: 30 }],
    };
    const result = vwap(candles, { session: withBreak });
    expect(result.some((p) => p.value !== null)).toBe(true);
  });
});
