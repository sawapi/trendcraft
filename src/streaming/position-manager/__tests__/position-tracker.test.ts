import { describe, it, expect } from "vitest";
import { createPositionTracker } from "../position-tracker";
import type { NormalizedCandle } from "../../../types";

function makeCandle(
  overrides: Partial<NormalizedCandle> & { close: number },
): NormalizedCandle {
  const c = overrides.close;
  return {
    time: overrides.time ?? 1000,
    open: overrides.open ?? c,
    high: overrides.high ?? c,
    low: overrides.low ?? c,
    close: c,
    volume: overrides.volume ?? 100,
  };
}

describe("createPositionTracker", () => {
  describe("openPosition", () => {
    it("should open a position and deduct capital", () => {
      const tracker = createPositionTracker({ capital: 100_000 });
      const pos = tracker.openPosition(100, 100, 1000);

      expect(pos.id).toBe("pos-1");
      expect(pos.entryPrice).toBe(100);
      expect(pos.shares).toBe(100);
      expect(pos.originalShares).toBe(100);
      expect(pos.peakPrice).toBe(100);
      expect(pos.maxProfitPercent).toBe(0);
      expect(pos.maxLossPercent).toBe(0);

      const account = tracker.getAccount();
      // Capital = 100,000 - (100 * 100 + 0 commission) = 90,000
      expect(account.currentCapital).toBe(90_000);
      expect(account.equity).toBe(100_000); // unrealized = 0
    });

    it("should apply slippage on entry", () => {
      const tracker = createPositionTracker({ capital: 100_000, slippage: 1 });
      const pos = tracker.openPosition(100, 10, 1000);

      // Buy slippage: 100 * (1 + 0.01) = 101
      expect(pos.entryPrice).toBe(101);
    });

    it("should apply commission on entry", () => {
      const tracker = createPositionTracker({
        capital: 100_000,
        commission: 500,
        commissionRate: 0.1,
      });
      const pos = tracker.openPosition(100, 100, 1000);
      const account = tracker.getAccount();

      // Position value = 100 * 100 = 10,000
      // Commission = 500 + 10,000 * 0.001 = 510
      // Capital = 100,000 - 10,000 - 510 = 89,490
      expect(account.currentCapital).toBe(89_490);
    });

    it("should throw when opening a second position", () => {
      const tracker = createPositionTracker({ capital: 100_000 });
      tracker.openPosition(100, 10, 1000);
      expect(() => tracker.openPosition(100, 10, 2000)).toThrow(
        "Cannot open position: already holding a position",
      );
    });

    it("should throw when shares <= 0", () => {
      const tracker = createPositionTracker({ capital: 100_000 });
      expect(() => tracker.openPosition(100, 0, 1000)).toThrow(
        "Cannot open position: shares must be positive",
      );
    });

    it("should calculate SL/TP levels from percentages", () => {
      const tracker = createPositionTracker({
        capital: 100_000,
        stopLoss: 2,
        takeProfit: 6,
      });
      const pos = tracker.openPosition(100, 10, 1000);

      expect(pos.stopLossPrice).toBe(98); // 100 * (1 - 0.02)
      expect(pos.takeProfitPrice).toBe(106); // 100 * (1 + 0.06)
    });

    it("should allow custom SL/TP overrides", () => {
      const tracker = createPositionTracker({
        capital: 100_000,
        stopLoss: 2,
        takeProfit: 6,
      });
      const pos = tracker.openPosition(100, 10, 1000, {
        stopLossPrice: 95,
        takeProfitPrice: 110,
      });

      expect(pos.stopLossPrice).toBe(95);
      expect(pos.takeProfitPrice).toBe(110);
    });

    it("should increment position IDs", () => {
      const tracker = createPositionTracker({ capital: 100_000 });
      const pos1 = tracker.openPosition(100, 10, 1000);
      tracker.closePosition(105, 2000, "exit-signal");
      const pos2 = tracker.openPosition(100, 10, 3000);

      expect(pos1.id).toBe("pos-1");
      expect(pos2.id).toBe("pos-2");
    });
  });

  describe("updatePrice", () => {
    it("should update unrealized P&L on price change", () => {
      const tracker = createPositionTracker({ capital: 100_000 });
      tracker.openPosition(100, 50, 1000);

      const candle = makeCandle({ close: 102, high: 103, low: 99 });
      const result = tracker.updatePrice(candle);

      expect(result.triggered).toBeNull();
      expect(result.position).not.toBeNull();

      const account = tracker.getAccount();
      // Unrealized = (102 - 100) * 50 = 100
      expect(account.unrealizedPnl).toBe(100);
      // Equity = currentCapital + market value = 95,000 + 102*50 = 100,100
      expect(account.equity).toBe(95_000 + 102 * 50);
    });

    it("should track peak price and MFE/MAE", () => {
      const tracker = createPositionTracker({ capital: 100_000 });
      tracker.openPosition(100, 50, 1000);

      tracker.updatePrice(makeCandle({ close: 105, high: 108, low: 99 }));
      const pos = tracker.getPosition()!;

      expect(pos.peakPrice).toBe(108);
      // MFE = (108 - 100) / 100 * 100 = 8%
      expect(pos.maxProfitPercent).toBe(8);
      // MAE = (100 - 99) / 100 * 100 = 1%
      expect(pos.maxLossPercent).toBe(1);
    });

    it("should trigger stop loss", () => {
      const tracker = createPositionTracker({
        capital: 100_000,
        stopLoss: 5,
      });
      tracker.openPosition(100, 50, 1000);

      // SL at 95, candle low hits 94
      const candle = makeCandle({
        close: 94,
        high: 100,
        low: 94,
        time: 2000,
      });
      const result = tracker.updatePrice(candle);

      expect(result.triggered).not.toBeNull();
      expect(result.triggered!.reason).toBe("stop-loss");
      expect(tracker.getPosition()).toBeNull();

      const trades = tracker.getTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].exitReason).toBe("stopLoss");
    });

    it("should trigger take profit", () => {
      const tracker = createPositionTracker({
        capital: 100_000,
        takeProfit: 10,
      });
      tracker.openPosition(100, 50, 1000);

      // TP at 110, candle high hits 112
      const candle = makeCandle({
        close: 112,
        high: 112,
        low: 100,
        time: 2000,
      });
      const result = tracker.updatePrice(candle);

      expect(result.triggered).not.toBeNull();
      expect(result.triggered!.reason).toBe("take-profit");
      expect(tracker.getPosition()).toBeNull();

      const trades = tracker.getTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].exitReason).toBe("takeProfit");
    });

    it("should trigger trailing stop", () => {
      const tracker = createPositionTracker({
        capital: 100_000,
        trailingStop: 5,
      });
      tracker.openPosition(100, 50, 1000);

      // Price rises to 110
      tracker.updatePrice(makeCandle({ close: 110, high: 110, low: 105 }));
      expect(tracker.getPosition()!.peakPrice).toBe(110);

      // Trailing stop = 110 * (1 - 0.05) = 104.5
      // Candle low = 104 → triggered
      const candle = makeCandle({
        close: 104,
        high: 108,
        low: 104,
        time: 3000,
      });
      const result = tracker.updatePrice(candle);

      expect(result.triggered).not.toBeNull();
      expect(result.triggered!.reason).toBe("trailing-stop");
      expect(tracker.getPosition()).toBeNull();

      const trades = tracker.getTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].exitReason).toBe("trailing");
    });

    it("should not trigger trailing if price stays above trail level", () => {
      const tracker = createPositionTracker({
        capital: 100_000,
        trailingStop: 5,
      });
      tracker.openPosition(100, 50, 1000);

      // Price rises to 110, trailing stop at 104.5
      tracker.updatePrice(makeCandle({ close: 110, high: 110, low: 108 }));

      // Low at 105 > 104.5 → no trigger
      const result = tracker.updatePrice(
        makeCandle({ close: 107, high: 109, low: 105 }),
      );
      expect(result.triggered).toBeNull();
      expect(tracker.getPosition()).not.toBeNull();
    });

    it("should return early when no position is open", () => {
      const tracker = createPositionTracker({ capital: 100_000 });
      const candle = makeCandle({ close: 100 });
      const result = tracker.updatePrice(candle);

      expect(result.triggered).toBeNull();
    });

    it("should check SL before TP when both trigger on same candle", () => {
      const tracker = createPositionTracker({
        capital: 100_000,
        stopLoss: 2,
        takeProfit: 5,
      });
      tracker.openPosition(100, 50, 1000);

      // Both SL (98) and TP (105) trigger: low=97, high=106
      const candle = makeCandle({
        close: 100,
        high: 106,
        low: 97,
        time: 2000,
      });
      const result = tracker.updatePrice(candle);

      expect(result.triggered).not.toBeNull();
      expect(result.triggered!.reason).toBe("stop-loss");
    });
  });

  describe("closePosition", () => {
    it("should close position and update account", () => {
      const tracker = createPositionTracker({ capital: 100_000 });
      tracker.openPosition(100, 50, 1000);

      const { trade, fill } = tracker.closePosition(110, 2000, "exit-signal");

      expect(trade.entryPrice).toBe(100);
      expect(trade.exitPrice).toBe(110);
      expect(trade.return).toBe(500); // (110 - 100) * 50
      expect(trade.exitReason).toBe("signal");
      expect(fill.side).toBe("sell");
      expect(fill.reason).toBe("exit-signal");

      expect(tracker.getPosition()).toBeNull();

      const account = tracker.getAccount();
      expect(account.totalRealizedPnl).toBe(500);
    });

    it("should apply slippage and commission on close", () => {
      const tracker = createPositionTracker({
        capital: 100_000,
        slippage: 1,
        commissionRate: 0.1,
      });
      // Entry at 100 with slippage → 101
      tracker.openPosition(100, 100, 1000);

      const { trade } = tracker.closePosition(110, 2000, "exit-signal");

      // Exit at 110 with sell slippage: 110 * (1 - 0.01) = 108.9
      expect(trade.exitPrice).toBeCloseTo(108.9, 1);
      // Gross = (108.9 - 101) * 100 = 790
      // Commission = 108.9 * 100 * 0.001 = 10.89
      // Net = 790 - 10.89 = 779.11
      expect(trade.return).toBeCloseTo(779.11, 1);
    });

    it("should apply tax on profitable trades", () => {
      const tracker = createPositionTracker({
        capital: 100_000,
        taxRate: 20,
      });
      tracker.openPosition(100, 100, 1000);

      const { trade } = tracker.closePosition(110, 2000, "exit-signal");

      // Gross = (110 - 100) * 100 = 1000
      // Tax = 1000 * 0.20 = 200
      // Net = 1000 - 200 = 800
      expect(trade.return).toBe(800);
    });

    it("should not apply tax on losing trades", () => {
      const tracker = createPositionTracker({
        capital: 100_000,
        taxRate: 20,
      });
      tracker.openPosition(100, 100, 1000);

      const { trade } = tracker.closePosition(90, 2000, "exit-signal");

      // Gross = (90 - 100) * 100 = -1000
      // No tax on loss
      expect(trade.return).toBe(-1000);
    });

    it("should throw when no position to close", () => {
      const tracker = createPositionTracker({ capital: 100_000 });
      expect(() => tracker.closePosition(100, 1000, "exit-signal")).toThrow(
        "No open position to close",
      );
    });

    it("should map reasons correctly", () => {
      const reasons: Array<{
        input: "stop-loss" | "take-profit" | "trailing-stop" | "force-close" | "manual";
        expected: string;
      }> = [
        { input: "stop-loss", expected: "stopLoss" },
        { input: "take-profit", expected: "takeProfit" },
        { input: "trailing-stop", expected: "trailing" },
        { input: "force-close", expected: "endOfData" },
        { input: "manual", expected: "signal" },
      ];

      for (const { input, expected } of reasons) {
        const tracker = createPositionTracker({ capital: 100_000 });
        tracker.openPosition(100, 10, 1000);
        const { trade } = tracker.closePosition(105, 2000, input);
        expect(trade.exitReason).toBe(expected);
      }
    });
  });

  describe("account tracking", () => {
    it("should track equity through multiple trades", () => {
      const tracker = createPositionTracker({ capital: 100_000 });

      // Trade 1: Win 500
      tracker.openPosition(100, 50, 1000);
      tracker.closePosition(110, 2000, "exit-signal");

      let account = tracker.getAccount();
      expect(account.totalRealizedPnl).toBe(500);
      // Capital restored: 50,000 (remaining) + 110*50 (proceeds) = 50,000 + 5,500 = 55,500?
      // Actually: initial capital - position value = 100,000 - 5,000 = 95,000
      // Close: 95,000 + netProceeds(110*50) = 95,000 + 5,500 = 100,500
      expect(account.currentCapital).toBe(100_500);

      // Trade 2: Loss 500
      tracker.openPosition(100, 50, 3000);
      tracker.closePosition(90, 4000, "exit-signal");

      account = tracker.getAccount();
      // Capital = 100,500 - 5,000 + netProceeds(90*50 = 4,500) = 100,000
      expect(account.currentCapital).toBe(100_000);
      expect(account.totalRealizedPnl).toBe(0);
    });

    it("should track peak equity and max drawdown", () => {
      const tracker = createPositionTracker({ capital: 100_000 });

      // Win first
      tracker.openPosition(100, 100, 1000);
      tracker.updatePrice(makeCandle({ close: 110, high: 110, low: 100 }));

      let account = tracker.getAccount();
      // Equity = cash + market value = 90,000 + 110*100 = 101,000
      expect(account.equity).toBe(101_000);
      // Peak was 100,000 at open, now 101,000
      expect(account.peakEquity).toBe(101_000);

      // Price drops
      tracker.updatePrice(makeCandle({ close: 80, high: 80, low: 80 }));
      account = tracker.getAccount();
      // Equity = 90,000 + 80*100 = 98,000
      expect(account.equity).toBe(98_000);
      // Drawdown = (101,000 - 98,000) / 101,000 * 100 ≈ 2.97%
      expect(account.maxDrawdownPercent).toBeCloseTo(2.97, 1);
    });
  });

  describe("trade history", () => {
    it("should limit trade history to maxTradeHistory", () => {
      const tracker = createPositionTracker({
        capital: 1_000_000,
        maxTradeHistory: 3,
      });

      for (let i = 0; i < 5; i++) {
        tracker.openPosition(100, 1, i * 2000);
        tracker.closePosition(101, i * 2000 + 1000, "exit-signal");
      }

      expect(tracker.getTrades()).toHaveLength(3);
    });
  });

  describe("state persistence", () => {
    it("should save and restore state", () => {
      const tracker1 = createPositionTracker({
        capital: 100_000,
        stopLoss: 2,
        takeProfit: 6,
      });
      tracker1.openPosition(100, 50, 1000);
      tracker1.updatePrice(makeCandle({ close: 103, high: 105, low: 99 }));

      const state = tracker1.getState();
      const serialized = JSON.parse(JSON.stringify(state));

      const tracker2 = createPositionTracker(
        { capital: 100_000, stopLoss: 2, takeProfit: 6 },
        serialized,
      );

      expect(tracker2.getPosition()).toEqual(tracker1.getPosition());
      expect(tracker2.getAccount()).toEqual(tracker1.getAccount());
    });

    it("should restore with correct position counter", () => {
      const tracker1 = createPositionTracker({ capital: 100_000 });
      tracker1.openPosition(100, 10, 1000);
      tracker1.closePosition(105, 2000, "exit-signal");

      const state = tracker1.getState();
      const tracker2 = createPositionTracker({ capital: 100_000 }, state);
      const pos = tracker2.openPosition(100, 10, 3000);

      expect(pos.id).toBe("pos-2");
    });
  });
});
