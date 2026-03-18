import { describe, expect, it } from "vitest";
import { olsRegression } from "../regression";

describe("olsRegression", () => {
  it("recovers perfect linear fit: y = 3x + 2", () => {
    const x = [1, 2, 3, 4, 5];
    const y = x.map((xi) => 3 * xi + 2);

    const result = olsRegression(x, y);

    expect(result.beta).toBeCloseTo(3, 10);
    expect(result.intercept).toBeCloseTo(2, 10);
    expect(result.rSquared).toBeCloseTo(1, 10);
  });

  it("returns beta=0 when x is constant (zero variance)", () => {
    const x = [5, 5, 5, 5, 5];
    const y = [1, 2, 3, 4, 5];

    const result = olsRegression(x, y);
    expect(result.beta).toBe(0);
  });

  it("handles negative slope", () => {
    const x = [1, 2, 3, 4, 5];
    const y = x.map((xi) => -2 * xi + 10);

    const result = olsRegression(x, y);
    expect(result.beta).toBeCloseTo(-2, 10);
    expect(result.intercept).toBeCloseTo(10, 10);
    expect(result.rSquared).toBeCloseTo(1, 10);
  });

  it("residuals sum to approximately zero", () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const y = [2.1, 4.2, 5.8, 8.1, 10.0, 12.2, 13.9, 16.1];

    const result = olsRegression(x, y);
    const residualSum = result.residuals.reduce((a, b) => a + b, 0);

    expect(Math.abs(residualSum)).toBeLessThan(1e-10);
  });

  it("returns correct number of residuals", () => {
    const x = [1, 2, 3];
    const y = [2, 4, 6];

    const result = olsRegression(x, y);
    expect(result.residuals).toHaveLength(3);
  });
});
