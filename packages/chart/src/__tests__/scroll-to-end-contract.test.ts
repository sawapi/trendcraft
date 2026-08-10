/**
 * Contract: every jump-to-end path lands on `TimeScale.scrollToEndTarget`.
 *
 * The scrollbar once re-derived its right boundary locally as
 * `total - visible` and silently destroyed a configured rightOffset margin.
 * This suite pins the single-owner contract at the TimeScale level across
 * rightOffset (integer / fractional / none) and session-gap layouts; the
 * DOM-level consumers (End key, scrollbar far-right) are pinned to the same
 * owner in viewport-attach.test.ts.
 */

import { describe, expect, it } from "vitest";
import { TimeScale } from "../core/scale";

type Config = { label: string; rightOffset: number; gaps: boolean };

const CONFIGS: Config[] = [
  { label: "no offset, no gaps", rightOffset: 0, gaps: false },
  { label: "integer offset", rightOffset: 7, gaps: false },
  { label: "fractional offset", rightOffset: 7.5, gaps: false },
  { label: "no offset, session gaps", rightOffset: 0, gaps: true },
  { label: "integer offset, session gaps", rightOffset: 7, gaps: true },
];

const GAPS = [
  { index: 200, size: 3 },
  { index: 400, size: 5 },
];

function makeScale({ rightOffset, gaps }: Config, total = 500): TimeScale {
  const ts = new TimeScale();
  ts.setWidth(800);
  ts.setTotalCount(total);
  if (gaps) ts.setGapsBefore(GAPS);
  if (rightOffset > 0) ts.setRightOffset(rightOffset);
  ts.setVisibleRange(100, 200);
  return ts;
}

describe.each(CONFIGS)("jump-to-end contract — $label", (config) => {
  it("scrollToEnd() lands on scrollToEndTarget", () => {
    const ts = makeScale(config);
    ts.scrollToEnd();
    expect(ts.rawStartIndex).toBe(ts.scrollToEndTarget);
  });

  it("a pinned viewer follows appends onto scrollToEndTarget", () => {
    const ts = makeScale(config);
    ts.scrollToEnd();
    const prevEndDistance = ts.endDistanceVirtual;
    ts.setTotalCount(501);
    if (config.gaps) ts.setGapsBefore(GAPS);
    ts.followLiveEdge(prevEndDistance);
    expect(ts.rawStartIndex).toBeCloseTo(ts.scrollToEndTarget, 9);
  });

  it.skipIf(config.gaps)("scrollToEndTarget leaves the offset visible past the data", () => {
    // Gap-free layouts only: with session gaps the window spans virtual
    // slots, so real-index arithmetic doesn't express the margin directly.
    const ts = makeScale(config);
    ts.scrollToEnd();
    expect(ts.rawStartIndex + ts.visibleCount).toBeGreaterThanOrEqual(
      500 + config.rightOffset - 1e-9,
    );
  });
});
