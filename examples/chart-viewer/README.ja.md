# Chart Viewer

TrendCraftライブラリのチャート可視化ツール。ローソク足チャートにテクニカル指標、シグナル検出、バックテスト結果を表示する。

## 技術スタック

- **React 18** - UIフレームワーク
- **Vite 6** - ビルドツール
- **ECharts 5** - チャートライブラリ (echarts-for-react経由)
- **Zustand 5** - 状態管理
- **TypeScript 5** - 型システム

## ディレクトリ構成

```
src/
├── main.tsx               # エントリーポイント
├── components/            # UIコンポーネント
│   ├── App.tsx            # メインアプリケーション
│   ├── MainChart.tsx      # EChartsチャート表示
│   ├── FileDropZone.tsx   # CSVファイルドロップエリア
│   ├── TimeframeSelector.tsx      # 日足/週足/月足切替
│   ├── IndicatorSettingsDialog.tsx # パラメータ設定ダイアログ
│   ├── SignalsPanel.tsx   # シグナル検出パネル
│   └── BacktestPanel.tsx  # バックテスト設定・結果パネル
├── hooks/                 # カスタムフック
│   ├── useIndicators.ts   # サブチャート用インジケーター計算
│   ├── useOverlays.ts     # オーバーレイ用インジケーター計算
│   ├── useSignals.ts      # シグナル検出
│   └── useBacktest.ts     # バックテスト実行
├── store/                 # 状態管理
│   └── chartStore.ts      # Zustand store
├── utils/                 # ユーティリティ
│   ├── chartConfig.ts     # ECharts設定ビルダー
│   ├── fileParser.ts      # CSVパーサー
│   ├── signalMarkers.ts   # シグナルマーカー生成
│   └── backtestMarkers.ts # バックテストマーカー生成
└── types/                 # 型定義
    └── index.ts           # 全型定義
```

## チャートレイアウト仕様

```
┌─────────────────────────────────────────┐
│ Main Legend (top: 10px)                 │  メインチャート凡例
├─────────────────────────────────────────┤
│                                         │
│ Main Chart (top: 40px, height: 300px)   │  ローソク足 + オーバーレイ
│                                         │
├─────────────────────────────────────────┤
│ Volume (height: 80px)                   │  出来高バー
├─────────────────────────────────────────┤
│ DataZoom Slider (height: 30px)          │  期間選択スライダー
├─────────────────────────────────────────┤
│ [gap: 20px]                             │
├─────────────────────────────────────────┤
│ Subchart Title │ Legend                 │  タイトル + 凡例 (26px)
│ Subchart (height: 70px)                 │  インジケーターチャート
├─────────────────────────────────────────┤
│ [gap: 20px]                             │
├─────────────────────────────────────────┤
│ Subchart Title │ Legend                 │
│ Subchart (height: 70px)                 │
└─────────────────────────────────────────┘
```

### レイアウト定数 (chartConfig.ts)

| 定数名 | 値 | 説明 |
|--------|------|------|
| `mainHeight` | 300px | メインチャート高さ |
| `volumeHeight` | 80px | 出来高チャート高さ |
| `dataZoomHeight` | 30px | DataZoomスライダー高さ |
| `subHeight` | 70px | サブチャート高さ |
| `labelHeight` | 26px | サブチャートタイトル高さ |
| `subChartGap` | 20px | サブチャート間ギャップ |
| `dataZoomGap` | 20px | DataZoomとサブチャート間ギャップ |

## インジケーター一覧

### オーバーレイ (メインチャート上に表示)

| カテゴリ | 種類 | 型名 |
|---------|------|------|
| 移動平均 | SMA 5, SMA 25, SMA 75, EMA 12, EMA 26, WMA 20 | `sma5`, `sma25`, `sma75`, `ema12`, `ema26`, `wma20` |
| バンド | Bollinger Bands, Donchian Channel, Keltner Channel | `bb`, `donchian`, `keltner` |
| トレンド | Ichimoku, Supertrend, Parabolic SAR | `ichimoku`, `supertrend`, `psar` |

### サブチャート (メインチャート下に表示)

| カテゴリ | 種類 | 型名 |
|---------|------|------|
| モメンタム | RSI, MACD, Stochastics, DMI/ADX, Stoch RSI, CCI, Williams %R, ROC | `rsi`, `macd`, `stochastics`, `dmi`, `stochrsi`, `cci`, `williams`, `roc` |
| 出来高 | MFI, OBV, CMF, Volume Anomaly, Volume Profile, Volume Trend | `mfi`, `obv`, `cmf`, `volumeAnomaly`, `volumeProfile`, `volumeTrend` |
| その他 | Range-Bound | `rangebound` |

### シグナル

| 種類 | 型名 | 説明 |
|------|------|------|
| Perfect Order | `perfectOrder` | 移動平均線のパーフェクトオーダー検出 |
| Range Bound | `rangeBound` | レンジ相場検出とサポート/レジスタンスライン |
| Cross | `cross` | ゴールデンクロス/デッドクロス検出 |

## 状態管理 (Zustand Store)

### ChartState

```typescript
interface ChartState {
  // データ
  rawCandles: NormalizedCandle[];      // 元データ (日足)
  currentCandles: NormalizedCandle[];  // 時間足変換後のデータ
  fileName: string;                    // 読み込んだファイル名

  // 表示設定
  timeframe: "daily" | "weekly" | "monthly";
  enabledIndicators: SubChartType[];   // 有効なサブチャート
  enabledOverlays: OverlayType[];      // 有効なオーバーレイ
  enabledSignals: SignalType[];        // 有効なシグナル
  zoomRange: { start: number; end: number };  // DataZoom範囲
  indicatorParams: IndicatorParams;    // パラメータ設定

  // UI状態
  sidebarCollapsed: boolean;

  // バックテスト
  backtestConfig: BacktestConfig;
  backtestResult: BacktestResult | null;
  isBacktestRunning: boolean;
}
```

### 主要アクション

- `loadCandles(candles, fileName)` - ローソク足データ読み込み
- `setTimeframe(timeframe)` - 時間足切替 (自動変換)
- `setEnabledIndicators(indicators)` - サブチャート有効化
- `setEnabledOverlays(overlays)` - オーバーレイ有効化
- `setIndicatorParams(params)` - パラメータ更新
- `setBacktestConfig(config)` - バックテスト設定更新

## データフォーマット

### 入力 (CSVファイル)

```csv
date,open,high,low,close,volume
2024-01-01,100.0,105.0,99.0,104.0,1000000
```

### 内部形式 (NormalizedCandle)

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

## 開発コマンド

```bash
# 依存関係インストール
pnpm install

# 開発サーバー起動 (http://localhost:5173)
pnpm dev

# プロダクションビルド
pnpm build

# ビルドプレビュー
pnpm preview
```

## ファイル読み込み

1. CSVファイルをドラッグ&ドロップ
2. `fileParser.ts`で`NormalizedCandle[]`に変換
3. `chartStore.loadCandles()`でストアに保存
4. 時間足に応じて`toWeeklyCandles()`/`toMonthlyCandles()`で変換

## チャート設定ビルダー

`chartConfig.ts`の`buildChartOption()`がEChartsオプションを生成:

```typescript
buildChartOption(
  candles: NormalizedCandle[],        // ローソク足データ
  indicators: IndicatorData,          // サブチャート用データ
  enabledIndicators: SubChartType[],  // 有効なサブチャート
  signals: SignalData | null,         // シグナルデータ
  enabledSignals: SignalType[],       // 有効なシグナル
  trades: Trade[] | null,             // バックテスト取引
  overlays: OverlayData,              // オーバーレイ用データ
  enabledOverlays: OverlayType[],     // 有効なオーバーレイ
  chartHeight: number                 // チャート高さ
): EChartsOption
```

## カラーパレット

主要な色定義 (`chartConfig.ts`のCOLORS定数):

| 用途 | 色 |
|------|------|
| 陽線 (up) | `#26a69a` |
| 陰線 (down) | `#ef5350` |
| RSI | `#f59e0b` |
| MACD Line | `#3b82f6` |
| SMA 5/25/75 | `#ff6b6b` / `#ffd93d` / `#c44dff` |
| Bollinger Bands | `#6bcb77` |
| Ichimoku Tenkan/Kijun | `#e74c3c` / `#3498db` |
