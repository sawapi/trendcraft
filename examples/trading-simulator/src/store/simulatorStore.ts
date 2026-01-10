import { create } from "zustand";
import type {
  NormalizedCandle,
  PlaybackSpeed,
  SimulatorPhase,
  Position,
  PositionSummary,
  Trade,
  SimulationConfig,
  YearHighLow,
  PriceType,
  IndicatorParams,
  IndicatorSnapshot,
  MarketContext,
  ExitReason,
  ExitTrigger,
  Alert,
  EquityPoint,
  SymbolSession,
  CommonDateRange,
  PortfolioStats,
  SymbolStats,
  PendingOrder,
  VolumeSpikeSettings,
  DetectedVolumeSpike,
} from "../types";
import { DEFAULT_INDICATOR_PARAMS, DEFAULT_VOLUME_SPIKE_SETTINGS } from "../types";
import { volumeAnomaly, volumeBreakout, volumeAccumulation, volumeAboveAverage, volumeMaCross, cmf, obv } from "trendcraft";
import { calculateIndicators, getIndicatorSnapshot, analyzeMarketContext, type IndicatorData } from "../utils/indicators";

// =============================================
// ヘルパー関数
// =============================================

/**
 * 複数銘柄の共通日付範囲を計算
 */
function calculateCommonDateRange(symbols: SymbolSession[]): CommonDateRange | null {
  if (symbols.length === 0) return null;

  if (symbols.length === 1) {
    // 単一銘柄の場合は全日付を使用
    const dates = symbols[0].allCandles.map(c => c.time);
    return {
      startDate: Math.min(...dates),
      endDate: Math.max(...dates),
      dates: dates.sort((a, b) => a - b),
    };
  }

  // 複数銘柄の場合は共通日付のみ
  const allDateSets = symbols.map(s => new Set(s.allCandles.map(c => c.time)));
  const firstDates = [...allDateSets[0]];
  const commonDates = firstDates.filter(d =>
    allDateSets.every(set => set.has(d))
  );

  if (commonDates.length === 0) return null;

  const sortedDates = commonDates.sort((a, b) => a - b);
  return {
    startDate: Math.min(...sortedDates),
    endDate: Math.max(...sortedDates),
    dates: sortedDates,
  };
}

/**
 * globalDateから銘柄のcurrentIndexを取得
 */
function getSymbolCurrentIndex(symbol: SymbolSession, globalDate: number): number {
  return symbol.allCandles.findIndex(c => c.time === globalDate);
}

/**
 * UUIDを生成
 */
function generateId(): string {
  return crypto.randomUUID();
}

// =============================================
// Store型定義
// =============================================

interface SimulatorState {
  // =============================================
  // 複数銘柄管理
  // =============================================
  symbols: SymbolSession[];
  activeSymbolId: string | null;

  // グローバル日付管理（全銘柄で同期）
  globalDate: number;
  commonDateRange: CommonDateRange | null;
  currentDateIndex: number;  // commonDateRange.dates内のインデックス

  // =============================================
  // 共有設定（全銘柄共通）
  // =============================================
  phase: SimulatorPhase;
  initialCandleCount: number;
  initialCapital: number;
  enabledIndicators: string[];
  indicatorParams: IndicatorParams;
  commissionRate: number;
  slippageBps: number;
  taxRate: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  trailingStopEnabled: boolean;
  trailingStopPercent: number;

  // =============================================
  // 出来高スパイク設定
  // =============================================
  volumeSpikeSettings: VolumeSpikeSettings;

  // =============================================
  // 再生状態
  // =============================================
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;

  // =============================================
  // アラート（全銘柄共通）
  // =============================================
  alerts: Alert[];

  // =============================================
  // 予約注文（翌日始値用）
  // =============================================
  pendingOrders: PendingOrder[];

  // =============================================
  // 後方互換性のためのエイリアス（アクティブ銘柄を参照）
  // =============================================
  readonly fileName: string;
  readonly allCandles: NormalizedCandle[];
  readonly positions: Position[];
  readonly tradeHistory: Trade[];
  readonly indicatorData: IndicatorData | null;
  readonly equityCurve: EquityPoint[];
  readonly currentIndex: number;
  readonly startIndex: number;

  // =============================================
  // 銘柄管理アクション
  // =============================================
  createSymbolSession: (candles: NormalizedCandle[], fileName: string) => string;
  closeSymbolSession: (symbolId: string) => void;
  switchSymbol: (symbolId: string) => void;
  nextSymbol: () => void;
  previousSymbol: () => void;
  getActiveSymbol: () => SymbolSession | null;
  getAllSymbols: () => SymbolSession[];

  // =============================================
  // 既存アクション
  // =============================================
  loadCandles: (candles: NormalizedCandle[], fileName: string) => void;
  startSimulation: (config: SimulationConfig) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  stepForward: () => boolean;
  stepBackward: () => void;
  executeBuy: (shares: number, memo: string, priceType: PriceType) => void;
  executeSell: (shares: number, memo: string, priceType: PriceType, exitReason: ExitReason, exitTrigger?: ExitTrigger) => void;
  executeSellAll: (memo: string, priceType: PriceType, exitReason: ExitReason, exitTrigger?: ExitTrigger) => void;

  // 予約注文関連
  placePendingOrder: (order: Omit<PendingOrder, "id" | "createdAt">) => void;
  cancelPendingOrder: (orderId: string) => void;
  getPendingOrdersForSymbol: (symbolId: string) => PendingOrder[];
  executePendingOrders: () => void;  // 内部用：stepForwardから呼ばれる
  updatePositionMFEMAE: () => void;
  getNextCandle: () => NormalizedCandle | null;
  skip: () => void;
  reset: () => void;
  finishSimulation: () => void;
  jumpToIndex: (index: number) => void;
  dismissAlert: (id: string) => void;

  // =============================================
  // インジケーター設定
  // =============================================
  setEnabledIndicators: (indicators: string[]) => void;
  setIndicatorParams: (params: IndicatorParams) => void;

  // =============================================
  // 出来高スパイク設定
  // =============================================
  setVolumeSpikeSettings: (settings: Partial<VolumeSpikeSettings>) => void;
  getDetectedVolumeSpikes: () => DetectedVolumeSpike[];

  // =============================================
  // Computed
  // =============================================
  getCurrentCandle: () => NormalizedCandle | null;
  getVisibleCandles: () => NormalizedCandle[];
  getUnrealizedPnl: () => { pnl: number; pnlPercent: number } | null;
  getPositionSummary: () => PositionSummary | null;
  getTotalPnl: () => number;
  getYearHighLow: () => YearHighLow | null;
  getHoldingDays: () => number | null;
  getEquityCurve: () => EquityPoint[];
  updateEquityCurve: () => void;

  // =============================================
  // ポートフォリオ統計
  // =============================================
  getPortfolioStats: () => PortfolioStats | null;
}

export const useSimulatorStore = create<SimulatorState>((set, get) => {
  // =============================================
  // アクティブ銘柄を取得するヘルパー
  // =============================================
  const getActiveSymbolInternal = (): SymbolSession | null => {
    const { symbols, activeSymbolId } = get();
    if (!activeSymbolId) return symbols[0] || null;
    return symbols.find(s => s.id === activeSymbolId) || null;
  };

  // =============================================
  // アクティブ銘柄のcurrentIndexを計算
  // =============================================
  const getActiveCurrentIndex = (): number => {
    const symbol = getActiveSymbolInternal();
    const { commonDateRange, currentDateIndex } = get();

    if (!symbol) return 0;
    if (!commonDateRange) return 0;

    // commonDateRange.dates[currentDateIndex] がglobalDate
    const targetDate = commonDateRange.dates[currentDateIndex];
    if (!targetDate) return 0;

    return symbol.allCandles.findIndex(c => c.time === targetDate);
  };

  return {
    // =============================================
    // 初期状態
    // =============================================
    symbols: [],
    activeSymbolId: null,
    globalDate: 0,
    commonDateRange: null,
    currentDateIndex: 0,

    phase: "setup",
    initialCandleCount: 250,
    initialCapital: 1000000,
    enabledIndicators: [],
    indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },
    commissionRate: 0,
    slippageBps: 0,
    taxRate: 20.315,
    stopLossPercent: 5,
    takeProfitPercent: 10,
    trailingStopEnabled: false,
    trailingStopPercent: 5,
    volumeSpikeSettings: { ...DEFAULT_VOLUME_SPIKE_SETTINGS },
    isPlaying: false,
    playbackSpeed: 1,
    alerts: [],
    pendingOrders: [],

    // =============================================
    // 後方互換性のためのgetterエイリアス
    // =============================================
    get fileName() {
      const symbol = getActiveSymbolInternal();
      return symbol?.fileName || "";
    },
    get allCandles() {
      const symbol = getActiveSymbolInternal();
      return symbol?.allCandles || [];
    },
    get positions() {
      const symbol = getActiveSymbolInternal();
      return symbol?.positions || [];
    },
    get tradeHistory() {
      const symbol = getActiveSymbolInternal();
      return symbol?.tradeHistory || [];
    },
    get indicatorData() {
      const symbol = getActiveSymbolInternal();
      return symbol?.indicatorData || null;
    },
    get equityCurve() {
      const symbol = getActiveSymbolInternal();
      return symbol?.equityCurve || [];
    },
    get currentIndex() {
      return getActiveCurrentIndex();
    },
    get startIndex() {
      const symbol = getActiveSymbolInternal();
      return symbol?.startIndex || 0;
    },

    // =============================================
    // 銘柄管理アクション
    // =============================================
    createSymbolSession: (candles, fileName) => {
      const id = generateId();
      const newSession: SymbolSession = {
        id,
        fileName,
        allCandles: candles,
        positions: [],
        tradeHistory: [],
        indicatorData: null,
        equityCurve: [],
        startIndex: 0,
      };

      set(state => {
        const newSymbols = [...state.symbols, newSession];
        return {
          symbols: newSymbols,
          activeSymbolId: state.activeSymbolId || id,
        };
      });

      return id;
    },

    closeSymbolSession: (symbolId) => {
      set(state => {
        const newSymbols = state.symbols.filter(s => s.id !== symbolId);
        let newActiveId = state.activeSymbolId;

        // 閉じた銘柄がアクティブだった場合、次の銘柄をアクティブに
        if (state.activeSymbolId === symbolId) {
          newActiveId = newSymbols[0]?.id || null;
        }

        // 共通日付範囲を再計算
        const newCommonDateRange = calculateCommonDateRange(newSymbols);

        return {
          symbols: newSymbols,
          activeSymbolId: newActiveId,
          commonDateRange: newCommonDateRange,
          phase: newSymbols.length === 0 ? "setup" : state.phase,
        };
      });
    },

    switchSymbol: (symbolId) => {
      set({ activeSymbolId: symbolId });
    },

    nextSymbol: () => {
      const { symbols, activeSymbolId } = get();
      if (symbols.length <= 1) return;

      const currentIdx = symbols.findIndex(s => s.id === activeSymbolId);
      const nextIdx = (currentIdx + 1) % symbols.length;
      set({ activeSymbolId: symbols[nextIdx].id });
    },

    previousSymbol: () => {
      const { symbols, activeSymbolId } = get();
      if (symbols.length <= 1) return;

      const currentIdx = symbols.findIndex(s => s.id === activeSymbolId);
      const prevIdx = currentIdx <= 0 ? symbols.length - 1 : currentIdx - 1;
      set({ activeSymbolId: symbols[prevIdx].id });
    },

    getActiveSymbol: () => getActiveSymbolInternal(),

    getAllSymbols: () => get().symbols,

    // =============================================
    // 既存アクション（後方互換性）
    // =============================================
    loadCandles: (candles, fileName) => {
      // 最初の銘柄として追加（または既存銘柄を置き換え）
      const id = generateId();
      const newSession: SymbolSession = {
        id,
        fileName,
        allCandles: candles,
        positions: [],
        tradeHistory: [],
        indicatorData: null,
        equityCurve: [],
        startIndex: 0,
      };

      set({
        symbols: [newSession],
        activeSymbolId: id,
        phase: "setup",
        commonDateRange: null,
        currentDateIndex: 0,
        globalDate: 0,
      });
    },

    startSimulation: (config) => {
      const { symbols } = get();
      if (symbols.length === 0) return;

      // 共通日付範囲を計算
      const commonDateRange = calculateCommonDateRange(symbols);
      if (!commonDateRange || commonDateRange.dates.length === 0) return;

      // 開始日のインデックスを見つける
      let startDateIdx = commonDateRange.dates.findIndex(d => d >= config.startDate);
      if (startDateIdx === -1) startDateIdx = 0;

      // 初期表示日数分前の日付から開始
      const initialIdx = Math.max(0, startDateIdx - config.initialCandleCount);
      const simStartDateIdx = Math.max(initialIdx + config.initialCandleCount, startDateIdx);

      // 各銘柄のインジケーターを計算
      const reportIndicators = new Set([
        ...config.enabledIndicators,
        "sma25", "sma75", "rsi", "macd", "bb",
      ]);

      const updatedSymbols = symbols.map(symbol => {
        const indicatorData = calculateIndicators(
          symbol.allCandles,
          Array.from(reportIndicators),
          config.indicatorParams
        );

        // 銘柄固有のstartIndexを計算
        const startDate = commonDateRange.dates[initialIdx];
        const symbolStartIdx = symbol.allCandles.findIndex(c => c.time === startDate);

        // 初期Equity Point
        const simStartDate = commonDateRange.dates[simStartDateIdx];
        const simStartCandle = symbol.allCandles.find(c => c.time === simStartDate);

        const initialEquityPoint: EquityPoint = {
          time: simStartCandle?.time || 0,
          equity: config.initialCapital,
          buyHoldEquity: config.initialCapital,
          drawdown: 0,
        };

        return {
          ...symbol,
          indicatorData,
          startIndex: symbolStartIdx >= 0 ? symbolStartIdx : 0,
          positions: [],
          tradeHistory: [],
          equityCurve: [initialEquityPoint],
        };
      });

      const globalDate = commonDateRange.dates[simStartDateIdx];

      set({
        symbols: updatedSymbols,
        phase: "running",
        initialCandleCount: config.initialCandleCount,
        initialCapital: config.initialCapital,
        enabledIndicators: config.enabledIndicators,
        indicatorParams: config.indicatorParams,
        commissionRate: config.commissionRate,
        slippageBps: config.slippageBps,
        taxRate: config.taxRate,
        stopLossPercent: config.stopLossPercent,
        takeProfitPercent: config.takeProfitPercent,
        trailingStopEnabled: config.trailingStopEnabled,
        trailingStopPercent: config.trailingStopPercent,
        alerts: [],
        isPlaying: false,
        commonDateRange,
        currentDateIndex: simStartDateIdx,
        globalDate,
      });
    },

    play: () => set({ isPlaying: true }),
    pause: () => set({ isPlaying: false }),
    togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),
    setSpeed: (speed) => set({ playbackSpeed: speed }),

    stepForward: () => {
      const { currentDateIndex, commonDateRange, stopLossPercent, takeProfitPercent, trailingStopEnabled, alerts } = get();

      if (!commonDateRange) return false;
      if (currentDateIndex >= commonDateRange.dates.length - 1) {
        set({ isPlaying: false });
        return false;
      }

      const newDateIndex = currentDateIndex + 1;
      const newGlobalDate = commonDateRange.dates[newDateIndex];

      set({
        currentDateIndex: newDateIndex,
        globalDate: newGlobalDate,
      });

      // 予約注文を実行（日付が進んだ時点の始値で約定）
      get().executePendingOrders();

      // 全銘柄のMFE/MAEを更新
      get().updatePositionMFEMAE();

      // 全銘柄のEquity Curveを更新
      get().updateEquityCurve();

      // アクティブ銘柄のアラートチェック
      const activeSymbol = getActiveSymbolInternal();
      if (activeSymbol && activeSymbol.positions.length > 0) {
        const summary = get().getPositionSummary();
        const currentIdx = getSymbolCurrentIndex(activeSymbol, newGlobalDate);
        const candle = activeSymbol.allCandles[currentIdx];

        if (summary && candle) {
          const avgEntry = summary.avgEntryPrice;
          const stopLossPrice = avgEntry * (1 - stopLossPercent / 100);
          const takeProfitPrice = avgEntry * (1 + takeProfitPercent / 100);

          // 損切りアラート
          if (candle.low <= stopLossPrice) {
            const existingAlert = alerts.find(a => a.type === "STOP_LOSS_WARNING");
            if (!existingAlert) {
              set({
                alerts: [...alerts, {
                  id: generateId(),
                  type: "STOP_LOSS_WARNING",
                  message: `損切りライン(${stopLossPrice.toLocaleString()}円, -${stopLossPercent}%)に接触しました`,
                  timestamp: Date.now(),
                }],
              });
            }
          }

          // 利確アラート
          if (candle.high >= takeProfitPrice) {
            const existingAlert = alerts.find(a => a.type === "TAKE_PROFIT_REACHED");
            if (!existingAlert) {
              set({
                alerts: [...get().alerts, {
                  id: generateId(),
                  type: "TAKE_PROFIT_REACHED",
                  message: `利確ライン(${takeProfitPrice.toLocaleString()}円, +${takeProfitPercent}%)に到達しました`,
                  timestamp: Date.now(),
                }],
              });
            }
          }

          // トレーリングストップアラート
          if (trailingStopEnabled) {
            const trailingStopPrices = activeSymbol.positions
              .filter(p => p.trailingStopPrice !== undefined)
              .map(p => p.trailingStopPrice!);

            if (trailingStopPrices.length > 0) {
              const minTrailingStop = Math.min(...trailingStopPrices);
              if (candle.low <= minTrailingStop) {
                const existingAlert = get().alerts.find(a => a.type === "TRAILING_STOP_HIT");
                if (!existingAlert) {
                  set({
                    alerts: [...get().alerts, {
                      id: generateId(),
                      type: "TRAILING_STOP_HIT",
                      message: `トレーリングストップ(${minTrailingStop.toLocaleString()}円)に到達しました`,
                      timestamp: Date.now(),
                    }],
                  });
                }
              }
            }
          }
        }
      }

      // 出来高スパイク検知（最新ローソク足のみチェック - 最適化版）
      const { volumeSpikeSettings: volSettings } = get();
      if (volSettings.showRealtimeAlerts && activeSymbol) {
        const currentIdx = getSymbolCurrentIndex(activeSymbol, newGlobalDate);
        const allCandles = activeSymbol.allCandles;

        // 平均出来高スパイク検知（最新N+1日のみ）
        if (volSettings.averageVolumeEnabled && currentIdx >= volSettings.averageVolumePeriod) {
          const lookback = volSettings.averageVolumePeriod + 1;
          const recentCandles = allCandles.slice(Math.max(0, currentIdx - lookback + 1), currentIdx + 1);
          const anomalies = volumeAnomaly(recentCandles, {
            period: volSettings.averageVolumePeriod,
            highThreshold: volSettings.averageVolumeMultiplier,
          });
          const currentAnomaly = anomalies[anomalies.length - 1];

          if (currentAnomaly && currentAnomaly.value.isAnomaly) {
            const existingAlert = get().alerts.find(a =>
              a.type === "VOLUME_SPIKE_AVERAGE" &&
              Date.now() - a.timestamp < 3000
            );
            if (!existingAlert) {
              set({
                alerts: [...get().alerts, {
                  id: generateId(),
                  type: "VOLUME_SPIKE_AVERAGE",
                  message: `出来高急増: ${currentAnomaly.value.ratio.toFixed(1)}倍 (${volSettings.averageVolumePeriod}日平均比)`,
                  timestamp: Date.now(),
                }],
              });
            }
          }
        }

        // ブレイクアウト検知（最新N+1日のみ）
        if (volSettings.breakoutVolumeEnabled && currentIdx > volSettings.breakoutVolumePeriod) {
          const lookback = volSettings.breakoutVolumePeriod + 1;
          const recentCandles = allCandles.slice(Math.max(0, currentIdx - lookback + 1), currentIdx + 1);
          const breakouts = volumeBreakout(recentCandles, {
            period: volSettings.breakoutVolumePeriod,
          });
          // 最新のローソク足がブレイクアウトかチェック
          const currentCandle = allCandles[currentIdx];
          const currentBreakout = breakouts.find(b => b.time === currentCandle.time);

          if (currentBreakout) {
            const existingAlert = get().alerts.find(a =>
              a.type === "VOLUME_SPIKE_BREAKOUT" &&
              Date.now() - a.timestamp < 3000
            );
            if (!existingAlert) {
              set({
                alerts: [...get().alerts, {
                  id: generateId(),
                  type: "VOLUME_SPIKE_BREAKOUT",
                  message: `出来高新高値: ${volSettings.breakoutVolumePeriod}日間の最高出来高を更新 (${currentBreakout.ratio.toFixed(1)}倍)`,
                  timestamp: Date.now(),
                }],
              });
            }
          }
        }

        // 蓄積フェーズ検知（最新N日のみ計算）
        if (volSettings.accumulationEnabled && currentIdx > volSettings.accumulationPeriod) {
          const lookback = volSettings.accumulationPeriod + volSettings.accumulationMinDays + 5;
          const recentCandles = allCandles.slice(Math.max(0, currentIdx - lookback + 1), currentIdx + 1);
          const accumulations = volumeAccumulation(recentCandles, {
            period: volSettings.accumulationPeriod,
            minSlope: volSettings.accumulationMinSlope,
            minConsecutiveDays: volSettings.accumulationMinDays,
          });
          const currentCandle = allCandles[currentIdx];
          const currentAccum = accumulations.find(a => a.time === currentCandle.time);

          if (currentAccum) {
            const existingAlert = get().alerts.find(a =>
              a.type === "VOLUME_ACCUMULATION" &&
              Date.now() - a.timestamp < 3000
            );
            if (!existingAlert) {
              set({
                alerts: [...get().alerts, {
                  id: generateId(),
                  type: "VOLUME_ACCUMULATION",
                  message: `蓄積フェーズ: 出来高上昇傾向 ${currentAccum.consecutiveDays}日継続`,
                  timestamp: Date.now(),
                }],
              });
            }
          }
        }

        // 高水準継続検知（平均比較ベース）
        if (volSettings.aboveAverageEnabled && currentIdx > volSettings.aboveAveragePeriod) {
          const lookback = volSettings.aboveAveragePeriod + volSettings.aboveAverageMinDays + 5;
          const recentCandles = allCandles.slice(Math.max(0, currentIdx - lookback + 1), currentIdx + 1);
          const aboveAvgSignals = volumeAboveAverage(recentCandles, {
            period: volSettings.aboveAveragePeriod,
            minRatio: volSettings.aboveAverageMinRatio,
            minConsecutiveDays: volSettings.aboveAverageMinDays,
          });
          const currentCandle = allCandles[currentIdx];
          const currentAboveAvg = aboveAvgSignals.find(a => a.time === currentCandle.time);

          if (currentAboveAvg) {
            const existingAlert = get().alerts.find(a =>
              a.type === "VOLUME_ABOVE_AVERAGE" &&
              Date.now() - a.timestamp < 3000
            );
            if (!existingAlert) {
              set({
                alerts: [...get().alerts, {
                  id: generateId(),
                  type: "VOLUME_ABOVE_AVERAGE",
                  message: `高水準継続: 平均の${(currentAboveAvg.ratio * 100).toFixed(0)}%で ${currentAboveAvg.consecutiveDays}日継続`,
                  timestamp: Date.now(),
                }],
              });
            }
          }
        }

        // MAクロス検知（最新N日のみ計算）
        if (volSettings.maCrossEnabled && currentIdx > volSettings.maCrossLongPeriod) {
          const lookback = volSettings.maCrossLongPeriod + 10;
          const recentCandles = allCandles.slice(Math.max(0, currentIdx - lookback + 1), currentIdx + 1);
          const crosses = volumeMaCross(recentCandles, {
            shortPeriod: volSettings.maCrossShortPeriod,
            longPeriod: volSettings.maCrossLongPeriod,
          });
          const currentCandle = allCandles[currentIdx];
          const currentCross = crosses.find(c => c.time === currentCandle.time && c.daysSinceCross === 1);

          if (currentCross) {
            const existingAlert = get().alerts.find(a =>
              a.type === "VOLUME_MA_CROSS" &&
              Date.now() - a.timestamp < 3000
            );
            if (!existingAlert) {
              set({
                alerts: [...get().alerts, {
                  id: generateId(),
                  type: "VOLUME_MA_CROSS",
                  message: `出来高MAクロス: 短期MA(${volSettings.maCrossShortPeriod})が長期MA(${volSettings.maCrossLongPeriod})を上抜け (${currentCross.ratio.toFixed(1)}倍)`,
                  timestamp: Date.now(),
                }],
              });
            }
          }
        }

        // CMF蓄積/分配検知（状態変化時のみ通知）
        if (volSettings.cmfEnabled && currentIdx >= volSettings.cmfPeriod + 1) {
          const lookback = volSettings.cmfPeriod + 5;
          const recentCandles = allCandles.slice(Math.max(0, currentIdx - lookback + 1), currentIdx + 1);
          const cmfData = cmf(recentCandles, { period: volSettings.cmfPeriod });
          const currentCmf = cmfData[cmfData.length - 1];
          const prevCmf = cmfData[cmfData.length - 2];

          if (currentCmf && currentCmf.value !== null && prevCmf && prevCmf.value !== null) {
            const threshold = volSettings.cmfThreshold;

            // 現在と前日の状態を判定
            const currentState = currentCmf.value > threshold ? "accumulation"
              : currentCmf.value < -threshold ? "distribution" : "neutral";
            const prevState = prevCmf.value > threshold ? "accumulation"
              : prevCmf.value < -threshold ? "distribution" : "neutral";

            // 状態が変化した場合のみ通知
            if (currentState !== prevState) {
              if (currentState === "accumulation") {
                set({
                  alerts: [...get().alerts, {
                    id: generateId(),
                    type: "CMF_ACCUMULATION",
                    message: `CMF蓄積フェーズ開始: CMF=${currentCmf.value.toFixed(3)} (閾値>${threshold})`,
                    timestamp: Date.now(),
                  }],
                });
              } else if (currentState === "distribution") {
                set({
                  alerts: [...get().alerts, {
                    id: generateId(),
                    type: "CMF_DISTRIBUTION",
                    message: `CMF分配フェーズ開始: CMF=${currentCmf.value.toFixed(3)} (閾値<${-threshold})`,
                    timestamp: Date.now(),
                  }],
                });
              }
            }
          }
        }

        // OBVトレンド検知（状態変化時のみ通知）
        if (volSettings.obvEnabled && currentIdx >= volSettings.obvPeriod + 1) {
          const lookback = volSettings.obvPeriod + 6;
          const recentCandles = allCandles.slice(Math.max(0, currentIdx - lookback + 1), currentIdx + 1);
          const obvData = obv(recentCandles);

          if (obvData.length >= volSettings.obvPeriod + 1) {
            // 現在のOBVトレンド（現在 vs N日前）
            const currentObv = obvData[obvData.length - 1]?.value;
            const pastObv = obvData[obvData.length - volSettings.obvPeriod]?.value;

            // 前日のOBVトレンド（前日 vs N+1日前）
            const prevObv = obvData[obvData.length - 2]?.value;
            const prevPastObv = obvData[obvData.length - volSettings.obvPeriod - 1]?.value;

            if (currentObv !== null && pastObv !== null && prevObv !== null && prevPastObv !== null) {
              const currentChange = currentObv - pastObv;
              const prevChange = prevObv - prevPastObv;

              // 現在と前日の状態を判定
              const currentState = currentChange > 0 ? "rising" : currentChange < 0 ? "falling" : "neutral";
              const prevState = prevChange > 0 ? "rising" : prevChange < 0 ? "falling" : "neutral";

              // 状態が変化した場合のみ通知
              if (currentState !== prevState) {
                // OBVの変化量をフォーマット（大きい数値はK/M表記）
                const formatOBVChange = (change: number): string => {
                  const absChange = Math.abs(change);
                  if (absChange >= 1000000) {
                    return `${(change / 1000000).toFixed(1)}M`;
                  } else if (absChange >= 1000) {
                    return `${(change / 1000).toFixed(0)}K`;
                  }
                  return change.toFixed(0);
                };

                if (currentState === "rising") {
                  set({
                    alerts: [...get().alerts, {
                      id: generateId(),
                      type: "OBV_RISING",
                      message: `OBV上昇トレンド転換: ${volSettings.obvPeriod}日間で+${formatOBVChange(currentChange)}`,
                      timestamp: Date.now(),
                    }],
                  });
                } else if (currentState === "falling") {
                  set({
                    alerts: [...get().alerts, {
                      id: generateId(),
                      type: "OBV_FALLING",
                      message: `OBV下降トレンド転換: ${volSettings.obvPeriod}日間で${formatOBVChange(currentChange)}`,
                      timestamp: Date.now(),
                    }],
                  });
                }
              }
            }
          }
        }
      }

      return true;
    },

    updatePositionMFEMAE: () => {
      const { symbols, globalDate, trailingStopEnabled, trailingStopPercent } = get();

      const updatedSymbols = symbols.map(symbol => {
        if (symbol.positions.length === 0) return symbol;

        const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
        const candle = symbol.allCandles[currentIdx];
        if (!candle) return symbol;

        let updated = false;
        const newPositions = symbol.positions.map(pos => {
          let newPos = pos;

          if (candle.high > pos.highestPrice) {
            newPos = { ...newPos, highestPrice: candle.high, highestDate: candle.time };
            updated = true;

            if (trailingStopEnabled) {
              const newTrailingStop = candle.high * (1 - trailingStopPercent / 100);
              if (!pos.trailingStopPrice || newTrailingStop > pos.trailingStopPrice) {
                newPos = { ...newPos, trailingStopPrice: newTrailingStop };
              }
            }
          }
          if (candle.low < pos.lowestPrice) {
            newPos = { ...newPos, lowestPrice: candle.low, lowestDate: candle.time };
            updated = true;
          }
          return newPos;
        });

        if (updated) {
          return { ...symbol, positions: newPositions };
        }
        return symbol;
      });

      set({ symbols: updatedSymbols });
    },

    stepBackward: () => {
      const { currentDateIndex, commonDateRange, initialCandleCount } = get();
      if (!commonDateRange) return;

      const minDateIndex = initialCandleCount;
      if (currentDateIndex > minDateIndex) {
        const newDateIndex = currentDateIndex - 1;
        set({
          currentDateIndex: newDateIndex,
          globalDate: commonDateRange.dates[newDateIndex],
        });
      }
    },

    executeBuy: (shares, memo, priceType) => {
      const { symbols, activeSymbolId, globalDate, commonDateRange, currentDateIndex, commissionRate, slippageBps, trailingStopEnabled, trailingStopPercent } = get();

      const symbolIdx = symbols.findIndex(s => s.id === activeSymbolId);
      if (symbolIdx === -1 || !commonDateRange) return;

      const symbol = symbols[symbolIdx];
      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);

      // Determine target candle and price
      let targetDateIndex = currentDateIndex;
      let targetIdx = currentIdx;
      let price: number;

      if (priceType === "nextOpen") {
        if (currentDateIndex >= commonDateRange.dates.length - 1) return;
        targetDateIndex = currentDateIndex + 1;
        const targetDate = commonDateRange.dates[targetDateIndex];
        targetIdx = getSymbolCurrentIndex(symbol, targetDate);
        const nextCandle = symbol.allCandles[targetIdx];
        if (!nextCandle) return;
        price = nextCandle.open;
      } else {
        const candle = symbol.allCandles[currentIdx];
        if (!candle) return;
        price = candle[priceType];
      }

      const targetCandle = symbol.allCandles[targetIdx];
      if (!targetCandle) return;

      // スリッページ・手数料計算
      const slippage = price * (slippageBps / 10000);
      const effectivePrice = price + slippage;
      const commission = effectivePrice * shares * (commissionRate / 100);

      // インジケータースナップショット
      let indicators: IndicatorSnapshot | undefined;
      let marketContext: MarketContext | undefined;

      if (symbol.indicatorData) {
        indicators = getIndicatorSnapshot(symbol.indicatorData, currentIdx);
        marketContext = analyzeMarketContext(symbol.allCandles, currentIdx, symbol.indicatorData);
      }

      // トレーリングストップ初期価格
      const initialTrailingStop = trailingStopEnabled
        ? targetCandle.high * (1 - trailingStopPercent / 100)
        : undefined;

      const newPosition: Position = {
        id: generateId(),
        entryPrice: effectivePrice,
        entryDate: targetCandle.time,
        entryIndex: targetIdx,
        shares,
        highestPrice: targetCandle.high,
        lowestPrice: targetCandle.low,
        highestDate: targetCandle.time,
        lowestDate: targetCandle.time,
        commission,
        trailingStopPrice: initialTrailingStop,
      };

      const trade: Trade = {
        id: generateId(),
        type: "BUY",
        date: targetCandle.time,
        price,
        shares,
        memo,
        priceType,
        indicators,
        marketContext,
        effectivePrice,
        slippage,
        commission,
      };

      const updatedSymbol: SymbolSession = {
        ...symbol,
        positions: [...symbol.positions, newPosition],
        tradeHistory: [...symbol.tradeHistory, trade],
      };

      const newSymbols = [...symbols];
      newSymbols[symbolIdx] = updatedSymbol;

      const targetGlobalDate = commonDateRange.dates[targetDateIndex];

      set({
        symbols: newSymbols,
        currentDateIndex: targetDateIndex,
        globalDate: targetGlobalDate,
      });
    },

    executeSell: (shares, memo, priceType, exitReason, exitTrigger) => {
      const { symbols, activeSymbolId, globalDate, commonDateRange, currentDateIndex, commissionRate, slippageBps, taxRate } = get();

      const symbolIdx = symbols.findIndex(s => s.id === activeSymbolId);
      if (symbolIdx === -1 || !commonDateRange) return;

      const symbol = symbols[symbolIdx];
      if (symbol.positions.length === 0) return;

      const summary = get().getPositionSummary();
      if (!summary || shares > summary.totalShares) return;

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);

      // Determine target candle and price
      let targetDateIndex = currentDateIndex;
      let targetIdx = currentIdx;
      let price: number;

      if (priceType === "nextOpen") {
        if (currentDateIndex >= commonDateRange.dates.length - 1) return;
        targetDateIndex = currentDateIndex + 1;
        const targetDate = commonDateRange.dates[targetDateIndex];
        targetIdx = getSymbolCurrentIndex(symbol, targetDate);
        const nextCandle = symbol.allCandles[targetIdx];
        if (!nextCandle) return;
        price = nextCandle.open;
      } else {
        const candle = symbol.allCandles[currentIdx];
        if (!candle) return;
        price = candle[priceType];
      }

      const targetCandle = symbol.allCandles[targetIdx];
      if (!targetCandle) return;

      // スリッページ・手数料計算
      const slippage = price * (slippageBps / 10000);
      const effectivePrice = price - slippage;
      const sellCommission = effectivePrice * shares * (commissionRate / 100);

      // MFE/MAE計算
      let totalMfeValue = 0;
      let totalMaeValue = 0;
      let totalBuyCommission = 0;
      let mfePrice = 0;
      let maePrice = 0;
      let mfeDate = 0;
      let maeDate = 0;
      let remainingForMFE = shares;

      for (const pos of symbol.positions) {
        if (remainingForMFE <= 0) break;
        const posShares = Math.min(pos.shares, remainingForMFE);
        const weight = posShares / shares;

        const posMfe = ((pos.highestPrice - pos.entryPrice) / pos.entryPrice) * 100;
        const posMae = ((pos.lowestPrice - pos.entryPrice) / pos.entryPrice) * 100;
        totalMfeValue += posMfe * weight;
        totalMaeValue += posMae * weight;
        totalBuyCommission += pos.commission * (posShares / pos.shares);

        if (mfePrice === 0 || pos.highestPrice > mfePrice) {
          mfePrice = pos.highestPrice;
          mfeDate = pos.highestDate;
        }
        if (maePrice === 0 || pos.lowestPrice < maePrice) {
          maePrice = pos.lowestPrice;
          maeDate = pos.lowestDate;
        }

        remainingForMFE -= posShares;
      }

      // インジケータースナップショット
      let indicators: IndicatorSnapshot | undefined;
      let marketContext: MarketContext | undefined;

      if (symbol.indicatorData) {
        indicators = getIndicatorSnapshot(symbol.indicatorData, currentIdx);
        marketContext = analyzeMarketContext(symbol.allCandles, currentIdx, symbol.indicatorData);
      }

      // P&L計算
      const grossPnl = (effectivePrice - summary.avgEntryPrice) * shares;
      const netPnl = grossPnl - totalBuyCommission - sellCommission;
      const pnlPercent = ((effectivePrice - summary.avgEntryPrice) / summary.avgEntryPrice) * 100;
      const tax = netPnl > 0 ? netPnl * (taxRate / 100) : 0;
      const afterTaxPnl = netPnl - tax;
      const mfeUtilization = totalMfeValue > 0 ? (pnlPercent / totalMfeValue) * 100 : 0;

      const trade: Trade = {
        id: generateId(),
        type: "SELL",
        date: targetCandle.time,
        price,
        shares,
        memo,
        priceType,
        pnl: afterTaxPnl,
        pnlPercent,
        indicators,
        marketContext,
        effectivePrice,
        slippage,
        commission: sellCommission,
        exitReason,
        exitTrigger,
        grossPnl,
        netPnl,
        tax,
        afterTaxPnl,
        mfe: totalMfeValue,
        mae: totalMaeValue,
        mfePrice,
        maePrice,
        mfeDate,
        maeDate,
        mfeUtilization,
      };

      // FIFO方式でポジションを削減
      let remainingSharesToSell = shares;
      const newPositions: Position[] = [];

      for (const pos of symbol.positions) {
        if (remainingSharesToSell <= 0) {
          newPositions.push(pos);
        } else if (pos.shares <= remainingSharesToSell) {
          remainingSharesToSell -= pos.shares;
        } else {
          newPositions.push({
            ...pos,
            shares: pos.shares - remainingSharesToSell,
          });
          remainingSharesToSell = 0;
        }
      }

      const updatedSymbol: SymbolSession = {
        ...symbol,
        positions: newPositions,
        tradeHistory: [...symbol.tradeHistory, trade],
      };

      const newSymbols = [...symbols];
      newSymbols[symbolIdx] = updatedSymbol;

      // ポジションが空になったらアラートもクリア
      const newAlerts = newPositions.length === 0 ? [] : get().alerts;
      const targetGlobalDate = commonDateRange.dates[targetDateIndex];

      set({
        symbols: newSymbols,
        currentDateIndex: targetDateIndex,
        globalDate: targetGlobalDate,
        alerts: newAlerts,
      });
    },

    executeSellAll: (memo, priceType, exitReason, exitTrigger) => {
      const summary = get().getPositionSummary();
      if (!summary) return;
      get().executeSell(summary.totalShares, memo, priceType, exitReason, exitTrigger);
    },

    getNextCandle: () => {
      const { commonDateRange, currentDateIndex } = get();
      const symbol = getActiveSymbolInternal();
      if (!symbol || !commonDateRange) return null;

      if (currentDateIndex >= commonDateRange.dates.length - 1) return null;

      const nextDate = commonDateRange.dates[currentDateIndex + 1];
      const nextIdx = getSymbolCurrentIndex(symbol, nextDate);
      return symbol.allCandles[nextIdx] || null;
    },

    skip: () => {
      get().stepForward();
    },

    reset: () => {
      set({
        symbols: [],
        activeSymbolId: null,
        phase: "setup",
        commonDateRange: null,
        currentDateIndex: 0,
        globalDate: 0,
        isPlaying: false,
        alerts: [],
      });
    },

    finishSimulation: () => {
      set({
        phase: "finished",
        isPlaying: false,
      });
    },

    jumpToIndex: (index: number) => {
      const { commonDateRange, initialCandleCount } = get();
      if (!commonDateRange) return;

      const minDateIndex = initialCandleCount;
      const maxDateIndex = commonDateRange.dates.length - 1;

      if (index >= minDateIndex && index <= maxDateIndex) {
        set({
          currentDateIndex: index,
          globalDate: commonDateRange.dates[index],
          isPlaying: false,
        });
      }
    },

    dismissAlert: (id: string) => {
      set(state => ({
        alerts: state.alerts.filter(a => a.id !== id),
      }));
    },

    // =============================================
    // インジケーター設定アクション
    // =============================================
    setEnabledIndicators: (indicators) => {
      const symbol = getActiveSymbolInternal();
      if (!symbol) return;

      // インジケーターデータを再計算
      const indicatorData = calculateIndicators(
        symbol.allCandles,
        indicators,
        get().indicatorParams
      );

      set(state => ({
        enabledIndicators: indicators,
        symbols: state.symbols.map(s =>
          s.id === symbol.id ? { ...s, indicatorData } : s
        ),
      }));
    },

    setIndicatorParams: (params) => {
      const symbol = getActiveSymbolInternal();
      if (!symbol) return;

      // インジケーターデータを再計算
      const indicatorData = calculateIndicators(
        symbol.allCandles,
        get().enabledIndicators,
        params
      );

      set(state => ({
        indicatorParams: params,
        symbols: state.symbols.map(s =>
          s.id === symbol.id ? { ...s, indicatorData } : s
        ),
      }));
    },

    // =============================================
    // 出来高スパイク設定アクション
    // =============================================
    setVolumeSpikeSettings: (settings) => {
      set(state => ({
        volumeSpikeSettings: { ...state.volumeSpikeSettings, ...settings },
      }));
    },

    getDetectedVolumeSpikes: () => {
      const symbol = getActiveSymbolInternal();
      const { volumeSpikeSettings, globalDate } = get();

      if (!symbol || !volumeSpikeSettings.showChartMarkers) return [];

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      const startIdx = symbol.startIndex;
      if (currentIdx < startIdx) return [];

      const visibleCandles = symbol.allCandles.slice(0, currentIdx + 1);
      const spikes: DetectedVolumeSpike[] = [];

      // 平均出来高検知
      if (volumeSpikeSettings.averageVolumeEnabled) {
        const anomalies = volumeAnomaly(visibleCandles, {
          period: volumeSpikeSettings.averageVolumePeriod,
          highThreshold: volumeSpikeSettings.averageVolumeMultiplier,
        });

        for (let i = startIdx; i <= currentIdx; i++) {
          const anomaly = anomalies[i];
          if (anomaly && anomaly.value.isAnomaly) {
            spikes.push({
              time: anomaly.time,
              volume: anomaly.value.volume,
              type: "average",
              ratio: anomaly.value.ratio,
            });
          }
        }
      }

      // ブレイクアウト検知
      if (volumeSpikeSettings.breakoutVolumeEnabled) {
        const breakouts = volumeBreakout(visibleCandles, {
          period: volumeSpikeSettings.breakoutVolumePeriod,
        });

        for (const breakout of breakouts) {
          // 可視範囲内のみ
          const idx = visibleCandles.findIndex(c => c.time === breakout.time);
          if (idx >= startIdx) {
            // 重複を避ける（同じ時間の平均検知がある場合はbreakoutを優先）
            const existingIdx = spikes.findIndex(s => s.time === breakout.time);
            if (existingIdx >= 0) {
              spikes[existingIdx] = {
                time: breakout.time,
                volume: breakout.volume,
                type: "breakout",
                ratio: breakout.ratio,
              };
            } else {
              spikes.push({
                time: breakout.time,
                volume: breakout.volume,
                type: "breakout",
                ratio: breakout.ratio,
              });
            }
          }
        }
      }

      // 蓄積フェーズ検知
      if (volumeSpikeSettings.accumulationEnabled) {
        const accumulations = volumeAccumulation(visibleCandles, {
          period: volumeSpikeSettings.accumulationPeriod,
          minSlope: volumeSpikeSettings.accumulationMinSlope,
          minConsecutiveDays: volumeSpikeSettings.accumulationMinDays,
        });

        for (const accum of accumulations) {
          const idx = visibleCandles.findIndex(c => c.time === accum.time);
          if (idx >= startIdx) {
            // 重複がない場合のみ追加
            const existingIdx = spikes.findIndex(s => s.time === accum.time);
            if (existingIdx < 0) {
              spikes.push({
                time: accum.time,
                volume: accum.volume,
                type: "accumulation",
                ratio: accum.normalizedSlope,
                consecutiveDays: accum.consecutiveDays,
              });
            }
          }
        }
      }

      // 高水準継続検知
      if (volumeSpikeSettings.aboveAverageEnabled) {
        const aboveAvgSignals = volumeAboveAverage(visibleCandles, {
          period: volumeSpikeSettings.aboveAveragePeriod,
          minRatio: volumeSpikeSettings.aboveAverageMinRatio,
          minConsecutiveDays: volumeSpikeSettings.aboveAverageMinDays,
        });

        for (const aboveAvg of aboveAvgSignals) {
          const idx = visibleCandles.findIndex(c => c.time === aboveAvg.time);
          if (idx >= startIdx) {
            // 重複がない場合のみ追加
            const existingIdx = spikes.findIndex(s => s.time === aboveAvg.time);
            if (existingIdx < 0) {
              spikes.push({
                time: aboveAvg.time,
                volume: aboveAvg.volume,
                type: "above_average",
                ratio: aboveAvg.ratio,
                consecutiveDays: aboveAvg.consecutiveDays,
              });
            }
          }
        }
      }

      // MAクロス検知
      if (volumeSpikeSettings.maCrossEnabled) {
        const crosses = volumeMaCross(visibleCandles, {
          shortPeriod: volumeSpikeSettings.maCrossShortPeriod,
          longPeriod: volumeSpikeSettings.maCrossLongPeriod,
        });

        // クロスの開始日（daysSinceCross === 1）のみマーカー表示
        for (const cross of crosses) {
          if (cross.daysSinceCross !== 1) continue;
          const idx = visibleCandles.findIndex(c => c.time === cross.time);
          if (idx >= startIdx) {
            const existingIdx = spikes.findIndex(s => s.time === cross.time);
            if (existingIdx < 0) {
              spikes.push({
                time: cross.time,
                volume: cross.volume,
                type: "ma_cross",
                ratio: cross.ratio,
              });
            }
          }
        }
      }

      return spikes;
    },

    // =============================================
    // Computed values
    // =============================================
    getCurrentCandle: () => {
      const symbol = getActiveSymbolInternal();
      const { globalDate } = get();
      if (!symbol) return null;

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      return symbol.allCandles[currentIdx] || null;
    },

    getVisibleCandles: () => {
      const symbol = getActiveSymbolInternal();
      const { globalDate } = get();
      if (!symbol) return [];

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      return symbol.allCandles.slice(symbol.startIndex, currentIdx + 1);
    },

    getUnrealizedPnl: () => {
      const symbol = getActiveSymbolInternal();
      const { globalDate } = get();
      if (!symbol || symbol.positions.length === 0) return null;

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      const currentCandle = symbol.allCandles[currentIdx];
      if (!currentCandle) return null;

      const summary = get().getPositionSummary();
      if (!summary) return null;

      const pnl = (currentCandle.close - summary.avgEntryPrice) * summary.totalShares;
      const pnlPercent = ((currentCandle.close - summary.avgEntryPrice) / summary.avgEntryPrice) * 100;

      return { pnl, pnlPercent };
    },

    getPositionSummary: () => {
      const symbol = getActiveSymbolInternal();
      if (!symbol || symbol.positions.length === 0) return null;

      const totalShares = symbol.positions.reduce((sum, p) => sum + p.shares, 0);
      const totalCost = symbol.positions.reduce((sum, p) => sum + p.entryPrice * p.shares, 0);
      const avgEntryPrice = totalCost / totalShares;

      return { totalShares, avgEntryPrice, totalCost };
    },

    getTotalPnl: () => {
      const symbol = getActiveSymbolInternal();
      if (!symbol) return 0;

      return symbol.tradeHistory
        .filter(t => t.type === "SELL" && t.pnl !== undefined)
        .reduce((sum, t) => sum + (t.pnl || 0), 0);
    },

    getYearHighLow: () => {
      const symbol = getActiveSymbolInternal();
      const { globalDate } = get();
      if (!symbol) return null;

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      const currentCandle = symbol.allCandles[currentIdx];
      if (!currentCandle) return null;

      const currentDate = new Date(currentCandle.time);
      const yearStart = new Date(currentDate.getFullYear(), 0, 1).getTime();

      const yearCandles = symbol.allCandles.filter(
        (c, i) => c.time >= yearStart && i <= currentIdx
      );

      if (yearCandles.length === 0) return null;

      let yearHigh = yearCandles[0].high;
      let yearHighDate = yearCandles[0].time;
      let yearLow = yearCandles[0].low;
      let yearLowDate = yearCandles[0].time;

      for (const candle of yearCandles) {
        if (candle.high > yearHigh) {
          yearHigh = candle.high;
          yearHighDate = candle.time;
        }
        if (candle.low < yearLow) {
          yearLow = candle.low;
          yearLowDate = candle.time;
        }
      }

      const currentPrice = currentCandle.close;
      const fromHigh = ((currentPrice - yearHigh) / yearHigh) * 100;
      const fromLow = ((currentPrice - yearLow) / yearLow) * 100;

      return { yearHigh, yearHighDate, yearLow, yearLowDate, currentPrice, fromHigh, fromLow };
    },

    getHoldingDays: () => {
      const symbol = getActiveSymbolInternal();
      const { globalDate } = get();
      if (!symbol || symbol.positions.length === 0) return null;

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      const firstEntryIndex = Math.min(...symbol.positions.map(p => p.entryIndex));
      return currentIdx - firstEntryIndex;
    },

    getEquityCurve: () => {
      const symbol = getActiveSymbolInternal();
      return symbol?.equityCurve || [];
    },

    updateEquityCurve: () => {
      const { symbols, globalDate, initialCapital, initialCandleCount, commonDateRange } = get();
      if (!commonDateRange) return;

      const updatedSymbols = symbols.map(symbol => {
        const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
        const currentCandle = symbol.allCandles[currentIdx];
        if (!currentCandle) return symbol;

        // 確定損益
        const realizedPnl = symbol.tradeHistory
          .filter(t => t.type === "SELL" && t.pnl !== undefined)
          .reduce((sum, t) => sum + (t.pnl || 0), 0);

        // 含み損益
        let unrealizedPnl = 0;
        if (symbol.positions.length > 0) {
          const totalShares = symbol.positions.reduce((sum, p) => sum + p.shares, 0);
          const totalCost = symbol.positions.reduce((sum, p) => sum + p.entryPrice * p.shares, 0);
          const avgEntryPrice = totalCost / totalShares;
          unrealizedPnl = (currentCandle.close - avgEntryPrice) * totalShares;
        }

        const equity = initialCapital + realizedPnl + unrealizedPnl;

        // Buy&Hold計算
        const simStartDateIdx = initialCandleCount;
        const simStartDate = commonDateRange.dates[simStartDateIdx];
        const simStartIdx = getSymbolCurrentIndex(symbol, simStartDate);
        const simStartPrice = symbol.allCandles[simStartIdx]?.close || currentCandle.close;
        const buyHoldReturn = (currentCandle.close - simStartPrice) / simStartPrice;
        const buyHoldEquity = initialCapital * (1 + buyHoldReturn);

        // ドローダウン
        const peak = symbol.equityCurve.reduce((max, p) => Math.max(max, p.equity), initialCapital);
        const drawdown = equity >= peak ? 0 : ((peak - equity) / peak) * 100;

        // トレードマーカー
        const lastTrade = symbol.tradeHistory[symbol.tradeHistory.length - 1];
        const tradeType = lastTrade && lastTrade.date === currentCandle.time
          ? lastTrade.type
          : undefined;

        const newPoint: EquityPoint = {
          time: currentCandle.time,
          equity,
          buyHoldEquity,
          drawdown,
          tradeType,
        };

        return {
          ...symbol,
          equityCurve: [...symbol.equityCurve, newPoint],
        };
      });

      set({ symbols: updatedSymbols });
    },

    // =============================================
    // 予約注文アクション
    // =============================================
    placePendingOrder: (order) => {
      const { commonDateRange, currentDateIndex } = get();
      if (!commonDateRange) return;

      const targetDate = commonDateRange.dates[currentDateIndex];

      const pendingOrder: PendingOrder = {
        id: generateId(),
        createdAt: targetDate,
        ...order,
      };

      set(state => ({
        pendingOrders: [...state.pendingOrders, pendingOrder],
        alerts: [...state.alerts, {
          id: generateId(),
          type: "ORDER_EXECUTED" as const,
          message: `${order.orderType === "BUY" ? "買い" : "売り"}注文を予約しました（翌日始値で約定）`,
          timestamp: Date.now(),
        }],
      }));
    },

    cancelPendingOrder: (orderId) => {
      set(state => ({
        pendingOrders: state.pendingOrders.filter(o => o.id !== orderId),
      }));
    },

    getPendingOrdersForSymbol: (symbolId) => {
      return get().pendingOrders.filter(o => o.symbolId === symbolId);
    },

    executePendingOrders: () => {
      const {
        pendingOrders,
        symbols,
        globalDate,
        commonDateRange,
        commissionRate,
        slippageBps,
        taxRate,
        trailingStopEnabled,
        trailingStopPercent,
      } = get();

      if (pendingOrders.length === 0 || !commonDateRange) return;

      let updatedSymbols = [...symbols];
      const executedOrderIds: string[] = [];
      const newAlerts: Alert[] = [];

      for (const order of pendingOrders) {
        const symbolIdx = updatedSymbols.findIndex(s => s.id === order.symbolId);
        if (symbolIdx === -1) continue;

        const symbol = updatedSymbols[symbolIdx];
        const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
        const currentCandle = symbol.allCandles[currentIdx];
        if (!currentCandle) continue;

        const price = currentCandle.open;  // 翌日始値

        if (order.orderType === "BUY") {
          // BUY処理
          const slippage = price * (slippageBps / 10000);
          const effectivePrice = price + slippage;
          const commission = effectivePrice * order.shares * (commissionRate / 100);

          // インジケータースナップショット
          let indicators: IndicatorSnapshot | undefined;
          let marketContext: MarketContext | undefined;
          if (symbol.indicatorData) {
            indicators = getIndicatorSnapshot(symbol.indicatorData, currentIdx);
            marketContext = analyzeMarketContext(symbol.allCandles, currentIdx, symbol.indicatorData);
          }

          const initialTrailingStop = trailingStopEnabled
            ? currentCandle.high * (1 - trailingStopPercent / 100)
            : undefined;

          const newPosition: Position = {
            id: generateId(),
            entryPrice: effectivePrice,
            entryDate: currentCandle.time,
            entryIndex: currentIdx,
            shares: order.shares,
            highestPrice: currentCandle.high,
            lowestPrice: currentCandle.low,
            highestDate: currentCandle.time,
            lowestDate: currentCandle.time,
            commission,
            trailingStopPrice: initialTrailingStop,
          };

          const trade: Trade = {
            id: generateId(),
            type: "BUY",
            date: currentCandle.time,
            price,
            shares: order.shares,
            memo: order.memo,
            priceType: "nextOpen",
            indicators,
            marketContext,
            effectivePrice,
            slippage,
            commission,
          };

          updatedSymbols[symbolIdx] = {
            ...symbol,
            positions: [...symbol.positions, newPosition],
            tradeHistory: [...symbol.tradeHistory, trade],
          };

          newAlerts.push({
            id: generateId(),
            type: "ORDER_EXECUTED",
            message: `${symbol.fileName}: 買い注文が約定しました（${order.shares}株 @ ¥${price.toLocaleString()}）`,
            timestamp: Date.now(),
          });

        } else if (order.orderType === "SELL" || order.orderType === "SELL_ALL") {
          // SELL処理
          if (symbol.positions.length === 0) continue;

          const totalShares = symbol.positions.reduce((sum, p) => sum + p.shares, 0);
          const sellShares = order.orderType === "SELL_ALL" ? totalShares : Math.min(order.shares, totalShares);

          const slippage = price * (slippageBps / 10000);
          const effectivePrice = price - slippage;
          const sellCommission = effectivePrice * sellShares * (commissionRate / 100);

          // 売却するポジションを選択（FIFO）
          let remainingSharesToSell = sellShares;
          let totalBuyCommission = 0;
          let totalEntryValue = 0;
          let totalMfeValue = 0;
          let totalMaeValue = 0;
          let mfePrice = 0;
          let maePrice = 0;
          let mfeDate = 0;
          let maeDate = 0;

          const soldPositions: Position[] = [];
          const remainingPositions: Position[] = [];

          for (const pos of symbol.positions) {
            if (remainingSharesToSell <= 0) {
              remainingPositions.push(pos);
              continue;
            }

            if (pos.shares <= remainingSharesToSell) {
              soldPositions.push(pos);
              remainingSharesToSell -= pos.shares;
              totalBuyCommission += pos.commission;
              totalEntryValue += pos.entryPrice * pos.shares;
              totalMfeValue += ((pos.highestPrice - pos.entryPrice) / pos.entryPrice) * 100 * pos.shares;
              totalMaeValue += ((pos.lowestPrice - pos.entryPrice) / pos.entryPrice) * 100 * pos.shares;
              if (pos.highestPrice > mfePrice) {
                mfePrice = pos.highestPrice;
                mfeDate = pos.highestDate;
              }
              if (maePrice === 0 || pos.lowestPrice < maePrice) {
                maePrice = pos.lowestPrice;
                maeDate = pos.lowestDate;
              }
            } else {
              const partialPos: Position = { ...pos, shares: remainingSharesToSell };
              soldPositions.push(partialPos);
              const partialRatio = remainingSharesToSell / pos.shares;
              totalBuyCommission += pos.commission * partialRatio;
              totalEntryValue += pos.entryPrice * remainingSharesToSell;
              totalMfeValue += ((pos.highestPrice - pos.entryPrice) / pos.entryPrice) * 100 * remainingSharesToSell;
              totalMaeValue += ((pos.lowestPrice - pos.entryPrice) / pos.entryPrice) * 100 * remainingSharesToSell;
              if (pos.highestPrice > mfePrice) {
                mfePrice = pos.highestPrice;
                mfeDate = pos.highestDate;
              }
              if (maePrice === 0 || pos.lowestPrice < maePrice) {
                maePrice = pos.lowestPrice;
                maeDate = pos.lowestDate;
              }
              remainingPositions.push({ ...pos, shares: pos.shares - remainingSharesToSell });
              remainingSharesToSell = 0;
            }
          }

          const avgEntryPrice = totalEntryValue / sellShares;
          const mfe = totalMfeValue / sellShares;
          const mae = totalMaeValue / sellShares;

          const grossPnl = (effectivePrice - avgEntryPrice) * sellShares;
          const netPnl = grossPnl - totalBuyCommission - sellCommission;

          let tax = 0;
          let afterTaxPnl = netPnl;
          if (netPnl > 0) {
            tax = netPnl * (taxRate / 100);
            afterTaxPnl = netPnl - tax;
          }

          const pnlPercent = ((effectivePrice - avgEntryPrice) / avgEntryPrice) * 100;
          const mfeUtilization = mfe > 0 ? (pnlPercent / mfe) * 100 : 0;

          let indicators: IndicatorSnapshot | undefined;
          let marketContext: MarketContext | undefined;
          if (symbol.indicatorData) {
            indicators = getIndicatorSnapshot(symbol.indicatorData, currentIdx);
            marketContext = analyzeMarketContext(symbol.allCandles, currentIdx, symbol.indicatorData);
          }

          const trade: Trade = {
            id: generateId(),
            type: "SELL",
            date: currentCandle.time,
            price,
            shares: sellShares,
            memo: order.memo,
            priceType: "nextOpen",
            pnl: grossPnl,
            pnlPercent,
            indicators,
            marketContext,
            effectivePrice,
            slippage,
            commission: sellCommission,
            exitReason: order.exitReason,
            exitTrigger: order.exitTrigger,
            grossPnl,
            netPnl,
            tax,
            afterTaxPnl,
            mfe,
            mae,
            mfePrice,
            maePrice,
            mfeDate,
            maeDate,
            mfeUtilization,
          };

          updatedSymbols[symbolIdx] = {
            ...symbol,
            positions: remainingPositions,
            tradeHistory: [...symbol.tradeHistory, trade],
          };

          const pnlSign = grossPnl >= 0 ? "+" : "";
          newAlerts.push({
            id: generateId(),
            type: "ORDER_EXECUTED",
            message: `${symbol.fileName}: 売り注文が約定しました（${sellShares}株 @ ¥${price.toLocaleString()} / ${pnlSign}${pnlPercent.toFixed(1)}%）`,
            timestamp: Date.now(),
          });
        }

        executedOrderIds.push(order.id);
      }

      set({
        symbols: updatedSymbols,
        pendingOrders: get().pendingOrders.filter(o => !executedOrderIds.includes(o.id)),
        alerts: [...get().alerts, ...newAlerts],
      });
    },

    // =============================================
    // ポートフォリオ統計
    // =============================================
    getPortfolioStats: () => {
      const { symbols, initialCapital, globalDate, initialCandleCount, commonDateRange } = get();
      if (symbols.length === 0 || !commonDateRange) return null;

      let totalPnl = 0;
      let totalTradeCount = 0;
      let totalWinCount = 0;
      let totalAllocation = 0;

      const symbolStats: SymbolStats[] = symbols.map(symbol => {
        const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
        const currentCandle = symbol.allCandles[currentIdx];

        // 確定損益
        const realizedPnl = symbol.tradeHistory
          .filter(t => t.type === "SELL" && t.pnl !== undefined)
          .reduce((sum, t) => sum + (t.pnl || 0), 0);

        // 含み損益
        let unrealizedPnl = 0;
        if (symbol.positions.length > 0 && currentCandle) {
          const totalShares = symbol.positions.reduce((sum, p) => sum + p.shares, 0);
          const totalCost = symbol.positions.reduce((sum, p) => sum + p.entryPrice * p.shares, 0);
          const avgEntryPrice = totalCost / totalShares;
          unrealizedPnl = (currentCandle.close - avgEntryPrice) * totalShares;
        }

        const pnl = realizedPnl + unrealizedPnl;
        const pnlPercent = (pnl / initialCapital) * 100;

        // 取引統計
        const sellTrades = symbol.tradeHistory.filter(t => t.type === "SELL");
        const tradeCount = sellTrades.length;
        const winCount = sellTrades.filter(t => (t.pnl || 0) > 0).length;
        const winRate = tradeCount > 0 ? (winCount / tradeCount) * 100 : 0;

        // ポジション金額から配分を計算
        let allocation = 0;
        if (symbol.positions.length > 0) {
          const totalCost = symbol.positions.reduce((sum, p) => sum + p.entryPrice * p.shares, 0);
          allocation = totalCost;
        }

        totalPnl += pnl;
        totalTradeCount += tradeCount;
        totalWinCount += winCount;
        totalAllocation += allocation;

        return {
          symbolId: symbol.id,
          fileName: symbol.fileName,
          pnl,
          pnlPercent,
          allocation: 0, // 後で計算
          tradeCount,
          winRate,
        };
      });

      // 配分率を計算
      symbolStats.forEach(s => {
        const symbol = symbols.find(sym => sym.id === s.symbolId);
        if (symbol && totalAllocation > 0) {
          const cost = symbol.positions.reduce((sum, p) => sum + p.entryPrice * p.shares, 0);
          s.allocation = (cost / totalAllocation) * 100;
        }
      });

      // 全体最大ドローダウン
      let maxDrawdown = 0;
      for (const symbol of symbols) {
        for (const point of symbol.equityCurve) {
          if (point.drawdown > maxDrawdown) {
            maxDrawdown = point.drawdown;
          }
        }
      }

      // 平均Alpha計算
      let totalAlpha = 0;
      let alphaCount = 0;
      for (const symbol of symbols) {
        const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
        const currentCandle = symbol.allCandles[currentIdx];
        if (!currentCandle) continue;

        const simStartDateIdx = initialCandleCount;
        const simStartDate = commonDateRange.dates[simStartDateIdx];
        const simStartIdx = getSymbolCurrentIndex(symbol, simStartDate);
        const simStartPrice = symbol.allCandles[simStartIdx]?.close;

        if (simStartPrice) {
          const buyHoldReturn = ((currentCandle.close - simStartPrice) / simStartPrice) * 100;
          const symbolPnlPercent = symbolStats.find(s => s.symbolId === symbol.id)?.pnlPercent || 0;
          totalAlpha += symbolPnlPercent - buyHoldReturn;
          alphaCount++;
        }
      }

      return {
        totalPnl,
        totalPnlPercent: (totalPnl / initialCapital) * 100,
        symbolStats,
        aggregatedStats: {
          totalTradeCount,
          overallWinRate: totalTradeCount > 0 ? (totalWinCount / totalTradeCount) * 100 : 0,
          maxDrawdown,
          avgAlpha: alphaCount > 0 ? totalAlpha / alphaCount : 0,
        },
      };
    },
  };
});
