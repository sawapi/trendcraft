/**
 * TrendCraft Chart Viewer
 * Interactive chart visualization with ECharts
 */

import * as echarts from 'echarts';
import * as TrendCraft from 'trendcraft';
import type { NormalizedCandle, Timeframe, CrossSignalQuality } from 'trendcraft';

// State
let rawCandles: NormalizedCandle[] = [];
let currentCandles: NormalizedCandle[] = [];
let mainChart: echarts.ECharts | null = null;
let rsiChart: echarts.ECharts | null = null;
let macdChart: echarts.ECharts | null = null;
let stochChart: echarts.ECharts | null = null;
let dmiChart: echarts.ECharts | null = null;
let currentZoomRange: { start: number; end: number } = { start: 0, end: 100 };

// DOM Elements
const dropZone = document.getElementById('dropZone') as HTMLDivElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const fileInfo = document.getElementById('fileInfo') as HTMLDivElement;
const controls = document.getElementById('controls') as HTMLDivElement;
const chartWrapper = document.getElementById('chartWrapper') as HTMLDivElement;
const timeframeSelect = document.getElementById('timeframe') as HTMLSelectElement;
const rsiChartEl = document.getElementById('rsi-chart') as HTMLDivElement;
const macdChartEl = document.getElementById('macd-chart') as HTMLDivElement;
const stochChartEl = document.getElementById('stoch-chart') as HTMLDivElement;
const dmiChartEl = document.getElementById('dmi-chart') as HTMLDivElement;

// Initialize
function init(): void {
  setupDropZone();
  setupControls();
  // Charts are initialized lazily after DOM is visible
}

// Setup drag and drop
function setupDropZone(): void {
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file) processFile(file);
  });
}

// Setup control event listeners
function setupControls(): void {
  timeframeSelect.addEventListener('change', () => {
    applyTimeframe();
    updateChart();
  });

  document.querySelectorAll<HTMLInputElement>('[data-indicator]').forEach(checkbox => {
    checkbox.addEventListener('change', updateChart);
  });
}

// Initialize ECharts
function initCharts(): void {
  mainChart = echarts.init(document.getElementById('main-chart'), 'dark');
  rsiChart = echarts.init(rsiChartEl, 'dark');
  macdChart = echarts.init(macdChartEl, 'dark');
  stochChart = echarts.init(stochChartEl, 'dark');
  dmiChart = echarts.init(dmiChartEl, 'dark');

  // Resize handler
  window.addEventListener('resize', () => {
    mainChart?.resize();
    rsiChart?.resize();
    macdChart?.resize();
    stochChart?.resize();
    dmiChart?.resize();
  });
}

// Handle file selection
function handleFileSelect(e: Event): void {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) processFile(file);
}

// Process CSV file
async function processFile(file: File): Promise<void> {
  try {
    const text = await readFileAsText(file);
    rawCandles = parseCSV(text);

    if (rawCandles.length === 0) {
      throw new Error('No valid data found');
    }

    // Sort by date ascending
    rawCandles.sort((a, b) => a.time - b.time);

    // Update UI
    dropZone.classList.add('has-data');
    fileInfo.textContent = `${file.name} - ${rawCandles.length} candles loaded`;
    controls.classList.add('visible');
    chartWrapper.classList.add('visible');

    // Initialize charts after DOM is visible
    requestAnimationFrame(() => {
      if (!mainChart) {
        initCharts();
      }
      applyTimeframe();
      updateChart();
    });
  } catch (error) {
    console.error('Error processing file:', error);
    fileInfo.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Read file with Shift-JIS support
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    // Try Shift-JIS first (for Japanese CSV files)
    reader.readAsText(file, 'Shift_JIS');
  });
}

// Parse CSV to candles
function parseCSV(text: string): NormalizedCandle[] {
  const lines = text.trim().split('\n');
  const candles: NormalizedCandle[] = [];

  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 6) continue;

    const [dateStr, open, high, low, close, volume, adjClose] = parts;

    // Parse date (format: 2025/12/12 or 2025-12-12)
    const dateParts = dateStr.split(/[\/\-]/);
    if (dateParts.length !== 3) continue;

    const date = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2])
    );

    if (isNaN(date.getTime())) continue;

    // Use adjusted close if available to handle stock splits
    const rawClose = parseFloat(close);
    const adjustedClose = adjClose ? parseFloat(adjClose) : rawClose;
    const adjustmentRatio = adjustedClose / rawClose;

    candles.push({
      time: date.getTime(),
      open: parseFloat(open) * adjustmentRatio,
      high: parseFloat(high) * adjustmentRatio,
      low: parseFloat(low) * adjustmentRatio,
      close: adjustedClose,
      volume: parseFloat(volume),
    });
  }

  return candles;
}

// Apply timeframe transformation
function applyTimeframe(): void {
  const timeframe = timeframeSelect.value as Timeframe | 'daily';

  if (timeframe === 'daily') {
    currentCandles = [...rawCandles];
  } else {
    currentCandles = TrendCraft.resample(rawCandles, timeframe);
  }
}

// Get selected indicators
function getSelectedIndicators(): Record<string, boolean> {
  const selected: Record<string, boolean> = {};
  document.querySelectorAll<HTMLInputElement>('[data-indicator]:checked').forEach(cb => {
    if (cb.dataset.indicator) {
      selected[cb.dataset.indicator] = true;
    }
  });
  return selected;
}

// Create line series for indicators
function createLineSeries(
  name: string,
  data: TrendCraft.Series<number | null>,
  color: string,
  lineStyle: 'solid' | 'dashed' | 'dotted' = 'solid'
): echarts.LineSeriesOption {
  return {
    name,
    type: 'line',
    data: data.map(d => d.value),
    smooth: false,
    showSymbol: false,
    lineStyle: {
      width: 1.5,
      color,
      type: lineStyle,
    },
  };
}

// Update all charts
function updateChart(): void {
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
        color: '#ef5350',
        color0: '#26a69a',
        borderColor: '#ef5350',
        borderColor0: '#26a69a',
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

  // Add indicators
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
    series.push(createLineSeries('BB Upper', bbData.map(d => ({ time: d.time, value: d.value.upper })), '#6bcb77', 'dashed'));
    series.push(createLineSeries('BB Middle', bbData.map(d => ({ time: d.time, value: d.value.middle })), '#6bcb77'));
    series.push(createLineSeries('BB Lower', bbData.map(d => ({ time: d.time, value: d.value.lower })), '#6bcb77', 'dashed'));
  }

  // Golden Cross / Dead Cross list
  updateCrossEventsList(indicators.cross);

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
  currentZoomRange = { start: zoomStart, end: 100 };

  // RSI Chart
  if (indicators.rsi) {
    rsiChartEl.classList.add('visible');
    const rsiData = TrendCraft.rsi(currentCandles, { period: 14 });
    updateRsiChart(dates, rsiData, zoomStart);
  } else {
    rsiChartEl.classList.remove('visible');
  }

  // MACD Chart
  if (indicators.macd) {
    macdChartEl.classList.add('visible');
    const macdData = TrendCraft.macd(currentCandles);
    updateMacdChart(dates, macdData, zoomStart);
  } else {
    macdChartEl.classList.remove('visible');
  }

  // Stochastics Chart
  if (indicators.stoch) {
    stochChartEl.classList.add('visible');
    const stochData = TrendCraft.slowStochastics(currentCandles, { kPeriod: 14, dPeriod: 3 });
    updateStochChart(dates, stochData, zoomStart);
  } else {
    stochChartEl.classList.remove('visible');
  }

  // DMI/ADX Chart
  if (indicators.dmi) {
    dmiChartEl.classList.add('visible');
    const dmiData = TrendCraft.dmi(currentCandles, { period: 14, adxPeriod: 14 });
    updateDmiChart(dates, dmiData, zoomStart);
  } else {
    dmiChartEl.classList.remove('visible');
  }

  // Sync dataZoom across all charts (remove old listener first to avoid duplicates)
  mainChart.off('datazoom', syncDataZoom);
  mainChart.on('datazoom', syncDataZoom);

  // Force resize after DOM updates
  requestAnimationFrame(() => {
    mainChart?.resize();
    rsiChart?.resize();
    macdChart?.resize();
    stochChart?.resize();
    dmiChart?.resize();
  });
}

// Sync dataZoom across charts
function syncDataZoom(): void {
  if (!mainChart) return;
  const option = mainChart.getOption() as { dataZoom?: { start?: number; end?: number }[] };
  const zoom = option.dataZoom?.[0];
  if (!zoom) return;

  const { start, end } = zoom;
  currentZoomRange = { start: start ?? 0, end: end ?? 100 };

  rsiChart?.setOption({ dataZoom: [{ start, end }] });
  macdChart?.setOption({ dataZoom: [{ start, end }] });
  stochChart?.setOption({ dataZoom: [{ start, end }] });
  dmiChart?.setOption({ dataZoom: [{ start, end }] });

  // Update GC/DC list if visible
  const indicators = getSelectedIndicators();
  if (indicators.cross) {
    updateCrossEventsList(true);
  }
}

// Update RSI chart
function updateRsiChart(dates: string[], rsiData: TrendCraft.Series<number | null>, zoomStart: number): void {
  if (!rsiChart) return;

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
    title: {
      text: 'RSI (14)',
      left: 10,
      top: 0,
      textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' },
    },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#666' } },
      axisLabel: { color: '#888', fontSize: 10 },
    },
    yAxis: {
      min: 0,
      max: 100,
      splitNumber: 4,
      axisLine: { lineStyle: { color: '#666' } },
      splitLine: { lineStyle: { color: '#333' } },
      axisLabel: { color: '#888' },
    },
    series: [
      {
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
          data: [
            { yAxis: 30, label: { formatter: '30' } },
            { yAxis: 70, label: { formatter: '70' } },
          ],
        },
      },
    ],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  rsiChart.setOption(option, true);
}

// Update MACD chart
function updateMacdChart(dates: string[], macdData: TrendCraft.Series<TrendCraft.MacdValue>, zoomStart: number): void {
  if (!macdChart) return;

  const macdLine = macdData.map(d => d.value.macd);
  const signalLine = macdData.map(d => d.value.signal);
  const histogram = macdData.map(d => d.value.histogram);

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
    title: {
      text: 'MACD (12, 26, 9)',
      left: 10,
      top: 0,
      textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' },
    },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#666' } },
      axisLabel: { color: '#888', fontSize: 10 },
    },
    yAxis: {
      scale: true,
      axisLine: { lineStyle: { color: '#666' } },
      splitLine: { lineStyle: { color: '#333' } },
      axisLabel: { color: '#888' },
    },
    series: [
      {
        name: 'Histogram',
        type: 'bar',
        data: histogram,
        itemStyle: {
          color: (params) => (params.value as number) >= 0 ? '#26a69a' : '#ef5350',
        },
      },
      {
        name: 'MACD',
        type: 'line',
        data: macdLine,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 1.5, color: '#ff9f43' },
      },
      {
        name: 'Signal',
        type: 'line',
        data: signalLine,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 1.5, color: '#a855f7' },
      },
    ],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  macdChart.setOption(option, true);
}

// Update Stochastics chart
function updateStochChart(dates: string[], stochData: TrendCraft.Series<TrendCraft.StochasticsValue>, zoomStart: number): void {
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
    title: {
      text: 'Stochastics (14, 3, 3)',
      left: 10,
      top: 0,
      textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' },
    },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#666' } },
      axisLabel: { color: '#888', fontSize: 10 },
    },
    yAxis: {
      min: 0,
      max: 100,
      splitNumber: 4,
      axisLine: { lineStyle: { color: '#666' } },
      splitLine: { lineStyle: { color: '#333' } },
      axisLabel: { color: '#888' },
    },
    series: [
      {
        name: '%K',
        type: 'line',
        data: kLine,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 1.5, color: '#00d9ff' },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#ef5350', type: 'dashed', width: 1 },
          label: { show: true, position: 'end', color: '#ef5350', fontSize: 10 },
          data: [
            { yAxis: 20, label: { formatter: '20' } },
            { yAxis: 80, label: { formatter: '80' } },
          ],
        },
      },
      {
        name: '%D',
        type: 'line',
        data: dLine,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 1.5, color: '#ff6b9d' },
      },
    ],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  stochChart.setOption(option, true);
}

// Update DMI/ADX chart
function updateDmiChart(dates: string[], dmiData: TrendCraft.Series<TrendCraft.DmiValue>, zoomStart: number): void {
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
    title: {
      text: 'DMI/ADX (14)',
      left: 10,
      top: 0,
      textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' },
    },
    grid: { left: 60, right: 60, top: 25, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#666' } },
      axisLabel: { color: '#888', fontSize: 10 },
    },
    yAxis: {
      min: 0,
      max: 100,
      splitNumber: 4,
      axisLine: { lineStyle: { color: '#666' } },
      splitLine: { lineStyle: { color: '#333' } },
      axisLabel: { color: '#888' },
    },
    series: [
      {
        name: '+DI',
        type: 'line',
        data: plusDi,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 1.5, color: '#26a69a' },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#ffd93d', type: 'dashed', width: 1 },
          label: { show: true, position: 'end', color: '#ffd93d', fontSize: 10 },
          data: [
            { yAxis: 25, label: { formatter: '25' } },
          ],
        },
      },
      {
        name: '-DI',
        type: 'line',
        data: minusDi,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 1.5, color: '#ef5350' },
      },
      {
        name: 'ADX',
        type: 'line',
        data: adx,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 2, color: '#a29bfe' },
      },
    ],
    dataZoom: [{ type: 'inside', start: zoomStart, end: 100 }],
  };
  dmiChart.setOption(option, true);
}

// Format date for display
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

// Get visible date range based on current zoom
function getVisibleDateRange(): { startDate: number; endDate: number } {
  const totalCandles = currentCandles.length;
  const startIdx = Math.floor((currentZoomRange.start / 100) * totalCandles);
  const endIdx = Math.ceil((currentZoomRange.end / 100) * totalCandles) - 1;

  const startDate = currentCandles[Math.max(0, startIdx)]?.time ?? 0;
  const endDate = currentCandles[Math.min(totalCandles - 1, endIdx)]?.time ?? Infinity;

  return { startDate, endDate };
}

// Update GC/DC events list with fake signal detection
function updateCrossEventsList(show: boolean): void {
  const container = document.getElementById('cross-events') as HTMLDivElement;
  const listEl = document.getElementById('cross-events-list') as HTMLDivElement;

  if (!show || currentCandles.length === 0) {
    container.classList.remove('visible');
    return;
  }

  // Use validateCrossSignals to get quality assessment
  const signals = TrendCraft.validateCrossSignals(currentCandles, {
    short: 5,
    long: 25,
    volumeMaPeriod: 20,
    trendPeriod: 5,
  });

  // Get visible date range
  const { startDate, endDate } = getVisibleDateRange();

  // Filter by visible range
  const visibleSignals = signals.filter(
    (s) => s.time >= startDate && s.time <= endDate
  );

  // Sort by date descending (newest first)
  visibleSignals.sort((a, b) => b.time - a.time);

  if (visibleSignals.length === 0) {
    listEl.innerHTML = '<span style="color: #666;">No events in visible range</span>';
  } else {
    listEl.innerHTML = visibleSignals.map(s => {
      const label = s.type === 'golden' ? 'GC' : 'DC';
      const cssClass = s.type === 'golden' ? 'gc' : 'dc';
      const fakeClass = s.isFake ? ' fake' : '';
      const fakeLabel = s.isFake ? ' (Maybe fake?)' : '';

      // Display days until reverse if available
      const daysLabel = s.details.daysUntilReverse !== null
        ? ` [→${s.details.daysUntilReverse}d]`
        : '';

      // Build tooltip with details
      const volIcon = s.details.volumeConfirmed ? '✓' : '✗';
      const trendIcon = s.details.trendConfirmed ? '✓' : '✗';
      const holdIcon = s.details.holdingConfirmed === true ? '✓' : s.details.holdingConfirmed === false ? '✗' : '?';
      const priceIcon = s.details.pricePositionConfirmed ? '✓' : '✗';
      const daysInfo = s.details.daysUntilReverse !== null ? `${s.details.daysUntilReverse}d` : 'N/A';
      const tooltip = `Volume: ${volIcon} / Trend: ${trendIcon} / 5d Hold: ${holdIcon} / Price: ${priceIcon} / Reverse: ${daysInfo}`;

      return `<span class="cross-event ${cssClass}${fakeClass}" title="${tooltip}">${label} ${formatDate(s.time)}${daysLabel}${fakeLabel}</span>`;
    }).join('');
  }

  container.classList.add('visible');
}

// Start
init();
