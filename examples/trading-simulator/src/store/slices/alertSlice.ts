import {
  cmf,
  obv,
  volumeAboveAverage,
  volumeAccumulation,
  volumeAnomaly,
  volumeBreakout,
  volumeMaCross,
} from "trendcraft";
import { generateId, getActiveSymbolFromState, getSymbolCurrentIndex } from "../helpers";
import type { AlertSlice, SliceCreator } from "../types";

export const createAlertSlice: SliceCreator<AlertSlice> = (set, get) => ({
  alerts: [],

  dismissAlert: (id: string) => {
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    }));
  },

  checkPositionAlerts: () => {
    const {
      symbols,
      activeSymbolId,
      globalDate,
      stopLossPercent,
      takeProfitPercent,
      trailingStopEnabled,
      alerts,
    } = get();

    const activeSymbol = getActiveSymbolFromState(symbols, activeSymbolId);
    if (!activeSymbol || activeSymbol.positions.length === 0) return;

    const summary = get().getPositionSummary();
    const shortSummary = get().getShortPositionSummary();
    const currentIdx = getSymbolCurrentIndex(activeSymbol, globalDate);
    const candle = activeSymbol.allCandles[currentIdx];

    if (!candle) return;

    // Long position alerts
    if (summary) {
      const avgEntry = summary.avgEntryPrice;
      const stopLossPrice = avgEntry * (1 - stopLossPercent / 100);
      const takeProfitPrice = avgEntry * (1 + takeProfitPercent / 100);

      if (candle.low <= stopLossPrice) {
        const existingAlert = alerts.find((a) => a.type === "STOP_LOSS_WARNING");
        if (!existingAlert) {
          set({
            alerts: [
              ...alerts,
              {
                id: generateId(),
                type: "STOP_LOSS_WARNING",
                message: `Stop loss line hit (${stopLossPrice.toLocaleString()}, -${stopLossPercent}%)`,
                timestamp: Date.now(),
              },
            ],
          });
        }
      }

      if (candle.high >= takeProfitPrice) {
        const existingAlert = alerts.find((a) => a.type === "TAKE_PROFIT_REACHED");
        if (!existingAlert) {
          set({
            alerts: [
              ...get().alerts,
              {
                id: generateId(),
                type: "TAKE_PROFIT_REACHED",
                message: `Take profit line reached (${takeProfitPrice.toLocaleString()}, +${takeProfitPercent}%)`,
                timestamp: Date.now(),
              },
            ],
          });
        }
      }
    }

    // Short position alerts (inverted: SL is above entry, TP is below entry)
    if (shortSummary) {
      const avgEntry = shortSummary.avgEntryPrice;
      const stopLossPrice = avgEntry * (1 + stopLossPercent / 100);
      const takeProfitPrice = avgEntry * (1 - takeProfitPercent / 100);

      if (candle.high >= stopLossPrice) {
        const existingAlert = alerts.find((a) => a.type === "STOP_LOSS_WARNING");
        if (!existingAlert) {
          set({
            alerts: [
              ...get().alerts,
              {
                id: generateId(),
                type: "STOP_LOSS_WARNING",
                message: `Short stop loss hit (${stopLossPrice.toLocaleString()}, +${stopLossPercent}%)`,
                timestamp: Date.now(),
              },
            ],
          });
        }
      }

      if (candle.low <= takeProfitPrice) {
        const existingAlert = alerts.find((a) => a.type === "TAKE_PROFIT_REACHED");
        if (!existingAlert) {
          set({
            alerts: [
              ...get().alerts,
              {
                id: generateId(),
                type: "TAKE_PROFIT_REACHED",
                message: `Short take profit reached (${takeProfitPrice.toLocaleString()}, -${takeProfitPercent}%)`,
                timestamp: Date.now(),
              },
            ],
          });
        }
      }
    }

    // Trailing stop alert
    if (trailingStopEnabled) {
      const longPositions = activeSymbol.positions.filter(
        (p) => p.direction !== "short" && p.trailingStopPrice !== undefined,
      );
      const shortPositions = activeSymbol.positions.filter(
        (p) => p.direction === "short" && p.trailingStopPrice !== undefined,
      );

      // Long trailing stop: price drops below
      if (longPositions.length > 0) {
        const minTrailingStop = Math.min(
          ...longPositions.map((p) => p.trailingStopPrice as number),
        );
        if (candle.low <= minTrailingStop) {
          const existingAlert = get().alerts.find((a) => a.type === "TRAILING_STOP_HIT");
          if (!existingAlert) {
            set({
              alerts: [
                ...get().alerts,
                {
                  id: generateId(),
                  type: "TRAILING_STOP_HIT",
                  message: `Trailing stop hit (${minTrailingStop.toLocaleString()})`,
                  timestamp: Date.now(),
                },
              ],
            });
          }
        }
      }

      // Short trailing stop: price rises above
      if (shortPositions.length > 0) {
        const maxTrailingStop = Math.max(
          ...shortPositions.map((p) => p.trailingStopPrice as number),
        );
        if (candle.high >= maxTrailingStop) {
          const existingAlert = get().alerts.find((a) => a.type === "TRAILING_STOP_HIT");
          if (!existingAlert) {
            set({
              alerts: [
                ...get().alerts,
                {
                  id: generateId(),
                  type: "TRAILING_STOP_HIT",
                  message: `Short trailing stop hit (${maxTrailingStop.toLocaleString()})`,
                  timestamp: Date.now(),
                },
              ],
            });
          }
        }
      }
    }
  },

  checkVolumeSpikeAlerts: () => {
    const { symbols, activeSymbolId, globalDate, volumeSpikeSettings: volSettings } = get();

    if (!volSettings.showRealtimeAlerts) return;

    const activeSymbol = getActiveSymbolFromState(symbols, activeSymbolId);
    if (!activeSymbol) return;

    const currentIdx = getSymbolCurrentIndex(activeSymbol, globalDate);
    const allCandles = activeSymbol.allCandles;

    // Average volume spike detection
    if (volSettings.averageVolumeEnabled && currentIdx >= volSettings.averageVolumePeriod) {
      const lookback = volSettings.averageVolumePeriod + 1;
      const recentCandles = allCandles.slice(
        Math.max(0, currentIdx - lookback + 1),
        currentIdx + 1,
      );
      const anomalies = volumeAnomaly(recentCandles, {
        period: volSettings.averageVolumePeriod,
        highThreshold: volSettings.averageVolumeMultiplier,
      });
      const currentAnomaly = anomalies[anomalies.length - 1];

      if (currentAnomaly?.value.isAnomaly) {
        const existingAlert = get().alerts.find(
          (a) => a.type === "VOLUME_SPIKE_AVERAGE" && Date.now() - a.timestamp < 3000,
        );
        if (!existingAlert) {
          set({
            alerts: [
              ...get().alerts,
              {
                id: generateId(),
                type: "VOLUME_SPIKE_AVERAGE",
                message: `Volume surge: ${currentAnomaly.value.ratio.toFixed(1)}x (vs ${volSettings.averageVolumePeriod}-day avg)`,
                timestamp: Date.now(),
              },
            ],
          });
        }
      }
    }

    // Breakout detection
    if (volSettings.breakoutVolumeEnabled && currentIdx > volSettings.breakoutVolumePeriod) {
      const lookback = volSettings.breakoutVolumePeriod + 1;
      const recentCandles = allCandles.slice(
        Math.max(0, currentIdx - lookback + 1),
        currentIdx + 1,
      );
      const breakouts = volumeBreakout(recentCandles, {
        period: volSettings.breakoutVolumePeriod,
      });
      const currentCandle = allCandles[currentIdx];
      const currentBreakout = breakouts.find((b) => b.time === currentCandle.time);

      if (currentBreakout) {
        const existingAlert = get().alerts.find(
          (a) => a.type === "VOLUME_SPIKE_BREAKOUT" && Date.now() - a.timestamp < 3000,
        );
        if (!existingAlert) {
          set({
            alerts: [
              ...get().alerts,
              {
                id: generateId(),
                type: "VOLUME_SPIKE_BREAKOUT",
                message: `Volume new high: ${volSettings.breakoutVolumePeriod}-day highest volume (${currentBreakout.ratio.toFixed(1)}x)`,
                timestamp: Date.now(),
              },
            ],
          });
        }
      }
    }

    // Accumulation phase detection
    if (volSettings.accumulationEnabled && currentIdx > volSettings.accumulationPeriod) {
      const lookback = volSettings.accumulationPeriod + volSettings.accumulationMinDays + 5;
      const recentCandles = allCandles.slice(
        Math.max(0, currentIdx - lookback + 1),
        currentIdx + 1,
      );
      const accumulations = volumeAccumulation(recentCandles, {
        period: volSettings.accumulationPeriod,
        minSlope: volSettings.accumulationMinSlope,
        minConsecutiveDays: volSettings.accumulationMinDays,
      });
      const currentCandle = allCandles[currentIdx];
      const currentAccum = accumulations.find((a) => a.time === currentCandle.time);

      if (currentAccum) {
        const existingAlert = get().alerts.find(
          (a) => a.type === "VOLUME_ACCUMULATION" && Date.now() - a.timestamp < 3000,
        );
        if (!existingAlert) {
          set({
            alerts: [
              ...get().alerts,
              {
                id: generateId(),
                type: "VOLUME_ACCUMULATION",
                message: `Accumulation phase: rising volume trend for ${currentAccum.consecutiveDays} days`,
                timestamp: Date.now(),
              },
            ],
          });
        }
      }
    }

    // Above average detection
    if (volSettings.aboveAverageEnabled && currentIdx > volSettings.aboveAveragePeriod) {
      const lookback = volSettings.aboveAveragePeriod + volSettings.aboveAverageMinDays + 5;
      const recentCandles = allCandles.slice(
        Math.max(0, currentIdx - lookback + 1),
        currentIdx + 1,
      );
      const aboveAvgSignals = volumeAboveAverage(recentCandles, {
        period: volSettings.aboveAveragePeriod,
        minRatio: volSettings.aboveAverageMinRatio,
        minConsecutiveDays: volSettings.aboveAverageMinDays,
      });
      const currentCandle = allCandles[currentIdx];
      const currentAboveAvg = aboveAvgSignals.find((a) => a.time === currentCandle.time);

      if (currentAboveAvg) {
        const existingAlert = get().alerts.find(
          (a) => a.type === "VOLUME_ABOVE_AVERAGE" && Date.now() - a.timestamp < 3000,
        );
        if (!existingAlert) {
          set({
            alerts: [
              ...get().alerts,
              {
                id: generateId(),
                type: "VOLUME_ABOVE_AVERAGE",
                message: `Above average: ${(currentAboveAvg.ratio * 100).toFixed(0)}% of avg for ${currentAboveAvg.consecutiveDays} days`,
                timestamp: Date.now(),
              },
            ],
          });
        }
      }
    }

    // MA cross detection
    if (volSettings.maCrossEnabled && currentIdx > volSettings.maCrossLongPeriod) {
      const lookback = volSettings.maCrossLongPeriod + 10;
      const recentCandles = allCandles.slice(
        Math.max(0, currentIdx - lookback + 1),
        currentIdx + 1,
      );
      const crosses = volumeMaCross(recentCandles, {
        shortPeriod: volSettings.maCrossShortPeriod,
        longPeriod: volSettings.maCrossLongPeriod,
      });
      const currentCandle = allCandles[currentIdx];
      const currentCross = crosses.find(
        (c) => c.time === currentCandle.time && c.daysSinceCross === 1,
      );

      if (currentCross) {
        const existingAlert = get().alerts.find(
          (a) => a.type === "VOLUME_MA_CROSS" && Date.now() - a.timestamp < 3000,
        );
        if (!existingAlert) {
          set({
            alerts: [
              ...get().alerts,
              {
                id: generateId(),
                type: "VOLUME_MA_CROSS",
                message: `Volume MA cross: short MA(${volSettings.maCrossShortPeriod}) crossed above long MA(${volSettings.maCrossLongPeriod}) (${currentCross.ratio.toFixed(1)}x)`,
                timestamp: Date.now(),
              },
            ],
          });
        }
      }
    }

    // CMF accumulation/distribution detection
    if (volSettings.cmfEnabled && currentIdx >= volSettings.cmfPeriod + 1) {
      const lookback = volSettings.cmfPeriod + 5;
      const recentCandles = allCandles.slice(
        Math.max(0, currentIdx - lookback + 1),
        currentIdx + 1,
      );
      const cmfData = cmf(recentCandles, { period: volSettings.cmfPeriod });
      const currentCmf = cmfData[cmfData.length - 1];
      const prevCmf = cmfData[cmfData.length - 2];

      if (currentCmf && currentCmf.value !== null && prevCmf && prevCmf.value !== null) {
        const threshold = volSettings.cmfThreshold;

        const currentState =
          currentCmf.value > threshold
            ? "accumulation"
            : currentCmf.value < -threshold
              ? "distribution"
              : "neutral";
        const prevState =
          prevCmf.value > threshold
            ? "accumulation"
            : prevCmf.value < -threshold
              ? "distribution"
              : "neutral";

        if (currentState !== prevState) {
          if (currentState === "accumulation") {
            set({
              alerts: [
                ...get().alerts,
                {
                  id: generateId(),
                  type: "CMF_ACCUMULATION",
                  message: `CMF accumulation started: CMF=${currentCmf.value.toFixed(3)} (threshold>${threshold})`,
                  timestamp: Date.now(),
                },
              ],
            });
          } else if (currentState === "distribution") {
            set({
              alerts: [
                ...get().alerts,
                {
                  id: generateId(),
                  type: "CMF_DISTRIBUTION",
                  message: `CMF distribution started: CMF=${currentCmf.value.toFixed(3)} (threshold<${-threshold})`,
                  timestamp: Date.now(),
                },
              ],
            });
          }
        }
      }
    }

    // OBV trend detection
    if (volSettings.obvEnabled && currentIdx >= volSettings.obvPeriod + 1) {
      const lookback = volSettings.obvPeriod + 6;
      const recentCandles = allCandles.slice(
        Math.max(0, currentIdx - lookback + 1),
        currentIdx + 1,
      );
      const obvData = obv(recentCandles);

      if (obvData.length >= volSettings.obvPeriod + 1) {
        const currentObv = obvData[obvData.length - 1]?.value;
        const pastObv = obvData[obvData.length - volSettings.obvPeriod]?.value;
        const prevObv = obvData[obvData.length - 2]?.value;
        const prevPastObv = obvData[obvData.length - volSettings.obvPeriod - 1]?.value;

        if (currentObv !== null && pastObv !== null && prevObv !== null && prevPastObv !== null) {
          const currentChange = currentObv - pastObv;
          const prevChange = prevObv - prevPastObv;

          const currentState =
            currentChange > 0 ? "rising" : currentChange < 0 ? "falling" : "neutral";
          const prevState = prevChange > 0 ? "rising" : prevChange < 0 ? "falling" : "neutral";

          if (currentState !== prevState) {
            const formatOBVChange = (change: number): string => {
              const absChange = Math.abs(change);
              if (absChange >= 1000000) {
                return `${(change / 1000000).toFixed(1)}M`;
              }
              if (absChange >= 1000) {
                return `${(change / 1000).toFixed(0)}K`;
              }
              return change.toFixed(0);
            };

            if (currentState === "rising") {
              set({
                alerts: [
                  ...get().alerts,
                  {
                    id: generateId(),
                    type: "OBV_RISING",
                    message: `OBV turned bullish: +${formatOBVChange(currentChange)} over ${volSettings.obvPeriod} days`,
                    timestamp: Date.now(),
                  },
                ],
              });
            } else if (currentState === "falling") {
              set({
                alerts: [
                  ...get().alerts,
                  {
                    id: generateId(),
                    type: "OBV_FALLING",
                    message: `OBV turned bearish: ${formatOBVChange(currentChange)} over ${volSettings.obvPeriod} days`,
                    timestamp: Date.now(),
                  },
                ],
              });
            }
          }
        }
      }
    }
  },
});
