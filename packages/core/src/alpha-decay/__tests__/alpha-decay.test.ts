import { describe, expect, it } from "vitest";
import type { DecayObservation } from "../../types/alpha-decay";
import {
  analyzeAlphaDecay,
  createObservationsFromScores,
  createObservationsFromTrades,
} from "../monitor";
import { linearRegression, spearmanCorrelation } from "../statistics";

// ---------------------------------------------------------------------------
// Helper: generate synthetic observations
// ---------------------------------------------------------------------------

function generateObservations(
  count: number,
  signalFn: (i: number) => number,
  returnFn: (i: number) => number,
): DecayObservation[] {
  return Array.from({ length: count }, (_, i) => ({
    time: 1000 + i * 60,
    signal: signalFn(i),
    forwardReturn: returnFn(i),
  }));
}

// ---------------------------------------------------------------------------
// 1. spearmanCorrelation — perfect positive
// ---------------------------------------------------------------------------
describe("spearmanCorrelation", () => {
  it("returns rho=1 for perfect positive correlation", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 20, 30, 40, 50];
    const { rho, pValue } = spearmanCorrelation(x, y);
    expect(rho).toBeCloseTo(1.0, 6);
    expect(pValue).toBeLessThan(0.05);
  });

  it("returns rho=-1 for perfect negative correlation", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [50, 40, 30, 20, 10];
    const { rho, pValue } = spearmanCorrelation(x, y);
    expect(rho).toBeCloseTo(-1.0, 6);
    expect(pValue).toBeLessThan(0.05);
  });

  it("returns rho near 0 for uncorrelated data", () => {
    // Alternating pattern has no monotonic relationship
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const y = [10, -10, 10, -10, 10, -10, 10, -10];
    const { rho } = spearmanCorrelation(x, y);
    expect(Math.abs(rho)).toBeLessThan(0.3);
  });

  it("handles fewer than 3 observations", () => {
    const { rho, pValue } = spearmanCorrelation([1, 2], [3, 4]);
    expect(rho).toBe(0);
    expect(pValue).toBe(1);
  });

  it("handles ties correctly", () => {
    const x = [1, 1, 2, 3];
    const y = [10, 10, 20, 30];
    const { rho } = spearmanCorrelation(x, y);
    expect(rho).toBeCloseTo(1.0, 4);
  });
});

// ---------------------------------------------------------------------------
// 2. linearRegression — known slope and intercept
// ---------------------------------------------------------------------------
describe("linearRegression", () => {
  it("fits y = 2x + 1 exactly", () => {
    const x = [0, 1, 2, 3, 4];
    const y = [1, 3, 5, 7, 9];
    const { slope, intercept } = linearRegression(x, y);
    expect(slope).toBeCloseTo(2.0, 6);
    expect(intercept).toBeCloseTo(1.0, 6);
  });

  it("returns slope=0 for constant y", () => {
    const x = [0, 1, 2, 3];
    const y = [5, 5, 5, 5];
    const { slope, intercept } = linearRegression(x, y);
    expect(slope).toBeCloseTo(0, 6);
    expect(intercept).toBeCloseTo(5, 6);
  });

  it("handles single point", () => {
    const { slope, intercept } = linearRegression([0], [7]);
    expect(slope).toBe(0);
    expect(intercept).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// 3. Rolling IC — correct number of data points
// ---------------------------------------------------------------------------
describe("analyzeAlphaDecay rolling IC length", () => {
  it("produces correct number of rolling IC points", () => {
    const window = 10;
    const count = 50;
    const obs = generateObservations(
      count,
      (i) => i,
      (i) => i * 0.5,
    );
    const result = analyzeAlphaDecay(obs, { window, minObservations: 10 });
    // rolling window of 10 over 50 observations => 50 - 10 + 1 = 41 points
    expect(result.rollingIC).toHaveLength(count - window + 1);
    expect(result.rollingHitRate).toHaveLength(count - window + 1);
  });
});

// ---------------------------------------------------------------------------
// 4. Healthy signal — stable IC above 0.1
// ---------------------------------------------------------------------------
describe("analyzeAlphaDecay healthy signal", () => {
  it("returns healthy status for strongly correlated signal", () => {
    // Signal perfectly predicts returns
    const obs = generateObservations(
      100,
      (i) => i,
      (i) => i * 2 + 1,
    );
    const result = analyzeAlphaDecay(obs, { window: 20, minObservations: 20 });
    expect(result.assessment.status).toBe("healthy");
    expect(result.assessment.currentIC).toBeGreaterThan(0.5);
    expect(result.assessment.currentHitRate).toBeGreaterThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// 5. Degrading signal — IC declining over time
// ---------------------------------------------------------------------------
describe("analyzeAlphaDecay degrading signal", () => {
  it("detects warning or degraded status when IC declines", () => {
    // First half: good correlation; second half: random
    const obs: DecayObservation[] = [];
    for (let i = 0; i < 200; i++) {
      if (i < 100) {
        // Strong signal
        obs.push({ time: 1000 + i, signal: i, forwardReturn: i * 2 });
      } else {
        // Degraded: signal uncorrelated with return
        obs.push({
          time: 1000 + i,
          signal: i,
          forwardReturn: ((i * 7) % 13) - 6, // pseudo-random
        });
      }
    }
    const result = analyzeAlphaDecay(obs, { window: 30, minObservations: 30 });
    // IC should have declined, status should not be healthy
    expect(result.assessment.icTrend).toBeLessThan(0);
    expect(["warning", "degraded", "critical"]).toContain(result.assessment.status);
  });
});

// ---------------------------------------------------------------------------
// 6. Critical signal — negative IC
// ---------------------------------------------------------------------------
describe("analyzeAlphaDecay critical signal", () => {
  it("returns critical status for negative IC", () => {
    // Signal inversely predicts returns
    const obs = generateObservations(
      100,
      (i) => i,
      (i) => -i * 2,
    );
    const result = analyzeAlphaDecay(obs, { window: 20, minObservations: 20 });
    expect(result.assessment.status).toBe("critical");
    expect(result.assessment.currentIC).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// 7. CUSUM break detection
// ---------------------------------------------------------------------------
describe("CUSUM break detection", () => {
  it("detects structural break in synthetic data", () => {
    // Phase 1: high positive IC, Phase 2: sudden negative IC
    const obs: DecayObservation[] = [];
    for (let i = 0; i < 200; i++) {
      if (i < 120) {
        obs.push({ time: 1000 + i, signal: i, forwardReturn: i * 3 });
      } else {
        obs.push({ time: 1000 + i, signal: i, forwardReturn: -i * 3 });
      }
    }
    const result = analyzeAlphaDecay(obs, {
      window: 20,
      cusumThreshold: 3.0,
      minObservations: 20,
    });
    // Should detect at least one degradation break
    const degradationBreaks = result.breaks.filter((b) => b.direction === "degradation");
    expect(degradationBreaks.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 8. createObservationsFromTrades
// ---------------------------------------------------------------------------
describe("createObservationsFromTrades", () => {
  it("converts trades to observations", () => {
    const trades = [
      { entryTime: 1000, returnPercent: 2.5 },
      { entryTime: 2000, returnPercent: -1.0 },
      { entryTime: 3000, returnPercent: 0.5 },
    ];
    const obs = createObservationsFromTrades(trades);
    expect(obs).toHaveLength(3);
    expect(obs[0]).toEqual({
      time: 1000,
      signal: 1,
      forwardReturn: 2.5,
    });
    expect(obs[1].forwardReturn).toBe(-1.0);
  });
});

// ---------------------------------------------------------------------------
// 9. Insufficient data handling
// ---------------------------------------------------------------------------
describe("analyzeAlphaDecay insufficient data", () => {
  it("returns empty result with insufficient observations", () => {
    const obs = generateObservations(
      5,
      (i) => i,
      (i) => i,
    );
    const result = analyzeAlphaDecay(obs, { minObservations: 30 });
    expect(result.rollingIC).toHaveLength(0);
    expect(result.rollingHitRate).toHaveLength(0);
    expect(result.assessment.status).toBe("healthy");
    expect(result.assessment.reason).toContain("Insufficient");
  });
});

// ---------------------------------------------------------------------------
// 10. Half-life estimation
// ---------------------------------------------------------------------------
describe("half-life estimation", () => {
  it("estimates half-life for linearly declining IC", () => {
    // Construct observations where IC will linearly decline
    // by having correlation weaken over time
    const obs: DecayObservation[] = [];
    for (let i = 0; i < 300; i++) {
      const noise = i * 0.02; // Increasing noise
      obs.push({
        time: 1000 + i,
        signal: i,
        forwardReturn: i + noise * (((i * 17) % 7) - 3),
      });
    }
    const result = analyzeAlphaDecay(obs, { window: 30, minObservations: 30 });
    // If IC is declining and positive, half-life should be set
    if (result.assessment.icTrend < 0 && result.assessment.currentIC > 0) {
      expect(result.assessment.halfLife).not.toBeNull();
      expect(result.assessment.halfLife!).toBeGreaterThan(0);
    }
  });

  it("returns null half-life when IC is stable or increasing", () => {
    // Perfectly correlated signal = stable IC
    const obs = generateObservations(
      100,
      (i) => i,
      (i) => i * 2,
    );
    const result = analyzeAlphaDecay(obs, { window: 20, minObservations: 20 });
    // Stable IC => no half-life
    if (result.assessment.icTrend >= 0) {
      expect(result.assessment.halfLife).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// 11. createObservationsFromScores
// ---------------------------------------------------------------------------
describe("createObservationsFromScores", () => {
  it("pairs scores with forward returns from candles", () => {
    const candles = [
      { time: 100, close: 10 },
      { time: 200, close: 12 },
      { time: 300, close: 11 },
      { time: 400, close: 15 },
      { time: 500, close: 14 },
    ];
    const scores = [
      { time: 100, score: 0.8 },
      { time: 200, score: -0.5 },
      { time: 300, score: 0.3 },
    ];
    const obs = createObservationsFromScores(scores, candles, 1);
    expect(obs).toHaveLength(3);
    // Forward return from time 100: (12 - 10) / 10 * 100 = 20%
    expect(obs[0].forwardReturn).toBeCloseTo(20, 4);
    expect(obs[0].signal).toBe(0.8);
    // Forward return from time 200: (11 - 12) / 12 * 100 ≈ -8.333%
    expect(obs[1].forwardReturn).toBeCloseTo(-8.3333, 2);
  });

  it("skips scores without enough forward bars", () => {
    const candles = [
      { time: 100, close: 10 },
      { time: 200, close: 12 },
    ];
    const scores = [
      { time: 100, score: 0.5 },
      { time: 200, score: 0.7 }, // No forward bar available
    ];
    const obs = createObservationsFromScores(scores, candles, 1);
    expect(obs).toHaveLength(1);
  });
});
