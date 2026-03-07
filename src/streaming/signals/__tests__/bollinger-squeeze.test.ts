import { describe, expect, it } from "vitest";
import { createSqueezeDetector } from "../bollinger-squeeze";

describe("createSqueezeDetector", () => {
  it("should not be in squeeze initially", () => {
    const d = createSqueezeDetector({ bandwidthThreshold: 0.05 });
    const result = d.next(0.08);
    expect(result.squeezeStart).toBe(false);
    expect(result.squeezeEnd).toBe(false);
    expect(result.inSqueeze).toBe(false);
  });

  it("should detect squeeze start when bandwidth drops below threshold", () => {
    const d = createSqueezeDetector({ bandwidthThreshold: 0.05 });
    d.next(0.08);
    const result = d.next(0.04);
    expect(result.squeezeStart).toBe(true);
    expect(result.squeezeEnd).toBe(false);
    expect(result.inSqueeze).toBe(true);
  });

  it("should stay in squeeze while below threshold", () => {
    const d = createSqueezeDetector({ bandwidthThreshold: 0.05 });
    d.next(0.08);
    d.next(0.04);
    const result = d.next(0.03);
    expect(result.squeezeStart).toBe(false);
    expect(result.squeezeEnd).toBe(false);
    expect(result.inSqueeze).toBe(true);
  });

  it("should detect squeeze end when bandwidth rises above threshold", () => {
    const d = createSqueezeDetector({ bandwidthThreshold: 0.05 });
    d.next(0.08);
    d.next(0.04); // squeeze start
    d.next(0.03); // still in squeeze
    const result = d.next(0.06);
    expect(result.squeezeStart).toBe(false);
    expect(result.squeezeEnd).toBe(true);
    expect(result.inSqueeze).toBe(false);
  });

  it("should handle full squeeze cycle", () => {
    const d = createSqueezeDetector({ bandwidthThreshold: 0.1 });

    expect(d.next(0.15).inSqueeze).toBe(false);
    expect(d.next(0.12).inSqueeze).toBe(false);
    const start = d.next(0.08);
    expect(start.squeezeStart).toBe(true);
    expect(start.inSqueeze).toBe(true);
    expect(d.next(0.06).inSqueeze).toBe(true);
    const end = d.next(0.12);
    expect(end.squeezeEnd).toBe(true);
    expect(end.inSqueeze).toBe(false);
    expect(d.next(0.15).inSqueeze).toBe(false);
  });

  it("should handle null bandwidth", () => {
    const d = createSqueezeDetector({ bandwidthThreshold: 0.05 });
    d.next(0.04); // in squeeze
    // null should not change squeeze state
    const result = d.next(null);
    expect(result.squeezeStart).toBe(false);
    expect(result.squeezeEnd).toBe(false);
  });

  it("should support peek without advancing state", () => {
    const d = createSqueezeDetector({ bandwidthThreshold: 0.05 });
    d.next(0.08);
    expect(d.peek(0.04).squeezeStart).toBe(true);
    // State not changed
    expect(d.next(0.04).squeezeStart).toBe(true);
  });

  it("should use default threshold of 0.1", () => {
    const d = createSqueezeDetector();
    d.next(0.15);
    expect(d.next(0.08).squeezeStart).toBe(true);
    expect(d.next(0.12).squeezeEnd).toBe(true);
  });

  describe("state persistence", () => {
    it("should serialize and restore state", () => {
      const d1 = createSqueezeDetector({ bandwidthThreshold: 0.05 });
      d1.next(0.08);
      d1.next(0.04); // in squeeze
      const state = JSON.parse(JSON.stringify(d1.getState()));

      const d2 = createSqueezeDetector({}, state);
      expect(d2.next(0.03).inSqueeze).toBe(true);
      expect(d2.next(0.06).squeezeEnd).toBe(true);
    });
  });
});
