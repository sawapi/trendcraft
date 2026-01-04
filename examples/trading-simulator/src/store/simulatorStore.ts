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
  taxRate: number;          // 譲渡益税率(%)
  stopLossPercent: number;  // 損切り%（チャート表示用）
  takeProfitPercent: number; // 利確%（チャート表示用）
  trailingStopEnabled: boolean;   // トレーリングストップ有効
  trailingStopPercent: number;    // トレーリングストップ%

  // Alerts
  alerts: Alert[];

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

  // Equity Curve
  equityCurve: EquityPoint[];

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
  executeSell: (shares: number, memo: string, priceType: PriceType, exitReason: ExitReason, exitTrigger?: ExitTrigger) => void;
  executeSellAll: (memo: string, priceType: PriceType, exitReason: ExitReason, exitTrigger?: ExitTrigger) => void;
  updatePositionMFEMAE: () => void;
  getNextCandle: () => NormalizedCandle | null;
  skip: () => void;
  reset: () => void;
  finishSimulation: () => void;
  jumpToIndex: (index: number) => void;
  dismissAlert: (id: string) => void;

  // Computed
  getCurrentCandle: () => NormalizedCandle | null;
  getVisibleCandles: () => NormalizedCandle[];
  getUnrealizedPnl: () => { pnl: number; pnlPercent: number } | null;
  getPositionSummary: () => PositionSummary | null;
  getTotalPnl: () => number;
  getYearHighLow: () => YearHighLow | null;
  getHoldingDays: () => number | null;
  getEquityCurve: () => EquityPoint[];
  updateEquityCurve: () => void;
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
  taxRate: 20.315,
  stopLossPercent: 5,
  takeProfitPercent: 10,
  trailingStopEnabled: false,
  trailingStopPercent: 5,
  alerts: [],
  currentIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  positions: [],
  tradeHistory: [],
  allCandles: [],
  indicatorData: null,
  equityCurve: [],

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

    // 初期Equity Curveを作成
    const simStartCandle = allCandles[startIdx];
    const initialEquityPoint: EquityPoint = {
      time: simStartCandle?.time || 0,
      equity: config.initialCapital,
      buyHoldEquity: config.initialCapital,
      drawdown: 0,
    };

    set({
      phase: "running",
      startIndex: initialIdx,
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
      currentIndex: startIdx,
      isPlaying: false,
      positions: [],
      tradeHistory: [],
      indicatorData,
      equityCurve: [initialEquityPoint],
    });
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setSpeed: (speed) => set({ playbackSpeed: speed }),

  stepForward: () => {
    const { currentIndex, allCandles, positions, stopLossPercent, takeProfitPercent, trailingStopEnabled, alerts } = get();
    if (currentIndex >= allCandles.length - 1) {
      set({ isPlaying: false });
      return false;
    }
    const newIndex = currentIndex + 1;
    set({ currentIndex: newIndex });
    // MFE/MAE更新
    get().updatePositionMFEMAE();
    // Equity Curve更新
    get().updateEquityCurve();

    // 損切り/利確アラートチェック
    if (positions.length > 0) {
      const summary = get().getPositionSummary();
      const candle = allCandles[newIndex];
      if (summary && candle) {
        const avgEntry = summary.avgEntryPrice;
        const stopLossPrice = avgEntry * (1 - stopLossPercent / 100);
        const takeProfitPrice = avgEntry * (1 + takeProfitPercent / 100);

        // 損切りアラート（安値がストップロス価格を下回った）
        if (candle.low <= stopLossPrice) {
          const existingAlert = alerts.find(
            (a) => a.type === "STOP_LOSS_WARNING"
          );
          if (!existingAlert) {
            set({
              alerts: [
                ...alerts,
                {
                  id: crypto.randomUUID(),
                  type: "STOP_LOSS_WARNING",
                  message: `損切りライン(${stopLossPrice.toLocaleString()}円, -${stopLossPercent}%)に接触しました`,
                  timestamp: Date.now(),
                },
              ],
            });
          }
        }

        // 利確アラート（高値が利確価格を超えた）
        if (candle.high >= takeProfitPrice) {
          const existingAlert = alerts.find(
            (a) => a.type === "TAKE_PROFIT_REACHED"
          );
          if (!existingAlert) {
            set({
              alerts: [
                ...get().alerts,
                {
                  id: crypto.randomUUID(),
                  type: "TAKE_PROFIT_REACHED",
                  message: `利確ライン(${takeProfitPrice.toLocaleString()}円, +${takeProfitPercent}%)に到達しました`,
                  timestamp: Date.now(),
                },
              ],
            });
          }
        }

        // トレーリングストップアラート
        if (trailingStopEnabled) {
          // 全ポジションのトレーリングストップ価格のうち、最小のものを取得
          const trailingStopPrices = get().positions
            .filter((p) => p.trailingStopPrice !== undefined)
            .map((p) => p.trailingStopPrice!);

          if (trailingStopPrices.length > 0) {
            const minTrailingStop = Math.min(...trailingStopPrices);
            // 安値がトレーリングストップ価格を下回った
            if (candle.low <= minTrailingStop) {
              const existingAlert = get().alerts.find(
                (a) => a.type === "TRAILING_STOP_HIT"
              );
              if (!existingAlert) {
                set({
                  alerts: [
                    ...get().alerts,
                    {
                      id: crypto.randomUUID(),
                      type: "TRAILING_STOP_HIT",
                      message: `トレーリングストップ(${minTrailingStop.toLocaleString()}円)に到達しました`,
                      timestamp: Date.now(),
                    },
                  ],
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
    const { positions, allCandles, currentIndex, trailingStopEnabled, trailingStopPercent } = get();
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

        // トレーリングストップ価格を更新（新高値からN%下）
        if (trailingStopEnabled) {
          const newTrailingStop = candle.high * (1 - trailingStopPercent / 100);
          // 既存のトレーリングストップより高い場合のみ更新（下げない）
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
    const { currentIndex, allCandles, tradeHistory, positions, indicatorData, commissionRate, slippageBps, trailingStopEnabled, trailingStopPercent } = get();

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
    // トレーリングストップが有効な場合、初期価格を設定（高値からN%下）
    const initialTrailingStop = trailingStopEnabled
      ? targetCandle.high * (1 - trailingStopPercent / 100)
      : undefined;

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
      trailingStopPrice: initialTrailingStop,
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

  executeSell: (shares, memo, priceType, exitReason, exitTrigger) => {
    const { positions, currentIndex, allCandles, tradeHistory, indicatorData, commissionRate, slippageBps, taxRate } = get();
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

    // 税金計算（利益がある場合のみ）
    const tax = netPnl > 0 ? netPnl * (taxRate / 100) : 0;
    const afterTaxPnl = netPnl - tax;

    // MFE活用度計算（MFEの何%を獲得できたか）
    const mfeUtilization = totalMfeValue > 0 ? (pnlPercent / totalMfeValue) * 100 : 0;

    const trade: Trade = {
      id: crypto.randomUUID(),
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

    // ポジションが空になったらアラートもクリア
    const newAlerts = newPositions.length === 0 ? [] : get().alerts;

    set({
      positions: newPositions,
      tradeHistory: [...tradeHistory, trade],
      currentIndex: targetIndex,
      alerts: newAlerts,
    });
  },

  executeSellAll: (memo, priceType, exitReason, exitTrigger) => {
    const summary = get().getPositionSummary();
    if (!summary) return;
    get().executeSell(summary.totalShares, memo, priceType, exitReason, exitTrigger);
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

  jumpToIndex: (index: number) => {
    const { startIndex, initialCandleCount, allCandles } = get();
    const minIndex = startIndex + initialCandleCount;
    const maxIndex = allCandles.length - 1;

    if (index >= minIndex && index <= maxIndex) {
      set({
        currentIndex: index,
        isPlaying: false,
      });
    }
  },

  dismissAlert: (id: string) => {
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    }));
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

  getHoldingDays: () => {
    const { positions, currentIndex } = get();
    if (positions.length === 0) return null;

    // 最初のエントリーインデックスを取得
    const firstEntryIndex = Math.min(...positions.map((p) => p.entryIndex));
    return currentIndex - firstEntryIndex;
  },

  getEquityCurve: () => {
    return get().equityCurve;
  },

  updateEquityCurve: () => {
    const {
      allCandles,
      currentIndex,
      initialCapital,
      tradeHistory,
      positions,
      startIndex,
      initialCandleCount,
      equityCurve
    } = get();

    const currentCandle = allCandles[currentIndex];
    if (!currentCandle) return;

    // 確定損益を計算
    const realizedPnl = tradeHistory
      .filter((t) => t.type === "SELL" && t.pnl !== undefined)
      .reduce((sum, t) => sum + (t.pnl || 0), 0);

    // 含み損益を計算
    let unrealizedPnl = 0;
    if (positions.length > 0) {
      const totalShares = positions.reduce((sum, p) => sum + p.shares, 0);
      const totalCost = positions.reduce((sum, p) => sum + p.entryPrice * p.shares, 0);
      const avgEntryPrice = totalCost / totalShares;
      unrealizedPnl = (currentCandle.close - avgEntryPrice) * totalShares;
    }

    // 現在の資産
    const equity = initialCapital + realizedPnl + unrealizedPnl;

    // Buy&Hold計算
    const simStartIndex = startIndex + initialCandleCount;
    const simStartPrice = allCandles[simStartIndex]?.close || currentCandle.close;
    const buyHoldReturn = (currentCandle.close - simStartPrice) / simStartPrice;
    const buyHoldEquity = initialCapital * (1 + buyHoldReturn);

    // ドローダウン計算（ピークからの下落）
    const peak = equityCurve.reduce((max, p) => Math.max(max, p.equity), initialCapital);
    const drawdown = equity >= peak ? 0 : ((peak - equity) / peak) * 100;

    // トレードマーカーがあるかチェック
    const lastTrade = tradeHistory[tradeHistory.length - 1];
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

    set({ equityCurve: [...equityCurve, newPoint] });
  },
}));
