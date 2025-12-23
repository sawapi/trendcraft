/**
 * TrendCraft Chart Viewer
 * Entry point - initializes the chart viewer application
 */

import * as echarts from 'echarts';
import * as TrendCraft from 'trendcraft';
import type { Timeframe } from 'trendcraft';
import {
  setRawCandles, setCurrentCandles, setMainChart, setSubCharts,
  rawCandles, currentCandles, mainChart, getAllCharts,
} from './state';
import { readFileAsText, parseCSV, setupDropZone } from './file-handler';
import { updateChart } from './chart-main';
import { setupBacktest, showBacktestPanel, runBacktest, resizeEquityChart, clearTradeMarkers, getRunButton } from './backtest';

// DOM Elements
const dropZone = document.getElementById('dropZone') as HTMLDivElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const fileInfo = document.getElementById('fileInfo') as HTMLDivElement;
const controls = document.getElementById('controls') as HTMLDivElement;
const chartWrapper = document.getElementById('chartWrapper') as HTMLDivElement;
const timeframeSelect = document.getElementById('timeframe') as HTMLSelectElement;

// Sub-chart DOM elements
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
 * Initialize ECharts instances
 */
function initCharts(): void {
  setMainChart(echarts.init(document.getElementById('main-chart'), 'dark'));
  setSubCharts({
    rsi: echarts.init(rsiChartEl, 'dark'),
    macd: echarts.init(macdChartEl, 'dark'),
    stoch: echarts.init(stochChartEl, 'dark'),
    dmi: echarts.init(dmiChartEl, 'dark'),
    stochRsi: echarts.init(stochRsiChartEl, 'dark'),
    mfi: echarts.init(mfiChartEl, 'dark'),
    obv: echarts.init(obvChartEl, 'dark'),
    cci: echarts.init(cciChartEl, 'dark'),
    willr: echarts.init(willrChartEl, 'dark'),
    roc: echarts.init(rocChartEl, 'dark'),
    rangeBound: echarts.init(rbChartEl, 'dark'),
    cmf: echarts.init(cmfChartEl, 'dark'),
    volumeAnomaly: echarts.init(volumeAnomalyChartEl, 'dark'),
    volumeProfile: echarts.init(volumeProfileChartEl, 'dark'),
    volumeTrend: echarts.init(volumeTrendChartEl, 'dark'),
  });

  // Resize handler
  window.addEventListener('resize', () => {
    getAllCharts().forEach(chart => chart?.resize());
    resizeEquityChart();
  });
}

/**
 * Apply timeframe transformation
 */
function applyTimeframe(): void {
  const timeframe = timeframeSelect.value as Timeframe | 'daily';

  if (timeframe === 'daily') {
    setCurrentCandles([...rawCandles]);
  } else {
    setCurrentCandles(TrendCraft.resample(rawCandles, timeframe));
  }
}

/**
 * Process CSV file
 */
async function processFile(file: File): Promise<void> {
  try {
    const text = await readFileAsText(file);
    const candles = parseCSV(text);

    if (candles.length === 0) {
      throw new Error('No valid data found');
    }

    // Sort by date ascending
    candles.sort((a, b) => a.time - b.time);
    setRawCandles(candles);

    // Update UI
    dropZone.classList.add('has-data');
    fileInfo.textContent = `${file.name} - ${candles.length} candles loaded`;
    controls.classList.add('visible');
    chartWrapper.classList.add('visible');

    // Initialize charts after DOM is visible
    requestAnimationFrame(() => {
      if (!mainChart) {
        initCharts();
      }
      applyTimeframe();
      updateChart();
      showBacktestPanel();
    });
  } catch (error) {
    console.error('Error processing file:', error);
    fileInfo.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Setup control event listeners
 */
function setupControls(): void {
  timeframeSelect.addEventListener('change', () => {
    applyTimeframe();
    updateChart();
    // Clear any backtest markers when timeframe changes
    if (mainChart) {
      clearTradeMarkers(mainChart);
    }
  });

  document.querySelectorAll<HTMLInputElement>('[data-indicator]').forEach(checkbox => {
    checkbox.addEventListener('change', updateChart);
  });

  // Backtest button handler (deferred until setupBacktest is called)
  setTimeout(() => {
    const runBtn = getRunButton();
    if (runBtn) {
      runBtn.addEventListener('click', () => {
        if (mainChart && currentCandles.length > 0) {
          runBacktest(currentCandles, mainChart);
        }
      });
    }
  }, 0);
}

/**
 * Initialize the application
 */
function init(): void {
  setupDropZone(dropZone, fileInput, processFile);
  setupControls();
  setupBacktest();
}

// Start the application
init();
