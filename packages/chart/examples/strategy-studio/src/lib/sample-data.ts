import data from "../../../simple-chart/data.json";

export type StudioCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const sampleCandles: StudioCandle[] = data;
