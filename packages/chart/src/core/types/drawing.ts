/**
 * Drawing types — discriminated union of all supported drawing variants
 */

import type { TimeValue } from "./fundamental";

export type DrawingType =
  | "hline"
  | "trendline"
  | "fibRetracement"
  | "ray"
  | "hray"
  | "vline"
  | "rectangle"
  | "channel"
  | "fibExtension"
  | "textLabel"
  | "arrow";

export type DrawingBase = {
  id: string;
  type: DrawingType;
  color?: string;
  lineWidth?: number;
};

export type HLineDrawing = DrawingBase & {
  type: "hline";
  price: number;
};

export type TrendLineDrawing = DrawingBase & {
  type: "trendline";
  startTime: TimeValue;
  startPrice: number;
  endTime: TimeValue;
  endPrice: number;
};

export type FibRetracementDrawing = DrawingBase & {
  type: "fibRetracement";
  startTime: TimeValue;
  startPrice: number;
  endTime: TimeValue;
  endPrice: number;
  levels?: number[];
};

export type RayDrawing = DrawingBase & {
  type: "ray";
  startTime: TimeValue;
  startPrice: number;
  endTime: TimeValue;
  endPrice: number;
};

export type HRayDrawing = DrawingBase & {
  type: "hray";
  time: TimeValue;
  price: number;
};

export type VLineDrawing = DrawingBase & {
  type: "vline";
  time: TimeValue;
};

export type RectangleDrawing = DrawingBase & {
  type: "rectangle";
  startTime: TimeValue;
  startPrice: number;
  endTime: TimeValue;
  endPrice: number;
  fillColor?: string;
};

export type ChannelDrawing = DrawingBase & {
  type: "channel";
  startTime: TimeValue;
  startPrice: number;
  endTime: TimeValue;
  endPrice: number;
  /** Price offset from the main line (positive = above) */
  channelWidth: number;
  fillColor?: string;
};

export type FibExtensionDrawing = DrawingBase & {
  type: "fibExtension";
  startTime: TimeValue;
  startPrice: number;
  endTime: TimeValue;
  endPrice: number;
  levels?: number[];
};

export type TextLabelDrawing = DrawingBase & {
  type: "textLabel";
  time: TimeValue;
  price: number;
  text: string;
  fontSize?: number;
  backgroundColor?: string;
};

export type ArrowDrawing = DrawingBase & {
  type: "arrow";
  startTime: TimeValue;
  startPrice: number;
  endTime: TimeValue;
  endPrice: number;
};

export type Drawing =
  | HLineDrawing
  | TrendLineDrawing
  | FibRetracementDrawing
  | RayDrawing
  | HRayDrawing
  | VLineDrawing
  | RectangleDrawing
  | ChannelDrawing
  | FibExtensionDrawing
  | TextLabelDrawing
  | ArrowDrawing;
