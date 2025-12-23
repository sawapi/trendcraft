/**
 * Sub-chart rendering for indicators (RSI, MACD, Stoch, DMI, etc.)
 */

import * as echarts from 'echarts';
import * as TrendCraft from 'trendcraft';
import type { DivergenceSignal } from 'trendcraft';
import {
  rsiChart, macdChart, stochChart, dmiChart, stochRsiChart,
  mfiChart, obvChart, cciChart, willrChart, rocChart, rangeBoundChart, cmfChart,
  currentCandles,
} from './state';

/**
 * Update RSI chart
 */
export function updateRsiChart(
  dates: string[],
  rsiData: TrendCraft.Series<number | null>,
  divergenceSignals: DivergenceSignal[],
  zoomStart: number
): void {
  if (!rsiChart) return;

  const markPointData: Array<{
    name: string;
    coord: [string, number];
    symbol: string;
    symbolSize: number;
    itemStyle: { color: string };
    label: { show: boolean; formatter: string; color: string; fontSize: number; position: 'inside' };
  }> = [];

  const timeToIdx = new Map<number, number>();
  currentCandles.forEach((c, i) => timeToIdx.set(c.time, i));

  divergenceSignals.forEach((signal) => {
    const idx = timeToIdx.get(signal.time);
    if (idx === undefined) return;
    const rsiValue = rsiData[idx]?.value;
    if (rsiValue === undefined || rsiValue === null) return;

    const isBullish = signal.type === 'bullish';
    markPointData.push({
      name: isBullish ? 'Bullish Div' : 'Bearish Div',
      coord: [dates[idx], rsiValue],
      symbol: 'circle',
      symbolSize: 10,
      itemStyle: { color: isBullish ? '#26a69a' : '#ef5350' },
      label: { show: true, formatter: isBullish ? 'B' : 'S', color: '#fff', fontSize: 8, position: 'inside' },
    });
  });

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const value = p.value as number | null;
        return `${p.name}<br/>RSI: ${value !== null ? value.toFixed(2) : '-'}`;
      },
    },
    title: { text: 'RSI (14)', left: 10, top: 0, textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' } },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888', fontSize: 10 } },
    yAxis: { min: 0, max: 100, splitNumber: 4, axisLine: { lineStyle: { color: '#666' } }, splitLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#888' } },
    series: [{
      name: 'RSI',
      type: 'line',
      data: rsiData.map(d => d.value),
      smooth: false,
      showSymbol: false,
      lineStyle: { width: 1.5, color: '#4d96ff' },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: '#ef5350', type: 'dashed', width: 1 },
        label: { show: true, position: 'end', color: '#ef5350', fontSize: 10 },
        data: [{ yAxis: 30, label: { formatter: '30' } }, { yAxis: 70, label: { formatter: '70' } }],
      },
      markPoint: { data: markPointData },
    }],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  rsiChart.setOption(option, true);
}

/**
 * Update MACD chart
 */
export function updateMacdChart(
  dates: string[],
  macdData: TrendCraft.Series<TrendCraft.MacdValue>,
  divergenceSignals: DivergenceSignal[],
  zoomStart: number
): void {
  if (!macdChart) return;

  const macdLine = macdData.map(d => d.value.macd);
  const signalLine = macdData.map(d => d.value.signal);
  const histogram = macdData.map(d => d.value.histogram);

  const markPointData: Array<{
    name: string;
    coord: [string, number];
    symbol: string;
    symbolSize: number;
    itemStyle: { color: string };
    label: { show: boolean; formatter: string; color: string; fontSize: number; position: 'inside' };
  }> = [];

  const timeToIdx = new Map<number, number>();
  currentCandles.forEach((c, i) => timeToIdx.set(c.time, i));

  divergenceSignals.forEach((signal) => {
    const idx = timeToIdx.get(signal.time);
    if (idx === undefined) return;
    const macdValue = macdData[idx]?.value.macd;
    if (macdValue === undefined || macdValue === null) return;

    const isBullish = signal.type === 'bullish';
    markPointData.push({
      name: isBullish ? 'Bullish Div' : 'Bearish Div',
      coord: [dates[idx], macdValue],
      symbol: 'circle',
      symbolSize: 10,
      itemStyle: { color: isBullish ? '#26a69a' : '#ef5350' },
      label: { show: true, formatter: isBullish ? 'B' : 'S', color: '#fff', fontSize: 8, position: 'inside' },
    });
  });

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        if (!Array.isArray(params)) return '';
        const date = params[0]?.name || '';
        const hist = params.find(p => p.seriesName === 'Histogram');
        const macd = params.find(p => p.seriesName === 'MACD');
        const signal = params.find(p => p.seriesName === 'Signal');
        const format = (v: number | null | undefined) => v !== null && v !== undefined ? v.toFixed(2) : '-';
        return `${date}<br/>MACD: ${format(macd?.value as number)}<br/>Signal: ${format(signal?.value as number)}<br/>Histogram: ${format(hist?.value as number)}`;
      },
    },
    title: { text: 'MACD (12, 26, 9)', left: 10, top: 0, textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' } },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888', fontSize: 10 } },
    yAxis: { scale: true, axisLine: { lineStyle: { color: '#666' } }, splitLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#888' } },
    series: [
      { name: 'Histogram', type: 'bar', data: histogram, itemStyle: { color: (params) => (params.value as number) >= 0 ? '#26a69a' : '#ef5350' } },
      { name: 'MACD', type: 'line', data: macdLine, smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#ff9f43' }, markPoint: { data: markPointData } },
      { name: 'Signal', type: 'line', data: signalLine, smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#a855f7' } },
    ],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  macdChart.setOption(option, true);
}

/**
 * Update Stochastics chart
 */
export function updateStochChart(dates: string[], stochData: TrendCraft.Series<TrendCraft.StochasticsValue>, zoomStart: number): void {
  if (!stochChart) return;

  const kLine = stochData.map(d => d.value.k);
  const dLine = stochData.map(d => d.value.d);

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        if (!Array.isArray(params)) return '';
        const date = params[0]?.name || '';
        const k = params.find(p => p.seriesName === '%K');
        const d = params.find(p => p.seriesName === '%D');
        const format = (v: number | null | undefined) => v !== null && v !== undefined ? v.toFixed(2) : '-';
        return `${date}<br/>%K: ${format(k?.value as number)}<br/>%D: ${format(d?.value as number)}`;
      },
    },
    title: { text: 'Stochastics (14, 3, 3)', left: 10, top: 0, textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' } },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888', fontSize: 10 } },
    yAxis: { min: 0, max: 100, splitNumber: 4, axisLine: { lineStyle: { color: '#666' } }, splitLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#888' } },
    series: [
      {
        name: '%K', type: 'line', data: kLine, smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#00d9ff' },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: '#ef5350', type: 'dashed', width: 1 }, label: { show: true, position: 'end', color: '#ef5350', fontSize: 10 }, data: [{ yAxis: 20, label: { formatter: '20' } }, { yAxis: 80, label: { formatter: '80' } }] },
      },
      { name: '%D', type: 'line', data: dLine, smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#ff6b9d' } },
    ],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  stochChart.setOption(option, true);
}

/**
 * Update DMI/ADX chart
 */
export function updateDmiChart(dates: string[], dmiData: TrendCraft.Series<TrendCraft.DmiValue>, zoomStart: number): void {
  if (!dmiChart) return;

  const plusDi = dmiData.map(d => d.value.plusDi);
  const minusDi = dmiData.map(d => d.value.minusDi);
  const adx = dmiData.map(d => d.value.adx);

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        if (!Array.isArray(params)) return '';
        const date = params[0]?.name || '';
        const pdi = params.find(p => p.seriesName === '+DI');
        const mdi = params.find(p => p.seriesName === '-DI');
        const adxVal = params.find(p => p.seriesName === 'ADX');
        const format = (v: number | null | undefined) => v !== null && v !== undefined ? v.toFixed(2) : '-';
        return `${date}<br/>+DI: ${format(pdi?.value as number)}<br/>-DI: ${format(mdi?.value as number)}<br/>ADX: ${format(adxVal?.value as number)}`;
      },
    },
    title: { text: 'DMI/ADX (14)', left: 10, top: 0, textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' } },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888', fontSize: 10 } },
    yAxis: { min: 0, max: 100, splitNumber: 4, axisLine: { lineStyle: { color: '#666' } }, splitLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#888' } },
    series: [
      {
        name: '+DI', type: 'line', data: plusDi, smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#26a69a' },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: '#ffd93d', type: 'dashed', width: 1 }, label: { show: true, position: 'end', color: '#ffd93d', fontSize: 10 }, data: [{ yAxis: 25, label: { formatter: '25' } }] },
      },
      { name: '-DI', type: 'line', data: minusDi, smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#ef5350' } },
      { name: 'ADX', type: 'line', data: adx, smooth: false, showSymbol: false, lineStyle: { width: 2, color: '#a29bfe' } },
    ],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  dmiChart.setOption(option, true);
}

/**
 * Update Stoch RSI chart
 */
export function updateStochRsiChart(dates: string[], stochRsiData: TrendCraft.Series<TrendCraft.StochRsiValue>, zoomStart: number): void {
  if (!stochRsiChart) return;

  const kLine = stochRsiData.map(d => d.value.k);
  const dLine = stochRsiData.map(d => d.value.d);

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        if (!Array.isArray(params)) return '';
        const date = params[0]?.name || '';
        const k = params.find(p => p.seriesName === '%K');
        const d = params.find(p => p.seriesName === '%D');
        const format = (v: number | null | undefined) => v !== null && v !== undefined ? v.toFixed(2) : '-';
        return `${date}<br/>%K: ${format(k?.value as number)}<br/>%D: ${format(d?.value as number)}`;
      },
    },
    title: { text: 'Stoch RSI (14, 14, 3, 3)', left: 10, top: 0, textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' } },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888', fontSize: 10 } },
    yAxis: { min: 0, max: 100, splitNumber: 4, axisLine: { lineStyle: { color: '#666' } }, splitLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#888' } },
    series: [
      {
        name: '%K', type: 'line', data: kLine, smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#ff6b9d' },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: '#ef5350', type: 'dashed', width: 1 }, label: { show: true, position: 'end', color: '#ef5350', fontSize: 10 }, data: [{ yAxis: 20, label: { formatter: '20' } }, { yAxis: 80, label: { formatter: '80' } }] },
      },
      { name: '%D', type: 'line', data: dLine, smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#a855f7' } },
    ],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  stochRsiChart.setOption(option, true);
}

/**
 * Update MFI chart
 */
export function updateMfiChart(dates: string[], mfiData: TrendCraft.Series<number | null>, zoomStart: number): void {
  if (!mfiChart) return;

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const value = p.value as number | null;
        return `${p.name}<br/>MFI: ${value !== null ? value.toFixed(2) : '-'}`;
      },
    },
    title: { text: 'MFI (14)', left: 10, top: 0, textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' } },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888', fontSize: 10 } },
    yAxis: { min: 0, max: 100, splitNumber: 4, axisLine: { lineStyle: { color: '#666' } }, splitLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#888' } },
    series: [{
      name: 'MFI', type: 'line', data: mfiData.map(d => d.value), smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#f39c12' },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: '#ef5350', type: 'dashed', width: 1 }, label: { show: true, position: 'end', color: '#ef5350', fontSize: 10 }, data: [{ yAxis: 20, label: { formatter: '20' } }, { yAxis: 80, label: { formatter: '80' } }] },
    }],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  mfiChart.setOption(option, true);
}

/**
 * Update OBV chart
 */
export function updateObvChart(
  dates: string[],
  obvData: TrendCraft.Series<number>,
  divergenceSignals: DivergenceSignal[],
  zoomStart: number
): void {
  if (!obvChart) return;

  const markPointData: Array<{
    name: string;
    coord: [string, number];
    symbol: string;
    symbolSize: number;
    itemStyle: { color: string };
    label: { show: boolean; formatter: string; color: string; fontSize: number; position: 'inside' };
  }> = [];

  const timeToIdx = new Map<number, number>();
  currentCandles.forEach((c, i) => timeToIdx.set(c.time, i));

  divergenceSignals.forEach((signal) => {
    const idx = timeToIdx.get(signal.time);
    if (idx === undefined) return;
    const obvValue = obvData[idx]?.value;
    if (obvValue === undefined) return;

    const isBullish = signal.type === 'bullish';
    markPointData.push({
      name: isBullish ? 'Bullish Div' : 'Bearish Div',
      coord: [dates[idx], obvValue],
      symbol: 'circle',
      symbolSize: 10,
      itemStyle: { color: isBullish ? '#26a69a' : '#ef5350' },
      label: { show: true, formatter: isBullish ? 'B' : 'S', color: '#fff', fontSize: 8, position: 'inside' },
    });
  });

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const value = p.value as number;
        return `${p.name}<br/>OBV: ${value.toLocaleString()}`;
      },
    },
    title: { text: 'OBV', left: 10, top: 0, textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' } },
    grid: { left: 80, right: 60, top: 25, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888', fontSize: 10 } },
    yAxis: {
      scale: true,
      axisLine: { lineStyle: { color: '#666' } },
      splitLine: { lineStyle: { color: '#333' } },
      axisLabel: {
        color: '#888',
        formatter: (value: number) => {
          const abs = Math.abs(value);
          if (abs >= 1e9) return (value / 1e9).toFixed(1) + 'B';
          if (abs >= 1e6) return (value / 1e6).toFixed(0) + 'M';
          if (abs >= 1e3) return (value / 1e3).toFixed(0) + 'K';
          return value.toString();
        },
      },
    },
    series: [{
      name: 'OBV', type: 'line', data: obvData.map(d => d.value), smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#9b59b6' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(155, 89, 182, 0.3)' }, { offset: 1, color: 'rgba(155, 89, 182, 0.05)' }]) },
      markPoint: { data: markPointData },
    }],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  obvChart.setOption(option, true);
}

/**
 * Update CCI chart
 */
export function updateCciChart(dates: string[], cciData: TrendCraft.Series<number | null>, zoomStart: number): void {
  if (!cciChart) return;

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const value = p.value as number | null;
        return `${p.name}<br/>CCI: ${value !== null ? value.toFixed(2) : '-'}`;
      },
    },
    title: { text: 'CCI (20)', left: 10, top: 0, textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' } },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888', fontSize: 10 } },
    yAxis: { scale: true, axisLine: { lineStyle: { color: '#666' } }, splitLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#888' } },
    series: [{
      name: 'CCI', type: 'line', data: cciData.map(d => d.value), smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#00bcd4' },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: '#ef5350', type: 'dashed', width: 1 }, label: { show: true, position: 'end', color: '#ef5350', fontSize: 10 }, data: [{ yAxis: -100, label: { formatter: '-100' } }, { yAxis: 100, label: { formatter: '100' } }] },
    }],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  cciChart.setOption(option, true);
}

/**
 * Update Williams %R chart
 */
export function updateWillrChart(dates: string[], willrData: TrendCraft.Series<number | null>, zoomStart: number): void {
  if (!willrChart) return;

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const value = p.value as number | null;
        return `${p.name}<br/>Williams %R: ${value !== null ? value.toFixed(2) : '-'}`;
      },
    },
    title: { text: 'Williams %R (14)', left: 10, top: 0, textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' } },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888', fontSize: 10 } },
    yAxis: { min: -100, max: 0, splitNumber: 4, axisLine: { lineStyle: { color: '#666' } }, splitLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#888' } },
    series: [{
      name: 'Williams %R', type: 'line', data: willrData.map(d => d.value), smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#8bc34a' },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: '#ef5350', type: 'dashed', width: 1 }, label: { show: true, position: 'end', color: '#ef5350', fontSize: 10 }, data: [{ yAxis: -20, label: { formatter: '-20' } }, { yAxis: -80, label: { formatter: '-80' } }] },
    }],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  willrChart.setOption(option, true);
}

/**
 * Update ROC chart
 */
export function updateRocChart(dates: string[], rocData: TrendCraft.Series<number | null>, zoomStart: number): void {
  if (!rocChart) return;

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const value = p.value as number | null;
        return `${p.name}<br/>ROC: ${value !== null ? value.toFixed(2) + '%' : '-'}`;
      },
    },
    title: { text: 'ROC (12)', left: 10, top: 0, textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' } },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888', fontSize: 10 } },
    yAxis: { scale: true, axisLine: { lineStyle: { color: '#666' } }, splitLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#888' } },
    series: [{
      name: 'ROC', type: 'line', data: rocData.map(d => d.value), smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#ff5722' },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: '#888', type: 'dashed', width: 1 }, label: { show: true, position: 'end', color: '#888', fontSize: 10 }, data: [{ yAxis: 0, label: { formatter: '0' } }] },
    }],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  rocChart.setOption(option, true);
}

/**
 * Update Range-Bound chart
 */
export function updateRangeBoundChart(
  dates: string[],
  rbData: TrendCraft.Series<TrendCraft.RangeBoundValue>,
  zoomStart: number
): void {
  if (!rangeBoundChart) return;

  const rangeScores = rbData.map(d => d.value.rangeScore);
  const adxValues = rbData.map(d => d.value.adx);

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        if (!Array.isArray(params)) return '';
        const date = params[0]?.name || '';
        const score = params.find(p => p.seriesName === 'Range Score');
        const adx = params.find(p => p.seriesName === 'ADX');
        const format = (v: number | null | undefined) => v !== null && v !== undefined ? v.toFixed(1) : '-';
        return `${date}<br/>Range Score: ${format(score?.value as number)}<br/>ADX: ${format(adx?.value as number)}`;
      },
    },
    title: { text: 'Range-Bound Detection', left: 10, top: 0, textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' } },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888', fontSize: 10 } },
    yAxis: { min: 0, max: 100, splitNumber: 4, axisLine: { lineStyle: { color: '#666' } }, splitLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#888' } },
    series: [
      {
        name: 'Range Score', type: 'line', data: rangeScores, smooth: false, showSymbol: false, lineStyle: { width: 2, color: '#9c27b0' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(156, 39, 176, 0.3)' }, { offset: 1, color: 'rgba(156, 39, 176, 0.05)' }]) },
        markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', width: 1 }, label: { show: true, position: 'end', fontSize: 10 }, data: [{ yAxis: 70, lineStyle: { color: '#ffd93d' }, label: { formatter: '70 Range', color: '#ffd93d' } }, { yAxis: 85, lineStyle: { color: '#ef5350' }, label: { formatter: '85 Tight', color: '#ef5350' } }] },
      },
      {
        name: 'ADX', type: 'line', data: adxValues, smooth: false, showSymbol: false, lineStyle: { width: 1.5, color: '#00bcd4', type: 'dashed' },
        markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dotted', width: 1 }, label: { show: true, position: 'start', fontSize: 9 }, data: [{ yAxis: 20, lineStyle: { color: '#4caf50' }, label: { formatter: 'ADX 20', color: '#4caf50' } }, { yAxis: 25, lineStyle: { color: '#ff9800' }, label: { formatter: 'ADX 25', color: '#ff9800' } }] },
      },
    ],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  rangeBoundChart.setOption(option, true);
}

/**
 * Update CMF chart
 */
export function updateCmfChart(dates: string[], cmfData: TrendCraft.Series<number | null>, zoomStart: number): void {
  if (!cmfChart) return;

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const value = p.value as number | null;
        return `${p.name}<br/>CMF: ${value !== null ? value.toFixed(3) : '-'}`;
      },
    },
    title: { text: 'CMF (20)', left: 10, top: 0, textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' } },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888', fontSize: 10 } },
    yAxis: { type: 'value', splitNumber: 4, axisLine: { lineStyle: { color: '#666' } }, splitLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#888', formatter: (v: number) => v.toFixed(2) } },
    series: [{
      name: 'CMF', type: 'bar',
      data: cmfData.map(d => ({ value: d.value, itemStyle: { color: d.value !== null && d.value >= 0 ? '#26a69a' : '#ef5350' } })),
      markLine: { silent: true, symbol: 'none', lineStyle: { color: '#888', type: 'dashed', width: 1 }, label: { show: true, position: 'end', color: '#888', fontSize: 10 }, data: [{ yAxis: 0, label: { formatter: '0' } }, { yAxis: 0.1, lineStyle: { color: '#26a69a' }, label: { formatter: '+0.1', color: '#26a69a' } }, { yAxis: -0.1, lineStyle: { color: '#ef5350' }, label: { formatter: '-0.1', color: '#ef5350' } }] },
    }],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  cmfChart.setOption(option, true);
}
