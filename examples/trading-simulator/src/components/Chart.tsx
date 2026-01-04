import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { useSimulatorStore } from "../store/simulatorStore";
import { calculateIndicators } from "../utils/indicators";
import { buildChartOption, type PositionLine } from "../utils/chartConfig";

export function Chart() {
  const {
    allCandles,
    startIndex,
    currentIndex,
    enabledIndicators,
    indicatorParams,
    tradeHistory,
    positions,
    stopLossPercent,
    takeProfitPercent,
    trailingStopEnabled,
    equityCurve,
  } = useSimulatorStore();

  const visibleCandles = useMemo(() => {
    return allCandles.slice(startIndex, currentIndex + 1);
  }, [allCandles, startIndex, currentIndex]);

  const indicators = useMemo(() => {
    return calculateIndicators(visibleCandles, enabledIndicators, indicatorParams);
  }, [visibleCandles, enabledIndicators, indicatorParams]);

  const tradeMarkers = useMemo(() => {
    return tradeHistory.map((t) => ({
      date: t.date,
      type: t.type,
      price: t.price,
    }));
  }, [tradeHistory]);

  // ポジションがある場合、エントリーラインと損切りラインを計算
  const positionLines: PositionLine | undefined = useMemo(() => {
    if (positions.length === 0) return undefined;

    // 最初のポジション（複数ある場合は平均取得単価を使う方が良いかも）
    const firstPos = positions[0];
    // startIndexからの相対インデックスを計算
    const relativeEntryIndex = firstPos.entryIndex - startIndex;
    if (relativeEntryIndex < 0) return undefined;

    // 複数ポジションの場合は平均取得単価を使用
    const totalShares = positions.reduce((sum, p) => sum + p.shares, 0);
    const totalCost = positions.reduce((sum, p) => sum + p.entryPrice * p.shares, 0);
    const avgEntryPrice = totalCost / totalShares;

    // トレーリングストップ価格（最大のものを使用）
    const trailingStopPrice = trailingStopEnabled
      ? Math.max(...positions.filter(p => p.trailingStopPrice).map(p => p.trailingStopPrice!), 0)
      : undefined;

    return {
      entryPrice: avgEntryPrice,
      entryIndex: relativeEntryIndex,
      stopLossPercent,
      takeProfitPercent,
      trailingStopPrice: trailingStopPrice && trailingStopPrice > 0 ? trailingStopPrice : undefined,
    };
  }, [positions, startIndex, stopLossPercent, takeProfitPercent, trailingStopEnabled]);

  const option = useMemo(() => {
    return buildChartOption(
      visibleCandles,
      indicators,
      enabledIndicators,
      tradeMarkers,
      positionLines,
      equityCurve
    );
  }, [visibleCandles, indicators, enabledIndicators, tradeMarkers, positionLines, equityCurve]);

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
