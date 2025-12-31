import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { useSimulatorStore } from "../store/simulatorStore";
import { calculateIndicators } from "../utils/indicators";
import { buildChartOption } from "../utils/chartConfig";

export function Chart() {
  const {
    allCandles,
    startIndex,
    currentIndex,
    enabledIndicators,
    tradeHistory,
  } = useSimulatorStore();

  const visibleCandles = useMemo(() => {
    return allCandles.slice(startIndex, currentIndex + 1);
  }, [allCandles, startIndex, currentIndex]);

  const indicators = useMemo(() => {
    return calculateIndicators(visibleCandles, enabledIndicators);
  }, [visibleCandles, enabledIndicators]);

  const tradeMarkers = useMemo(() => {
    return tradeHistory.map((t) => ({
      date: t.date,
      type: t.type,
      price: t.price,
    }));
  }, [tradeHistory]);

  const option = useMemo(() => {
    return buildChartOption(
      visibleCandles,
      indicators,
      enabledIndicators,
      tradeMarkers
    );
  }, [visibleCandles, indicators, enabledIndicators, tradeMarkers]);

  return (
    <div className="chart-container">
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}
