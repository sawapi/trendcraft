/**
 * Chart Viewer State Management
 * Centralized state for chart instances and data
 */

import type * as echarts from 'echarts';
import type { NormalizedCandle } from 'trendcraft';

// Data state
export let rawCandles: NormalizedCandle[] = [];
export let currentCandles: NormalizedCandle[] = [];

export function setRawCandles(candles: NormalizedCandle[]): void {
  rawCandles = candles;
}

export function setCurrentCandles(candles: NormalizedCandle[]): void {
  currentCandles = candles;
}

// Chart instances
export let mainChart: echarts.ECharts | null = null;
export let rsiChart: echarts.ECharts | null = null;
export let macdChart: echarts.ECharts | null = null;
export let stochChart: echarts.ECharts | null = null;
export let dmiChart: echarts.ECharts | null = null;
export let stochRsiChart: echarts.ECharts | null = null;
export let mfiChart: echarts.ECharts | null = null;
export let obvChart: echarts.ECharts | null = null;
export let cciChart: echarts.ECharts | null = null;
export let willrChart: echarts.ECharts | null = null;
export let rocChart: echarts.ECharts | null = null;
export let rangeBoundChart: echarts.ECharts | null = null;
export let cmfChart: echarts.ECharts | null = null;
export let volumeAnomalyChart: echarts.ECharts | null = null;
export let volumeProfileChart: echarts.ECharts | null = null;
export let volumeTrendChart: echarts.ECharts | null = null;

export function setMainChart(chart: echarts.ECharts): void {
  mainChart = chart;
}

export function setSubCharts(charts: {
  rsi: echarts.ECharts;
  macd: echarts.ECharts;
  stoch: echarts.ECharts;
  dmi: echarts.ECharts;
  stochRsi: echarts.ECharts;
  mfi: echarts.ECharts;
  obv: echarts.ECharts;
  cci: echarts.ECharts;
  willr: echarts.ECharts;
  roc: echarts.ECharts;
  rangeBound: echarts.ECharts;
  cmf: echarts.ECharts;
  volumeAnomaly: echarts.ECharts;
  volumeProfile: echarts.ECharts;
  volumeTrend: echarts.ECharts;
}): void {
  rsiChart = charts.rsi;
  macdChart = charts.macd;
  stochChart = charts.stoch;
  dmiChart = charts.dmi;
  stochRsiChart = charts.stochRsi;
  mfiChart = charts.mfi;
  obvChart = charts.obv;
  cciChart = charts.cci;
  willrChart = charts.willr;
  rocChart = charts.roc;
  rangeBoundChart = charts.rangeBound;
  cmfChart = charts.cmf;
  volumeAnomalyChart = charts.volumeAnomaly;
  volumeProfileChart = charts.volumeProfile;
  volumeTrendChart = charts.volumeTrend;
}

// Zoom state
export let currentZoomRange: { start: number; end: number } = { start: 0, end: 100 };

export function setCurrentZoomRange(range: { start: number; end: number }): void {
  currentZoomRange = range;
}

// Get all chart instances
export function getAllCharts(): (echarts.ECharts | null)[] {
  return [
    mainChart, rsiChart, macdChart, stochChart, dmiChart, stochRsiChart,
    mfiChart, obvChart, cciChart, willrChart, rocChart, rangeBoundChart, cmfChart,
    volumeAnomalyChart, volumeProfileChart, volumeTrendChart
  ];
}

// Get sub charts only (excluding main)
export function getSubCharts(): (echarts.ECharts | null)[] {
  return [
    rsiChart, macdChart, stochChart, dmiChart, stochRsiChart,
    mfiChart, obvChart, cciChart, willrChart, rocChart, rangeBoundChart, cmfChart,
    volumeAnomalyChart, volumeProfileChart, volumeTrendChart
  ];
}
