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

  placeOcoOrders: (orders: Omit<PendingOrder, "id" | "createdAt" | "ocoGroupId">[]) => {
    const { commonDateRange, currentDateIndex } = get();
    if (!commonDateRange || orders.length < 2) return;

    const targetDate = commonDateRange.dates[currentDateIndex];
    const ocoGroupId = generateId();

    const newOrders: PendingOrder[] = orders.map((order) => ({
      id: generateId(),
      createdAt: targetDate,
      ocoGroupId,
      ...order,
    }));

    set((state) => ({
      pendingOrders: [...state.pendingOrders, ...newOrders],
      alerts: [
        ...state.alerts,
        {
          id: generateId(),
          type: "ORDER_EXECUTED" as const,
          message: `OCO order placed (${newOrders.length} legs)`,
          timestamp: Date.now(),
        },
      ],
    }));
  },

  cancelPendingOrder: (orderId: string) => {
    set((state) => {
      const order = state.pendingOrders.find((o) => o.id === orderId);
      // If order has an OCO group, cancel all siblings
      if (order?.ocoGroupId) {
        return {
          pendingOrders: state.pendingOrders.filter(
            (o) => o.id !== orderId && o.ocoGroupId !== order.ocoGroupId,
          ),
        };
      }
      return {
        pendingOrders: state.pendingOrders.filter((o) => o.id !== orderId),
      };
    });
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

      // Skip if this order's OCO sibling was already executed this bar
      if (
        order.ocoGroupId &&
        executedOrderIds.some((eid) => {
          const sibling = pendingOrders.find((o) => o.id === eid);
          return sibling?.ocoGroupId === order.ocoGroupId;
        })
      ) {
        executedOrderIds.push(order.id); // Cancel this OCO sibling
        continue;
      }

      // Stop-Limit logic: check if stop trigger has been hit
      if (order.stopTrigger != null && !order.stopTriggered) {
        const isBuyStop = order.orderType === "BUY" || order.orderType === "BUY_TO_COVER";
        if (isBuyStop) {
          // Buy stop: triggers when price rises above stopTrigger
          if (currentCandle.high < order.stopTrigger) continue;
        } else {
          // Sell stop: triggers when price falls below stopTrigger
          if (currentCandle.low > order.stopTrigger) continue;
        }
        // Mark as triggered — will attempt to fill at limitPrice (or open if no limitPrice)
        order.stopTriggered = true;
      }

      // Determine execution price — limit orders fill at limit price if the
      // candle's range touches it, otherwise the order stays pending.
      let price: number;
      if (order.limitPrice != null) {
        if (order.orderType === "BUY" || order.orderType === "BUY_TO_COVER") {
          // Buy limit: fill only if low <= limitPrice (price came down to our level)
          if (currentCandle.low > order.limitPrice) continue; // not filled
          price = order.limitPrice;
        } else {
          // Sell limit: fill only if high >= limitPrice (price came up to our level)
          if (currentCandle.high < order.limitPrice) continue; // not filled
          price = order.limitPrice;
        }
      } else {
        price = currentCandle.open;
      }

      if (order.orderType === "BUY" || order.orderType === "SHORT_SELL") {
        const isShort = order.orderType === "SHORT_SELL";
        const slippage = price * (slippageBps / 10000);
        // Long buy: slippage increases cost; Short sell: slippage decreases proceeds
        const effectivePrice = isShort ? price - slippage : price + slippage;
        const commission = effectivePrice * order.shares * (commissionRate / 100);

        let indicators: IndicatorSnapshot | undefined;
        let marketContext: MarketContext | undefined;
        if (symbol.indicatorData) {
          indicators = getIndicatorSnapshot(symbol.indicatorData, currentIdx);
          marketContext = analyzeMarketContext(symbol.allCandles, currentIdx, symbol.indicatorData);
        }

        const initialTrailingStop = trailingStopEnabled
          ? isShort
            ? currentCandle.low * (1 + trailingStopPercent / 100)
            : currentCandle.high * (1 - trailingStopPercent / 100)
          : undefined;

        const newPosition: Position = {
          id: generateId(),
          direction: isShort ? "short" : "long",
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
          type: order.orderType,
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

        const action = isShort ? "Short sell" : "Buy";
        const cs = symbol.currency === "USD" ? "$" : "¥";
        newAlerts.push({
          id: generateId(),
          type: "ORDER_EXECUTED",
          message: `${symbol.fileName}: ${action} order filled (${order.shares} shares @ ${cs}${price.toLocaleString()})`,
          timestamp: Date.now(),
        });
      } else if (
        order.orderType === "SELL" ||
        order.orderType === "SELL_ALL" ||
        order.orderType === "BUY_TO_COVER" ||
        order.orderType === "COVER_ALL"
      ) {
        const isCover = order.orderType === "BUY_TO_COVER" || order.orderType === "COVER_ALL";
        const targetDirection = isCover ? "short" : "long";
        const directionPositions = symbol.positions.filter(
          (p) => (p.direction || "long") === targetDirection,
        );
        if (directionPositions.length === 0) continue;

        const totalShares = directionPositions.reduce((sum, p) => sum + p.shares, 0);
        const sellShares =
          order.orderType === "SELL_ALL" || order.orderType === "COVER_ALL"
            ? totalShares
            : Math.min(order.shares, totalShares);

        const slippage = price * (slippageBps / 10000);
        // Sell: slippage reduces proceeds; Cover: slippage increases cost
        const effectivePrice = isCover ? price + slippage : price - slippage;
        const closeCommission = effectivePrice * sellShares * (commissionRate / 100);

        let remainingSharesToSell = sellShares;
        let totalEntryCommission = 0;
        let totalEntryValue = 0;
        let totalMfeValue = 0;
        let totalMaeValue = 0;
        let mfePrice = 0;
        let maePrice = 0;
        let mfeDate = 0;
        let maeDate = 0;

        const remainingPositions: Position[] = [];

        for (const pos of symbol.positions) {
          if ((pos.direction || "long") !== targetDirection) {
            remainingPositions.push(pos);
            continue;
          }
          if (remainingSharesToSell <= 0) {
            remainingPositions.push(pos);
            continue;
          }

          if (pos.shares <= remainingSharesToSell) {
            remainingSharesToSell -= pos.shares;
            totalEntryCommission += pos.commission;
            totalEntryValue += pos.entryPrice * pos.shares;
            if (isCover) {
              // Short: MFE = price going down, MAE = price going up
              totalMfeValue +=
                ((pos.entryPrice - pos.lowestPrice) / pos.entryPrice) * 100 * pos.shares;
              totalMaeValue +=
                ((pos.entryPrice - pos.highestPrice) / pos.entryPrice) * 100 * pos.shares;
              if (mfePrice === 0 || pos.lowestPrice < mfePrice) {
                mfePrice = pos.lowestPrice;
                mfeDate = pos.lowestDate;
              }
              if (maePrice === 0 || pos.highestPrice > maePrice) {
                maePrice = pos.highestPrice;
                maeDate = pos.highestDate;
              }
            } else {
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
            }
          } else {
            const partialRatio = remainingSharesToSell / pos.shares;
            totalEntryCommission += pos.commission * partialRatio;
            totalEntryValue += pos.entryPrice * remainingSharesToSell;
            if (isCover) {
              totalMfeValue +=
                ((pos.entryPrice - pos.lowestPrice) / pos.entryPrice) * 100 * remainingSharesToSell;
              totalMaeValue +=
                ((pos.entryPrice - pos.highestPrice) / pos.entryPrice) *
                100 *
                remainingSharesToSell;
              if (mfePrice === 0 || pos.lowestPrice < mfePrice) {
                mfePrice = pos.lowestPrice;
                mfeDate = pos.lowestDate;
              }
              if (maePrice === 0 || pos.highestPrice > maePrice) {
                maePrice = pos.highestPrice;
                maeDate = pos.highestDate;
              }
            } else {
              totalMfeValue +=
                ((pos.highestPrice - pos.entryPrice) / pos.entryPrice) *
                100 *
                remainingSharesToSell;
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
            }
            remainingPositions.push({ ...pos, shares: pos.shares - remainingSharesToSell });
            remainingSharesToSell = 0;
          }
        }

        const avgEntryPrice = totalEntryValue / sellShares;
        const mfe = totalMfeValue / sellShares;
        const mae = totalMaeValue / sellShares;

        // P&L: Long sell = (exit - entry), Short cover = (entry - exit)
        const grossPnl = isCover
          ? (avgEntryPrice - effectivePrice) * sellShares
          : (effectivePrice - avgEntryPrice) * sellShares;
        const netPnl = grossPnl - totalEntryCommission - closeCommission;

        let tax = 0;
        let afterTaxPnl = netPnl;
        if (netPnl > 0) {
          tax = netPnl * (taxRate / 100);
          afterTaxPnl = netPnl - tax;
        }

        const pnlPercent = isCover
          ? ((avgEntryPrice - effectivePrice) / avgEntryPrice) * 100
          : ((effectivePrice - avgEntryPrice) / avgEntryPrice) * 100;
        const mfeUtilization = mfe > 0 ? (pnlPercent / mfe) * 100 : 0;

        let indicators: IndicatorSnapshot | undefined;
        let marketContext: MarketContext | undefined;
        if (symbol.indicatorData) {
          indicators = getIndicatorSnapshot(symbol.indicatorData, currentIdx);
          marketContext = analyzeMarketContext(symbol.allCandles, currentIdx, symbol.indicatorData);
        }

        const tradeType = isCover ? ("BUY_TO_COVER" as const) : ("SELL" as const);
        const trade: Trade = {
          id: generateId(),
          type: tradeType,
          date: currentCandle.time,
          price,
          shares: sellShares,
          memo: order.memo,
          priceType: "nextOpen",
          pnl: afterTaxPnl,
          pnlPercent,
          indicators,
          marketContext,
          effectivePrice,
          slippage,
          commission: closeCommission,
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
        const action = isCover ? "Cover" : "Sell";
        const cs2 = symbol.currency === "USD" ? "$" : "¥";
        newAlerts.push({
          id: generateId(),
          type: "ORDER_EXECUTED",
          message: `${symbol.fileName}: ${action} order filled (${sellShares} shares @ ${cs2}${price.toLocaleString()} / ${pnlSign}${pnlPercent.toFixed(1)}%)`,
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
