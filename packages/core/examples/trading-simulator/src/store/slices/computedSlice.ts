import {
  volumeAboveAverage,
  volumeAccumulation,
  volumeAnomaly,
  volumeBreakout,
  volumeMaCross,
} from "trendcraft";
import type { DetectedVolumeSpike, EquityPoint } from "../../types";
import { getActiveSymbolFromState, getSymbolCurrentIndex } from "../helpers";
import type { ComputedSlice, SliceCreator } from "../types";

export const createComputedSlice: SliceCreator<ComputedSlice> = (set, get) => {
  const getActiveSymbol = () => {
    const { symbols, activeSymbolId } = get();
    return getActiveSymbolFromState(symbols, activeSymbolId);
  };

  return {
    // Backward compatibility getters are defined via Object.defineProperties
    // in createStore.ts to avoid premature evaluation during spread.
    // Placeholder values (overwritten by defineProperties):
    fileName: "" as string,
    allCandles: [] as never[],
    positions: [] as never[],
    tradeHistory: [] as never[],
    indicatorData: null,
    equityCurve: [] as never[],
    currentIndex: 0,
    startIndex: 0,

    getCurrentCandle: () => {
      const { globalDate } = get();
      const symbol = getActiveSymbol();
      if (!symbol) return null;

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      return symbol.allCandles[currentIdx] || null;
    },

    getVisibleCandles: () => {
      const { globalDate } = get();
      const symbol = getActiveSymbol();
      if (!symbol) return [];

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      return symbol.allCandles.slice(symbol.startIndex, currentIdx + 1);
    },

    getUnrealizedPnl: () => {
      const { globalDate } = get();
      const symbol = getActiveSymbol();
      if (!symbol || symbol.positions.length === 0) return null;

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      const currentCandle = symbol.allCandles[currentIdx];
      if (!currentCandle) return null;

      let totalPnl = 0;
      let totalCost = 0;

      for (const pos of symbol.positions) {
        if (pos.direction === "short") {
          // Short: profit when price goes down
          totalPnl += (pos.entryPrice - currentCandle.close) * pos.shares;
        } else {
          // Long: profit when price goes up
          totalPnl += (currentCandle.close - pos.entryPrice) * pos.shares;
        }
        totalCost += pos.entryPrice * pos.shares;
      }

      const pnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
      return { pnl: totalPnl, pnlPercent };
    },

    getPositionSummary: () => {
      const symbol = getActiveSymbol();
      if (!symbol || symbol.positions.length === 0) return null;

      // Return summary for long positions only (legacy behavior)
      const longPositions = symbol.positions.filter((p) => p.direction !== "short");
      if (longPositions.length === 0) return null;

      const totalShares = longPositions.reduce((sum, p) => sum + p.shares, 0);
      const totalCost = longPositions.reduce((sum, p) => sum + p.entryPrice * p.shares, 0);
      const avgEntryPrice = totalCost / totalShares;

      return { totalShares, avgEntryPrice, totalCost, direction: "long" as const };
    },

    getTotalPnl: () => {
      const symbol = getActiveSymbol();
      if (!symbol) return 0;

      return symbol.tradeHistory
        .filter((t) => (t.type === "SELL" || t.type === "BUY_TO_COVER") && t.pnl !== undefined)
        .reduce((sum, t) => sum + (t.pnl || 0), 0);
    },

    getYearHighLow: () => {
      const { globalDate } = get();
      const symbol = getActiveSymbol();
      if (!symbol) return null;

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      const currentCandle = symbol.allCandles[currentIdx];
      if (!currentCandle) return null;

      const currentDate = new Date(currentCandle.time);
      const yearStart = new Date(currentDate.getFullYear(), 0, 1).getTime();

      const yearCandles = symbol.allCandles.filter(
        (c, i) => c.time >= yearStart && i <= currentIdx,
      );

      if (yearCandles.length === 0) return null;

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

      return { yearHigh, yearHighDate, yearLow, yearLowDate, currentPrice, fromHigh, fromLow };
    },

    getHoldingDays: () => {
      const { globalDate } = get();
      const symbol = getActiveSymbol();
      if (!symbol || symbol.positions.length === 0) return null;

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      const firstEntryIndex = Math.min(...symbol.positions.map((p) => p.entryIndex));
      return currentIdx - firstEntryIndex;
    },

    getEquityCurve: () => {
      const symbol = getActiveSymbol();
      return symbol?.equityCurve || [];
    },

    updateEquityCurve: () => {
      const { symbols, globalDate, initialCapital, initialCandleCount, commonDateRange } = get();
      if (!commonDateRange) return;

      const updatedSymbols = symbols.map((symbol) => {
        const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
        const currentCandle = symbol.allCandles[currentIdx];
        if (!currentCandle) return symbol;

        const realizedPnl = symbol.tradeHistory
          .filter((t) => (t.type === "SELL" || t.type === "BUY_TO_COVER") && t.pnl !== undefined)
          .reduce((sum, t) => sum + (t.pnl || 0), 0);

        let unrealizedPnl = 0;
        if (symbol.positions.length > 0) {
          for (const pos of symbol.positions) {
            if (pos.direction === "short") {
              unrealizedPnl += (pos.entryPrice - currentCandle.close) * pos.shares;
            } else {
              unrealizedPnl += (currentCandle.close - pos.entryPrice) * pos.shares;
            }
          }
        }

        const equity = initialCapital + realizedPnl + unrealizedPnl;

        const simStartDateIdx = initialCandleCount;
        const simStartDate = commonDateRange.dates[simStartDateIdx];
        const simStartIdx = getSymbolCurrentIndex(symbol, simStartDate);
        const simStartPrice = symbol.allCandles[simStartIdx]?.close || currentCandle.close;
        const buyHoldReturn = (currentCandle.close - simStartPrice) / simStartPrice;
        const buyHoldEquity = initialCapital * (1 + buyHoldReturn);

        const peak = symbol.equityCurve.reduce((max, p) => Math.max(max, p.equity), initialCapital);
        const drawdown = equity >= peak ? 0 : ((peak - equity) / peak) * 100;

        const lastTrade = symbol.tradeHistory[symbol.tradeHistory.length - 1];
        const tradeType =
          lastTrade && lastTrade.date === currentCandle.time ? lastTrade.type : undefined;

        const newPoint: EquityPoint = {
          time: currentCandle.time,
          equity,
          buyHoldEquity,
          drawdown,
          tradeType,
        };

        return {
          ...symbol,
          equityCurve: [...symbol.equityCurve, newPoint],
        };
      });

      set({ symbols: updatedSymbols });
    },

    getPortfolioStats: () => {
      const { symbols, initialCapital, globalDate, initialCandleCount, commonDateRange } = get();
      if (symbols.length === 0 || !commonDateRange) return null;

      let totalPnl = 0;
      let totalTradeCount = 0;
      let totalWinCount = 0;
      let totalAllocation = 0;

      const symbolStats = symbols.map((symbol) => {
        const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
        const currentCandle = symbol.allCandles[currentIdx];

        const realizedPnl = symbol.tradeHistory
          .filter((t) => (t.type === "SELL" || t.type === "BUY_TO_COVER") && t.pnl !== undefined)
          .reduce((sum, t) => sum + (t.pnl || 0), 0);

        let unrealizedPnl = 0;
        if (symbol.positions.length > 0 && currentCandle) {
          for (const pos of symbol.positions) {
            if (pos.direction === "short") {
              unrealizedPnl += (pos.entryPrice - currentCandle.close) * pos.shares;
            } else {
              unrealizedPnl += (currentCandle.close - pos.entryPrice) * pos.shares;
            }
          }
        }

        const pnl = realizedPnl + unrealizedPnl;
        const pnlPercent = (pnl / initialCapital) * 100;

        const sellTrades = symbol.tradeHistory.filter(
          (t) => t.type === "SELL" || t.type === "BUY_TO_COVER",
        );
        const tradeCount = sellTrades.length;
        const winCount = sellTrades.filter((t) => (t.pnl || 0) > 0).length;
        const winRate = tradeCount > 0 ? (winCount / tradeCount) * 100 : 0;

        let allocation = 0;
        if (symbol.positions.length > 0) {
          const totalCost = symbol.positions.reduce((sum, p) => sum + p.entryPrice * p.shares, 0);
          allocation = totalCost;
        }

        totalPnl += pnl;
        totalTradeCount += tradeCount;
        totalWinCount += winCount;
        totalAllocation += allocation;

        return {
          symbolId: symbol.id,
          fileName: symbol.fileName,
          pnl,
          pnlPercent,
          allocation: 0,
          tradeCount,
          winRate,
        };
      });

      // Calculate allocation ratios
      symbolStats.forEach((s) => {
        const symbol = symbols.find((sym) => sym.id === s.symbolId);
        if (symbol && totalAllocation > 0) {
          const cost = symbol.positions.reduce((sum, p) => sum + p.entryPrice * p.shares, 0);
          s.allocation = (cost / totalAllocation) * 100;
        }
      });

      // Max drawdown across all symbols
      let maxDrawdown = 0;
      for (const symbol of symbols) {
        for (const point of symbol.equityCurve) {
          if (point.drawdown > maxDrawdown) {
            maxDrawdown = point.drawdown;
          }
        }
      }

      // Average alpha
      let totalAlpha = 0;
      let alphaCount = 0;
      for (const symbol of symbols) {
        const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
        const currentCandle = symbol.allCandles[currentIdx];
        if (!currentCandle) continue;

        const simStartDateIdx = initialCandleCount;
        const simStartDate = commonDateRange.dates[simStartDateIdx];
        const simStartIdx = getSymbolCurrentIndex(symbol, simStartDate);
        const simStartPrice = symbol.allCandles[simStartIdx]?.close;

        if (simStartPrice) {
          const buyHoldReturn = ((currentCandle.close - simStartPrice) / simStartPrice) * 100;
          const symbolPnlPercent =
            symbolStats.find((s) => s.symbolId === symbol.id)?.pnlPercent || 0;
          totalAlpha += symbolPnlPercent - buyHoldReturn;
          alphaCount++;
        }
      }

      return {
        totalPnl,
        totalPnlPercent: (totalPnl / initialCapital) * 100,
        symbolStats,
        aggregatedStats: {
          totalTradeCount,
          overallWinRate: totalTradeCount > 0 ? (totalWinCount / totalTradeCount) * 100 : 0,
          maxDrawdown,
          avgAlpha: alphaCount > 0 ? totalAlpha / alphaCount : 0,
        },
      };
    },

    getDetectedVolumeSpikes: () => {
      const { symbols, activeSymbolId, globalDate, volumeSpikeSettings } = get();
      const symbol = getActiveSymbolFromState(symbols, activeSymbolId);

      if (!symbol || !volumeSpikeSettings.showChartMarkers) return [];

      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      const startIdx = symbol.startIndex;
      if (currentIdx < startIdx) return [];

      const visibleCandles = symbol.allCandles.slice(0, currentIdx + 1);
      const spikes: DetectedVolumeSpike[] = [];

      // Average volume detection
      if (volumeSpikeSettings.averageVolumeEnabled) {
        const anomalies = volumeAnomaly(visibleCandles, {
          period: volumeSpikeSettings.averageVolumePeriod,
          highThreshold: volumeSpikeSettings.averageVolumeMultiplier,
        });

        for (let i = startIdx; i <= currentIdx; i++) {
          const anomaly = anomalies[i];
          if (anomaly?.value.isAnomaly) {
            spikes.push({
              time: anomaly.time,
              volume: anomaly.value.volume,
              type: "average",
              ratio: anomaly.value.ratio,
            });
          }
        }
      }

      // Breakout detection
      if (volumeSpikeSettings.breakoutVolumeEnabled) {
        const breakouts = volumeBreakout(visibleCandles, {
          period: volumeSpikeSettings.breakoutVolumePeriod,
        });

        for (const breakout of breakouts) {
          const idx = visibleCandles.findIndex((c) => c.time === breakout.time);
          if (idx >= startIdx) {
            const existingIdx = spikes.findIndex((s) => s.time === breakout.time);
            if (existingIdx >= 0) {
              spikes[existingIdx] = {
                time: breakout.time,
                volume: breakout.volume,
                type: "breakout",
                ratio: breakout.ratio,
              };
            } else {
              spikes.push({
                time: breakout.time,
                volume: breakout.volume,
                type: "breakout",
                ratio: breakout.ratio,
              });
            }
          }
        }
      }

      // Accumulation phase detection
      if (volumeSpikeSettings.accumulationEnabled) {
        const accumulations = volumeAccumulation(visibleCandles, {
          period: volumeSpikeSettings.accumulationPeriod,
          minSlope: volumeSpikeSettings.accumulationMinSlope,
          minConsecutiveDays: volumeSpikeSettings.accumulationMinDays,
        });

        for (const accum of accumulations) {
          const idx = visibleCandles.findIndex((c) => c.time === accum.time);
          if (idx >= startIdx) {
            const existingIdx = spikes.findIndex((s) => s.time === accum.time);
            if (existingIdx < 0) {
              spikes.push({
                time: accum.time,
                volume: accum.volume,
                type: "accumulation",
                ratio: accum.normalizedSlope,
                consecutiveDays: accum.consecutiveDays,
              });
            }
          }
        }
      }

      // Above average detection
      if (volumeSpikeSettings.aboveAverageEnabled) {
        const aboveAvgSignals = volumeAboveAverage(visibleCandles, {
          period: volumeSpikeSettings.aboveAveragePeriod,
          minRatio: volumeSpikeSettings.aboveAverageMinRatio,
          minConsecutiveDays: volumeSpikeSettings.aboveAverageMinDays,
        });

        for (const aboveAvg of aboveAvgSignals) {
          const idx = visibleCandles.findIndex((c) => c.time === aboveAvg.time);
          if (idx >= startIdx) {
            const existingIdx = spikes.findIndex((s) => s.time === aboveAvg.time);
            if (existingIdx < 0) {
              spikes.push({
                time: aboveAvg.time,
                volume: aboveAvg.volume,
                type: "above_average",
                ratio: aboveAvg.ratio,
                consecutiveDays: aboveAvg.consecutiveDays,
              });
            }
          }
        }
      }

      // MA cross detection
      if (volumeSpikeSettings.maCrossEnabled) {
        const crosses = volumeMaCross(visibleCandles, {
          shortPeriod: volumeSpikeSettings.maCrossShortPeriod,
          longPeriod: volumeSpikeSettings.maCrossLongPeriod,
        });

        for (const cross of crosses) {
          if (cross.daysSinceCross !== 1) continue;
          const idx = visibleCandles.findIndex((c) => c.time === cross.time);
          if (idx >= startIdx) {
            const existingIdx = spikes.findIndex((s) => s.time === cross.time);
            if (existingIdx < 0) {
              spikes.push({
                time: cross.time,
                volume: cross.volume,
                type: "ma_cross",
                ratio: cross.ratio,
              });
            }
          }
        }
      }

      return spikes;
    },
  };
};
