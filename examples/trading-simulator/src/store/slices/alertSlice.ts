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
    const currentIdx = getSymbolCurrentIndex(activeSymbol, globalDate);
    const candle = activeSymbol.allCandles[currentIdx];

    if (!summary || !candle) return;

    const avgEntry = summary.avgEntryPrice;
    const stopLossPrice = avgEntry * (1 - stopLossPercent / 100);
    const takeProfitPrice = avgEntry * (1 + takeProfitPercent / 100);

    // Stop loss alert
    if (candle.low <= stopLossPrice) {
      const existingAlert = alerts.find((a) => a.type === "STOP_LOSS_WARNING");
      if (!existingAlert) {
        set({
          alerts: [
            ...alerts,
            {
              id: generateId(),
              type: "STOP_LOSS_WARNING",
              message: `損切りライン(${stopLossPrice.toLocaleString()}円, -${stopLossPercent}%)に接触しました`,
              timestamp: Date.now(),
            },
          ],
        });
      }
    }

    // Take profit alert
    if (candle.high >= takeProfitPrice) {
      const existingAlert = alerts.find((a) => a.type === "TAKE_PROFIT_REACHED");
      if (!existingAlert) {
        set({
          alerts: [
            ...get().alerts,
            {
              id: generateId(),
              type: "TAKE_PROFIT_REACHED",
              message: `利確ライン(${takeProfitPrice.toLocaleString()}円, +${takeProfitPercent}%)に到達しました`,
              timestamp: Date.now(),
            },
          ],
        });
      }
    }

    // Trailing stop alert
    if (trailingStopEnabled) {
      const trailingStopPrices = activeSymbol.positions
        .filter((p) => p.trailingStopPrice !== undefined)
        .map((p) => p.trailingStopPrice as number);

      if (trailingStopPrices.length > 0) {
        const minTrailingStop = Math.min(...trailingStopPrices);
        if (candle.low <= minTrailingStop) {
          const existingAlert = get().alerts.find((a) => a.type === "TRAILING_STOP_HIT");
          if (!existingAlert) {
            set({
              alerts: [
                ...get().alerts,
                {
                  id: generateId(),
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
                message: `出来高急増: ${currentAnomaly.value.ratio.toFixed(1)}倍 (${volSettings.averageVolumePeriod}日平均比)`,
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
                message: `出来高新高値: ${volSettings.breakoutVolumePeriod}日間の最高出来高を更新 (${currentBreakout.ratio.toFixed(1)}倍)`,
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
                message: `蓄積フェーズ: 出来高上昇傾向 ${currentAccum.consecutiveDays}日継続`,
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
                message: `高水準継続: 平均の${(currentAboveAvg.ratio * 100).toFixed(0)}%で ${currentAboveAvg.consecutiveDays}日継続`,
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
                message: `出来高MAクロス: 短期MA(${volSettings.maCrossShortPeriod})が長期MA(${volSettings.maCrossLongPeriod})を上抜け (${currentCross.ratio.toFixed(1)}倍)`,
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
                  message: `CMF蓄積フェーズ開始: CMF=${currentCmf.value.toFixed(3)} (閾値>${threshold})`,
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
                  message: `CMF分配フェーズ開始: CMF=${currentCmf.value.toFixed(3)} (閾値<${-threshold})`,
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
                    message: `OBV上昇トレンド転換: ${volSettings.obvPeriod}日間で+${formatOBVChange(currentChange)}`,
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
                    message: `OBV下降トレンド転換: ${volSettings.obvPeriod}日間で${formatOBVChange(currentChange)}`,
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
