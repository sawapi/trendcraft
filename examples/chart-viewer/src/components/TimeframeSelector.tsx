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
      <option value="daily">日足</option>
      <option value="weekly">週足</option>
      <option value="monthly">月足</option>
    </select>
  );
}
