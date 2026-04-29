/**
 * Pane / layout configuration
 */

export type ScaleMode = "linear" | "log" | "percent";

export type PaneConfig = {
  /** Unique pane identifier */
  id: string;
  /** Flex proportion for height allocation */
  flex: number;
  /** Y-axis scale mode for right scale (default: "linear") */
  yScale?: ScaleMode;
  /** Fixed Y-axis range for right scale (e.g., [0, 100] for RSI) */
  yRange?: [number, number];
  /** Horizontal reference lines (e.g., [30, 70] for RSI) */
  referenceLines?: number[];
  /** Reference line color */
  referenceLineColor?: string;
  /** Left scale configuration (enables dual-scale mode when present) */
  leftScale?: {
    mode?: ScaleMode;
    range?: [number, number];
    referenceLines?: number[];
    referenceLineColor?: string;
  };
};

export type LayoutConfig = {
  /** Pane definitions */
  panes: PaneConfig[];
  /** Gap between panes in pixels (default: 4) */
  gap?: number;
  /** Show bottom scrollbar (default: true) */
  scrollbar?: boolean;
};
