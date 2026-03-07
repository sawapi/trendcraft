/**
 * Tests for Signal Lifecycle Management (Feature 2)
 */
import { describe, expect, it } from "vitest";
import type { TradeSignal } from "../../types/trade-signal";
import { processSignalsBatch } from "../lifecycle/batch-adapter";
import { createSignalManager } from "../lifecycle/signal-manager";

function makeSignal(time: number, action: "BUY" | "SELL" = "BUY"): TradeSignal {
  return {
    id: `signal-${action}-${time}`,
    time,
    action,
    direction: action === "BUY" ? "LONG" : "SHORT",
    confidence: 70,
    reasons: [{ source: "test", name: "testSignal" }],
  };
}

describe("createSignalManager", () => {
  describe("basic operation", () => {
    it("passes through signals without options", () => {
      const manager = createSignalManager();
      const result = manager.onBar([makeSignal(1000)], 1000);
      expect(result.length).toBe(1);
    });

    it("tracks active count", () => {
      const manager = createSignalManager();
      manager.onBar([makeSignal(1000)], 1000);
      expect(manager.getActiveCount()).toBe(1);
    });
  });

  describe("cooldown", () => {
    it("suppresses duplicate signals within cooldown bars", () => {
      const manager = createSignalManager({ cooldown: { bars: 3 } });

      const r1 = manager.onBar([makeSignal(1000)], 1000);
      expect(r1.length).toBe(1);

      // Same signal on next bar - should be suppressed
      const r2 = manager.onBar([makeSignal(2000)], 2000);
      expect(r2.length).toBe(0);

      // Still within cooldown (bar 3, cooldown is 3)
      const r3 = manager.onBar([makeSignal(3000)], 3000);
      expect(r3.length).toBe(0);

      // After cooldown (bar 4)
      const r4 = manager.onBar([makeSignal(4000)], 4000);
      expect(r4.length).toBe(1);
    });

    it("allows different signals during cooldown", () => {
      const manager = createSignalManager({ cooldown: { bars: 5 } });

      manager.onBar([makeSignal(1000, "BUY")], 1000);
      const r2 = manager.onBar([makeSignal(2000, "SELL")], 2000);
      expect(r2.length).toBe(1); // Different signal, not suppressed
    });

    it("supports ms-based cooldown", () => {
      const manager = createSignalManager({ cooldown: { ms: 5000 } });

      manager.onBar([makeSignal(1000)], 1000);
      const r2 = manager.onBar([makeSignal(3000)], 3000);
      expect(r2.length).toBe(0); // Within 5000ms

      const r3 = manager.onBar([makeSignal(7000)], 7000);
      expect(r3.length).toBe(1); // After 5000ms
    });
  });

  describe("debounce", () => {
    it("requires N consecutive bars to activate", () => {
      const manager = createSignalManager({ debounce: { bars: 3 } });

      const r1 = manager.onBar([makeSignal(1000)], 1000);
      expect(r1.length).toBe(0); // Not enough consecutive

      const r2 = manager.onBar([makeSignal(2000)], 2000);
      expect(r2.length).toBe(0);

      const r3 = manager.onBar([makeSignal(3000)], 3000);
      expect(r3.length).toBe(1); // 3 consecutive bars
    });

    it("resets count when signal disappears", () => {
      const manager = createSignalManager({ debounce: { bars: 3 } });

      manager.onBar([makeSignal(1000)], 1000);
      manager.onBar([makeSignal(2000)], 2000);
      manager.onBar([], 3000); // Signal disappears
      manager.onBar([makeSignal(4000)], 4000);
      const r5 = manager.onBar([makeSignal(5000)], 5000);
      expect(r5.length).toBe(0); // Only 2 consecutive, not 3
    });

    it("debounce of 1 activates immediately", () => {
      const manager = createSignalManager({ debounce: { bars: 1 } });
      const r1 = manager.onBar([makeSignal(1000)], 1000);
      expect(r1.length).toBe(1);
    });
  });

  describe("expiry", () => {
    it("expires active signals after N bars", () => {
      const manager = createSignalManager({ expiry: { bars: 2 } });

      manager.onBar([makeSignal(1000)], 1000);
      expect(manager.getActiveCount()).toBe(1);

      manager.onBar([], 2000);
      expect(manager.getActiveCount()).toBe(1); // Not expired yet (1 bar)

      manager.onBar([], 3000);
      expect(manager.getActiveCount()).toBe(0); // Expired (2 bars)
    });

    it("expires signals based on ms", () => {
      const manager = createSignalManager({ expiry: { ms: 5000 } });

      manager.onBar([makeSignal(1000)], 1000);
      expect(manager.getActiveCount()).toBe(1);

      manager.onBar([], 5000);
      expect(manager.getActiveCount()).toBe(1); // 4000ms, not expired

      manager.onBar([], 7000);
      expect(manager.getActiveCount()).toBe(0); // 6000ms >= 5000ms
    });
  });

  describe("fill and cancel", () => {
    it("fills an active signal", () => {
      const manager = createSignalManager();
      const signals = manager.onBar([makeSignal(1000)], 1000);
      manager.fill(signals[0].id);

      const filled = manager.getSignals("FILLED");
      expect(filled.length).toBe(1);
      expect(manager.getActiveCount()).toBe(0);
    });

    it("cancels a signal", () => {
      const manager = createSignalManager();
      const signals = manager.onBar([makeSignal(1000)], 1000);
      manager.cancel(signals[0].id);

      const cancelled = manager.getSignals("CANCELLED");
      expect(cancelled.length).toBe(1);
    });
  });

  describe("custom signalKey", () => {
    it("uses custom key for deduplication", () => {
      const manager = createSignalManager({
        cooldown: { bars: 5 },
        signalKey: () => "same-key", // All signals treated as identical
      });

      const r1 = manager.onBar([makeSignal(1000, "BUY")], 1000);
      expect(r1.length).toBe(1);

      const r2 = manager.onBar([makeSignal(2000, "SELL")], 2000);
      expect(r2.length).toBe(0); // Suppressed because same key
    });
  });

  describe("state serialization", () => {
    it("serializes and restores state", () => {
      const manager = createSignalManager({ cooldown: { bars: 3 } });
      manager.onBar([makeSignal(1000)], 1000);

      const state = manager.getState();
      expect(state.barCount).toBe(1);
      expect(state.signals.length).toBe(1);

      // Restore from state
      const restored = createSignalManager({ cooldown: { bars: 3 } }, state);
      // Signal should still be in cooldown
      const r2 = restored.onBar([makeSignal(2000)], 2000);
      expect(r2.length).toBe(0); // Still in cooldown
    });
  });
});

describe("processSignalsBatch", () => {
  it("deduplicates signals in batch mode", () => {
    const signals = [
      makeSignal(1000),
      makeSignal(2000),
      makeSignal(3000),
      makeSignal(4000),
      makeSignal(5000),
    ];

    const filtered = processSignalsBatch(signals, { cooldown: { bars: 3 } });
    expect(filtered.length).toBe(2); // 1000 and 4000
  });

  it("returns all signals without options", () => {
    const signals = [makeSignal(1000), makeSignal(2000)];
    const filtered = processSignalsBatch(signals);
    expect(filtered.length).toBe(2);
  });

  it("handles empty array", () => {
    const result = processSignalsBatch([]);
    expect(result.length).toBe(0);
  });

  it("groups signals at same time", () => {
    const signals = [
      makeSignal(1000, "BUY"),
      makeSignal(1000, "SELL"), // Same time, different signal
    ];
    const filtered = processSignalsBatch(signals);
    expect(filtered.length).toBe(2);
  });
});
