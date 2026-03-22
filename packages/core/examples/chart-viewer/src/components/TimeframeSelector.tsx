/**
 * Timeframe selector component
 */

import type { ChangeEvent } from "react";
import { useChartStore } from "../store/chartStore";
import type { Timeframe } from "../types";

export function TimeframeSelector() {
  const timeframe = useChartStore((state) => state.timeframe);
  const setTimeframe = useChartStore((state) => state.setTimeframe);

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setTimeframe(e.target.value as Timeframe);
  };

  return (
    <select className="timeframe-selector" value={timeframe} onChange={handleChange}>
      <option value="daily">Daily</option>
      <option value="weekly">Weekly</option>
      <option value="monthly">Monthly</option>
    </select>
  );
}
