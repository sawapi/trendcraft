import type {
  ExitReason,
  ExitTrigger,
  IndicatorSnapshot,
  MarketContext,
  Position,
  PriceType,
  Trade,
} from "../../types";
import { analyzeMarketContext, getIndicatorSnapshot } from "../../utils/indicators";
import { generateId, getActiveSymbolFromState, getSymbolCurrentIndex } from "../helpers";
import type { SliceCreator, TradingSlice } from "../types";

export const createTradingSlice: SliceCreator<TradingSlice> = (set, get) => ({
  executeBuy: (shares: number, memo: string, priceType: PriceType) => {
    get().pushTradeSnapshot();
    const {
      symbols,
      activeSymbolId,
      globalDate,
      commonDateRange,
      currentDateIndex,
      commissionRate,
      slippageBps,
      trailingStopEnabled,
      trailingStopPercent,
    } = get();

    const symbolIdx = symbols.findIndex((s) => s.id === activeSymbolId);
    if (symbolIdx === -1 || !commonDateRange) return;

    const symbol = symbols[symbolIdx];
    const currentIdx = getSymbolCurrentIndex(symbol, globalDate);

    let targetDateIndex = currentDateIndex;
    let targetIdx = currentIdx;
    let price: number;

    if (priceType === "nextOpen") {
      if (currentDateIndex >= commonDateRange.dates.length - 1) return;
      targetDateIndex = currentDateIndex + 1;
      const targetDate = commonDateRange.dates[targetDateIndex];
      targetIdx = getSymbolCurrentIndex(symbol, targetDate);
      const nextCandle = symbol.allCandles[targetIdx];
      if (!nextCandle) return;
      price = nextCandle.open;
    } else {
      const candle = symbol.allCandles[currentIdx];
      if (!candle) return;
      price = candle[priceType];
    }

    const targetCandle = symbol.allCandles[targetIdx];
    if (!targetCandle) return;

    const slippage = price * (slippageBps / 10000);
    const effectivePrice = price + slippage;
    const commission = effectivePrice * shares * (commissionRate / 100);

    let indicators: IndicatorSnapshot | undefined;
    let marketContext: MarketContext | undefined;

    if (symbol.indicatorData) {
      indicators = getIndicatorSnapshot(symbol.indicatorData, currentIdx);
      marketContext = analyzeMarketContext(symbol.allCandles, currentIdx, symbol.indicatorData);
    }

    const initialTrailingStop = trailingStopEnabled
      ? targetCandle.high * (1 - trailingStopPercent / 100)
      : undefined;

    const newPosition: Position = {
      id: generateId(),
      entryPrice: effectivePrice,
      entryDate: targetCandle.time,
      entryIndex: targetIdx,
      shares,
      highestPrice: targetCandle.high,
      lowestPrice: targetCandle.low,
      highestDate: targetCandle.time,
      lowestDate: targetCandle.time,
      commission,
      trailingStopPrice: initialTrailingStop,
    };

    const trade: Trade = {
      id: generateId(),
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

    const newSymbols = [...symbols];
    newSymbols[symbolIdx] = {
      ...symbol,
      positions: [...symbol.positions, newPosition],
      tradeHistory: [...symbol.tradeHistory, trade],
    };

    const targetGlobalDate = commonDateRange.dates[targetDateIndex];

    set({
      symbols: newSymbols,
      currentDateIndex: targetDateIndex,
      globalDate: targetGlobalDate,
    });
  },

  executeSell: (
    shares: number,
    memo: string,
    priceType: PriceType,
    exitReason: ExitReason,
    exitTrigger?: ExitTrigger,
  ) => {
    get().pushTradeSnapshot();
    const {
      symbols,
      activeSymbolId,
      globalDate,
      commonDateRange,
      currentDateIndex,
      commissionRate,
      slippageBps,
      taxRate,
    } = get();

    const symbolIdx = symbols.findIndex((s) => s.id === activeSymbolId);
    if (symbolIdx === -1 || !commonDateRange) return;

    const symbol = symbols[symbolIdx];
    if (symbol.positions.length === 0) return;

    const summary = get().getPositionSummary();
    if (!summary || shares > summary.totalShares) return;

    const currentIdx = getSymbolCurrentIndex(symbol, globalDate);

    let targetDateIndex = currentDateIndex;
    let targetIdx = currentIdx;
    let price: number;

    if (priceType === "nextOpen") {
      if (currentDateIndex >= commonDateRange.dates.length - 1) return;
      targetDateIndex = currentDateIndex + 1;
      const targetDate = commonDateRange.dates[targetDateIndex];
      targetIdx = getSymbolCurrentIndex(symbol, targetDate);
      const nextCandle = symbol.allCandles[targetIdx];
      if (!nextCandle) return;
      price = nextCandle.open;
    } else {
      const candle = symbol.allCandles[currentIdx];
      if (!candle) return;
      price = candle[priceType];
    }

    const targetCandle = symbol.allCandles[targetIdx];
    if (!targetCandle) return;

    const slippage = price * (slippageBps / 10000);
    const effectivePrice = price - slippage;
    const sellCommission = effectivePrice * shares * (commissionRate / 100);

    // MFE/MAE calculation
    let totalMfeValue = 0;
    let totalMaeValue = 0;
    let totalBuyCommission = 0;
    let mfePrice = 0;
    let maePrice = 0;
    let mfeDate = 0;
    let maeDate = 0;
    let remainingForMFE = shares;

    for (const pos of symbol.positions) {
      if (remainingForMFE <= 0) break;
      const posShares = Math.min(pos.shares, remainingForMFE);
      const weight = posShares / shares;

      const posMfe = ((pos.highestPrice - pos.entryPrice) / pos.entryPrice) * 100;
      const posMae = ((pos.lowestPrice - pos.entryPrice) / pos.entryPrice) * 100;
      totalMfeValue += posMfe * weight;
      totalMaeValue += posMae * weight;
      totalBuyCommission += pos.commission * (posShares / pos.shares);

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

    let indicators: IndicatorSnapshot | undefined;
    let marketContext: MarketContext | undefined;

    if (symbol.indicatorData) {
      indicators = getIndicatorSnapshot(symbol.indicatorData, currentIdx);
      marketContext = analyzeMarketContext(symbol.allCandles, currentIdx, symbol.indicatorData);
    }

    const grossPnl = (effectivePrice - summary.avgEntryPrice) * shares;
    const netPnl = grossPnl - totalBuyCommission - sellCommission;
    const pnlPercent = ((effectivePrice - summary.avgEntryPrice) / summary.avgEntryPrice) * 100;
    const tax = netPnl > 0 ? netPnl * (taxRate / 100) : 0;
    const afterTaxPnl = netPnl - tax;
    const mfeUtilization = totalMfeValue > 0 ? (pnlPercent / totalMfeValue) * 100 : 0;

    const trade: Trade = {
      id: generateId(),
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

    // FIFO position reduction
    let remainingSharesToSell = shares;
    const newPositions: Position[] = [];

    for (const pos of symbol.positions) {
      if (remainingSharesToSell <= 0) {
        newPositions.push(pos);
      } else if (pos.shares <= remainingSharesToSell) {
        remainingSharesToSell -= pos.shares;
      } else {
        newPositions.push({
          ...pos,
          shares: pos.shares - remainingSharesToSell,
        });
        remainingSharesToSell = 0;
      }
    }

    const newSymbols = [...symbols];
    newSymbols[symbolIdx] = {
      ...symbol,
      positions: newPositions,
      tradeHistory: [...symbol.tradeHistory, trade],
    };

    const newAlerts = newPositions.length === 0 ? [] : get().alerts;
    const targetGlobalDate = commonDateRange.dates[targetDateIndex];

    set({
      symbols: newSymbols,
      currentDateIndex: targetDateIndex,
      globalDate: targetGlobalDate,
      alerts: newAlerts,
    });
  },

  executeSellAll: (
    memo: string,
    priceType: PriceType,
    exitReason: ExitReason,
    exitTrigger?: ExitTrigger,
  ) => {
    const summary = get().getPositionSummary();
    if (!summary) return;
    get().executeSell(summary.totalShares, memo, priceType, exitReason, exitTrigger);
  },

  getNextCandle: () => {
    const { commonDateRange, currentDateIndex, symbols, activeSymbolId } = get();
    const symbol = getActiveSymbolFromState(symbols, activeSymbolId);
    if (!symbol || !commonDateRange) return null;

    if (currentDateIndex >= commonDateRange.dates.length - 1) return null;

    const nextDate = commonDateRange.dates[currentDateIndex + 1];
    const nextIdx = getSymbolCurrentIndex(symbol, nextDate);
    return symbol.allCandles[nextIdx] || null;
  },

  updatePositionMFEMAE: () => {
    const { symbols, globalDate, trailingStopEnabled, trailingStopPercent } = get();

    const updatedSymbols = symbols.map((symbol) => {
      if (symbol.positions.length === 0) return symbol;

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      const candle = symbol.allCandles[currentIdx];
      if (!candle) return symbol;

      let updated = false;
      const newPositions = symbol.positions.map((pos) => {
        let newPos = pos;

        if (candle.high > pos.highestPrice) {
          newPos = { ...newPos, highestPrice: candle.high, highestDate: candle.time };
          updated = true;

          if (trailingStopEnabled) {
            const newTrailingStop = candle.high * (1 - trailingStopPercent / 100);
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
        return { ...symbol, positions: newPositions };
      }
      return symbol;
    });

    set({ symbols: updatedSymbols });
  },
});
