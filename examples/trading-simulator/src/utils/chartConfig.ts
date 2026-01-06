import type { EChartsOption } from "echarts";
import type { NormalizedCandle, EquityPoint, DetectedVolumeSpike } from "../types";
import type { IndicatorData } from "./indicators";
import { formatDate } from "./fileParser";
import { INDICATOR_DEFINITIONS } from "../types";

const COLORS = {
  up: "#4ade80",
  down: "#ef4444",
  // トレンド系
  sma5: "#f59e0b",
  sma25: "#3b82f6",
  sma75: "#a855f7",
  ema12: "#22d3d8",
  ema26: "#f472b6",
  // 一目均衡表
  ichimokuTenkan: "#f59e0b",
  ichimokuKijun: "#ef4444",
  ichimokuSenkouA: "#4ade80",
  ichimokuSenkouB: "#ef4444",
  ichimokuChikou: "#a855f7",
  ichimokuKumoUp: "rgba(74, 222, 128, 0.15)",
  ichimokuKumoDown: "rgba(239, 68, 68, 0.15)",
  // Supertrend
  supertrendUp: "#4ade80",
  supertrendDown: "#ef4444",
  // Parabolic SAR
  parabolicSar: "#f59e0b",
  // ボラティリティ系
  bbUpper: "#6b7280",
  bbMiddle: "#9ca3af",
  bbLower: "#6b7280",
  keltnerUpper: "#06b6d4",
  keltnerMiddle: "#22d3ee",
  keltnerLower: "#06b6d4",
  donchianUpper: "#3b82f6",
  donchianMiddle: "#60a5fa",
  donchianLower: "#3b82f6",
  atr: "#f59e0b",
  // モメンタム系
  rsi: "#f59e0b",
  macdLine: "#3b82f6",
  macdSignal: "#ef4444",
  macdHistUp: "#4ade80",
  macdHistDown: "#ef4444",
  stochK: "#3b82f6",
  stochD: "#ef4444",
  stochRsiK: "#22d3d8",
  stochRsiD: "#f472b6",
  dmiPlusDi: "#4ade80",
  dmiMinusDi: "#ef4444",
  dmiAdx: "#f59e0b",
  cci: "#a855f7",
  // 出来高系
  volume: "#4b5563",
  obv: "#4b5563",
  mfi: "#06b6d4",
  // Equity Curve
  equity: "#4ade80",
  buyHold: "#6b7280",
  drawdown: "rgba(239, 68, 68, 0.3)",
  // Volume Spike
  volumeSpikeAvg: "#06b6d4",         // シアン
  volumeSpikeBreakout: "#a855f7",    // パープル
  volumeAccumulation: "#22c55e",     // グリーン
  volumeMaCross: "#f59e0b",          // アンバー
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SeriesItem = any;

// サブチャートを持つインジケーターのキー
const SUBCHART_INDICATORS = INDICATOR_DEFINITIONS
  .filter((ind) => ind.chartType === "subchart")
  .map((ind) => ind.key);

export interface PositionLine {
  entryPrice: number;
  entryIndex: number;
  stopLossPercent?: number; // 損切り%（例: 5 = 5%下）
  takeProfitPercent?: number; // 利確%（例: 10 = 10%上）
  trailingStopPrice?: number; // トレーリングストップ価格
}

export function buildChartOption(
  candles: NormalizedCandle[],
  indicators: IndicatorData,
  enabledIndicators: string[],
  tradeMarkers: { date: number; type: "BUY" | "SELL"; price: number }[] = [],
  positionLines?: PositionLine,
  equityCurve?: EquityPoint[],
  volumeSpikeMarkers: DetectedVolumeSpike[] = []
): EChartsOption {
  const dates = candles.map((c) => formatDate(c.time));
  const ohlc = candles.map((c) => [c.open, c.close, c.low, c.high]);
  const volumes = candles.map((c, i) => {
    const isUp = candles[i].close >= candles[i].open;
    return {
      value: c.volume,
      itemStyle: { color: isUp ? COLORS.up : COLORS.down, opacity: 0.5 },
    };
  });

  const series: SeriesItem[] = [
    {
      name: "K",
      type: "candlestick",
      data: ohlc,
      itemStyle: {
        color: COLORS.up,
        color0: COLORS.down,
        borderColor: COLORS.up,
        borderColor0: COLORS.down,
      },
      markPoint: buildTradeMarkers(candles, tradeMarkers),
      markLine: buildPositionLines(positionLines, candles.length),
    },
  ];

  // ========== オーバーレイ系インジケーター ==========

  // 移動平均
  if (enabledIndicators.includes("sma5") && indicators.sma5) {
    series.push(createLineSeries("SMA5", indicators.sma5, COLORS.sma5));
  }
  if (enabledIndicators.includes("sma25") && indicators.sma25) {
    series.push(createLineSeries("SMA25", indicators.sma25, COLORS.sma25));
  }
  if (enabledIndicators.includes("sma75") && indicators.sma75) {
    series.push(createLineSeries("SMA75", indicators.sma75, COLORS.sma75));
  }
  if (enabledIndicators.includes("ema12") && indicators.ema12) {
    series.push(createLineSeries("EMA12", indicators.ema12, COLORS.ema12));
  }
  if (enabledIndicators.includes("ema26") && indicators.ema26) {
    series.push(createLineSeries("EMA26", indicators.ema26, COLORS.ema26));
  }

  // 一目均衡表
  if (enabledIndicators.includes("ichimoku")) {
    if (indicators.ichimokuTenkan) {
      series.push(createLineSeries("転換線", indicators.ichimokuTenkan, COLORS.ichimokuTenkan));
    }
    if (indicators.ichimokuKijun) {
      series.push(createLineSeries("基準線", indicators.ichimokuKijun, COLORS.ichimokuKijun));
    }
    if (indicators.ichimokuSenkouA && indicators.ichimokuSenkouB) {
      // 雲（先行スパンA/B）をエリアで表示
      series.push({
        name: "雲",
        type: "line",
        data: indicators.ichimokuSenkouA,
        symbol: "none",
        lineStyle: { color: COLORS.ichimokuSenkouA, width: 1 },
        areaStyle: {
          color: COLORS.ichimokuKumoUp,
          origin: "auto",
        },
      });
      series.push(createLineSeries("先行スパンB", indicators.ichimokuSenkouB, COLORS.ichimokuSenkouB));
    }
    if (indicators.ichimokuChikou) {
      series.push(createLineSeries("遅行スパン", indicators.ichimokuChikou, COLORS.ichimokuChikou, "dashed"));
    }
  }

  // Supertrend
  if (enabledIndicators.includes("supertrend") && indicators.supertrendLine && indicators.supertrendDirection) {
    // 方向に応じて色を変える
    const supertrendData = indicators.supertrendLine.map((val, i) => {
      const dir = indicators.supertrendDirection?.[i];
      return {
        value: val,
        itemStyle: { color: dir === 1 ? COLORS.supertrendUp : COLORS.supertrendDown },
      };
    });
    series.push({
      name: "Supertrend",
      type: "line",
      data: supertrendData,
      symbol: "none",
      lineStyle: { width: 2 },
    });
  }

  // Parabolic SAR
  if (enabledIndicators.includes("parabolicSar") && indicators.parabolicSar) {
    series.push({
      name: "SAR",
      type: "scatter",
      data: indicators.parabolicSar.map((val, i) => {
        const dir = indicators.parabolicSarDirection?.[i];
        return {
          value: val,
          itemStyle: { color: dir === 1 ? COLORS.supertrendUp : COLORS.supertrendDown },
        };
      }),
      symbolSize: 4,
    });
  }

  // ボリンジャーバンド
  if (enabledIndicators.includes("bb")) {
    if (indicators.bbUpper) {
      series.push(createLineSeries("BB Upper", indicators.bbUpper, COLORS.bbUpper, "dashed"));
    }
    if (indicators.bbMiddle) {
      series.push(createLineSeries("BB Middle", indicators.bbMiddle, COLORS.bbMiddle));
    }
    if (indicators.bbLower) {
      series.push(createLineSeries("BB Lower", indicators.bbLower, COLORS.bbLower, "dashed"));
    }
  }

  // ケルトナーチャネル
  if (enabledIndicators.includes("keltner")) {
    if (indicators.keltnerUpper) {
      series.push(createLineSeries("Keltner Upper", indicators.keltnerUpper, COLORS.keltnerUpper, "dashed"));
    }
    if (indicators.keltnerMiddle) {
      series.push(createLineSeries("Keltner Middle", indicators.keltnerMiddle, COLORS.keltnerMiddle));
    }
    if (indicators.keltnerLower) {
      series.push(createLineSeries("Keltner Lower", indicators.keltnerLower, COLORS.keltnerLower, "dashed"));
    }
  }

  // ドンチャンチャネル
  if (enabledIndicators.includes("donchian")) {
    if (indicators.donchianUpper) {
      series.push(createLineSeries("Donchian Upper", indicators.donchianUpper, COLORS.donchianUpper, "dashed"));
    }
    if (indicators.donchianMiddle) {
      series.push(createLineSeries("Donchian Middle", indicators.donchianMiddle, COLORS.donchianMiddle));
    }
    if (indicators.donchianLower) {
      series.push(createLineSeries("Donchian Lower", indicators.donchianLower, COLORS.donchianLower, "dashed"));
    }
  }

  // ========== サブチャートの動的計算 ==========

  // 有効なサブチャートインジケーターを特定
  const enabledSubcharts = enabledIndicators.filter((ind) => SUBCHART_INDICATORS.includes(ind));
  // Equity Curveがある場合は+1
  const hasEquityCurve = equityCurve && equityCurve.length > 1;
  const subChartCount = enabledSubcharts.length + (hasEquityCurve ? 1 : 0);

  // グリッド高さの計算（サブチャート間にスペースを確保、ラベル用に2%追加）
  const subChartGap = 5; // サブチャート間のギャップ(%) - ラベル用スペース含む
  const labelHeight = 2; // ラベル用の高さ(%)
  const mainHeight = subChartCount === 0 ? 90 : Math.max(30, 65 - subChartCount * 9);
  const subHeight = subChartCount > 0 ? Math.min(10, (85 - mainHeight - subChartCount * subChartGap) / subChartCount) : 0;

  const grids: SeriesItem[] = [
    { left: 60, right: 40, top: 40, height: `${mainHeight}%` },
  ];

  // タイトル配列（各サブチャートのラベル用）
  const titles: SeriesItem[] = [];

  // 大きな数値をK/M形式でフォーマット
  const formatLargeNumber = (value: number): string => {
    if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(1) + "M";
    } else if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(0) + "K";
    }
    return value.toFixed(0);
  };

  const xAxes: SeriesItem[] = [
    {
      type: "category",
      data: dates,
      axisLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0" },
    },
  ];

  const yAxes: SeriesItem[] = [
    {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0" },
    },
  ];

  let currentTop = mainHeight + 5;

  // ========== サブチャート系インジケーター ==========

  // Volume
  if (enabledIndicators.includes("volume")) {
    const gridIndex = grids.length;
    titles.push({
      text: "Volume",
      left: 5,
      top: `${currentTop}%`,
      textStyle: { color: "#a0a0a0", fontSize: 10, fontWeight: "normal" },
    });
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop + labelHeight}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      splitLine: { show: false },
      axisLabel: { show: false },
    });
    // 出来高スパイクマーカーを生成
    const volumeSpikeMarkPointData = volumeSpikeMarkers.map((spike) => {
      const idx = candles.findIndex((c) => c.time === spike.time);
      if (idx === -1) return null;

      // タイプ別の設定
      let symbol = "triangle";
      let symbolSize = 14;
      let symbolRotate = 180;
      let color = COLORS.volumeSpikeAvg;
      let label = `${spike.ratio.toFixed(1)}x`;

      switch (spike.type) {
        case "breakout":
          symbol = "pin";
          symbolSize = 20;
          symbolRotate = 0;
          color = COLORS.volumeSpikeBreakout;
          label = "NEW";
          break;
        case "accumulation":
          symbol = "diamond";
          symbolSize = 16;
          symbolRotate = 0;
          color = COLORS.volumeAccumulation;
          label = spike.consecutiveDays ? `${spike.consecutiveDays}日` : "蓄積";
          break;
        case "ma_cross":
          symbol = "arrow";
          symbolSize = 16;
          symbolRotate = 0;
          color = COLORS.volumeMaCross;
          label = "Cross";
          break;
        case "average":
        default:
          // デフォルト設定はそのまま
          break;
      }

      return {
        coord: [idx, spike.volume],
        symbol,
        symbolSize,
        symbolRotate,
        itemStyle: {
          color,
          borderColor: "#fff",
          borderWidth: 1,
        },
        label: {
          show: true,
          position: "top",
          formatter: label,
          fontSize: 9,
          color,
          fontWeight: "bold",
          distance: 5,
        },
      };
    }).filter(Boolean);

    series.push({
      name: "Volume",
      type: "bar",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: volumes,
      markPoint: volumeSpikeMarkPointData.length > 0 ? {
        data: volumeSpikeMarkPointData,
      } : undefined,
    });
    currentTop += subHeight + subChartGap;
  }

  // RSI
  if (enabledIndicators.includes("rsi") && indicators.rsi) {
    const gridIndex = grids.length;
    titles.push({
      text: "RSI",
      left: 5,
      top: `${currentTop}%`,
      textStyle: { color: COLORS.rsi, fontSize: 10, fontWeight: "normal" },
    });
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop + labelHeight}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0", fontSize: 10 },
    });
    series.push({
      name: "RSI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.rsi,
      symbol: "none",
      lineStyle: { color: COLORS.rsi, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 30 }, { yAxis: 70 }],
      },
    });
    currentTop += subHeight + subChartGap;
  }

  // MACD
  if (enabledIndicators.includes("macd") && indicators.macdLine && indicators.macdSignal && indicators.macdHist) {
    const gridIndex = grids.length;
    titles.push({
      text: "MACD",
      left: 5,
      top: `${currentTop}%`,
      textStyle: { color: COLORS.macdLine, fontSize: 10, fontWeight: "normal" },
    });
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop + labelHeight}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0", fontSize: 10 },
    });
    series.push({
      name: "MACD",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.macdLine,
      symbol: "none",
      lineStyle: { color: COLORS.macdLine, width: 1.5 },
    });
    series.push({
      name: "Signal",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.macdSignal,
      symbol: "none",
      lineStyle: { color: COLORS.macdSignal, width: 1.5 },
    });
    series.push({
      name: "Histogram",
      type: "bar",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.macdHist.map((v) => ({
        value: v,
        itemStyle: {
          color: v !== null && v >= 0 ? COLORS.macdHistUp : COLORS.macdHistDown,
        },
      })),
    });
    currentTop += subHeight + subChartGap;
  }

  // Stochastics
  if (enabledIndicators.includes("stochastics") && indicators.stochK && indicators.stochD) {
    const gridIndex = grids.length;
    titles.push({
      text: "Stoch",
      left: 5,
      top: `${currentTop}%`,
      textStyle: { color: COLORS.stochK, fontSize: 10, fontWeight: "normal" },
    });
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop + labelHeight}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0", fontSize: 10 },
    });
    series.push({
      name: "Stoch %K",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.stochK,
      symbol: "none",
      lineStyle: { color: COLORS.stochK, width: 1.5 },
    });
    series.push({
      name: "Stoch %D",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.stochD,
      symbol: "none",
      lineStyle: { color: COLORS.stochD, width: 1.5 },
    });
    currentTop += subHeight + subChartGap;
  }

  // Stochastic RSI
  if (enabledIndicators.includes("stochRsi") && indicators.stochRsiK && indicators.stochRsiD) {
    const gridIndex = grids.length;
    titles.push({
      text: "StochRSI",
      left: 5,
      top: `${currentTop}%`,
      textStyle: { color: COLORS.stochRsiK, fontSize: 10, fontWeight: "normal" },
    });
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop + labelHeight}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0", fontSize: 10 },
    });
    series.push({
      name: "StochRSI %K",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.stochRsiK,
      symbol: "none",
      lineStyle: { color: COLORS.stochRsiK, width: 1.5 },
    });
    series.push({
      name: "StochRSI %D",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.stochRsiD,
      symbol: "none",
      lineStyle: { color: COLORS.stochRsiD, width: 1.5 },
    });
    currentTop += subHeight + subChartGap;
  }

  // DMI/ADX
  if (enabledIndicators.includes("dmi") && indicators.dmiPlusDi && indicators.dmiMinusDi && indicators.dmiAdx) {
    const gridIndex = grids.length;
    titles.push({
      text: "DMI",
      left: 5,
      top: `${currentTop}%`,
      textStyle: { color: COLORS.dmiAdx, fontSize: 10, fontWeight: "normal" },
    });
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop + labelHeight}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0", fontSize: 10 },
    });
    series.push({
      name: "+DI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.dmiPlusDi,
      symbol: "none",
      lineStyle: { color: COLORS.dmiPlusDi, width: 1.5 },
    });
    series.push({
      name: "-DI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.dmiMinusDi,
      symbol: "none",
      lineStyle: { color: COLORS.dmiMinusDi, width: 1.5 },
    });
    series.push({
      name: "ADX",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.dmiAdx,
      symbol: "none",
      lineStyle: { color: COLORS.dmiAdx, width: 2 },
    });
    currentTop += subHeight + subChartGap;
  }

  // CCI
  if (enabledIndicators.includes("cci") && indicators.cci) {
    const gridIndex = grids.length;
    titles.push({
      text: "CCI",
      left: 5,
      top: `${currentTop}%`,
      textStyle: { color: COLORS.cci, fontSize: 10, fontWeight: "normal" },
    });
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop + labelHeight}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0", fontSize: 10 },
    });
    series.push({
      name: "CCI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.cci,
      symbol: "none",
      lineStyle: { color: COLORS.cci, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: -100 }, { yAxis: 100 }],
      },
    });
    currentTop += subHeight + subChartGap;
  }

  // ATR
  if (enabledIndicators.includes("atr") && indicators.atr) {
    const gridIndex = grids.length;
    titles.push({
      text: "ATR",
      left: 5,
      top: `${currentTop}%`,
      textStyle: { color: COLORS.atr, fontSize: 10, fontWeight: "normal" },
    });
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop + labelHeight}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0", fontSize: 10 },
    });
    series.push({
      name: "ATR",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.atr,
      symbol: "none",
      lineStyle: { color: COLORS.atr, width: 1.5 },
    });
    currentTop += subHeight + subChartGap;
  }

  // OBV
  if (enabledIndicators.includes("obv") && indicators.obv) {
    const gridIndex = grids.length;
    titles.push({
      text: "OBV",
      left: 5,
      top: `${currentTop}%`,
      textStyle: { color: "#a0a0a0", fontSize: 10, fontWeight: "normal" },
    });
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop + labelHeight}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: {
        color: "#a0a0a0",
        fontSize: 9,
        formatter: (value: number) => formatLargeNumber(value),
      },
    });
    series.push({
      name: "OBV",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.obv,
      symbol: "none",
      lineStyle: { color: COLORS.obv, width: 1.5 },
    });
    currentTop += subHeight + subChartGap;
  }

  // MFI
  if (enabledIndicators.includes("mfi") && indicators.mfi) {
    const gridIndex = grids.length;
    titles.push({
      text: "MFI",
      left: 5,
      top: `${currentTop}%`,
      textStyle: { color: COLORS.mfi, fontSize: 10, fontWeight: "normal" },
    });
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop + labelHeight}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0", fontSize: 10 },
    });
    series.push({
      name: "MFI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.mfi,
      symbol: "none",
      lineStyle: { color: COLORS.mfi, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 20 }, { yAxis: 80 }],
      },
    });
    currentTop += subHeight + subChartGap;
  }

  // Equity Curve
  if (hasEquityCurve && equityCurve) {
    const gridIndex = grids.length;
    titles.push({
      text: "Equity",
      left: 5,
      top: `${currentTop}%`,
      textStyle: { color: COLORS.equity, fontSize: 10, fontWeight: "normal" },
    });
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop + labelHeight}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: {
        color: "#a0a0a0",
        fontSize: 9,
        formatter: (value: number) => formatLargeNumber(value),
      },
    });

    // Equity Curveデータをローソク足の日付にマッピング
    const equityByTime = new Map(equityCurve.map((p) => [p.time, p]));
    const equityData = candles.map((c) => {
      const point = equityByTime.get(c.time);
      return point ? point.equity : null;
    });
    const buyHoldData = candles.map((c) => {
      const point = equityByTime.get(c.time);
      return point ? point.buyHoldEquity : null;
    });

    // Buy&Holdライン
    series.push({
      name: "Buy&Hold",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: buyHoldData,
      symbol: "none",
      lineStyle: { color: COLORS.buyHold, width: 1, type: "dashed" },
    });

    // Equityライン
    series.push({
      name: "Equity",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: equityData,
      symbol: "none",
      lineStyle: { color: COLORS.equity, width: 2 },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(74, 222, 128, 0.3)" },
            { offset: 1, color: "rgba(74, 222, 128, 0)" },
          ],
        },
      },
    });

    // トレードマーカー
    const tradePoints = equityCurve
      .filter((p) => p.tradeType)
      .map((p) => {
        const idx = candles.findIndex((c) => c.time === p.time);
        if (idx === -1) return null;
        return {
          coord: [idx, p.equity],
          symbol: p.tradeType === "BUY" ? "triangle" : "pin",
          symbolSize: 10,
          symbolRotate: p.tradeType === "BUY" ? 0 : 180,
          itemStyle: {
            color: p.tradeType === "BUY" ? "#4ade80" : "#ef4444",
          },
        };
      })
      .filter(Boolean);

    if (tradePoints.length > 0) {
      series.push({
        name: "Trade Markers",
        type: "scatter",
        xAxisIndex: gridIndex,
        yAxisIndex: gridIndex,
        data: [],
        markPoint: { data: tradePoints },
      });
    }

    currentTop += subHeight + subChartGap;
  }

  return {
    backgroundColor: "#1a1a2e",
    animation: false,
    title: titles,
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series,
    axisPointer: {
      link: [{ xAxisIndex: "all" }],
      label: { backgroundColor: "#16213e" },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
      backgroundColor: "#16213e",
      borderColor: "#333",
      textStyle: { color: "#eaeaea" },
    },
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: xAxes.map((_: SeriesItem, i: number) => i),
        start: Math.max(0, 100 - (100 / candles.length) * 100),
        end: 100,
      },
      {
        type: "slider",
        xAxisIndex: xAxes.map((_: SeriesItem, i: number) => i),
        top: "95%",
        height: 20,
        start: Math.max(0, 100 - (100 / candles.length) * 100),
        end: 100,
      },
    ],
  };
}

function createLineSeries(
  name: string,
  data: (number | null)[],
  color: string,
  lineType: "solid" | "dashed" = "solid"
): SeriesItem {
  return {
    name,
    type: "line",
    data,
    symbol: "none",
    lineStyle: {
      color,
      width: 1.5,
      type: lineType,
    },
  };
}

function buildTradeMarkers(
  candles: NormalizedCandle[],
  trades: { date: number; type: "BUY" | "SELL"; price: number }[]
): SeriesItem | undefined {
  if (trades.length === 0) return undefined;

  const data = trades
    .map((trade) => {
      const idx = candles.findIndex((c) => c.time === trade.date);
      if (idx === -1) return null;

      return {
        name: trade.type,
        value: trade.type,
        coord: [idx, trade.price],
        symbol: trade.type === "BUY" ? "triangle" : "pin",
        symbolSize: trade.type === "BUY" ? 15 : 20,
        symbolRotate: trade.type === "BUY" ? 0 : 180,
        itemStyle: {
          color: trade.type === "BUY" ? "#4ade80" : "#ef4444",
        },
        label: {
          show: true,
          formatter: trade.type === "BUY" ? "B" : "S",
          color: "#fff",
          fontSize: 10,
        },
      };
    })
    .filter(Boolean);

  return { data };
}

function buildPositionLines(
  positionLines: PositionLine | undefined,
  _candleCount: number
): SeriesItem | undefined {
  if (!positionLines) return undefined;

  const { entryPrice, stopLossPercent, takeProfitPercent, trailingStopPrice } = positionLines;
  const data: SeriesItem[] = [];

  // エントリーライン（実線、緑）- 水平線として描画
  data.push({
    yAxis: entryPrice,
    symbol: "none",
    lineStyle: {
      color: "#4ade80",
      width: 1.5,
      type: "solid",
    },
    label: {
      show: true,
      position: "end",
      formatter: `Entry: ${entryPrice.toLocaleString()}`,
      color: "#4ade80",
      fontSize: 10,
      backgroundColor: "#1a1a2e",
      padding: [2, 4],
    },
  });

  // 利確ライン（破線、青/シアン）
  if (takeProfitPercent && takeProfitPercent > 0) {
    const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
    data.push({
      yAxis: takeProfitPrice,
      symbol: "none",
      lineStyle: {
        color: "#22d3ee",
        width: 1.5,
        type: "dashed",
      },
      label: {
        show: true,
        position: "end",
        formatter: `TP +${takeProfitPercent}%`,
        color: "#22d3ee",
        fontSize: 10,
        backgroundColor: "#1a1a2e",
        padding: [2, 4],
      },
    });
  }

  // 損切りライン（破線、赤）
  if (stopLossPercent && stopLossPercent > 0) {
    const stopLossPrice = entryPrice * (1 - stopLossPercent / 100);
    data.push({
      yAxis: stopLossPrice,
      symbol: "none",
      lineStyle: {
        color: "#ef4444",
        width: 1.5,
        type: "dashed",
      },
      label: {
        show: true,
        position: "end",
        formatter: `SL -${stopLossPercent}%`,
        color: "#ef4444",
        fontSize: 10,
        backgroundColor: "#1a1a2e",
        padding: [2, 4],
      },
    });
  }

  // トレーリングストップライン（点線、オレンジ）
  if (trailingStopPrice && trailingStopPrice > 0) {
    const trailingPct = ((entryPrice - trailingStopPrice) / entryPrice * 100).toFixed(1);
    data.push({
      yAxis: trailingStopPrice,
      symbol: "none",
      lineStyle: {
        color: "#f59e0b",
        width: 2,
        type: "dotted",
      },
      label: {
        show: true,
        position: "end",
        formatter: `TS ${trailingStopPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} (-${trailingPct}%)`,
        color: "#f59e0b",
        fontSize: 10,
        backgroundColor: "#1a1a2e",
        padding: [2, 4],
      },
    });
  }

  return {
    silent: true,
    symbol: "none",
    data,
  };
}
