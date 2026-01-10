import type { NormalizedCandle } from "trendcraft";
import type { IndicatorData } from "../utils/indicators";

export type { NormalizedCandle };

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export type SimulatorPhase = "setup" | "running" | "finished";

// ===========================================
// 複数銘柄対応
// ===========================================

/**
 * 銘柄ごとのセッションデータ
 * 各銘柄は独自のローソク足データ、ポジション、取引履歴を持つ
 */
export interface SymbolSession {
  id: string;                        // UUID
  fileName: string;
  allCandles: NormalizedCandle[];
  positions: Position[];
  tradeHistory: Trade[];
  indicatorData: IndicatorData | null;
  equityCurve: EquityPoint[];
  // 銘柄固有の開始インデックス（共通日付範囲内での位置）
  startIndex: number;
}

/**
 * 全銘柄で共通の日付範囲
 * 複数銘柄のCSVをロードした場合、共通する日付のみでシミュレーション
 */
export interface CommonDateRange {
  startDate: number;
  endDate: number;
  dates: number[];              // 共通日付の配列（ソート済み）
}

/**
 * ポートフォリオ統計
 * 複数銘柄運用時の全体パフォーマンス
 */
export interface PortfolioStats {
  totalPnl: number;
  totalPnlPercent: number;
  symbolStats: SymbolStats[];
  aggregatedStats: AggregatedStats;
}

export interface SymbolStats {
  symbolId: string;
  fileName: string;
  pnl: number;
  pnlPercent: number;
  allocation: number;  // 配分比率 (%)
  tradeCount: number;
  winRate: number;
}

export interface AggregatedStats {
  totalTradeCount: number;
  overallWinRate: number;
  maxDrawdown: number;
  avgAlpha: number;  // vs B&H平均
}

export type PriceType = "nextOpen" | "high" | "low" | "close";

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  nextOpen: "翌日始値",
  high: "高値",
  low: "安値",
  close: "終値",
};

export interface Position {
  id: string;
  entryPrice: number;
  entryDate: number;
  entryIndex: number;
  shares: number;
  // MFE/MAE追跡用（High/Lowベース）
  highestPrice: number;
  lowestPrice: number;
  highestDate: number;
  lowestDate: number;
  // 買い時のコスト（手数料込み）
  commission: number;
  // トレーリングストップ価格（ポジションごとに追跡）
  trailingStopPrice?: number;
}

// 複数ポジションの集計情報
export interface PositionSummary {
  totalShares: number;
  avgEntryPrice: number;
  totalCost: number;
}

// 取引時点のインジケータースナップショット
export interface IndicatorSnapshot {
  sma5?: number | null;
  sma25?: number | null;
  sma75?: number | null;
  ema12?: number | null;
  ema26?: number | null;
  rsi?: number | null;
  macdLine?: number | null;
  macdSignal?: number | null;
  macdHist?: number | null;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
  atr?: number | null;
  stochK?: number | null;
  stochD?: number | null;
  dmiPlusDi?: number | null;
  dmiMinusDi?: number | null;
  dmiAdx?: number | null;
}

// チャートパターン/市場状況
export interface MarketContext {
  // トレンド状態
  trend: "uptrend" | "downtrend" | "range";
  trendStrength: "strong" | "moderate" | "weak";

  // 機械可読用（LLM分析向け）
  regime: "TREND_UP" | "TREND_DOWN" | "RANGE";
  confidence: number; // 0-1 (ADXベース、なければtrendStrengthから推定)

  // MA関係
  priceVsSma25: "above" | "below" | "at";
  priceVsSma75: "above" | "below" | "at";
  sma25VsSma75: "golden_cross" | "death_cross" | "above" | "below";

  // RSI状態
  rsiZone?: "overbought" | "oversold" | "neutral";

  // MACD状態
  macdSignal?: "bullish" | "bearish" | "neutral";

  // BB位置
  bbPosition?: "upper" | "middle" | "lower";

  // 説明テキスト
  description: string;
}

// イグジット理由
export type ExitReason =
  | "TAKE_PROFIT"   // 利確
  | "STOP_LOSS"     // 損切り
  | "SIGNAL_FLIP"   // シグナル反転
  | "TIMEOUT"       // 保有期間超過
  | "MANUAL";       // 手動判断

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  TAKE_PROFIT: "利確",
  STOP_LOSS: "損切り",
  SIGNAL_FLIP: "シグナル反転",
  TIMEOUT: "保有超過",
  MANUAL: "手動",
};

// イグジットトリガー（詳細理由）
export type ExitTrigger =
  | "TARGET_REACHED"    // 目標価格到達
  | "RSI_OVERBOUGHT"    // RSI買われすぎ
  | "RSI_OVERSOLD"      // RSI売られすぎ
  | "MACD_CROSS"        // MACDクロス
  | "MA_CROSS"          // MAクロス
  | "TRAILING_STOP"     // トレーリングストップ
  | "TIME_LIMIT"        // 時間制限
  | "DISCRETIONARY";    // 裁量判断

export const EXIT_TRIGGER_LABELS: Record<ExitTrigger, string> = {
  TARGET_REACHED: "目標到達",
  RSI_OVERBOUGHT: "RSI買われすぎ",
  RSI_OVERSOLD: "RSI売られすぎ",
  MACD_CROSS: "MACDクロス",
  MA_CROSS: "MAクロス",
  TRAILING_STOP: "トレーリングストップ",
  TIME_LIMIT: "時間超過",
  DISCRETIONARY: "裁量",
};

export interface Trade {
  id: string;
  type: "BUY" | "SELL";
  date: number;
  price: number;
  shares: number;
  memo: string;
  priceType: PriceType;
  pnl?: number;
  pnlPercent?: number;
  // 取引時点の情報（LLM分析用）
  indicators?: IndicatorSnapshot;
  marketContext?: MarketContext;
  // コスト関連
  commission?: number;       // 手数料
  slippage?: number;         // スリッページ額
  effectivePrice?: number;   // 実効価格（スリッページ込み）
  // SELL時のみ
  exitReason?: ExitReason;   // イグジット理由
  exitTrigger?: ExitTrigger; // 詳細トリガー
  grossPnl?: number;         // 粗利益（コスト前）
  netPnl?: number;           // 純利益（コスト後）
  tax?: number;              // 税金（利益がある場合のみ）
  afterTaxPnl?: number;      // 税引後損益
  // MFE/MAE（SELL時のみ）
  mfe?: number;              // 最大含み益(%)
  mae?: number;              // 最大含み損(%)
  mfePrice?: number;         // MFE時価格
  maePrice?: number;         // MAE時価格
  mfeDate?: number;          // MFE日
  maeDate?: number;          // MAE日
  mfeUtilization?: number;   // MFE活用度(%) - pnlPercent/mfe*100
}

export interface SimulationConfig {
  startDate: number;
  initialCandleCount: number;
  initialCapital: number;
  enabledIndicators: string[];
  indicatorParams: IndicatorParams;
  // コスト設定
  commissionRate: number;   // 手数料率(%, デフォルト0)
  slippageBps: number;      // スリッページ(bps, デフォルト0)
  // 税金設定
  taxRate: number;          // 譲渡益税率(%, デフォルト20.315)
  // チャート表示設定
  stopLossPercent: number;  // 損切りライン%(デフォルト5)
  takeProfitPercent: number; // 利確ライン%(デフォルト10)
  // トレーリングストップ設定
  trailingStopEnabled: boolean;   // トレーリングストップ有効
  trailingStopPercent: number;    // トレーリングストップ%(デフォルト5)
}

// ===========================================
// 予約注文（翌日始値対応）
// ===========================================

export type OrderType = "BUY" | "SELL" | "SELL_ALL";

export interface PendingOrder {
  id: string;
  symbolId: string;              // 対象銘柄
  orderType: OrderType;
  shares: number;
  memo: string;
  createdAt: number;             // 注文作成日（現在のチャート日付）
  // SELL時のみ
  exitReason?: ExitReason;
  exitTrigger?: ExitTrigger;
}

// アラート型
export type AlertType =
  | "STOP_LOSS_WARNING"
  | "TAKE_PROFIT_REACHED"
  | "TRAILING_STOP_HIT"
  | "ORDER_EXECUTED"
  | "VOLUME_SPIKE_AVERAGE"       // 平均出来高のX倍超え
  | "VOLUME_SPIKE_BREAKOUT"      // N日最高出来高更新
  | "VOLUME_ACCUMULATION"        // 出来高蓄積フェーズ検知（回帰ベース）
  | "VOLUME_ABOVE_AVERAGE"       // 出来高高水準継続（平均比較）
  | "VOLUME_MA_CROSS"            // 出来高MAクロス
  | "CMF_ACCUMULATION"           // CMF蓄積フェーズ（CMF > 0）
  | "CMF_DISTRIBUTION"           // CMF分配フェーズ（CMF < 0）
  | "OBV_RISING"                 // OBV上昇トレンド
  | "OBV_FALLING";               // OBV下降トレンド

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  timestamp: number;
}

// ===========================================
// 出来高スパイク設定
// ===========================================

export interface VolumeSpikeSettings {
  // 平均出来高検知
  averageVolumeEnabled: boolean;
  averageVolumePeriod: number;       // N日平均 (default: 20)
  averageVolumeMultiplier: number;   // X倍 (default: 2.0)
  // ブレイクアウト検知
  breakoutVolumeEnabled: boolean;
  breakoutVolumePeriod: number;      // N日最高値 (default: 20)
  // 蓄積フェーズ検知（出来高の右肩上がり - 回帰ベース）
  accumulationEnabled: boolean;
  accumulationPeriod: number;        // 傾き計算期間 (default: 10)
  accumulationMinSlope: number;      // 最小傾き (default: 0.05 = 5%/日)
  accumulationMinDays: number;       // 最小連続日数 (default: 3)
  // 高水準継続検知（平均比較ベース）
  aboveAverageEnabled: boolean;
  aboveAveragePeriod: number;        // 平均計算期間 (default: 20)
  aboveAverageMinRatio: number;      // 最小比率 (default: 1.0 = 平均以上)
  aboveAverageMinDays: number;       // 最小連続日数 (default: 3)
  // MAクロス検知
  maCrossEnabled: boolean;
  maCrossShortPeriod: number;        // 短期MA期間 (default: 5)
  maCrossLongPeriod: number;         // 長期MA期間 (default: 20)
  // CMF蓄積/分配検知
  cmfEnabled: boolean;
  cmfPeriod: number;                 // CMF計算期間 (default: 20)
  cmfThreshold: number;              // 閾値 (default: 0)
  // OBVトレンド検知
  obvEnabled: boolean;
  obvPeriod: number;                 // OBV比較期間 (default: 10)
  // 表示設定
  showRealtimeAlerts: boolean;       // リアルタイムアラート表示
  showChartMarkers: boolean;         // チャートマーカー表示
}

export const DEFAULT_VOLUME_SPIKE_SETTINGS: VolumeSpikeSettings = {
  averageVolumeEnabled: true,
  averageVolumePeriod: 20,
  averageVolumeMultiplier: 2.0,
  breakoutVolumeEnabled: true,
  breakoutVolumePeriod: 20,
  accumulationEnabled: true,
  accumulationPeriod: 10,
  accumulationMinSlope: 0.05,
  accumulationMinDays: 3,
  aboveAverageEnabled: false,
  aboveAveragePeriod: 20,
  aboveAverageMinRatio: 1.0,
  aboveAverageMinDays: 3,
  maCrossEnabled: true,
  maCrossShortPeriod: 5,
  maCrossLongPeriod: 20,
  cmfEnabled: true,
  cmfPeriod: 20,
  cmfThreshold: 0,
  obvEnabled: true,
  obvPeriod: 10,
  showRealtimeAlerts: true,
  showChartMarkers: true,
};

// 出来高スパイク検知結果
export interface DetectedVolumeSpike {
  time: number;
  volume: number;
  type: "average" | "breakout" | "accumulation" | "above_average" | "ma_cross";
  ratio: number;   // 平均比 or 前回最高比 or 正規化傾き or MA比率
  consecutiveDays?: number;  // 蓄積フェーズ/高水準継続の連続日数
}

export interface SimulatorStats {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercent: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  profitFactor: number;
}

export interface YearHighLow {
  yearHigh: number;
  yearHighDate: number;
  yearLow: number;
  yearLowDate: number;
  currentPrice: number;
  fromHigh: number; // % from year high
  fromLow: number; // % from year low
}

// Equity Curve用データポイント
export interface EquityPoint {
  time: number;
  equity: number;        // 現在資産
  buyHoldEquity: number; // B&H比較用
  drawdown: number;      // ピークからの下落%
  tradeType?: "BUY" | "SELL"; // トレードマーカー用
}

// Legacy - 後方互換性のため維持
export const AVAILABLE_INDICATORS = [
  { key: "sma5", label: "SMA 5" },
  { key: "sma25", label: "SMA 25" },
  { key: "sma75", label: "SMA 75" },
  { key: "ema12", label: "EMA 12" },
  { key: "ema26", label: "EMA 26" },
  { key: "bb", label: "Bollinger Bands" },
  { key: "rsi", label: "RSI 14" },
  { key: "macd", label: "MACD" },
  { key: "volume", label: "Volume" },
] as const;

export type IndicatorKey = (typeof AVAILABLE_INDICATORS)[number]["key"];

// カテゴリ別インジケーター定義
export type IndicatorCategory = "trend" | "volatility" | "momentum" | "volume";
export type ChartType = "overlay" | "subchart";

// インジケーターパラメータの型定義
export interface IndicatorParams {
  // SMA
  sma5Period?: number;
  sma25Period?: number;
  sma75Period?: number;
  // EMA
  ema12Period?: number;
  ema26Period?: number;
  // RSI
  rsiPeriod?: number;
  // MACD
  macdFastPeriod?: number;
  macdSlowPeriod?: number;
  macdSignalPeriod?: number;
  // Bollinger Bands
  bbPeriod?: number;
  bbStdDev?: number;
  // ATR
  atrPeriod?: number;
  // Stochastics
  stochKPeriod?: number;
  stochDPeriod?: number;
  // Stochastic RSI
  stochRsiRsiPeriod?: number;
  stochRsiStochPeriod?: number;
  stochRsiKPeriod?: number;
  stochRsiDPeriod?: number;
  // DMI
  dmiPeriod?: number;
  // CCI
  cciPeriod?: number;
  // MFI
  mfiPeriod?: number;
  // Supertrend
  supertrendPeriod?: number;
  supertrendMultiplier?: number;
  // Keltner
  keltnerEmaPeriod?: number;
  keltnerAtrPeriod?: number;
  keltnerMultiplier?: number;
  // Donchian
  donchianPeriod?: number;
}

export const DEFAULT_INDICATOR_PARAMS: IndicatorParams = {
  sma5Period: 5,
  sma25Period: 25,
  sma75Period: 75,
  ema12Period: 12,
  ema26Period: 26,
  rsiPeriod: 14,
  macdFastPeriod: 12,
  macdSlowPeriod: 26,
  macdSignalPeriod: 9,
  bbPeriod: 20,
  bbStdDev: 2,
  atrPeriod: 14,
  stochKPeriod: 14,
  stochDPeriod: 3,
  stochRsiRsiPeriod: 14,
  stochRsiStochPeriod: 14,
  stochRsiKPeriod: 3,
  stochRsiDPeriod: 3,
  dmiPeriod: 14,
  cciPeriod: 20,
  mfiPeriod: 14,
  supertrendPeriod: 10,
  supertrendMultiplier: 3,
  keltnerEmaPeriod: 20,
  keltnerAtrPeriod: 10,
  keltnerMultiplier: 2,
  donchianPeriod: 20,
};

// パラメータ設定可能なインジケーターの定義
export interface ParamConfig {
  key: keyof IndicatorParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const INDICATOR_PARAM_CONFIGS: Record<string, ParamConfig[]> = {
  sma5: [{ key: "sma5Period", label: "期間", min: 2, max: 200, step: 1 }],
  sma25: [{ key: "sma25Period", label: "期間", min: 2, max: 200, step: 1 }],
  sma75: [{ key: "sma75Period", label: "期間", min: 2, max: 200, step: 1 }],
  ema12: [{ key: "ema12Period", label: "期間", min: 2, max: 200, step: 1 }],
  ema26: [{ key: "ema26Period", label: "期間", min: 2, max: 200, step: 1 }],
  rsi: [{ key: "rsiPeriod", label: "期間", min: 2, max: 50, step: 1 }],
  macd: [
    { key: "macdFastPeriod", label: "Fast", min: 2, max: 50, step: 1 },
    { key: "macdSlowPeriod", label: "Slow", min: 2, max: 100, step: 1 },
    { key: "macdSignalPeriod", label: "Signal", min: 2, max: 50, step: 1 },
  ],
  bb: [
    { key: "bbPeriod", label: "期間", min: 2, max: 100, step: 1 },
    { key: "bbStdDev", label: "標準偏差", min: 0.5, max: 4, step: 0.5 },
  ],
  atr: [{ key: "atrPeriod", label: "期間", min: 2, max: 50, step: 1 }],
  stochastics: [
    { key: "stochKPeriod", label: "K期間", min: 2, max: 50, step: 1 },
    { key: "stochDPeriod", label: "D期間", min: 2, max: 20, step: 1 },
  ],
  stochRsi: [
    { key: "stochRsiRsiPeriod", label: "RSI期間", min: 2, max: 50, step: 1 },
    { key: "stochRsiStochPeriod", label: "Stoch期間", min: 2, max: 50, step: 1 },
    { key: "stochRsiKPeriod", label: "K", min: 2, max: 20, step: 1 },
    { key: "stochRsiDPeriod", label: "D", min: 2, max: 20, step: 1 },
  ],
  dmi: [{ key: "dmiPeriod", label: "期間", min: 2, max: 50, step: 1 }],
  cci: [{ key: "cciPeriod", label: "期間", min: 2, max: 100, step: 1 }],
  mfi: [{ key: "mfiPeriod", label: "期間", min: 2, max: 50, step: 1 }],
  supertrend: [
    { key: "supertrendPeriod", label: "期間", min: 2, max: 50, step: 1 },
    { key: "supertrendMultiplier", label: "乗数", min: 1, max: 10, step: 0.5 },
  ],
  keltner: [
    { key: "keltnerEmaPeriod", label: "EMA期間", min: 2, max: 100, step: 1 },
    { key: "keltnerAtrPeriod", label: "ATR期間", min: 2, max: 50, step: 1 },
    { key: "keltnerMultiplier", label: "乗数", min: 0.5, max: 5, step: 0.5 },
  ],
  donchian: [{ key: "donchianPeriod", label: "期間", min: 2, max: 100, step: 1 }],
};

export interface IndicatorDefinition {
  key: string;
  label: string;
  category: IndicatorCategory;
  chartType: ChartType;
}

export const INDICATOR_DEFINITIONS: IndicatorDefinition[] = [
  // トレンド系（オーバーレイ）
  { key: "sma5", label: "SMA 5", category: "trend", chartType: "overlay" },
  { key: "sma25", label: "SMA 25", category: "trend", chartType: "overlay" },
  { key: "sma75", label: "SMA 75", category: "trend", chartType: "overlay" },
  { key: "ema12", label: "EMA 12", category: "trend", chartType: "overlay" },
  { key: "ema26", label: "EMA 26", category: "trend", chartType: "overlay" },
  { key: "ichimoku", label: "一目均衡表", category: "trend", chartType: "overlay" },
  { key: "supertrend", label: "Supertrend", category: "trend", chartType: "overlay" },
  { key: "parabolicSar", label: "Parabolic SAR", category: "trend", chartType: "overlay" },

  // ボラティリティ系
  { key: "bb", label: "Bollinger Bands", category: "volatility", chartType: "overlay" },
  { key: "keltner", label: "Keltner Channel", category: "volatility", chartType: "overlay" },
  { key: "donchian", label: "Donchian Channel", category: "volatility", chartType: "overlay" },
  { key: "atr", label: "ATR", category: "volatility", chartType: "subchart" },

  // モメンタム系（サブチャート）
  { key: "rsi", label: "RSI", category: "momentum", chartType: "subchart" },
  { key: "macd", label: "MACD", category: "momentum", chartType: "subchart" },
  { key: "stochastics", label: "Stochastics", category: "momentum", chartType: "subchart" },
  { key: "stochRsi", label: "Stochastic RSI", category: "momentum", chartType: "subchart" },
  { key: "dmi", label: "DMI/ADX", category: "momentum", chartType: "subchart" },
  { key: "cci", label: "CCI", category: "momentum", chartType: "subchart" },

  // 出来高系（サブチャート）
  { key: "volume", label: "Volume", category: "volume", chartType: "subchart" },
  { key: "obv", label: "OBV", category: "volume", chartType: "subchart" },
  { key: "mfi", label: "MFI", category: "volume", chartType: "subchart" },
];

export const CATEGORY_LABELS: Record<IndicatorCategory, string> = {
  trend: "トレンド系",
  volatility: "ボラティリティ系",
  momentum: "モメンタム系",
  volume: "出来高系",
};

// カテゴリ順序
export const CATEGORY_ORDER: IndicatorCategory[] = ["trend", "volatility", "momentum", "volume"];

// ヘルパー関数
export function getIndicatorsByCategory(category: IndicatorCategory): IndicatorDefinition[] {
  return INDICATOR_DEFINITIONS.filter((ind) => ind.category === category);
}

export function getIndicatorDefinition(key: string): IndicatorDefinition | undefined {
  return INDICATOR_DEFINITIONS.find((ind) => ind.key === key);
}
