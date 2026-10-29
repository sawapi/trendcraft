/**
 * Optional chart features — the registry `CanvasChart` consults.
 *
 * Drawing tools, backtest/pattern display, signal and trade markers and the
 * score heatmap are not part of the core bundle. Each lives in
 * `@trendcraft/chart/features` and is attached to a chart by its register
 * function, so a chart that never uses one does not ship its code. This file
 * holds only types and the registration key: importing it adds nothing.
 */

import type {
  renderBacktestSummary,
  renderBacktestTrades,
  renderEquityCurve,
} from "../renderer/backtest-renderer";
import type { renderDrawings } from "../renderer/drawing-renderer";
import type { DrawingTool, DrawingToolDeps } from "../renderer/drawing-tool";
import type { renderSignals, renderTrades } from "../renderer/marker-renderer";
import type { renderPatterns } from "../renderer/pattern-renderer";
import type { renderScoreHeatmap } from "../renderer/score-renderer";
import type { checkBacktest, checkSignals, checkTrades } from "./feature-validation";
import type { BacktestResultData } from "./types";

/** Interactive drawing tools and drawing rendering. */
export type DrawingFeature = {
  render: typeof renderDrawings;
  createTool: (deps: DrawingToolDeps) => DrawingTool;
};

/** Backtest results (trades, equity pane, summary) and chart patterns. */
export type BacktestFeature = {
  check: typeof checkBacktest;
  /** Value range of the equity pane for a result. */
  equityRange: (result: BacktestResultData) => [number, number];
  renderTrades: typeof renderBacktestTrades;
  renderEquityCurve: typeof renderEquityCurve;
  renderSummary: typeof renderBacktestSummary;
  renderPatterns: typeof renderPatterns;
};

/** Signal and trade markers. */
export type MarkersFeature = {
  checkSignals: typeof checkSignals;
  checkTrades: typeof checkTrades;
  renderSignals: typeof renderSignals;
  renderTrades: typeof renderTrades;
};

/** Score heatmap behind the candles. */
export type ScoresFeature = {
  renderHeatmap: typeof renderScoreHeatmap;
};

/** The features registered on one chart. */
export type ChartFeatures = {
  drawing?: DrawingFeature;
  backtest?: BacktestFeature;
  markers?: MarkersFeature;
  scores?: ScoresFeature;
};

export type ChartFeatureName = keyof ChartFeatures;

/**
 * The method a chart exposes for feature registration. A global symbol, so
 * the feature bundle and the core bundle agree on it even when a bundler
 * duplicates modules.
 */
export const REGISTER_FEATURE = Symbol.for("@trendcraft/chart/registerFeature");

/** A chart as the feature modules see it. */
export type FeatureHost = {
  [REGISTER_FEATURE]: <K extends ChartFeatureName>(
    name: K,
    feature: NonNullable<ChartFeatures[K]>,
  ) => void;
};
