/**
 * Daily bars from real feeds are stamped at the exchange's local midnight in
 * UTC, which moves by an hour at every DST change (05:00Z in winter, 04:00Z
 * in summer for US data). The axis read that one-hour shift as an intraday
 * session gap and labelled daily bars with a time.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { autoFormatTime } from "../core/format";

const DAY = 86_400_000;

describe("autoFormatTime on daily bars across a DST change", () => {
  const savedTz = process.env.TZ;
  beforeAll(() => {
    // A viewer far from the exchange: the shift is visible as 14:00 -> 13:00.
    process.env.TZ = "Asia/Tokyo";
  });
  afterAll(() => {
    process.env.TZ = savedTz;
  });

  it("shows no time when the bar's wall-clock hour shifts by the DST hour", () => {
    const friday = Date.parse("2025-03-07T05:00:00Z"); // before US DST
    const monday = Date.parse("2025-03-10T04:00:00Z"); // after US DST
    const label = autoFormatTime(monday, friday, DAY);
    expect(label).toBe("Mar 10");
  });

  it("still shows the time on intraday bars after a session gap", () => {
    const close = Date.parse("2025-03-07T21:00:00Z");
    const open = Date.parse("2025-03-10T13:30:00Z");
    expect(autoFormatTime(open, close, 5 * 60_000)).toMatch(/\d{2}:\d{2}$/);
  });
});
