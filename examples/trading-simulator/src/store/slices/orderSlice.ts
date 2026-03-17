import type {
  Alert,
  IndicatorSnapshot,
  MarketContext,
  PendingOrder,
  Position,
  Trade,
} from "../../types";
import { analyzeMarketContext, getIndicatorSnapshot } from "../../utils/indicators";
import { generateId, getSymbolCurrentIndex } from "../helpers";
import type { OrderSlice, SliceCreator } from "../types";

export const createOrderSlice: SliceCreator<OrderSlice> = (set, get) => ({
  pendingOrders: [],

  placePendingOrder: (order: Omit<PendingOrder, "id" | "createdAt">) => {
    const { commonDateRange, currentDateIndex } = get();
    if (!commonDateRange) return;

    const targetDate = commonDateRange.dates[currentDateIndex];

    const pendingOrder: PendingOrder = {
      id: generateId(),
      createdAt: targetDate,
      ...order,
    };

    set((state) => ({
      pendingOrders: [...state.pendingOrders, pendingOrder],
      alerts: [
        ...state.alerts,
        {
          id: generateId(),
          type: "ORDER_EXECUTED" as const,
          message: `${order.orderType === "BUY" ? "Buy" : "Sell"} order placed (fills at next open)`,
          timestamp: Date.now(),
        },
      ],
    }));
  },

  cancelPendingOrder: (orderId: string) => {
    set((state) => ({
      pendingOrders: state.pendingOrders.filter((o) => o.id !== orderId),
    }));
  },

  getPendingOrdersForSymbol: (symbolId: string) => {
    return get().pendingOrders.filter((o) => o.symbolId === symbolId);
  },

  executePendingOrders: () => {
    const {
      pendingOrders,
      symbols,
      globalDate,
      commonDateRange,
      commissionRate,
      slippageBps,
      taxRate,
      trailingStopEnabled,
      trailingStopPercent,
    } = get();

    if (pendingOrders.length === 0 || !commonDateRange) return;

    const updatedSymbols = [...symbols];
    const executedOrderIds: string[] = [];
    const newAlerts: Alert[] = [];

    for (const order of pendingOrders) {
      const symbolIdx = updatedSymbols.findIndex((s) => s.id === order.symbolId);
      if (symbolIdx === -1) continue;

      const symbol = updatedSymbols[symbolIdx];
      const currentIdx = getSymbolCurrentIndex(symbol, globalDate);
      const currentCandle = symbol.allCandles[currentIdx];
      if (!currentCandle) continue;

      const price = currentCandle.open;

      if (order.orderType === "BUY") {
        const slippage = price * (slippageBps / 10000);
        const effectivePrice = price + slippage;
        const commission = effectivePrice * order.shares * (commissionRate / 100);

        let indicators: IndicatorSnapshot | undefined;
        let marketContext: MarketContext | undefined;
        if (symbol.indicatorData) {
          indicators = getIndicatorSnapshot(symbol.indicatorData, currentIdx);
          marketContext = analyzeMarketContext(symbol.allCandles, currentIdx, symbol.indicatorData);
        }

        const initialTrailingStop = trailingStopEnabled
          ? currentCandle.high * (1 - trailingStopPercent / 100)
          : undefined;

        const newPosition: Position = {
          id: generateId(),
          entryPrice: effectivePrice,
          entryDate: currentCandle.time,
          entryIndex: currentIdx,
          shares: order.shares,
          highestPrice: currentCandle.high,
          lowestPrice: currentCandle.low,
          highestDate: currentCandle.time,
          lowestDate: currentCandle.time,
          commission,
          trailingStopPrice: initialTrailingStop,
        };

        const trade: Trade = {
          id: generateId(),
          type: "BUY",
          date: currentCandle.time,
          price,
          shares: order.shares,
          memo: order.memo,
          priceType: "nextOpen",
          indicators,
          marketContext,
          effectivePrice,
          slippage,
          commission,
        };

        updatedSymbols[symbolIdx] = {
          ...symbol,
          positions: [...symbol.positions, newPosition],
          tradeHistory: [...symbol.tradeHistory, trade],
        };

        newAlerts.push({
          id: generateId(),
          type: "ORDER_EXECUTED",
          message: `${symbol.fileName}: Buy order filled (${order.shares} shares @ ¥${price.toLocaleString()})`,
          timestamp: Date.now(),
        });
      } else if (order.orderType === "SELL" || order.orderType === "SELL_ALL") {
        if (symbol.positions.length === 0) continue;

        const totalShares = symbol.positions.reduce((sum, p) => sum + p.shares, 0);
        const sellShares =
          order.orderType === "SELL_ALL" ? totalShares : Math.min(order.shares, totalShares);

        const slippage = price * (slippageBps / 10000);
        const effectivePrice = price - slippage;
        const sellCommission = effectivePrice * sellShares * (commissionRate / 100);

        let remainingSharesToSell = sellShares;
        let totalBuyCommission = 0;
        let totalEntryValue = 0;
        let totalMfeValue = 0;
        let totalMaeValue = 0;
        let mfePrice = 0;
        let maePrice = 0;
        let mfeDate = 0;
        let maeDate = 0;

        const remainingPositions: Position[] = [];

        for (const pos of symbol.positions) {
          if (remainingSharesToSell <= 0) {
            remainingPositions.push(pos);
            continue;
          }

          if (pos.shares <= remainingSharesToSell) {
            remainingSharesToSell -= pos.shares;
            totalBuyCommission += pos.commission;
            totalEntryValue += pos.entryPrice * pos.shares;
            totalMfeValue +=
              ((pos.highestPrice - pos.entryPrice) / pos.entryPrice) * 100 * pos.shares;
            totalMaeValue +=
              ((pos.lowestPrice - pos.entryPrice) / pos.entryPrice) * 100 * pos.shares;
            if (pos.highestPrice > mfePrice) {
              mfePrice = pos.highestPrice;
              mfeDate = pos.highestDate;
            }
            if (maePrice === 0 || pos.lowestPrice < maePrice) {
              maePrice = pos.lowestPrice;
              maeDate = pos.lowestDate;
            }
          } else {
            const partialRatio = remainingSharesToSell / pos.shares;
            totalBuyCommission += pos.commission * partialRatio;
            totalEntryValue += pos.entryPrice * remainingSharesToSell;
            totalMfeValue +=
              ((pos.highestPrice - pos.entryPrice) / pos.entryPrice) * 100 * remainingSharesToSell;
            totalMaeValue +=
              ((pos.lowestPrice - pos.entryPrice) / pos.entryPrice) * 100 * remainingSharesToSell;
            if (pos.highestPrice > mfePrice) {
              mfePrice = pos.highestPrice;
              mfeDate = pos.highestDate;
            }
            if (maePrice === 0 || pos.lowestPrice < maePrice) {
              maePrice = pos.lowestPrice;
              maeDate = pos.lowestDate;
            }
            remainingPositions.push({ ...pos, shares: pos.shares - remainingSharesToSell });
            remainingSharesToSell = 0;
          }
        }

        const avgEntryPrice = totalEntryValue / sellShares;
        const mfe = totalMfeValue / sellShares;
        const mae = totalMaeValue / sellShares;

        const grossPnl = (effectivePrice - avgEntryPrice) * sellShares;
        const netPnl = grossPnl - totalBuyCommission - sellCommission;

        let tax = 0;
        let afterTaxPnl = netPnl;
        if (netPnl > 0) {
          tax = netPnl * (taxRate / 100);
          afterTaxPnl = netPnl - tax;
        }

        const pnlPercent = ((effectivePrice - avgEntryPrice) / avgEntryPrice) * 100;
        const mfeUtilization = mfe > 0 ? (pnlPercent / mfe) * 100 : 0;

        let indicators: IndicatorSnapshot | undefined;
        let marketContext: MarketContext | undefined;
        if (symbol.indicatorData) {
          indicators = getIndicatorSnapshot(symbol.indicatorData, currentIdx);
          marketContext = analyzeMarketContext(symbol.allCandles, currentIdx, symbol.indicatorData);
        }

        const trade: Trade = {
          id: generateId(),
          type: "SELL",
          date: currentCandle.time,
          price,
          shares: sellShares,
          memo: order.memo,
          priceType: "nextOpen",
          pnl: grossPnl,
          pnlPercent,
          indicators,
          marketContext,
          effectivePrice,
          slippage,
          commission: sellCommission,
          exitReason: order.exitReason,
          exitTrigger: order.exitTrigger,
          grossPnl,
          netPnl,
          tax,
          afterTaxPnl,
          mfe,
          mae,
          mfePrice,
          maePrice,
          mfeDate,
          maeDate,
          mfeUtilization,
        };

        updatedSymbols[symbolIdx] = {
          ...symbol,
          positions: remainingPositions,
          tradeHistory: [...symbol.tradeHistory, trade],
        };

        const pnlSign = grossPnl >= 0 ? "+" : "";
        newAlerts.push({
          id: generateId(),
          type: "ORDER_EXECUTED",
          message: `${symbol.fileName}: Sell order filled (${sellShares} shares @ ¥${price.toLocaleString()} / ${pnlSign}${pnlPercent.toFixed(1)}%)`,
          timestamp: Date.now(),
        });
      }

      executedOrderIds.push(order.id);
    }

    set({
      symbols: updatedSymbols,
      pendingOrders: get().pendingOrders.filter((o) => !executedOrderIds.includes(o.id)),
      alerts: [...get().alerts, ...newAlerts],
    });
  },
});
