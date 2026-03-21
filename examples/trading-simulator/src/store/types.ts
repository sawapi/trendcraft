import type {
  Alert,
  CommonDateRange,
  DetectedVolumeSpike,
  EquityPoint,
  ExitReason,
  ExitTrigger,
  IndicatorParams,
  NormalizedCandle,
  PendingOrder,
  PlaybackSpeed,
  PortfolioStats,
  Position,
  PositionSummary,
  PriceType,
  SimulationConfig,
  SimulatorPhase,
  SymbolSession,
  Trade,
  VolumeSpikeSettings,
  YearHighLow,
} from "../types";
import type { IndicatorData } from "../utils/indicators";

// =============================================
// Slice Interfaces
// =============================================

export interface SymbolSlice {
  symbols: SymbolSession[];
  activeSymbolId: string | null;
  commonDateRange: CommonDateRange | null;

  createSymbolSession: (candles: NormalizedCandle[], fileName: string) => string;
  closeSymbolSession: (symbolId: string) => void;
  switchSymbol: (symbolId: string) => void;
  nextSymbol: () => void;
  previousSymbol: () => void;
  getActiveSymbol: () => SymbolSession | null;
  getAllSymbols: () => SymbolSession[];
  loadCandles: (candles: NormalizedCandle[], fileName: string) => void;
}

export interface PlaybackSlice {
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  globalDate: number;
  currentDateIndex: number;

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  stepForward: () => boolean;
  stepBackward: () => void;
  skip: () => void;
  jumpToIndex: (index: number) => void;
}

export interface TradingSlice {
  executeBuy: (shares: number, memo: string, priceType: PriceType) => void;
  executeSell: (
    shares: number,
    memo: string,
    priceType: PriceType,
    exitReason: ExitReason,
    exitTrigger?: ExitTrigger,
  ) => void;
  executeSellAll: (
    memo: string,
    priceType: PriceType,
    exitReason: ExitReason,
    exitTrigger?: ExitTrigger,
  ) => void;
  getNextCandle: () => NormalizedCandle | null;
  updatePositionMFEMAE: () => void;
}

export interface OrderSlice {
  pendingOrders: PendingOrder[];

  placePendingOrder: (order: Omit<PendingOrder, "id" | "createdAt">) => void;
  cancelPendingOrder: (orderId: string) => void;
  getPendingOrdersForSymbol: (symbolId: string) => PendingOrder[];
  executePendingOrders: () => void;
}

export interface AlertSlice {
  alerts: Alert[];

  dismissAlert: (id: string) => void;
  checkPositionAlerts: () => void;
  checkVolumeSpikeAlerts: () => void;
}

export interface IndicatorSlice {
  enabledIndicators: string[];
  indicatorParams: IndicatorParams;

  setEnabledIndicators: (indicators: string[]) => void;
  setIndicatorParams: (params: IndicatorParams) => void;
}

export interface ConfigSlice {
  phase: SimulatorPhase;
  initialCandleCount: number;
  initialCapital: number;
  commissionRate: number;
  slippageBps: number;
  taxRate: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  trailingStopEnabled: boolean;
  trailingStopPercent: number;
  volumeSpikeSettings: VolumeSpikeSettings;

  setVolumeSpikeSettings: (settings: Partial<VolumeSpikeSettings>) => void;
  quickStart: () => void;
  startSimulation: (config: SimulationConfig) => void;
  finishSimulation: () => void;
  reset: () => void;
}

export interface ComputedSlice {
  // Backward compatibility getters
  readonly fileName: string;
  readonly allCandles: NormalizedCandle[];
  readonly positions: Position[];
  readonly tradeHistory: Trade[];
  readonly indicatorData: IndicatorData | null;
  readonly equityCurve: EquityPoint[];
  readonly currentIndex: number;
  readonly startIndex: number;

  getCurrentCandle: () => NormalizedCandle | null;
  getVisibleCandles: () => NormalizedCandle[];
  getUnrealizedPnl: () => { pnl: number; pnlPercent: number } | null;
  getPositionSummary: () => PositionSummary | null;
  getTotalPnl: () => number;
  getYearHighLow: () => YearHighLow | null;
  getHoldingDays: () => number | null;
  getEquityCurve: () => EquityPoint[];
  updateEquityCurve: () => void;
  getPortfolioStats: () => PortfolioStats | null;
  getDetectedVolumeSpikes: () => DetectedVolumeSpike[];
}

export interface CoachingSlice {
  coachingSignals: import("../engine/signalCoach").CoachingSignal[];
  coachingLevel: import("../engine/signalCoach").CoachingLevel;
  coachingEnabled: boolean;

  setCoachingLevel: (level: import("../engine/signalCoach").CoachingLevel) => void;
  setCoachingEnabled: (enabled: boolean) => void;
  updateCoachingSignals: () => void;
}

export interface HistorySlice {
  _undoStack: import("./slices/historySlice").TradeSnapshot[];
  _redoStack: import("./slices/historySlice").TradeSnapshot[];

  pushTradeSnapshot: () => void;
  undoTrade: () => void;
  redoTrade: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export interface IncrementalIndicatorSlice {
  /** Per-symbol incremental indicator registries (internal) */
  _incrementalRegistries: Map<string, Map<string, unknown>>;

  /** Initialize incremental indicators for a symbol */
  initIncrementalIndicators: (
    symbolId: string,
    candles: NormalizedCandle[],
    warmUpEnd: number,
    enabledIndicators: string[],
    params: IndicatorParams,
  ) => IndicatorData;

  /** Advance all incremental indicators by one candle */
  advanceIncrementalIndicators: (symbolId: string, candle: NormalizedCandle) => void;

  /** Clear incremental state for a symbol */
  clearIncrementalIndicators: (symbolId: string) => void;
}

// =============================================
// Composed State
// =============================================

export type SimulatorState = SymbolSlice &
  PlaybackSlice &
  TradingSlice &
  OrderSlice &
  AlertSlice &
  IndicatorSlice &
  ConfigSlice &
  ComputedSlice &
  IncrementalIndicatorSlice &
  CoachingSlice &
  HistorySlice;

// Slice creator type for Zustand v5
export type SliceCreator<T> = (
  set: (
    partial:
      | SimulatorState
      | Partial<SimulatorState>
      | ((state: SimulatorState) => SimulatorState | Partial<SimulatorState>),
    replace?: false,
  ) => void,
  get: () => SimulatorState,
  api: unknown,
) => T;
