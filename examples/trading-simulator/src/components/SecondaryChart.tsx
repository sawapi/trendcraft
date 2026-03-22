import ReactECharts from "echarts-for-react";
import { useMemo, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { COLORS, THEME_COLORS } from "../utils/chartColors";
import { formatDate } from "../utils/fileParser";
import { type Timeframe, convertTimeframe } from "../utils/timeframeConverter";

function useDocumentTheme() {
  const [theme] = useState(
    () => (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark",
  );
  return theme;
}

export function SecondaryChart() {
  const { symbols, activeSymbolId, commonDateRange, currentDateIndex } = useSimulatorStore();
  const theme = useDocumentTheme();
  const tc = THEME_COLORS[theme];

  const [timeframe, setTimeframe] = useState<Timeframe>("weekly");

  const activeSymbol = useMemo(() => {
    if (!activeSymbolId) return symbols[0] || null;
    return symbols.find((s) => s.id === activeSymbolId) || null;
  }, [symbols, activeSymbolId]);

  const currentIndex = useMemo(() => {
    if (!activeSymbol || !commonDateRange || currentDateIndex < 0) return 0;
    const targetDate = commonDateRange.dates[currentDateIndex];
    if (!targetDate) return 0;
    return activeSymbol.allCandles.findIndex((c) => c.time === targetDate);
  }, [activeSymbol, commonDateRange, currentDateIndex]);

  const visibleCandles = useMemo(() => {
    if (!activeSymbol) return [];
    return activeSymbol.allCandles.slice(activeSymbol.startIndex, currentIndex + 1);
  }, [activeSymbol, currentIndex]);

  const convertedCandles = useMemo(() => {
    return convertTimeframe(visibleCandles, timeframe);
  }, [visibleCandles, timeframe]);

  const option = useMemo(() => {
    if (convertedCandles.length === 0) return {};

    const dates = convertedCandles.map((c) => formatDate(c.time));
    const ohlc = convertedCandles.map((c) => [c.open, c.close, c.low, c.high]);

    return {
      backgroundColor: tc.bg,
      animation: false,
      grid: { top: 30, bottom: 30, left: 50, right: 20 },
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: { color: tc.axisLabel, fontSize: 10 },
        axisLine: { lineStyle: { color: tc.gridLine } },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { color: tc.axisLabel, fontSize: 10 },
        splitLine: { lineStyle: { color: tc.gridLine } },
      },
      series: [
        {
          type: "candlestick",
          data: ohlc,
          itemStyle: {
            color: COLORS.up,
            color0: COLORS.down,
            borderColor: COLORS.up,
            borderColor0: COLORS.down,
          },
        },
      ],
    };
  }, [convertedCandles, tc]);

  if (visibleCandles.length < 5) return null;

  return (
    <div className="secondary-chart">
      <div className="secondary-chart-header">
        <span className="secondary-chart-title">
          {timeframe === "weekly" ? "Weekly" : "Monthly"} Chart
        </span>
        <div className="timeframe-pills">
          {(["weekly", "monthly"] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              type="button"
              className={`speed-pill ${timeframe === tf ? "active" : ""}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf === "weekly" ? "W" : "M"}
            </button>
          ))}
        </div>
      </div>
      <div className="secondary-chart-container">
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
    </div>
  );
}
