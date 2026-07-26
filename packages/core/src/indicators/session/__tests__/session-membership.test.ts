import { describe, expect, it } from "vitest";
import type { SessionDefinition } from "../session-definition";
import { resolveSessionMembership } from "../session-definition";

/** New York cash session, with an artificial mid-session break. */
const NY_REGULAR: SessionDefinition = {
  name: "regular",
  startHour: 9,
  startMinute: 30,
  endHour: 16,
  endMinute: 0,
  timezone: "America/New_York",
};

const NY_WITH_BREAK: SessionDefinition = {
  ...NY_REGULAR,
  breaks: [{ startHour: 12, startMinute: 0, endHour: 13, endMinute: 0 }],
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

describe("resolveSessionMembership", () => {
  describe("inside the window", () => {
    it("reports elapsed minutes from the session open", () => {
      // 2024-01-02 15:00 UTC = 10:00 New York, 30 minutes after the 09:30 open.
      const m = resolveSessionMembership(Date.UTC(2024, 0, 2, 15, 0), NY_REGULAR);

      expect(m.inWindow).toBe(true);
      expect(m.inBreak).toBe(false);
      expect(m.active).toBe(true);
      expect(m.elapsedMinutes).toBe(30);
    });

    it("reports zero elapsed minutes on the opening bar", () => {
      const m = resolveSessionMembership(Date.UTC(2024, 0, 2, 14, 30), NY_REGULAR);

      expect(m.elapsedMinutes).toBe(0);
      expect(m.active).toBe(true);
    });

    it("counts elapsed minutes continuously across midnight", () => {
      // 22:00 open; 01:00 local the next morning is three hours in.
      const open = resolveSessionMembership(Date.UTC(2024, 0, 3, 3, 0), NY_OVERNIGHT);
      const later = resolveSessionMembership(Date.UTC(2024, 0, 3, 6, 0), NY_OVERNIGHT);

      expect(open.elapsedMinutes).toBe(0);
      expect(later.elapsedMinutes).toBe(180);
    });
  });

  describe("inside a break", () => {
    it("stays in the window but is not active", () => {
      // 17:30 UTC = 12:30 New York, inside the 12:00-13:00 break.
      const m = resolveSessionMembership(Date.UTC(2024, 0, 2, 17, 30), NY_WITH_BREAK);

      expect(m.inWindow).toBe(true);
      expect(m.inBreak).toBe(true);
      expect(m.active).toBe(false);
      // Elapsed time keeps running through the break — the session has not
      // restarted, it has paused.
      expect(m.elapsedMinutes).toBe(180);
    });

    it("becomes active again after the break ends", () => {
      const m = resolveSessionMembership(Date.UTC(2024, 0, 2, 18, 0), NY_WITH_BREAK);

      expect(m.inBreak).toBe(false);
      expect(m.active).toBe(true);
    });
  });

  describe("outside the window", () => {
    it("reports nothing usable rather than a stale position", () => {
      // 13:00 UTC = 08:00 New York, before the open.
      const m = resolveSessionMembership(Date.UTC(2024, 0, 2, 13, 0), NY_REGULAR);

      expect(m).toEqual({
        occurrenceKey: -1,
        elapsedMinutes: -1,
        inWindow: false,
        inBreak: false,
        active: false,
      });
    });
  });

  describe("occurrenceKey", () => {
    it("is stable within one day and changes on the next", () => {
      const morning = resolveSessionMembership(Date.UTC(2024, 0, 2, 14, 30), NY_REGULAR);
      const afternoon = resolveSessionMembership(Date.UTC(2024, 0, 2, 20, 0), NY_REGULAR);
      const nextDay = resolveSessionMembership(Date.UTC(2024, 0, 3, 14, 30), NY_REGULAR);

      expect(afternoon.occurrenceKey).toBe(morning.occurrenceKey);
      expect(nextDay.occurrenceKey).not.toBe(morning.occurrenceKey);
    });

    it("attributes post-midnight bars back to the day the session opened", () => {
      // Both belong to the session that opened at 22:00 on 2024-01-02 local.
      const beforeMidnight = resolveSessionMembership(Date.UTC(2024, 0, 3, 3, 0), NY_OVERNIGHT);
      const afterMidnight = resolveSessionMembership(Date.UTC(2024, 0, 3, 8, 0), NY_OVERNIGHT);

      expect(afterMidnight.occurrenceKey).toBe(beforeMidnight.occurrenceKey);
    });

    it("survives a DST fall-back, where the local clock repeats an hour", () => {
      // New York rewinds 02:00 EDT to 01:00 EST on 2024-11-03. Both of these
      // read 01:30 locally, an hour apart in real time.
      const beforeRewind = resolveSessionMembership(Date.UTC(2024, 10, 3, 5, 30), NY_OVERNIGHT);
      const afterRewind = resolveSessionMembership(Date.UTC(2024, 10, 3, 6, 30), NY_OVERNIGHT);

      expect(afterRewind.occurrenceKey).toBe(beforeRewind.occurrenceKey);
      // Elapsed minutes are clock-derived, so an hour of real time passes
      // without them advancing.
      expect(afterRewind.elapsedMinutes).toBe(beforeRewind.elapsedMinutes);
    });

    it("holds while elapsed minutes run backwards across the repeated hour", () => {
      // 01:30 EDT, then half an hour later 01:00 EST: the clock has gone back,
      // so elapsed minutes shrink. This is the case that made an elapsed-time
      // comparison split one session in two, and why occurrenceKey — not
      // elapsedMinutes — identifies an occurrence.
      const beforeRewind = resolveSessionMembership(Date.UTC(2024, 10, 3, 5, 30), NY_OVERNIGHT);
      const afterRewind = resolveSessionMembership(Date.UTC(2024, 10, 3, 6, 0), NY_OVERNIGHT);

      expect(afterRewind.elapsedMinutes).toBeLessThan(beforeRewind.elapsedMinutes);
      expect(afterRewind.occurrenceKey).toBe(beforeRewind.occurrenceKey);
    });
  });
});
