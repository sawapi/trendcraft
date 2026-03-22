import { describe, expect, it } from "vitest";
import type { PositionSnapshot } from "../order-types";
import { reconcilePositions } from "../reconciler";

describe("reconcilePositions", () => {
  it("returns empty array when positions match", () => {
    const internal: PositionSnapshot[] = [{ symbol: "AAPL", quantity: 10, avgEntryPrice: 150 }];
    const external: PositionSnapshot[] = [{ symbol: "AAPL", quantity: 10, avgEntryPrice: 150 }];

    const result = reconcilePositions(internal, external);
    expect(result).toEqual([]);
  });

  it("detects missing-external position", () => {
    const internal: PositionSnapshot[] = [{ symbol: "AAPL", quantity: 10, avgEntryPrice: 150 }];
    const external: PositionSnapshot[] = [];

    const result = reconcilePositions(internal, external);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("missing-external");
    expect(result[0].symbol).toBe("AAPL");
  });

  it("detects missing-internal position", () => {
    const internal: PositionSnapshot[] = [];
    const external: PositionSnapshot[] = [{ symbol: "TSLA", quantity: 5, avgEntryPrice: 200 }];

    const result = reconcilePositions(internal, external);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("missing-internal");
    expect(result[0].symbol).toBe("TSLA");
  });

  it("detects quantity mismatch", () => {
    const internal: PositionSnapshot[] = [{ symbol: "AAPL", quantity: 10, avgEntryPrice: 150 }];
    const external: PositionSnapshot[] = [{ symbol: "AAPL", quantity: 8, avgEntryPrice: 150 }];

    const result = reconcilePositions(internal, external);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("quantity-mismatch");
  });

  it("detects price mismatch when exceeding tolerance", () => {
    const internal: PositionSnapshot[] = [{ symbol: "AAPL", quantity: 10, avgEntryPrice: 100 }];
    const external: PositionSnapshot[] = [{ symbol: "AAPL", quantity: 10, avgEntryPrice: 103 }];

    const result = reconcilePositions(internal, external, { priceTolerance: 0.01 });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("price-mismatch");
  });

  it("ignores price difference within tolerance", () => {
    const internal: PositionSnapshot[] = [{ symbol: "AAPL", quantity: 10, avgEntryPrice: 100 }];
    const external: PositionSnapshot[] = [{ symbol: "AAPL", quantity: 10, avgEntryPrice: 100.5 }];

    const result = reconcilePositions(internal, external, { priceTolerance: 0.01 });
    expect(result).toEqual([]);
  });

  it("handles multiple discrepancies at once", () => {
    const internal: PositionSnapshot[] = [
      { symbol: "AAPL", quantity: 10, avgEntryPrice: 150 },
      { symbol: "GOOG", quantity: 5, avgEntryPrice: 2800 },
    ];
    const external: PositionSnapshot[] = [
      { symbol: "AAPL", quantity: 8, avgEntryPrice: 150 },
      { symbol: "TSLA", quantity: 3, avgEntryPrice: 200 },
    ];

    const result = reconcilePositions(internal, external);
    // AAPL: quantity mismatch, GOOG: missing-external, TSLA: missing-internal
    expect(result).toHaveLength(3);
    const types = result.map((d) => d.type);
    expect(types).toContain("quantity-mismatch");
    expect(types).toContain("missing-external");
    expect(types).toContain("missing-internal");
  });

  it("returns empty array for two empty sets", () => {
    const result = reconcilePositions([], []);
    expect(result).toEqual([]);
  });
});
