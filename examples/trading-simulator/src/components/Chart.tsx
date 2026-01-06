import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { useSimulatorStore } from "../store/simulatorStore";
import { calculateIndicators } from "../utils/indicators";
import { buildChartOption, type PositionLine } from "../utils/chartConfig";

export function Chart() {
  const {
    symbols,
    activeSymbolId,
    commonDateRange,
    currentDateIndex,
    enabledIndicators,
    indicatorParams,
    stopLossPercent,
    takeProfitPercent,
    trailingStopEnabled,
    getDetectedVolumeSpikes,
  } = useSimulatorStore();

  // アクティブ銘柄を取得
  const activeSymbol = useMemo(() => {
    if (!activeSymbolId) return symbols[0] || null;
    return symbols.find(s => s.id === activeSymbolId) || null;
  }, [symbols, activeSymbolId]);

  // 現在の日付からインデックスを計算
  const currentIndex = useMemo(() => {
    if (!activeSymbol || !commonDateRange || currentDateIndex < 0) return 0;
    const targetDate = commonDateRange.dates[currentDateIndex];
    if (!targetDate) return 0;
    return activeSymbol.allCandles.findIndex(c => c.time === targetDate);
  }, [activeSymbol, commonDateRange, currentDateIndex]);

  // データを抽出
  const allCandles = activeSymbol?.allCandles || [];
  const startIndex = activeSymbol?.startIndex || 0;
  const tradeHistory = activeSymbol?.tradeHistory || [];
  const positions = activeSymbol?.positions || [];
  const equityCurve = activeSymbol?.equityCurve || [];

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

  // 出来高スパイクマーカーを取得
  const volumeSpikeMarkers = useMemo(() => {
    return getDetectedVolumeSpikes();
  }, [getDetectedVolumeSpikes, currentDateIndex]);

  const option = useMemo(() => {
    return buildChartOption(
      visibleCandles,
      indicators,
      enabledIndicators,
      tradeMarkers,
      positionLines,
      equityCurve,
      volumeSpikeMarkers
    );
  }, [visibleCandles, indicators, enabledIndicators, tradeMarkers, positionLines, equityCurve, volumeSpikeMarkers]);

  // データがない場合はチャートを表示しない（EChartsのクリーンアップエラーを回避）
  if (visibleCandles.length === 0) {
    return (
      <div className="chart-container">
        <div className="chart-placeholder">
          チャートデータがありません
        </div>
      </div>
    );
  }

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
