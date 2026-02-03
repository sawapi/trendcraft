/**
 * Period selector component for quick zoom range selection
 */

import { useChartStore } from "../store/chartStore";

/**
 * Period options for quick selection
 */
const PERIOD_OPTIONS = [
  { label: "5D", days: 5 },
  { label: "20D", days: 20 },
  { label: "3M", days: 60 },
  { label: "6M", days: 120 },
  { label: "1Y", days: 250 },
  { label: "ALL", days: null },
] as const;

/**
 * Calculate zoom range for a given period
 */
function calculateZoomForPeriod(
  candleCount: number,
  targetDays: number | null,
): { start: number; end: number } {
  if (targetDays === null || targetDays >= candleCount) {
    return { start: 0, end: 100 };
  }
  const start = Math.max(0, 100 - (targetDays / candleCount) * 100);
  return { start, end: 100 };
}

export function PeriodSelector() {
  const currentCandles = useChartStore((s) => s.currentCandles);
  const zoomRange = useChartStore((s) => s.zoomRange);
  const setZoomRange = useChartStore((s) => s.setZoomRange);

  const candleCount = currentCandles.length;

  const handlePeriodClick = (days: number | null) => {
    const newRange = calculateZoomForPeriod(candleCount, days);
    setZoomRange(newRange);
  };

  // Determine which button is currently active based on zoom range
  const getActiveOption = (): string | null => {
    if (zoomRange.start === 0 && zoomRange.end === 100) {
      return "ALL";
    }

    // Find the closest matching option
    let closestOption: string | null = null;
    let closestDiff = Infinity;

    for (const opt of PERIOD_OPTIONS) {
      if (opt.days === null) continue;
      const expected = calculateZoomForPeriod(candleCount, opt.days);
      const diff = Math.abs(expected.start - zoomRange.start);

      // Only consider if end matches (should be 100)
      if (Math.abs(expected.end - zoomRange.end) < 0.5 && diff < closestDiff) {
        closestDiff = diff;
        closestOption = opt.label;
      }
    }

    // Only return if the match is close enough (within 0.1% tolerance)
    return closestDiff < 0.1 ? closestOption : null;
  };

  const activeOption = getActiveOption();

  return (
    <div className="period-selector">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.label}
          type="button"
          className={`period-btn ${activeOption === opt.label ? "active" : ""}`}
          onClick={() => handlePeriodClick(opt.days)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
