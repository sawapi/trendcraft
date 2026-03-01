import { describe, it, expect } from "vitest";
import { createThresholdDetector } from "../threshold";

describe("createThresholdDetector", () => {
  it("should return no crosses on first call (no previous data)", () => {
    const d = createThresholdDetector(30);
    const result = d.next(25);
    expect(result.crossAbove).toBe(false);
    expect(result.crossBelow).toBe(false);
  });

  it("should detect crossing above threshold", () => {
    const d = createThresholdDetector(30);
    d.next(25); // below
    const result = d.next(35); // above
    expect(result.crossAbove).toBe(true);
    expect(result.crossBelow).toBe(false);
  });

  it("should detect crossing below threshold", () => {
    const d = createThresholdDetector(70);
    d.next(75); // above
    const result = d.next(65); // below
    expect(result.crossAbove).toBe(false);
    expect(result.crossBelow).toBe(true);
  });

  it("should detect crossing above from equal", () => {
    const d = createThresholdDetector(30);
    d.next(30); // equal
    const result = d.next(31); // above
    expect(result.crossAbove).toBe(true);
  });

  it("should detect crossing below from equal", () => {
    const d = createThresholdDetector(70);
    d.next(70); // equal
    const result = d.next(69); // below
    expect(result.crossBelow).toBe(true);
  });

  it("should not fire when staying above", () => {
    const d = createThresholdDetector(30);
    d.next(35);
    const result = d.next(40);
    expect(result.crossAbove).toBe(false);
    expect(result.crossBelow).toBe(false);
  });

  it("should not fire when staying below", () => {
    const d = createThresholdDetector(30);
    d.next(25);
    const result = d.next(20);
    expect(result.crossAbove).toBe(false);
    expect(result.crossBelow).toBe(false);
  });

  it("should handle null values", () => {
    const d = createThresholdDetector(30);
    d.next(25);
    const result = d.next(null);
    expect(result.crossAbove).toBe(false);
    expect(result.crossBelow).toBe(false);
  });

  it("should detect both directions in a sequence", () => {
    const d = createThresholdDetector(50);
    d.next(45); // below
    expect(d.next(55).crossAbove).toBe(true);
    expect(d.next(60).crossAbove).toBe(false);
    expect(d.next(45).crossBelow).toBe(true);
    expect(d.next(40).crossBelow).toBe(false);
    expect(d.next(55).crossAbove).toBe(true);
  });

  it("should support peek without advancing state", () => {
    const d = createThresholdDetector(30);
    d.next(25);
    expect(d.peek(35).crossAbove).toBe(true);
    // State not advanced, so next with same value should also fire
    expect(d.next(35).crossAbove).toBe(true);
    // Now state is advanced
    expect(d.next(35).crossAbove).toBe(false);
  });

  describe("state persistence", () => {
    it("should serialize and restore state", () => {
      const d1 = createThresholdDetector(30);
      d1.next(25);
      const state = JSON.parse(JSON.stringify(d1.getState()));

      const d2 = createThresholdDetector(30, state);
      expect(d2.next(35).crossAbove).toBe(true);
    });

    it("should preserve threshold in state", () => {
      const d1 = createThresholdDetector(42);
      d1.next(40);
      const state = d1.getState();
      expect(state.threshold).toBe(42);
      expect(state.prevValue).toBe(40);
    });
  });
});
