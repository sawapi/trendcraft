/**
 * Series configuration and handles
 */

import type { DataPoint } from "./fundamental";

/** Built-in visual series types */
export type BuiltinSeriesType =
  | "line"
  | "area"
  | "histogram"
  | "band"
  | "cloud"
  | "marker"
  | "box"
  | "heatmap";

/** Visual series types (extensible via plugins) */
export type SeriesType = BuiltinSeriesType | (string & {});

export type SeriesConfig = {
  /** Target pane: 'main' (overlay) or a specific pane id. Omit for auto-detection via __meta. */
  pane?: "main" | string;
  /** Scale assignment: 'right' (default) or 'left' for dual-scale panes */
  scaleId?: "left" | "right";
  /** Override auto-detected series type */
  type?: SeriesType;
  /** Primary color */
  color?: string;
  /** Line width in pixels (default: 1.5) */
  lineWidth?: number;
  /** Display label */
  label?: string;
  /** Initial visibility (default: true) */
  visible?: boolean;
  /** Max height as fraction of pane (0-1). Expands scale range so data occupies at most this ratio of pane height. Useful for volume overlay. */
  maxHeightRatio?: number;
  /** Fixed Y-axis range for the pane (e.g., [0, 100] for RSI). Applied when a new pane is created. */
  yRange?: [number, number];
  /** Horizontal reference lines (e.g., [30, 70] for RSI). Applied when a new pane is created. */
  referenceLines?: number[];
  /** Per-channel colors for multi-channel series (e.g., { upper: "#2196F3", lower: "#2196F3" } for bands) */
  channelColors?: Record<string, string>;
  /**
   * Palette hint used by the auto-color rotation when `color` is not set.
   * Populated from an indicator preset's `color` field when it's an array.
   * Each new series using this same palette instance picks the next entry
   * (wrapping), so stacking e.g. multiple SMAs produces distinct colors.
   */
  colorPalette?: readonly string[];
};

export type SeriesHandle = {
  /** Unique series id */
  readonly id: string;
  /**
   * Resolved series config (after preset defaults, palette rotation, and
   * introspection). Useful for reading back the auto-assigned color.
   */
  readonly config: Readonly<SeriesConfig>;
  /** Push a single data point (streaming). Accepts scalar or compound values. */
  update(point: DataPoint<unknown>): void;
  /** Replace all data */
  setData<T>(data: DataPoint<T>[]): void;
  /** Toggle visibility */
  setVisible(visible: boolean): void;
  /** Remove this series from the chart */
  remove(): void;
};
