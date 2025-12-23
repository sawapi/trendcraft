/**
 * Main chart (candlestick + overlays) rendering
 */

import * as echarts from 'echarts';
import * as TrendCraft from 'trendcraft';
import { formatDate, createLineSeries } from './utils';
import {
  mainChart, currentCandles, currentZoomRange, setCurrentZoomRange,
  getAllCharts, getSubCharts,
} from './state';
import {
  updateRsiChart, updateMacdChart, updateStochChart, updateDmiChart,
  updateStochRsiChart, updateMfiChart, updateObvChart, updateCciChart,
  updateWillrChart, updateRocChart, updateRangeBoundChart, updateCmfChart,
  updateVolumeAnomalyChart, updateVolumeProfileChart, updateVolumeTrendChart,
} from './chart-indicators';
import {
  createPerfectOrderMarkPointsEnhanced, updatePerfectOrderEventsListEnhanced,
  createRangeBoundMarkAreas, createSupportResistanceLines, updateRangeBoundEventsList,
  createSqueezeMarkPoints, updateCrossEventsList,
} from './chart-signals';

// DOM Elements
const rsiChartEl = document.getElementById('rsi-chart') as HTMLDivElement;
const macdChartEl = document.getElementById('macd-chart') as HTMLDivElement;
const stochChartEl = document.getElementById('stoch-chart') as HTMLDivElement;
const dmiChartEl = document.getElementById('dmi-chart') as HTMLDivElement;
const stochRsiChartEl = document.getElementById('stochrsi-chart') as HTMLDivElement;
const mfiChartEl = document.getElementById('mfi-chart') as HTMLDivElement;
const obvChartEl = document.getElementById('obv-chart') as HTMLDivElement;
const cciChartEl = document.getElementById('cci-chart') as HTMLDivElement;
const willrChartEl = document.getElementById('willr-chart') as HTMLDivElement;
const rocChartEl = document.getElementById('roc-chart') as HTMLDivElement;
const rbChartEl = document.getElementById('rb-chart') as HTMLDivElement;
const cmfChartEl = document.getElementById('cmf-chart') as HTMLDivElement;
const volumeAnomalyChartEl = document.getElementById('volume-anomaly-chart') as HTMLDivElement;
const volumeProfileChartEl = document.getElementById('volume-profile-chart') as HTMLDivElement;
const volumeTrendChartEl = document.getElementById('volume-trend-chart') as HTMLDivElement;

/**
 * Get selected indicators from checkboxes
 */
export function getSelectedIndicators(): Record<string, boolean> {
  const selected: Record<string, boolean> = {};
  document.querySelectorAll<HTMLInputElement>('[data-indicator]:checked').forEach(cb => {
    if (cb.dataset.indicator) {
      selected[cb.dataset.indicator] = true;
    }
  });
  return selected;
}

/**
 * Sync dataZoom across all charts
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function syncDataZoom(sourceChart: echarts.ECharts, params: any): void {
  let start: number | undefined;
  let end: number | undefined;

  if (params.batch) {
    start = params.batch[0]?.start;
    end = params.batch[0]?.end;
  } else {
    start = params.start;
    end = params.end;
  }

  if (start === undefined || end === undefined) {
    const option = sourceChart.getOption() as { dataZoom?: { start?: number; end?: number }[] };
    const zoom = option.dataZoom?.[0];
    if (!zoom) return;
    start = zoom.start;
    end = zoom.end;
  }

  setCurrentZoomRange({ start: start ?? 0, end: end ?? 100 });

  // Sync to all other charts
  getAllCharts().forEach(chart => {
    if (chart && chart !== sourceChart) {
      chart.setOption({ dataZoom: [{ start, end }] }, { lazyUpdate: true });
    }
  });

  // Update event lists if visible
  const indicators = getSelectedIndicators();
  if (indicators.cross) {
    updateCrossEventsList(true);
  }
  if (indicators.perfectorder) {
    const poData = TrendCraft.perfectOrderEnhanced(currentCandles, {
      enhanced: true,
      periods: [5, 25, 75],
      slopeLookback: 3,
      persistBars: 3,
    });
    updatePerfectOrderEventsListEnhanced(true, poData);
  }
  if (indicators.rangebound) {
    const rbData = TrendCraft.rangeBound(currentCandles, { persistBars: 3 });
    updateRangeBoundEventsList(true, rbData);
  }
}

/**
 * Update all charts
 */
export function updateChart(): void {
  if (currentCandles.length === 0 || !mainChart) return;

  const indicators = getSelectedIndicators();

  // Prepare data
  const dates = currentCandles.map(c => formatDate(c.time));
  const ohlc = currentCandles.map(c => [c.open, c.close, c.low, c.high]);
  const volumes = currentCandles.map(c => c.volume);

  // Build series
  const series: echarts.SeriesOption[] = [
    {
      name: 'Candlestick',
      type: 'candlestick',
      data: ohlc,
      itemStyle: {
        color: '#26a69a',
        color0: '#ef5350',
        borderColor: '#26a69a',
        borderColor0: '#ef5350',
      },
    },
    {
      name: 'Volume',
      type: 'bar',
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: volumes,
      itemStyle: {
        color: (params) => {
          const idx = params.dataIndex;
          return ohlc[idx][1] >= ohlc[idx][0] ? '#26a69a' : '#ef5350';
        },
      },
    },
  ];

  // Add overlay indicators
  if (indicators.sma5) {
    const data = TrendCraft.sma(currentCandles, { period: 5 });
    series.push(createLineSeries('SMA 5', data, '#ff6b6b'));
  }
  if (indicators.sma25) {
    const data = TrendCraft.sma(currentCandles, { period: 25 });
    series.push(createLineSeries('SMA 25', data, '#ffd93d'));
  }
  if (indicators.sma75) {
    const data = TrendCraft.sma(currentCandles, { period: 75 });
    series.push(createLineSeries('SMA 75', data, '#c44dff'));
  }
  if (indicators.ema12) {
    const data = TrendCraft.ema(currentCandles, { period: 12 });
    series.push(createLineSeries('EMA 12', data, '#4ecdc4', 'dashed'));
  }
  if (indicators.ema26) {
    const data = TrendCraft.ema(currentCandles, { period: 26 });
    series.push(createLineSeries('EMA 26', data, '#45b7d1', 'dashed'));
  }
  if (indicators.bb) {
    const bbData = TrendCraft.bollingerBands(currentCandles, { period: 20, stdDev: 2 });
    const squeezeSignals = TrendCraft.bollingerSqueeze(currentCandles, { threshold: 10 });
    const squeezeMarkPoints = createSqueezeMarkPoints(squeezeSignals, dates);

    series.push(createLineSeries('BB Upper', bbData.map(d => ({ time: d.time, value: d.value.upper })), '#6bcb77', 'dashed'));
    series.push({
      ...createLineSeries('BB Middle', bbData.map(d => ({ time: d.time, value: d.value.middle })), '#6bcb77'),
      markPoint: squeezeMarkPoints.length > 0 ? { data: squeezeMarkPoints } : undefined,
    });
    series.push(createLineSeries('BB Lower', bbData.map(d => ({ time: d.time, value: d.value.lower })), '#6bcb77', 'dashed'));
  }
  if (indicators.donchian) {
    const donchianData = TrendCraft.donchianChannel(currentCandles, { period: 20 });
    series.push(createLineSeries('Donchian Upper', donchianData.map(d => ({ time: d.time, value: d.value.upper })), '#1abc9c', 'dashed'));
    series.push(createLineSeries('Donchian Middle', donchianData.map(d => ({ time: d.time, value: d.value.middle })), '#1abc9c'));
    series.push(createLineSeries('Donchian Lower', donchianData.map(d => ({ time: d.time, value: d.value.lower })), '#1abc9c', 'dashed'));
  }
  if (indicators.wma20) {
    const data = TrendCraft.wma(currentCandles, { period: 20 });
    series.push(createLineSeries('WMA 20', data, '#e74c3c'));
  }
  if (indicators.ichimoku) {
    const ichimokuData = TrendCraft.ichimoku(currentCandles);
    series.push(createLineSeries('Tenkan', ichimokuData.map(d => ({ time: d.time, value: d.value.tenkan })), '#e74c3c'));
    series.push(createLineSeries('Kijun', ichimokuData.map(d => ({ time: d.time, value: d.value.kijun })), '#3498db'));
    series.push(createLineSeries('Senkou A', ichimokuData.map(d => ({ time: d.time, value: d.value.senkouA })), '#2ecc71', 'dashed'));
    series.push(createLineSeries('Senkou B', ichimokuData.map(d => ({ time: d.time, value: d.value.senkouB })), '#e67e22', 'dashed'));
    series.push(createLineSeries('Chikou', ichimokuData.map(d => ({ time: d.time, value: d.value.chikou })), '#9b59b6', 'dotted'));
  }
  if (indicators.supertrend) {
    const supertrendData = TrendCraft.supertrend(currentCandles, { period: 10, multiplier: 3 });
    const bullishData = supertrendData.map(d => ({ time: d.time, value: d.value.direction === 1 ? d.value.supertrend : null }));
    const bearishData = supertrendData.map(d => ({ time: d.time, value: d.value.direction === -1 ? d.value.supertrend : null }));
    series.push(createLineSeries('Supertrend ↑', bullishData, '#26a69a'));
    series.push(createLineSeries('Supertrend ↓', bearishData, '#ef5350'));
  }
  if (indicators.psar) {
    const psarData = TrendCraft.parabolicSar(currentCandles, { step: 0.02, max: 0.2 });
    const bullishSar = psarData.map(d => ({ time: d.time, value: d.value.direction === 1 ? d.value.sar : null }));
    const bearishSar = psarData.map(d => ({ time: d.time, value: d.value.direction === -1 ? d.value.sar : null }));
    series.push({ name: 'PSAR ↑', type: 'scatter', data: bullishSar.map(d => d.value), symbolSize: 4, itemStyle: { color: '#26a69a' } });
    series.push({ name: 'PSAR ↓', type: 'scatter', data: bearishSar.map(d => d.value), symbolSize: 4, itemStyle: { color: '#ef5350' } });
  }
  if (indicators.keltner) {
    const kcData = TrendCraft.keltnerChannel(currentCandles, { emaPeriod: 20, atrPeriod: 10, multiplier: 2 });
    series.push(createLineSeries('KC Upper', kcData.map(d => ({ time: d.time, value: d.value.upper })), '#7c4dff', 'dashed'));
    series.push(createLineSeries('KC Middle', kcData.map(d => ({ time: d.time, value: d.value.middle })), '#7c4dff'));
    series.push(createLineSeries('KC Lower', kcData.map(d => ({ time: d.time, value: d.value.lower })), '#7c4dff', 'dashed'));
  }

  // GC/DC list
  updateCrossEventsList(indicators.cross);

  // Perfect Order
  if (indicators.perfectorder) {
    const poData = TrendCraft.perfectOrderEnhanced(currentCandles, {
      enhanced: true,
      periods: [5, 25, 75],
      slopeLookback: 3,
      persistBars: 3,
    });
    const poMarkPoints = createPerfectOrderMarkPointsEnhanced(poData, dates);
    if (poMarkPoints.length > 0) {
      const candlestickSeries = series.find(s => s.name === 'Candlestick');
      if (candlestickSeries) {
        (candlestickSeries as echarts.CandlestickSeriesOption).markPoint = { data: poMarkPoints };
      }
    }
    updatePerfectOrderEventsListEnhanced(true, poData);
  } else {
    updatePerfectOrderEventsListEnhanced(false, []);
  }

  // Range-Bound mark areas
  if (indicators.rangebound) {
    const rbData = TrendCraft.rangeBound(currentCandles, { persistBars: 3 });
    const rbMarkAreas = createRangeBoundMarkAreas(rbData, dates);
    const srLines = createSupportResistanceLines(rbData, dates);
    const candlestickSeries = series.find(s => s.name === 'Candlestick');
    if (candlestickSeries) {
      if (rbMarkAreas.length > 0) {
        (candlestickSeries as echarts.CandlestickSeriesOption).markArea = { silent: true, data: rbMarkAreas };
      }
      if (srLines.length > 0) {
        (candlestickSeries as echarts.CandlestickSeriesOption).markLine = { silent: true, symbol: 'none', data: srLines };
      }
    }
  }

  // Main chart option
  const mainOption: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
    },
    legend: {
      data: series.filter(s => s.name !== 'Volume').map(s => s.name as string),
      top: 10,
      textStyle: { color: '#888' },
    },
    grid: [
      { left: 60, right: 60, top: 60, height: '55%' },
      { left: 60, right: 60, top: '72%', height: '18%' },
    ],
    xAxis: [
      { type: 'category', data: dates, boundaryGap: true, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888' } },
      { type: 'category', data: dates, gridIndex: 1, boundaryGap: true, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { show: false } },
    ],
    yAxis: [
      { scale: true, splitLine: { lineStyle: { color: '#333' } }, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#888' } },
      { scale: true, gridIndex: 1, splitNumber: 2, axisLabel: { show: false }, splitLine: { lineStyle: { color: '#333' } } },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: Math.max(0, 100 - (150 / currentCandles.length) * 100), end: 100 },
      { type: 'slider', xAxisIndex: [0, 1], top: '93%', height: 20, start: Math.max(0, 100 - (150 / currentCandles.length) * 100), end: 100 },
    ],
    series,
  };

  mainChart.setOption(mainOption, true);

  // Calculate initial zoom range
  const zoomStart = Math.max(0, 100 - (150 / currentCandles.length) * 100);
  setCurrentZoomRange({ start: zoomStart, end: 100 });

  // Update sub-charts
  if (indicators.rsi) {
    rsiChartEl.classList.add('visible');
    const rsiData = TrendCraft.rsi(currentCandles, { period: 14 });
    const rsiDivergenceSignals = TrendCraft.rsiDivergence(currentCandles);
    updateRsiChart(dates, rsiData, rsiDivergenceSignals, zoomStart);
  } else {
    rsiChartEl.classList.remove('visible');
  }

  if (indicators.macd) {
    macdChartEl.classList.add('visible');
    const macdData = TrendCraft.macd(currentCandles);
    const macdDivergenceSignals = TrendCraft.macdDivergence(currentCandles);
    updateMacdChart(dates, macdData, macdDivergenceSignals, zoomStart);
  } else {
    macdChartEl.classList.remove('visible');
  }

  if (indicators.stoch) {
    stochChartEl.classList.add('visible');
    const stochData = TrendCraft.slowStochastics(currentCandles, { kPeriod: 14, dPeriod: 3 });
    updateStochChart(dates, stochData, zoomStart);
  } else {
    stochChartEl.classList.remove('visible');
  }

  if (indicators.dmi) {
    dmiChartEl.classList.add('visible');
    const dmiData = TrendCraft.dmi(currentCandles, { period: 14, adxPeriod: 14 });
    updateDmiChart(dates, dmiData, zoomStart);
  } else {
    dmiChartEl.classList.remove('visible');
  }

  if (indicators.stochrsi) {
    stochRsiChartEl.classList.add('visible');
    const stochRsiData = TrendCraft.stochRsi(currentCandles, { rsiPeriod: 14, stochPeriod: 14, kPeriod: 3, dPeriod: 3 });
    updateStochRsiChart(dates, stochRsiData, zoomStart);
  } else {
    stochRsiChartEl.classList.remove('visible');
  }

  if (indicators.mfi) {
    mfiChartEl.classList.add('visible');
    const mfiData = TrendCraft.mfi(currentCandles, { period: 14 });
    updateMfiChart(dates, mfiData, zoomStart);
  } else {
    mfiChartEl.classList.remove('visible');
  }

  if (indicators.obv) {
    obvChartEl.classList.add('visible');
    const obvData = TrendCraft.obv(currentCandles);
    const divergenceSignals = TrendCraft.obvDivergence(currentCandles);
    updateObvChart(dates, obvData, divergenceSignals, zoomStart);
  } else {
    obvChartEl.classList.remove('visible');
  }

  if (indicators.cci) {
    cciChartEl.classList.add('visible');
    const cciData = TrendCraft.cci(currentCandles, { period: 20 });
    updateCciChart(dates, cciData, zoomStart);
  } else {
    cciChartEl.classList.remove('visible');
  }

  if (indicators.willr) {
    willrChartEl.classList.add('visible');
    const willrData = TrendCraft.williamsR(currentCandles, { period: 14 });
    updateWillrChart(dates, willrData, zoomStart);
  } else {
    willrChartEl.classList.remove('visible');
  }

  if (indicators.roc) {
    rocChartEl.classList.add('visible');
    const rocData = TrendCraft.roc(currentCandles, { period: 12 });
    updateRocChart(dates, rocData, zoomStart);
  } else {
    rocChartEl.classList.remove('visible');
  }

  if (indicators.rangebound) {
    rbChartEl.classList.add('visible');
    const rbData = TrendCraft.rangeBound(currentCandles, { persistBars: 3 });
    updateRangeBoundChart(dates, rbData, zoomStart);
    updateRangeBoundEventsList(true, rbData);
  } else {
    rbChartEl.classList.remove('visible');
    updateRangeBoundEventsList(false, []);
  }

  if (indicators.cmf) {
    cmfChartEl.classList.add('visible');
    const cmfData = TrendCraft.cmf(currentCandles, { period: 20 });
    updateCmfChart(dates, cmfData, zoomStart);
  } else {
    cmfChartEl.classList.remove('visible');
  }

  if (indicators.volumeAnomaly) {
    volumeAnomalyChartEl.classList.add('visible');
    const anomalyData = TrendCraft.volumeAnomaly(currentCandles, { period: 20 });
    updateVolumeAnomalyChart(dates, anomalyData, zoomStart);
  } else {
    volumeAnomalyChartEl.classList.remove('visible');
  }

  if (indicators.volumeProfile) {
    volumeProfileChartEl.classList.add('visible');
    const profileData = TrendCraft.volumeProfileSeries(currentCandles, { period: 20 });
    updateVolumeProfileChart(dates, profileData, zoomStart);
  } else {
    volumeProfileChartEl.classList.remove('visible');
  }

  if (indicators.volumeTrend) {
    volumeTrendChartEl.classList.add('visible');
    const trendData = TrendCraft.volumeTrend(currentCandles);
    updateVolumeTrendChart(dates, trendData, zoomStart);
  } else {
    volumeTrendChartEl.classList.remove('visible');
  }

  // Sync dataZoom across all charts
  getAllCharts().forEach(chart => {
    if (chart) {
      chart.off('datazoom');
      chart.on('datazoom', (params) => syncDataZoom(chart, params));
    }
  });

  // Force resize after DOM updates
  requestAnimationFrame(() => {
    getAllCharts().forEach(chart => chart?.resize());

    // Sync initial zoom position to all sub-charts
    getSubCharts().forEach(chart => {
      if (chart) {
        chart.setOption({ dataZoom: [{ start: currentZoomRange.start, end: currentZoomRange.end }] }, { lazyUpdate: true });
      }
    });
  });
}
