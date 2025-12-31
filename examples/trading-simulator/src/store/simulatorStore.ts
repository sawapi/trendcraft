import { create } from "zustand";
import type {
  NormalizedCandle,
  PlaybackSpeed,
  SimulatorPhase,
  Position,
  Trade,
  SimulationConfig,
  YearHighLow,
  PriceType,
} from "../types";

interface SimulatorState {
  // Phase
  phase: SimulatorPhase;
  fileName: string;

  // Configuration
  startIndex: number;
  initialCandleCount: number;
  initialCapital: number;
  enabledIndicators: string[];

  // Playback
  currentIndex: number;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;

  // Position & Trades
  position: Position | null;
  tradeHistory: Trade[];

  // Data
  allCandles: NormalizedCandle[];

  // Actions
  loadCandles: (candles: NormalizedCandle[], fileName: string) => void;
  startSimulation: (config: SimulationConfig) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  stepForward: () => boolean;
  stepBackward: () => void;
  executeBuy: (shares: number, memo: string, priceType: PriceType) => void;
  executeSell: (memo: string, priceType: PriceType) => void;
  getNextCandle: () => NormalizedCandle | null;
  skip: () => void;
  reset: () => void;
  finishSimulation: () => void;

  // Computed
  getCurrentCandle: () => NormalizedCandle | null;
  getVisibleCandles: () => NormalizedCandle[];
  getUnrealizedPnl: () => { pnl: number; pnlPercent: number } | null;
  getTotalPnl: () => number;
  getYearHighLow: () => YearHighLow | null;
}

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  // Initial state
  phase: "setup",
  fileName: "",
  startIndex: 0,
  initialCandleCount: 250,
  initialCapital: 1000000,
  enabledIndicators: [],
  currentIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  position: null,
  tradeHistory: [],
  allCandles: [],

  // Actions
  loadCandles: (candles, fileName) => {
    set({
      allCandles: candles,
      fileName,
      phase: "setup",
    });
  },

  startSimulation: (config) => {
    const { allCandles } = get();

    // Find start index based on startDate
    let startIdx = allCandles.findIndex((c) => c.time >= config.startDate);
    if (startIdx === -1) startIdx = 0;

    // Ensure we have enough candles before start date
    const initialIdx = Math.max(0, startIdx - config.initialCandleCount);

    set({
      phase: "running",
      startIndex: initialIdx,
      initialCandleCount: config.initialCandleCount,
      initialCapital: config.initialCapital,
      enabledIndicators: config.enabledIndicators,
      currentIndex: startIdx,
      isPlaying: false,
      position: null,
      tradeHistory: [],
    });
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setSpeed: (speed) => set({ playbackSpeed: speed }),

  stepForward: () => {
    const { currentIndex, allCandles } = get();
    if (currentIndex >= allCandles.length - 1) {
      set({ isPlaying: false });
      return false;
    }
    set({ currentIndex: currentIndex + 1 });
    return true;
  },

  stepBackward: () => {
    const { currentIndex, startIndex, initialCandleCount } = get();
    const minIndex = startIndex + initialCandleCount;
    if (currentIndex > minIndex) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  executeBuy: (shares, memo, priceType) => {
    const { position, currentIndex, allCandles, tradeHistory } = get();
    if (position) return;

    // Determine which candle and price to use
    let targetIndex = currentIndex;
    let price: number;

    if (priceType === "nextOpen") {
      // Use next candle's open price
      const nextCandle = allCandles[currentIndex + 1];
      if (!nextCandle) return;
      targetIndex = currentIndex + 1;
      price = nextCandle.open;
    } else {
      // Use current candle's selected price
      const candle = allCandles[currentIndex];
      if (!candle) return;
      price = candle[priceType];
    }

    const targetCandle = allCandles[targetIndex];
    if (!targetCandle) return;

    const newPosition: Position = {
      entryPrice: price,
      entryDate: targetCandle.time,
      entryIndex: targetIndex,
      shares,
    };

    const trade: Trade = {
      id: crypto.randomUUID(),
      type: "BUY",
      date: targetCandle.time,
      price,
      shares,
      memo,
      priceType,
    };

    set({
      position: newPosition,
      tradeHistory: [...tradeHistory, trade],
      currentIndex: targetIndex,
    });
  },

  executeSell: (memo, priceType) => {
    const { position, currentIndex, allCandles, tradeHistory } = get();
    if (!position) return;

    // Determine which candle and price to use
    let targetIndex = currentIndex;
    let price: number;

    if (priceType === "nextOpen") {
      // Use next candle's open price
      const nextCandle = allCandles[currentIndex + 1];
      if (!nextCandle) return;
      targetIndex = currentIndex + 1;
      price = nextCandle.open;
    } else {
      // Use current candle's selected price
      const candle = allCandles[currentIndex];
      if (!candle) return;
      price = candle[priceType];
    }

    const targetCandle = allCandles[targetIndex];
    if (!targetCandle) return;

    const pnl = (price - position.entryPrice) * position.shares;
    const pnlPercent =
      ((price - position.entryPrice) / position.entryPrice) * 100;

    const trade: Trade = {
      id: crypto.randomUUID(),
      type: "SELL",
      date: targetCandle.time,
      price,
      shares: position.shares,
      memo,
      priceType,
      pnl,
      pnlPercent,
    };

    set({
      position: null,
      tradeHistory: [...tradeHistory, trade],
      currentIndex: targetIndex,
    });
  },

  getNextCandle: () => {
    const { allCandles, currentIndex } = get();
    return allCandles[currentIndex + 1] || null;
  },

  skip: () => {
    get().stepForward();
  },

  reset: () => {
    set({
      phase: "setup",
      startIndex: 0,
      currentIndex: 0,
      isPlaying: false,
      position: null,
      tradeHistory: [],
    });
  },

  finishSimulation: () => {
    set({
      phase: "finished",
      isPlaying: false,
    });
  },

  // Computed values
  getCurrentCandle: () => {
    const { allCandles, currentIndex } = get();
    return allCandles[currentIndex] || null;
  },

  getVisibleCandles: () => {
    const { allCandles, startIndex, currentIndex } = get();
    return allCandles.slice(startIndex, currentIndex + 1);
  },

  getUnrealizedPnl: () => {
    const { position, allCandles, currentIndex } = get();
    if (!position) return null;

    const currentCandle = allCandles[currentIndex];
    if (!currentCandle) return null;

    const pnl = (currentCandle.close - position.entryPrice) * position.shares;
    const pnlPercent =
      ((currentCandle.close - position.entryPrice) / position.entryPrice) * 100;

    return { pnl, pnlPercent };
  },

  getTotalPnl: () => {
    const { tradeHistory } = get();
    return tradeHistory
      .filter((t) => t.type === "SELL" && t.pnl !== undefined)
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
  },

  getYearHighLow: () => {
    const { allCandles, currentIndex } = get();
    const currentCandle = allCandles[currentIndex];
    if (!currentCandle) return null;

    // Get year start of current candle date
    const currentDate = new Date(currentCandle.time);
    const yearStart = new Date(currentDate.getFullYear(), 0, 1).getTime();

    // Find candles from year start to current index (inclusive)
    const yearCandles = allCandles.filter(
      (c, i) => c.time >= yearStart && i <= currentIndex
    );

    if (yearCandles.length === 0) return null;

    // Find year high and low
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

    return {
      yearHigh,
      yearHighDate,
      yearLow,
      yearLowDate,
      currentPrice,
      fromHigh,
      fromLow,
    };
  },
}));
