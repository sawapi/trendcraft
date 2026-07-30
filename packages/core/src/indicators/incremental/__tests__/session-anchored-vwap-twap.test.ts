import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import type { SessionDefinition } from "../../session/session-definition";
import { twap as batchTwap } from "../../volume/twap";
import { vwap as batchVwap } from "../../volume/vwap";
import { createTwap } from "../volume/twap";
import { createVwap } from "../volume/vwap";

/** New York cash session, 09:30-16:00 local. */
const NY_REGULAR: SessionDefinition = {
  name: "regular",
  startHour: 9,
  startMinute: 30,
  endHour: 16,
  endMinute: 0,
  timezone: "America/New_York",
};

/** Tokyo-style session with a lunch break. */
const WITH_LUNCH: SessionDefinition = {
  name: "tokyo",
  startHour: 9,
  startMinute: 0,
  endHour: 15,
  endMinute: 0,
  breaks: [{ startHour: 11, startMinute: 30, endHour: 12, endMinute: 30 }],
  timezone: "Asia/Tokyo",
};

/** Runs across midnight, in New York local time. */
const NY_OVERNIGHT: SessionDefinition = {
  name: "overnight",
  startHour: 22,
  startMinute: 0,
  endHour: 6,
  endMinute: 0,
  timezone: "America/New_York",
};

function bar(time: number, price: number, volume = 1000): NormalizedCandle {
  return { time, open: price, high: price, low: price, close: price, volume };
}

/**
 * Two New York days with pre- and post-market bars, so the session boundary is
 * genuinely narrower than the UTC calendar day.
 */
function twoDaysWithExtendedHours(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];

  for (const [dayIndex, day] of [2, 3].entries()) {
    const base = 100 + dayIndex * 100;
    candles.push(bar(Date.UTC(2024, 0, day, 12, 0), base + 1)); // pre-market
    candles.push(bar(Date.UTC(2024, 0, day, 14, 30), base + 10)); // 09:30 open
    candles.push(bar(Date.UTC(2024, 0, day, 17, 0), base + 20)); // 12:00
    candles.push(bar(Date.UTC(2024, 0, day, 20, 30), base + 30)); // 15:30
    candles.push(bar(Date.UTC(2024, 0, day, 22, 0), base + 99)); // post-market
  }

  return candles;
}

const LUNCH_DAY = [
  bar(Date.UTC(2024, 0, 2, 0, 0), 100), // 09:00 Tokyo
  bar(Date.UTC(2024, 0, 2, 2, 0), 200), // 11:00
  bar(Date.UTC(2024, 0, 2, 3, 0), 999), // 12:00 — inside the break
  bar(Date.UTC(2024, 0, 2, 4, 0), 300), // 13:00
];

const ACROSS_DST = [
  bar(Date.UTC(2024, 10, 3, 5, 30), 100), // 01:30 EDT
  bar(Date.UTC(2024, 10, 3, 6, 30), 200), // 01:30 EST, an hour later
];

function runVwap(candles: NormalizedCandle[], session?: SessionDefinition) {
  const indicator = createVwap(session ? { session } : {});
  return candles.map((c) => indicator.next(c).value.vwap);
}

function runTwap(candles: NormalizedCandle[], session?: SessionDefinition) {
  const indicator = createTwap(session ? { session } : {});
  return candles.map((c) => indicator.next(c).value);
}

describe("incremental session-anchored VWAP", () => {
  it("excludes bars outside the session and restarts each day", () => {
    const values = runVwap(twoDaysWithExtendedHours(), NY_REGULAR);

    expect(values[0]).toBeNull();
    expect(values[4]).toBeNull();
    expect(values[1]).toBeCloseTo(110, 10);
    expect(values[2]).toBeCloseTo(115, 10);
    expect(values[3]).toBeCloseTo(120, 10);
    expect(values[6]).toBeCloseTo(210, 10);
    expect(values[8]).toBeCloseTo(220, 10);
  });

  it("pauses through a lunch break without restarting", () => {
    const values = runVwap(LUNCH_DAY, WITH_LUNCH);

    expect(values[2]).toBeNull();
    expect(values[3]).toBeCloseTo(200, 10);
  });

  it("keeps one average across a DST fall-back", () => {
    expect(runVwap(ACROSS_DST, NY_OVERNIGHT)[1]).toBeCloseTo(150, 10);
  });

  it("advances count even for bars outside the session", () => {
    // The bar was consumed; it just did not contribute. A caller counting
    // inputs must still see them.
    const indicator = createVwap({ session: NY_REGULAR });
    indicator.next(bar(Date.UTC(2024, 0, 2, 12, 0), 100));

    expect(indicator.count).toBe(1);
    expect(indicator.getState().state.cumulativeVolume).toBe(0);
  });
});

describe("incremental session-anchored TWAP", () => {
  it("excludes bars outside the session and restarts each day", () => {
    const values = runTwap(twoDaysWithExtendedHours(), NY_REGULAR);

    expect(values[0]).toBeNull();
    expect(values[4]).toBeNull();
    expect(values[1]).toBeCloseTo(110, 10);
    expect(values[3]).toBeCloseTo(120, 10);
    expect(values[6]).toBeCloseTo(210, 10);
  });

  it("pauses through a lunch break without restarting", () => {
    const values = runTwap(LUNCH_DAY, WITH_LUNCH);

    expect(values[2]).toBeNull();
    expect(values[3]).toBeCloseTo(200, 10);
  });

  it("rejects a reset period that contradicts the session", () => {
    expect(() => createTwap({ session: NY_REGULAR, sessionResetPeriod: 5 })).toThrow(
      /cannot be combined with `session`/,
    );
  });
});

describe("peek does not advance session state", () => {
  it("VWAP: peeking an out-of-session bar leaves the totals alone", () => {
    const indicator = createVwap({ session: NY_REGULAR });
    indicator.next(bar(Date.UTC(2024, 0, 2, 14, 30), 100));
    const before = indicator.getState().state;

    const peeked = indicator.peek(bar(Date.UTC(2024, 0, 2, 12, 0), 999));

    expect(peeked.value.vwap).toBeNull();
    expect(indicator.getState().state).toEqual(before);
  });

  it("VWAP: peeking a bar in the next occurrence does not reset the totals", () => {
    const indicator = createVwap({ session: NY_REGULAR });
    indicator.next(bar(Date.UTC(2024, 0, 2, 14, 30), 100));
    const before = indicator.getState().state;

    // Next day's open — a peek must show the restarted average without
    // actually restarting it.
    const peeked = indicator.peek(bar(Date.UTC(2024, 0, 3, 14, 30), 200));

    expect(peeked.value.vwap).toBeCloseTo(200, 10);
    expect(indicator.getState().state).toEqual(before);

    // The still-current occurrence continues from where it was.
    expect(indicator.next(bar(Date.UTC(2024, 0, 2, 17, 0), 200)).value.vwap).toBeCloseTo(150, 10);
  });

  it("TWAP: peeking leaves the totals alone", () => {
    const indicator = createTwap({ session: NY_REGULAR });
    indicator.next(bar(Date.UTC(2024, 0, 2, 14, 30), 100));
    const before = indicator.getState().state;

    indicator.peek(bar(Date.UTC(2024, 0, 2, 12, 0), 999));
    indicator.peek(bar(Date.UTC(2024, 0, 3, 14, 30), 200));

    expect(indicator.getState().state).toEqual(before);
  });
});

describe("snapshot and resume", () => {
  it("VWAP: resuming mid-session continues the same average", () => {
    const candles = twoDaysWithExtendedHours();
    const straightThrough = runVwap(candles, NY_REGULAR);

    const first = createVwap({ session: NY_REGULAR });
    for (const c of candles.slice(0, 3)) first.next(c);
    const snapshot = JSON.parse(JSON.stringify(first.getState()));

    const resumed = createVwap({ session: NY_REGULAR }, { fromState: snapshot });
    const rest = candles.slice(3).map((c) => resumed.next(c).value.vwap);

    expect(rest).toEqual(straightThrough.slice(3));
  });

  it("TWAP: resuming mid-session continues the same average", () => {
    const candles = twoDaysWithExtendedHours();
    const straightThrough = runTwap(candles, NY_REGULAR);

    const first = createTwap({ session: NY_REGULAR });
    for (const c of candles.slice(0, 3)) first.next(c);
    const snapshot = JSON.parse(JSON.stringify(first.getState()));

    const resumed = createTwap({ session: NY_REGULAR }, { fromState: snapshot });
    const rest = candles.slice(3).map((c) => resumed.next(c).value);

    expect(rest).toEqual(straightThrough.slice(3));
  });

  it("carries the session in meta.params, not the bare state", () => {
    const indicator = createVwap({ session: NY_REGULAR });
    indicator.next(bar(Date.UTC(2024, 0, 2, 14, 30), 100));
    const snapshot = indicator.getState();

    expect(snapshot.meta.params).toEqual({ session: NY_REGULAR });
    expect(snapshot.state).not.toHaveProperty("session");
  });

  it("refuses to resume a snapshot taken under a different session", () => {
    const indicator = createVwap({ session: NY_REGULAR });
    indicator.next(bar(Date.UTC(2024, 0, 2, 14, 30), 100));
    const snapshot = indicator.getState();

    // The totals encode which session they were accumulated over; carrying
    // them into another one would silently mean something else.
    expect(() => createVwap({ session: NY_OVERNIGHT }, { fromState: snapshot })).toThrow();
  });

  it("carries the snapshot's session forward when the options omit it", () => {
    const indicator = createVwap({ session: NY_REGULAR });
    indicator.next(bar(Date.UTC(2024, 0, 2, 14, 30), 100));
    const snapshot = JSON.parse(JSON.stringify(indicator.getState()));

    // Omitting an option means "unchanged", not "cleared": a caller resuming
    // from a snapshot does not have to restate how it was configured.
    const resumed = createVwap({}, { fromState: snapshot });

    expect(resumed.getState().meta.params).toEqual({ session: NY_REGULAR });
    // The session is still in force — an out-of-session bar reports nothing.
    expect(resumed.next(bar(Date.UTC(2024, 0, 2, 12, 0), 999)).value.vwap).toBeNull();
    // And the in-session average continues rather than restarting.
    expect(resumed.next(bar(Date.UTC(2024, 0, 2, 17, 0), 200)).value.vwap).toBeCloseTo(150, 10);
  });

  it("refuses a snapshot written before the schema bump", () => {
    const indicator = createVwap({ session: NY_REGULAR });
    indicator.next(bar(Date.UTC(2024, 0, 2, 14, 30), 100));
    const stale = indicator.getState();
    stale.meta.version = 1;

    expect(() => createVwap({ session: NY_REGULAR }, { fromState: stale })).toThrow();
  });
});

describe("parity with the batch implementations", () => {
  const cases: { name: string; candles: NormalizedCandle[]; session: SessionDefinition }[] = [
    {
      name: "extended hours over two days",
      candles: twoDaysWithExtendedHours(),
      session: NY_REGULAR,
    },
    { name: "a session with a lunch break", candles: LUNCH_DAY, session: WITH_LUNCH },
    { name: "a DST fall-back", candles: ACROSS_DST, session: NY_OVERNIGHT },
    {
      name: "a session crossing midnight",
      candles: [bar(Date.UTC(2024, 0, 3, 3, 0), 100), bar(Date.UTC(2024, 0, 3, 8, 0), 200)],
      session: NY_OVERNIGHT,
    },
  ];

  for (const { name, candles, session } of cases) {
    it(`VWAP agrees on ${name}`, () => {
      const batch = batchVwap(candles, { session }).map((p) => p.value.vwap);

      expect(runVwap(candles, session)).toEqual(batch);
    });

    it(`TWAP agrees on ${name}`, () => {
      const batch = batchTwap(candles, { session }).map((p) => p.value);

      expect(runTwap(candles, session)).toEqual(batch);
    });
  }

  it("VWAP agrees with the batch default when no session is given", () => {
    const candles = twoDaysWithExtendedHours();
    const batch = batchVwap(candles).map((p) => p.value.vwap);

    expect(runVwap(candles)).toEqual(batch);
  });

  it("TWAP agrees with the batch default when no session is given", () => {
    const candles = twoDaysWithExtendedHours();
    const batch = batchTwap(candles).map((p) => p.value);

    expect(runTwap(candles)).toEqual(batch);
  });
});
