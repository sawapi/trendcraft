/**
 * Backtest Simulation UI
 * Interactive backtest functionality for the chart viewer
 */

import * as echarts from 'echarts';
import * as TrendCraft from 'trendcraft';
import type { NormalizedCandle, Condition, BacktestResult } from 'trendcraft';
import { formatDate } from './utils';

// State
let backtestResult: BacktestResult | null = null;
let equityChart: echarts.ECharts | null = null;

// DOM Elements (initialized in setupBacktest)
let entryConditionSelect: HTMLSelectElement;
let exitConditionSelect: HTMLSelectElement;
let capitalInput: HTMLInputElement;
let stopLossInput: HTMLInputElement;
let takeProfitInput: HTMLInputElement;
let trailingStopInput: HTMLInputElement;
let partialThresholdInput: HTMLInputElement;
let partialSellPercentInput: HTMLInputElement;
let startDateInput: HTMLInputElement;
let commissionRateInput: HTMLInputElement;
let taxRateInput: HTMLInputElement;
let runButton: HTMLButtonElement;
let resultsContainer: HTMLDivElement;
let tradesPanel: HTMLDivElement;

/**
 * Entry condition factory functions
 */
const entryConditions: Record<string, () => Condition> = {
  gc: () => TrendCraft.goldenCrossCondition(5, 25),
  validatedGc: () => TrendCraft.validatedGoldenCross({ minScore: 50 }),
  rsi30: () => TrendCraft.rsiBelow(30),
  rsi40: () => TrendCraft.rsiBelow(40),
  macdUp: () => TrendCraft.macdCrossUp(),
  poBullish: () => TrendCraft.perfectOrderBullish({ periods: [5, 25, 75] }),
  poRsi: () => TrendCraft.and(
    TrendCraft.perfectOrderBullish({ periods: [5, 25, 75] }),
    TrendCraft.rsiBelow(60)
  ),
  bbLower: () => TrendCraft.bollingerTouch('lower'),
  // Stochastics
  stoch20: () => TrendCraft.stochBelow(20),
  stochCrossUp: () => TrendCraft.stochCrossUp(),
  stochOversoldCross: () => TrendCraft.and(
    TrendCraft.stochBelow(30),
    TrendCraft.stochCrossUp()
  ),
  // DMI/ADX
  dmiBullish: () => TrendCraft.dmiBullish(20),
  dmiBullishStrong: () => TrendCraft.and(
    TrendCraft.dmiBullish(25),
    TrendCraft.adxStrong(30)
  ),
  // Volume confirmation combos
  gcVolume: () => TrendCraft.and(
    TrendCraft.goldenCrossCondition(5, 25),
    TrendCraft.volumeAboveAvg(1.5)
  ),
  macdRsi: () => TrendCraft.and(
    TrendCraft.macdCrossUp(),
    TrendCraft.rsiBelow(50)
  ),
};

/**
 * Exit condition factory functions
 */
const exitConditions: Record<string, () => Condition> = {
  dc: () => TrendCraft.deadCrossCondition(5, 25),
  validatedDc: () => TrendCraft.validatedDeadCross({ minScore: 50 }),
  rsi70: () => TrendCraft.rsiAbove(70),
  rsi60: () => TrendCraft.rsiAbove(60),
  macdDown: () => TrendCraft.macdCrossDown(),
  poCollapsed: () => TrendCraft.perfectOrderCollapsed({ periods: [5, 25, 75] }),
  bbUpper: () => TrendCraft.bollingerTouch('upper'),
  // Stochastics
  stoch80: () => TrendCraft.stochAbove(80),
  stochCrossDown: () => TrendCraft.stochCrossDown(),
  stochOverboughtCross: () => TrendCraft.and(
    TrendCraft.stochAbove(70),
    TrendCraft.stochCrossDown()
  ),
  // DMI/ADX
  dmiBearish: () => TrendCraft.dmiBearish(20),
};

/**
 * Setup backtest panel event listeners
 */
export function setupBacktest(): void {
  // Get DOM elements
  entryConditionSelect = document.getElementById('entryCondition') as HTMLSelectElement;
  exitConditionSelect = document.getElementById('exitCondition') as HTMLSelectElement;
  capitalInput = document.getElementById('capital') as HTMLInputElement;
  stopLossInput = document.getElementById('stopLoss') as HTMLInputElement;
  takeProfitInput = document.getElementById('takeProfit') as HTMLInputElement;
  trailingStopInput = document.getElementById('trailingStop') as HTMLInputElement;
  partialThresholdInput = document.getElementById('partialThreshold') as HTMLInputElement;
  partialSellPercentInput = document.getElementById('partialSellPercent') as HTMLInputElement;
  startDateInput = document.getElementById('startDate') as HTMLInputElement;
  commissionRateInput = document.getElementById('commissionRate') as HTMLInputElement;
  taxRateInput = document.getElementById('taxRate') as HTMLInputElement;
  runButton = document.getElementById('runBacktest') as HTMLButtonElement;
  resultsContainer = document.getElementById('backtestResults') as HTMLDivElement;
  tradesPanel = document.getElementById('tradesPanel') as HTMLDivElement;
}

/**
 * Show the backtest panel
 */
export function showBacktestPanel(): void {
  document.getElementById('backtestPanel')?.classList.add('visible');
}

/**
 * Hide the backtest panel
 */
export function hideBacktestPanel(): void {
  document.getElementById('backtestPanel')?.classList.remove('visible');
  hideBacktestResults();
}

/**
 * Hide backtest results
 */
function hideBacktestResults(): void {
  resultsContainer?.classList.remove('visible');
  tradesPanel?.classList.remove('visible');
  document.getElementById('equity-chart')?.classList.remove('visible');
  backtestResult = null;
}

/**
 * Get the run backtest button for external event binding
 */
export function getRunButton(): HTMLButtonElement {
  return runButton;
}

/**
 * Run backtest with current settings
 */
export function runBacktest(
  candles: NormalizedCandle[],
  mainChart: echarts.ECharts
): void {
  if (candles.length === 0) {
    alert('Please load data first');
    return;
  }

  // Get entry/exit conditions
  const entryKey = entryConditionSelect.value;
  const exitKey = exitConditionSelect.value;

  const entryCondition = entryConditions[entryKey]?.();
  const exitCondition = exitConditions[exitKey]?.();

  if (!entryCondition || !exitCondition) {
    console.error('Invalid condition selected');
    return;
  }

  // Get parameters
  const capital = parseFloat(capitalInput.value) || 1000000;
  const stopLoss = parseFloat(stopLossInput.value) || undefined;
  const takeProfit = parseFloat(takeProfitInput.value) || undefined;
  const trailingStop = parseFloat(trailingStopInput.value) || undefined;

  const partialThreshold = parseFloat(partialThresholdInput.value) || undefined;
  const partialSellPercent = parseFloat(partialSellPercentInput.value) || 50;

  // Get cost and date parameters
  const commissionRate = parseFloat(commissionRateInput.value) || 0;
  const taxRate = parseFloat(taxRateInput.value) || 0;
  const startDateStr = startDateInput.value;

  // Filter candles by start date
  let filteredCandles = candles;
  if (startDateStr) {
    const startTime = new Date(startDateStr).getTime();
    filteredCandles = candles.filter(c => c.time >= startTime);
  }

  if (filteredCandles.length < 50) {
    alert(`Not enough data after start date filter (${filteredCandles.length} candles). Need at least 50.`);
    return;
  }

  // Build options
  const options: TrendCraft.BacktestOptions = {
    capital,
    stopLoss,
    takeProfit,
    trailingStop,
    commissionRate,
    taxRate,
  };

  if (partialThreshold !== undefined) {
    options.partialTakeProfit = {
      threshold: partialThreshold,
      sellPercent: partialSellPercent,
    };
  }

  // Run backtest using TrendCraft fluent API
  try {
    backtestResult = TrendCraft.TrendCraft.from(filteredCandles)
      .strategy()
      .entry(entryCondition)
      .exit(exitCondition)
      .backtest(options);

    // Update UI
    updateBacktestResults();
    updateEquityChart(candles);
    updateTradesTable();
    updateChartWithTradeMarkers(candles, mainChart);
  } catch (error) {
    console.error('Backtest error:', error);
    alert('Backtest failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Update backtest results display
 */
function updateBacktestResults(): void {
  if (!backtestResult) return;

  // Update result values
  const setResult = (id: string, value: string, isPositive?: boolean) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
      el.classList.remove('positive', 'negative');
      if (isPositive !== undefined) {
        el.classList.add(isPositive ? 'positive' : 'negative');
      }
    }
  };

  const returnPercent = backtestResult.totalReturnPercent;
  setResult('resultReturn', `${returnPercent >= 0 ? '+' : ''}${returnPercent.toFixed(1)}%`, returnPercent >= 0);
  setResult('resultWinRate', `${backtestResult.winRate.toFixed(0)}%`);
  setResult('resultTrades', backtestResult.tradeCount.toString());
  setResult('resultDD', `-${backtestResult.maxDrawdown.toFixed(1)}%`, false);
  setResult('resultSharpe', backtestResult.sharpeRatio.toFixed(2));
  setResult('resultPF', backtestResult.profitFactor.toFixed(2));

  resultsContainer.classList.add('visible');
}

/**
 * Update equity curve chart
 */
function updateEquityChart(candles: NormalizedCandle[]): void {
  if (!backtestResult || backtestResult.trades.length === 0) return;

  const equityChartEl = document.getElementById('equity-chart') as HTMLDivElement;
  equityChartEl.classList.add('visible');

  if (!equityChart) {
    equityChart = echarts.init(equityChartEl, 'dark');
    window.addEventListener('resize', () => equityChart?.resize());
  }

  // Build equity curve data
  const capital = parseFloat(capitalInput.value) || 1000000;
  const equityData: Array<{ time: number; equity: number }> = [];

  // Start with initial capital
  const firstTradeTime = backtestResult.trades[0].entryTime;
  const startTime = candles.find(c => c.time >= firstTradeTime)?.time ?? firstTradeTime;
  equityData.push({ time: startTime, equity: capital });

  let currentEquity = capital;
  for (const trade of backtestResult.trades) {
    currentEquity += trade.return;
    equityData.push({ time: trade.exitTime, equity: currentEquity });
  }

  const dates = equityData.map(d => formatDate(d.time));
  const equityValues = equityData.map(d => d.equity);

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    animation: false,
    title: {
      text: 'Equity Curve',
      left: 10,
      top: 5,
      textStyle: { color: '#888', fontSize: 12, fontWeight: 'normal' },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const value = p.value as number;
        return `${p.name}<br/>Equity: ${value.toLocaleString()}`;
      },
    },
    grid: { left: 80, right: 30, top: 35, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#666' } },
      axisLabel: { color: '#888', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#666' } },
      splitLine: { lineStyle: { color: '#333' } },
      axisLabel: {
        color: '#888',
        formatter: (value: number) => {
          if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
          if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
          return value.toString();
        },
      },
    },
    series: [
      {
        name: 'Equity',
        type: 'line',
        data: equityValues,
        smooth: false,
        showSymbol: true,
        symbolSize: 6,
        lineStyle: { width: 2, color: '#4ecdc4' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(78, 205, 196, 0.4)' },
            { offset: 1, color: 'rgba(78, 205, 196, 0.05)' },
          ]),
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#888', type: 'dashed', width: 1 },
          label: { show: true, position: 'end', color: '#888', fontSize: 10 },
          data: [
            { yAxis: capital, label: { formatter: 'Initial' } },
          ],
        },
      },
    ],
    dataZoom: [{ type: 'inside', start: 0, end: 100 }],
  };

  equityChart.setOption(option, true);
}

/**
 * Update trades table
 */
function updateTradesTable(): void {
  if (!backtestResult || backtestResult.trades.length === 0) {
    tradesPanel.classList.remove('visible');
    return;
  }

  tradesPanel.classList.add('visible');

  const tableEl = document.getElementById('tradesTable') as HTMLDivElement;

  // Sort trades by exit time descending (newest first)
  const sortedTrades = [...backtestResult.trades].sort((a, b) => b.exitTime - a.exitTime);

  const rows = sortedTrades.map((trade) => {
    const isWin = trade.return > 0;
    const cssClass = isWin ? 'win' : 'loss';
    const returnStr = `${isWin ? '+' : ''}${trade.returnPercent.toFixed(1)}%`;
    const partialLabel = trade.isPartial ? ' (Partial)' : '';

    return `
      <div class="trade-row ${cssClass}">
        <span class="trade-date">${formatDate(trade.entryTime)} → ${formatDate(trade.exitTime)}</span>
        <span class="trade-days">${trade.holdingDays}d</span>
        <span class="trade-entry">${trade.entryPrice.toFixed(0)}</span>
        <span class="trade-exit">${trade.exitPrice.toFixed(0)}</span>
        <span class="trade-return">${returnStr}${partialLabel}</span>
      </div>
    `;
  }).join('');

  // Header
  tableEl.innerHTML = `
    <div class="trade-row header">
      <span class="trade-date">Period</span>
      <span class="trade-days">Days</span>
      <span class="trade-entry">Entry</span>
      <span class="trade-exit">Exit</span>
      <span class="trade-return">Return</span>
    </div>
    ${rows}
  `;
}

/**
 * Add trade markers to main chart
 */
export function updateChartWithTradeMarkers(
  candles: NormalizedCandle[],
  mainChart: echarts.ECharts
): void {
  if (!backtestResult || backtestResult.trades.length === 0) return;

  // Build time to index map
  const timeToIdx = new Map<number, number>();
  candles.forEach((c, i) => timeToIdx.set(c.time, i));

  // Get dates for coordinate lookup
  const dates = candles.map(c => formatDate(c.time));

  // Create mark points for entries and exits
  const markPointData: Array<{
    name: string;
    coord: [string, number];
    symbol: string;
    symbolSize: number;
    symbolRotate?: number;
    itemStyle: { color: string };
    label: { show: boolean; formatter: string; color: string; fontSize: number; position: 'inside' | 'top' | 'bottom' };
  }> = [];

  for (const trade of backtestResult.trades) {
    // Entry marker
    const entryIdx = timeToIdx.get(trade.entryTime);
    if (entryIdx !== undefined) {
      const entryCandle = candles[entryIdx];
      markPointData.push({
        name: 'Entry',
        coord: [dates[entryIdx], entryCandle.low * 0.995],
        symbol: 'triangle',
        symbolSize: 14,
        itemStyle: { color: '#26a69a' },
        label: {
          show: true,
          formatter: 'B',
          color: '#fff',
          fontSize: 8,
          position: 'inside',
        },
      });
    }

    // Exit marker
    const exitIdx = timeToIdx.get(trade.exitTime);
    if (exitIdx !== undefined) {
      const exitCandle = candles[exitIdx];
      const isPartial = trade.isPartial;
      markPointData.push({
        name: isPartial ? 'Partial Exit' : 'Exit',
        coord: [dates[exitIdx], exitCandle.high * 1.005],
        symbol: 'triangle',
        symbolSize: isPartial ? 10 : 14,
        symbolRotate: 180,
        itemStyle: { color: isPartial ? '#ffd93d' : '#ef5350' },
        label: {
          show: true,
          formatter: isPartial ? 'P' : 'S',
          color: isPartial ? '#000' : '#fff',
          fontSize: 8,
          position: 'inside',
        },
      });
    }
  }

  // Update chart with mark points - merge with existing markPoint data
  const option = mainChart.getOption() as echarts.EChartsOption;
  const series = option.series as echarts.SeriesOption[];

  // Find candlestick series
  const candlestickSeries = series?.find(s => s.name === 'Candlestick') as echarts.CandlestickSeriesOption | undefined;
  if (candlestickSeries) {
    // Get existing markPoint data (e.g., Perfect Order signals) and filter out old trade markers
    type MarkPointItem = { name?: string; [key: string]: unknown };
    const existingData = (candlestickSeries.markPoint?.data || []) as MarkPointItem[];
    const existingMarkPointData = existingData.filter(
      mp => mp.name !== 'Entry' && mp.name !== 'Exit' && mp.name !== 'Partial Exit'
    );

    // Merge existing data with new trade markers
    candlestickSeries.markPoint = {
      data: [...existingMarkPointData, ...markPointData] as echarts.MarkPointComponentOption['data'],
    };
    mainChart.setOption({ series });
  }
}

/**
 * Clear trade markers from main chart (preserves other markers like Perfect Order signals)
 */
export function clearTradeMarkers(mainChart: echarts.ECharts): void {
  const option = mainChart.getOption() as echarts.EChartsOption;
  const series = option.series as echarts.SeriesOption[];

  const candlestickSeries = series?.find(s => s.name === 'Candlestick') as echarts.CandlestickSeriesOption | undefined;
  if (candlestickSeries) {
    // Keep existing markPoint data but remove trade markers
    type MarkPointItem = { name?: string; [key: string]: unknown };
    const existingData = (candlestickSeries.markPoint?.data || []) as MarkPointItem[];
    const existingMarkPointData = existingData.filter(
      mp => mp.name !== 'Entry' && mp.name !== 'Exit' && mp.name !== 'Partial Exit'
    );

    if (existingMarkPointData.length > 0) {
      candlestickSeries.markPoint = { data: existingMarkPointData as echarts.MarkPointComponentOption['data'] };
    } else {
      candlestickSeries.markPoint = undefined;
    }
    mainChart.setOption({ series });
  }

  hideBacktestResults();
}

/**
 * Get current backtest result
 */
export function getBacktestResult(): BacktestResult | null {
  return backtestResult;
}

/**
 * Resize equity chart
 */
export function resizeEquityChart(): void {
  equityChart?.resize();
}
