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
} from "../types";
import { DEFAULT_INDICATOR_PARAMS } from "../types";
import { calculateIndicators, getIndicatorSnapshot, analyzeMarketContext, type IndicatorData } from "../utils/indicators";

interface SimulatorState {
  // Phase
  phase: SimulatorPhase;
  fileName: string;

  // Configuration
  startIndex: number;
  initialCandleCount: number;
  initialCapital: number;
  enabledIndicators: string[];
  indicatorParams: IndicatorParams;
  commissionRate: number;   // 手数料率(%)
  slippageBps: number;      // スリッページ(bps)
  stopLossPercent: number;  // 損切り%（チャート表示用）

  // Playback
  currentIndex: number;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;

  // Position & Trades (複数ポジション対応)
  positions: Position[];
  tradeHistory: Trade[];

  // Data
  allCandles: NormalizedCandle[];
  indicatorData: IndicatorData | null;

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
  executeSell: (shares: number, memo: string, priceType: PriceType, exitReason: ExitReason) => void;
  executeSellAll: (memo: string, priceType: PriceType, exitReason: ExitReason) => void;
  updatePositionMFEMAE: () => void;
  getNextCandle: () => NormalizedCandle | null;
  skip: () => void;
  reset: () => void;
  finishSimulation: () => void;

  // Computed
  getCurrentCandle: () => NormalizedCandle | null;
  getVisibleCandles: () => NormalizedCandle[];
  getUnrealizedPnl: () => { pnl: number; pnlPercent: number } | null;
  getPositionSummary: () => PositionSummary | null;
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
  indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },
  commissionRate: 0,
  slippageBps: 0,
  stopLossPercent: 5,
  currentIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  positions: [],
  tradeHistory: [],
  allCandles: [],
  indicatorData: null,

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

    // レポート用にインジケーターを計算（MA25, MA75, RSI, MACD, BBは常に計算）
    const reportIndicators = new Set([
      ...config.enabledIndicators,
      "sma25",
      "sma75",
      "rsi",
      "macd",
      "bb",
    ]);
    const indicatorData = calculateIndicators(
      allCandles,
      Array.from(reportIndicators),
      config.indicatorParams
    );

    set({
      phase: "running",
      startIndex: initialIdx,
      initialCandleCount: config.initialCandleCount,
      initialCapital: config.initialCapital,
      enabledIndicators: config.enabledIndicators,
      indicatorParams: config.indicatorParams,
      commissionRate: config.commissionRate,
      slippageBps: config.slippageBps,
      stopLossPercent: config.stopLossPercent,
      currentIndex: startIdx,
      isPlaying: false,
      positions: [],
      tradeHistory: [],
      indicatorData,
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
    const newIndex = currentIndex + 1;
    set({ currentIndex: newIndex });
    // MFE/MAE更新
    get().updatePositionMFEMAE();
    return true;
  },

  updatePositionMFEMAE: () => {
    const { positions, allCandles, currentIndex } = get();
    if (positions.length === 0) return;

    const candle = allCandles[currentIndex];
    if (!candle) return;

    let updated = false;
    const newPositions = positions.map((pos) => {
      let newPos = pos;
      // High/Lowベースで更新
      if (candle.high > pos.highestPrice) {
        newPos = { ...newPos, highestPrice: candle.high, highestDate: candle.time };
        updated = true;
      }
      if (candle.low < pos.lowestPrice) {
        newPos = { ...newPos, lowestPrice: candle.low, lowestDate: candle.time };
        updated = true;
      }
      return newPos;
    });

    if (updated) {
      set({ positions: newPositions });
    }
  },

  stepBackward: () => {
    const { currentIndex, startIndex, initialCandleCount } = get();
    const minIndex = startIndex + initialCandleCount;
    if (currentIndex > minIndex) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  executeBuy: (shares, memo, priceType) => {
    const { currentIndex, allCandles, tradeHistory, positions, indicatorData, commissionRate, slippageBps } = get();

    // Determine which candle and price to use
    let targetIndex = currentIndex;
    let price: number;

    if (priceType === "nextOpen") {
      const nextCandle = allCandles[currentIndex + 1];
      if (!nextCandle) return;
      targetIndex = currentIndex + 1;
      price = nextCandle.open;
    } else {
      const candle = allCandles[currentIndex];
      if (!candle) return;
      price = candle[priceType];
    }

    const targetCandle = allCandles[targetIndex];
    if (!targetCandle) return;

    // スリッページ計算（買いは高くなる）
    const slippage = price * (slippageBps / 10000);
    const effectivePrice = price + slippage;

    // 手数料計算
    const commission = effectivePrice * shares * (commissionRate / 100);

    // インジケータースナップショットとマーケットコンテキストを取得
    let indicators: IndicatorSnapshot | undefined;
    let marketContext: MarketContext | undefined;

    if (indicatorData) {
      indicators = getIndicatorSnapshot(indicatorData, currentIndex);
      marketContext = analyzeMarketContext(allCandles, currentIndex, indicatorData);
    }

    // 新しいポジションを追加（追加買い対応）
    // MFE/MAE追跡用にhighest/lowestを初期化
    const newPosition: Position = {
      id: crypto.randomUUID(),
      entryPrice: effectivePrice,
      entryDate: targetCandle.time,
      entryIndex: targetIndex,
      shares,
      highestPrice: targetCandle.high,
      lowestPrice: targetCandle.low,
      highestDate: targetCandle.time,
      lowestDate: targetCandle.time,
      commission,
    };

    const trade: Trade = {
      id: crypto.randomUUID(),
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

    set({
      positions: [...positions, newPosition],
      tradeHistory: [...tradeHistory, trade],
      currentIndex: targetIndex,
    });
  },

  executeSell: (shares, memo, priceType, exitReason) => {
    const { positions, currentIndex, allCandles, tradeHistory, indicatorData, commissionRate, slippageBps } = get();
    if (positions.length === 0) return;

    // 平均取得単価を計算
    const summary = get().getPositionSummary();
    if (!summary || shares > summary.totalShares) return;

    // Determine which candle and price to use
    let targetIndex = currentIndex;
    let price: number;

    if (priceType === "nextOpen") {
      const nextCandle = allCandles[currentIndex + 1];
      if (!nextCandle) return;
      targetIndex = currentIndex + 1;
      price = nextCandle.open;
    } else {
      const candle = allCandles[currentIndex];
      if (!candle) return;
      price = candle[priceType];
    }

    const targetCandle = allCandles[targetIndex];
    if (!targetCandle) return;

    // スリッページ計算（売りは安くなる）
    const slippage = price * (slippageBps / 10000);
    const effectivePrice = price - slippage;

    // 売却手数料計算
    const sellCommission = effectivePrice * shares * (commissionRate / 100);

    // MFE/MAE計算（売却対象ポジションの加重平均）
    let totalMfeValue = 0;
    let totalMaeValue = 0;
    let totalBuyCommission = 0;
    let mfePrice = 0;
    let maePrice = 0;
    let mfeDate = 0;
    let maeDate = 0;
    let remainingForMFE = shares;

    for (const pos of positions) {
      if (remainingForMFE <= 0) break;
      const posShares = Math.min(pos.shares, remainingForMFE);
      const weight = posShares / shares;

      // MFE/MAE (%)
      const posMfe = ((pos.highestPrice - pos.entryPrice) / pos.entryPrice) * 100;
      const posMae = ((pos.lowestPrice - pos.entryPrice) / pos.entryPrice) * 100;
      totalMfeValue += posMfe * weight;
      totalMaeValue += posMae * weight;
      totalBuyCommission += pos.commission * (posShares / pos.shares);

      // 最高値/最安値を記録（最初に見つかったものを使用）
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

    // インジケータースナップショットとマーケットコンテキストを取得
    let indicators: IndicatorSnapshot | undefined;
    let marketContext: MarketContext | undefined;

    if (indicatorData) {
      indicators = getIndicatorSnapshot(indicatorData, currentIndex);
      marketContext = analyzeMarketContext(allCandles, currentIndex, indicatorData);
    }

    // P&L計算
    const grossPnl = (effectivePrice - summary.avgEntryPrice) * shares;
    const netPnl = grossPnl - totalBuyCommission - sellCommission;
    const pnlPercent = ((effectivePrice - summary.avgEntryPrice) / summary.avgEntryPrice) * 100;

    const trade: Trade = {
      id: crypto.randomUUID(),
      type: "SELL",
      date: targetCandle.time,
      price,
      shares,
      memo,
      priceType,
      pnl: netPnl,
      pnlPercent,
      indicators,
      marketContext,
      effectivePrice,
      slippage,
      commission: sellCommission,
      exitReason,
      grossPnl,
      netPnl,
      mfe: totalMfeValue,
      mae: totalMaeValue,
      mfePrice,
      maePrice,
      mfeDate,
      maeDate,
    };

    // FIFO方式でポジションを削減
    let remainingSharesToSell = shares;
    const newPositions: Position[] = [];

    for (const pos of positions) {
      if (remainingSharesToSell <= 0) {
        newPositions.push(pos);
      } else if (pos.shares <= remainingSharesToSell) {
        // このポジションを全て売却
        remainingSharesToSell -= pos.shares;
      } else {
        // このポジションを部分売却
        newPositions.push({
          ...pos,
          shares: pos.shares - remainingSharesToSell,
        });
        remainingSharesToSell = 0;
      }
    }

    set({
      positions: newPositions,
      tradeHistory: [...tradeHistory, trade],
      currentIndex: targetIndex,
    });
  },

  executeSellAll: (memo, priceType, exitReason) => {
    const summary = get().getPositionSummary();
    if (!summary) return;
    get().executeSell(summary.totalShares, memo, priceType, exitReason);
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
      positions: [],
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
    const { positions, allCandles, currentIndex } = get();
    if (positions.length === 0) return null;

    const currentCandle = allCandles[currentIndex];
    if (!currentCandle) return null;

    const summary = get().getPositionSummary();
    if (!summary) return null;

    const pnl = (currentCandle.close - summary.avgEntryPrice) * summary.totalShares;
    const pnlPercent =
      ((currentCandle.close - summary.avgEntryPrice) / summary.avgEntryPrice) * 100;

    return { pnl, pnlPercent };
  },

  getPositionSummary: () => {
    const { positions } = get();
    if (positions.length === 0) return null;

    const totalShares = positions.reduce((sum, p) => sum + p.shares, 0);
    const totalCost = positions.reduce((sum, p) => sum + p.entryPrice * p.shares, 0);
    const avgEntryPrice = totalCost / totalShares;

    return { totalShares, avgEntryPrice, totalCost };
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
