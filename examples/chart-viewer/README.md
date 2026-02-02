# Chart Viewer

A chart visualization tool for the TrendCraft library. Displays candlestick charts with technical indicators, signal detection, and backtest results.

## Tech Stack

- **React 18** - UI framework
- **Vite 6** - Build tool
- **ECharts 5** - Charting library (via echarts-for-react)
- **Zustand 5** - State management
- **TypeScript 5** - Type system

## Directory Structure

```
src/
├── main.tsx               # Entry point
├── components/            # UI components
│   ├── App.tsx            # Main application
│   ├── MainChart.tsx      # ECharts chart display
│   ├── FileDropZone.tsx   # CSV file drop zone
│   ├── TimeframeSelector.tsx      # Daily/Weekly/Monthly toggle
│   ├── IndicatorSettingsDialog.tsx # Parameter settings dialog
│   ├── SignalsPanel.tsx   # Signal detection panel
│   └── BacktestPanel.tsx  # Backtest config & results panel
├── hooks/                 # Custom hooks
│   ├── useIndicators.ts   # Subchart indicator calculations
│   ├── useOverlays.ts     # Overlay indicator calculations
│   ├── useSignals.ts      # Signal detection
│   └── useBacktest.ts     # Backtest execution
├── store/                 # State management
│   └── chartStore.ts      # Zustand store
├── utils/                 # Utilities
│   ├── chartConfig.ts     # ECharts option builder
│   ├── fileParser.ts      # CSV parser
│   ├── signalMarkers.ts   # Signal marker generation
│   └── backtestMarkers.ts # Backtest marker generation
└── types/                 # Type definitions
    └── index.ts           # All type definitions
```

## Chart Layout Specification

```
┌─────────────────────────────────────────┐
│ Main Legend (top: 10px)                 │  Main chart legend
├─────────────────────────────────────────┤
│                                         │
│ Main Chart (top: 40px, height: 300px)   │  Candlestick + Overlays
│                                         │
├─────────────────────────────────────────┤
│ Volume (height: 80px)                   │  Volume bars
├─────────────────────────────────────────┤
│ DataZoom Slider (height: 30px)          │  Time range slider
├─────────────────────────────────────────┤
│ [gap: 20px]                             │
├─────────────────────────────────────────┤
│ Subchart Title │ Legend                 │  Title + Legend (26px)
│ Subchart (height: 70px)                 │  Indicator chart
├─────────────────────────────────────────┤
│ [gap: 20px]                             │
├─────────────────────────────────────────┤
│ Subchart Title │ Legend                 │
│ Subchart (height: 70px)                 │
└─────────────────────────────────────────┘
```

### Layout Constants (chartConfig.ts)

| Constant | Value | Description |
|----------|-------|-------------|
| `mainHeight` | 300px | Main chart height |
| `volumeHeight` | 80px | Volume chart height |
| `dataZoomHeight` | 30px | DataZoom slider height |
| `subHeight` | 70px | Subchart height |
| `labelHeight` | 26px | Subchart title height |
| `subChartGap` | 20px | Gap between subcharts |
| `dataZoomGap` | 20px | Gap between DataZoom and subcharts |

## Indicator List

### Overlays (displayed on main chart)

| Category | Types | Type Names |
|----------|-------|------------|
| Moving Averages | SMA 5, SMA 25, SMA 75, EMA 12, EMA 26, WMA 20 | `sma5`, `sma25`, `sma75`, `ema12`, `ema26`, `wma20` |
| Bands | Bollinger Bands, Donchian Channel, Keltner Channel | `bb`, `donchian`, `keltner` |
| Trend | Ichimoku, Supertrend, Parabolic SAR | `ichimoku`, `supertrend`, `psar` |

### Subcharts (displayed below main chart)

| Category | Types | Type Names |
|----------|-------|------------|
| Momentum | RSI, MACD, Stochastics, DMI/ADX, Stoch RSI, CCI, Williams %R, ROC | `rsi`, `macd`, `stochastics`, `dmi`, `stochrsi`, `cci`, `williams`, `roc` |
| Volume | MFI, OBV, CMF, Volume Anomaly, Volume Profile, Volume Trend | `mfi`, `obv`, `cmf`, `volumeAnomaly`, `volumeProfile`, `volumeTrend` |
| Other | Range-Bound | `rangebound` |

### Signals

| Type | Type Name | Description |
|------|-----------|-------------|
| Perfect Order | `perfectOrder` | Moving average perfect order detection |
| Range Bound | `rangeBound` | Range market detection with support/resistance lines |
| Cross | `cross` | Golden cross / Death cross detection |

## State Management (Zustand Store)

### ChartState

```typescript
interface ChartState {
  // Data
  rawCandles: NormalizedCandle[];      // Original data (daily)
  currentCandles: NormalizedCandle[];  // Timeframe-converted data
  fileName: string;                    // Loaded file name

  // Display settings
  timeframe: "daily" | "weekly" | "monthly";
  enabledIndicators: SubChartType[];   // Enabled subcharts
  enabledOverlays: OverlayType[];      // Enabled overlays
  enabledSignals: SignalType[];        // Enabled signals
  zoomRange: { start: number; end: number };  // DataZoom range
  indicatorParams: IndicatorParams;    // Parameter settings

  // UI state
  sidebarCollapsed: boolean;

  // Backtest
  backtestConfig: BacktestConfig;
  backtestResult: BacktestResult | null;
  isBacktestRunning: boolean;
}
```

### Main Actions

- `loadCandles(candles, fileName)` - Load candlestick data
- `setTimeframe(timeframe)` - Switch timeframe (auto-converts)
- `setEnabledIndicators(indicators)` - Enable subcharts
- `setEnabledOverlays(overlays)` - Enable overlays
- `setIndicatorParams(params)` - Update parameters
- `setBacktestConfig(config)` - Update backtest configuration

## Data Format

### Input (CSV file)

```csv
date,open,high,low,close,volume
2024-01-01,100.0,105.0,99.0,104.0,1000000
```

### Internal Format (NormalizedCandle)

```typescript
interface NormalizedCandle {
  time: number;    // Unix timestamp (milliseconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Start dev server (http://localhost:5173)
pnpm dev

# Production build
pnpm build

# Preview build
pnpm preview
```

## Data Loading

### Method 1: CSV File (Drag & Drop)

1. Drag & drop CSV file
2. Parse to `NormalizedCandle[]` via `fileParser.ts`
3. Save to store via `chartStore.loadCandles()`
4. Convert via `toWeeklyCandles()` / `toMonthlyCandles()` based on timeframe

### Method 2: postMessage API (Cross-Domain)

Chart Viewer can receive data from a parent window via `postMessage`. This enables:
- Embedding in dashboards as an iframe
- Opening as a popup window from external sites
- Using as a shared chart viewer hosted on GitHub Pages

#### Message Format

```typescript
interface ChartDataMessage {
  type: "LOAD_CHART_DATA";
  candles: NormalizedCandle[];
  fundamentals?: { per: (number | null)[]; pbr: (number | null)[] } | null;
  fileName?: string;
}
```

#### Usage with window.open()

```javascript
// Open chart-viewer in a new window
const popup = window.open('http://localhost:5173/', 'chart-viewer', 'width=1200,height=800');

// Wait for "CHART_VIEWER_READY" message
window.addEventListener('message', (event) => {
  if (event.data?.type === 'CHART_VIEWER_READY') {
    console.log('chart-viewer is ready!');

    // Send chart data
    popup.postMessage({
      type: 'LOAD_CHART_DATA',
      candles: [
        { time: 1704067200000, open: 100, high: 105, low: 98, close: 103, volume: 10000 },
        { time: 1704153600000, open: 103, high: 110, low: 102, close: 108, volume: 12000 },
        // ...
      ],
      fileName: 'My Stock Data'
    }, '*');
  }
});
```

#### Usage with iframe

```html
<iframe id="chart" src="https://your-chart-viewer.com" width="100%" height="600"></iframe>

<script>
const iframe = document.getElementById('chart');

// Wait for ready message
window.addEventListener('message', (event) => {
  if (event.data?.type === 'CHART_VIEWER_READY') {
    iframe.contentWindow.postMessage({
      type: 'LOAD_CHART_DATA',
      candles: [...],
      fileName: 'AAPL'
    }, '*');
  }
});
</script>
```

#### Messages

| Message Type | Direction | Description |
|-------------|-----------|-------------|
| `CHART_VIEWER_READY` | chart-viewer → parent | Sent when chart-viewer is ready to receive data |
| `LOAD_CHART_DATA` | parent → chart-viewer | Send candlestick data to display |

## Chart Option Builder

`buildChartOption()` in `chartConfig.ts` generates ECharts options:

```typescript
buildChartOption(
  candles: NormalizedCandle[],        // Candlestick data
  indicators: IndicatorData,          // Subchart data
  enabledIndicators: SubChartType[],  // Enabled subcharts
  signals: SignalData | null,         // Signal data
  enabledSignals: SignalType[],       // Enabled signals
  trades: Trade[] | null,             // Backtest trades
  overlays: OverlayData,              // Overlay data
  enabledOverlays: OverlayType[],     // Enabled overlays
  chartHeight: number                 // Chart height
): EChartsOption
```

## Color Palette

Main color definitions (`COLORS` constant in `chartConfig.ts`):

| Usage | Color |
|-------|-------|
| Bullish (up) | `#26a69a` |
| Bearish (down) | `#ef5350` |
| RSI | `#f59e0b` |
| MACD Line | `#3b82f6` |
| SMA 5/25/75 | `#ff6b6b` / `#ffd93d` / `#c44dff` |
| Bollinger Bands | `#6bcb77` |
| Ichimoku Tenkan/Kijun | `#e74c3c` / `#3498db` |
