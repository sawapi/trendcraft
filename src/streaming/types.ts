/**
 * Streaming module type definitions
 *
 * Types for real-time tick-to-candle aggregation, incremental signal detection,
 * and streaming pipeline infrastructure.
 */

import type { NormalizedCandle } from "../types";

// ============================================
// Trade / Tick Types
// ============================================

/**
 * A single trade (tick) from a market data feed
 *
 * @example
 * ```ts
 * const trade: Trade = {
 *   time: Date.now(),
 *   price: 150.25,
 *   volume: 100,
 *   side: 'buy',
 * };
 * ```
 */
export type Trade = {
  /** Epoch milliseconds timestamp */
  time: number;
  /** Execution price */
  price: number;
  /** Trade volume (shares/contracts/units) */
  volume: number;
  /** Trade side (optional, for order flow analysis) */
  side?: "buy" | "sell";
};

// ============================================
// Candle Aggregator Types
// ============================================

/**
 * Serializable state for CandleAggregator
 */
export type CandleAggregatorState = {
  intervalMs: number;
  currentPeriodStart: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
};

/**
 * Options for creating a CandleAggregator
 */
export type CandleAggregatorOptions = {
  /** Candle interval in milliseconds (e.g., 60000 for 1-minute candles) */
  intervalMs: number;
};

/**
 * Stateful aggregator that converts trades into OHLCV candles
 */
export type CandleAggregator = {
  /** Process a trade; returns a completed candle when the period rolls over */
  addTrade(trade: Trade): NormalizedCandle | null;
  /** Get the in-progress (unfinished) candle, or null if no trades received */
  getCurrentCandle(): NormalizedCandle | null;
  /** Force-close the current candle (e.g., at session end) */
  flush(): NormalizedCandle | null;
  /** Serialize internal state for persistence */
  getState(): CandleAggregatorState;
};

// ============================================
// Candle Resampler Types
// ============================================

/**
 * Serializable state for CandleResampler
 */
export type CandleResamplerState = {
  targetIntervalMs: number;
  currentPeriodStart: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
};

/**
 * Options for creating a CandleResampler
 */
export type CandleResamplerOptions = {
  /** Target (higher) timeframe interval in milliseconds */
  targetIntervalMs: number;
};

/**
 * Resamples lower-timeframe candles into higher-timeframe candles incrementally
 */
export type CandleResampler = {
  /** Process a candle; returns a completed higher-TF candle when the period rolls over */
  addCandle(candle: NormalizedCandle): NormalizedCandle | null;
  /** Get the in-progress (unfinished) higher-TF candle */
  getCurrentCandle(): NormalizedCandle | null;
  /** Force-close the current higher-TF candle */
  flush(): NormalizedCandle | null;
  /** Serialize internal state for persistence */
  getState(): CandleResamplerState;
};

// ============================================
// Signal Detector Types
// ============================================

/**
 * Serializable state for CrossDetector
 */
export type CrossDetectorState = {
  prevA: number | null;
  prevB: number | null;
};

/**
 * Detects when one value crosses over/under another incrementally
 */
export type CrossDetector = {
  /** Advance state and return whether a cross occurred */
  next(valueA: number | null, valueB: number | null): boolean;
  /** Preview without advancing state */
  peek(valueA: number | null, valueB: number | null): boolean;
  /** Serialize internal state */
  getState(): CrossDetectorState;
};

/**
 * Serializable state for ThresholdDetector
 */
export type ThresholdDetectorState = {
  threshold: number;
  prevValue: number | null;
};

/**
 * Detects when a value crosses above/below a fixed threshold
 */
export type ThresholdDetector = {
  /** Advance state and return cross events */
  next(value: number | null): { crossAbove: boolean; crossBelow: boolean };
  /** Preview without advancing state */
  peek(value: number | null): { crossAbove: boolean; crossBelow: boolean };
  /** Serialize internal state */
  getState(): ThresholdDetectorState;
};

/**
 * Serializable state for SqueezeDetector
 */
export type SqueezeDetectorState = {
  prevBandwidth: number | null;
  squeezeTriggerBandwidth: number | null;
  inSqueeze: boolean;
};

/**
 * Detects Bollinger Band squeeze conditions incrementally
 */
export type SqueezeDetector = {
  /** Advance state and return squeeze events */
  next(bandwidth: number | null): { squeezeStart: boolean; squeezeEnd: boolean; inSqueeze: boolean };
  /** Preview without advancing state */
  peek(bandwidth: number | null): { squeezeStart: boolean; squeezeEnd: boolean; inSqueeze: boolean };
  /** Serialize internal state */
  getState(): SqueezeDetectorState;
};

/**
 * Serializable state for DivergenceDetector
 */
export type DivergenceDetectorState = {
  priceBuffer: (number | null)[];
  indicatorBuffer: (number | null)[];
  lookback: number;
  bufferSize: number;
};

/**
 * Divergence detection result
 */
export type DivergenceResult = {
  bullish: boolean;
  bearish: boolean;
};

/**
 * Detects price-indicator divergences incrementally
 */
export type DivergenceDetector = {
  /** Advance state and return divergence events */
  next(price: number | null, indicatorValue: number | null): DivergenceResult;
  /** Preview without advancing state */
  peek(price: number | null, indicatorValue: number | null): DivergenceResult;
  /** Serialize internal state */
  getState(): DivergenceDetectorState;
};

// ============================================
// Streaming Condition Types
// ============================================

/**
 * Snapshot of indicator values at a point in time
 */
export type IndicatorSnapshot = { [key: string]: unknown };

/**
 * A function-based streaming condition
 */
export type StreamingConditionFn = (snapshot: IndicatorSnapshot, candle: NormalizedCandle) => boolean;

/**
 * Preset streaming condition with a name
 */
export type StreamingPresetCondition = {
  type: "preset";
  name: string;
  evaluate: StreamingConditionFn;
};

/**
 * Combined streaming condition (and/or/not)
 */
export type StreamingCombinedCondition = {
  type: "and" | "or" | "not";
  conditions: StreamingCondition[];
};

/**
 * Any streaming condition type
 */
export type StreamingCondition =
  | StreamingPresetCondition
  | StreamingCombinedCondition
  | StreamingConditionFn;

// ============================================
// Pipeline Types
// ============================================

/**
 * Indicator registration for a pipeline
 */
export type PipelineIndicatorConfig = {
  /** Key name in the snapshot (e.g., "rsi14", "sma20") */
  name: string;
  /** Factory function that creates the incremental indicator */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: () => { next(candle: NormalizedCandle): { value: any }; peek(candle: NormalizedCandle): { value: any }; getState(): unknown };
  /** Optional state to restore from */
  state?: unknown;
};

/**
 * Pipeline configuration options
 */
export type PipelineOptions = {
  /** Indicator definitions */
  indicators: PipelineIndicatorConfig[];
  /** Entry condition */
  entry?: StreamingCondition;
  /** Exit condition */
  exit?: StreamingCondition;
  /** Named signal detectors */
  signals?: { name: string; condition: StreamingCondition }[];
};

/**
 * Pipeline evaluation result for a single candle
 */
export type PipelineResult = {
  snapshot: IndicatorSnapshot;
  entrySignal: boolean;
  exitSignal: boolean;
  signals: string[];
};

/**
 * Serializable pipeline state
 */
export type PipelineState = {
  indicatorStates: { name: string; state: unknown }[];
};

/**
 * Stateful pipeline that evaluates indicators + conditions per candle
 */
export type StreamingPipeline = {
  /** Advance all indicators and evaluate conditions */
  next(candle: NormalizedCandle): PipelineResult;
  /** Preview without advancing state */
  peek(candle: NormalizedCandle): PipelineResult;
  /** Serialize internal state */
  getState(): PipelineState;
};

// ============================================
// MTF Types
// ============================================

/**
 * Streaming MTF timeframe configuration
 */
export type StreamingMtfTimeframeConfig = {
  /** Timeframe interval in milliseconds */
  intervalMs: number;
  /** Indicator definitions for this timeframe */
  indicators: PipelineIndicatorConfig[];
};

/**
 * Streaming MTF state
 */
export type StreamingMtfState = {
  timeframes: {
    intervalMs: number;
    resamplerState: CandleResamplerState;
    indicatorStates: { name: string; state: unknown }[];
  }[];
};

/**
 * Multi-timeframe indicator snapshot
 */
export type MtfSnapshot = {
  [timeframeKey: string]: IndicatorSnapshot;
};

/**
 * Streaming multi-timeframe context
 */
export type StreamingMtf = {
  /** Process a base-timeframe candle and update all higher-TF indicators */
  next(candle: NormalizedCandle): MtfSnapshot;
  /** Preview without advancing state */
  peek(candle: NormalizedCandle): MtfSnapshot;
  /** Serialize internal state */
  getState(): StreamingMtfState;
};

// ============================================
// Session Types
// ============================================

/**
 * Events emitted by a TradingSession
 */
export type SessionEvent =
  | { type: "candle"; candle: NormalizedCandle }
  | { type: "signal"; name: string; candle: NormalizedCandle }
  | { type: "entry"; snapshot: IndicatorSnapshot; candle: NormalizedCandle }
  | { type: "exit"; snapshot: IndicatorSnapshot; candle: NormalizedCandle }
  | { type: "partial"; candle: NormalizedCandle; snapshot: IndicatorSnapshot };

/**
 * Session configuration options
 */
export type SessionOptions = {
  /** Candle interval in milliseconds */
  intervalMs: number;
  /** Pipeline configuration */
  pipeline: PipelineOptions;
  /** Emit partial (unfinished candle) events on each trade */
  emitPartial?: boolean;
  /** Historical candles for warming up indicators */
  warmUp?: NormalizedCandle[];
};

/**
 * Serializable session state
 */
export type SessionState = {
  aggregatorState: CandleAggregatorState;
  pipelineState: PipelineState;
};

/**
 * End-to-end trading session: tick → candle → indicator → signal
 */
export type TradingSession = {
  /** Process a trade and return any events that occurred */
  onTrade(trade: Trade): SessionEvent[];
  /** Close session and flush remaining data */
  close(): SessionEvent[];
  /** Serialize internal state */
  getState(): SessionState;
};
