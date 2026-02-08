import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NormalizedCandle } from "../../src/types";

const FIXTURES_DIR = resolve(__dirname, "../fixtures");

interface OhlcvFixture {
  length: number;
  candles: NormalizedCandle[];
}

interface SingleTestCase {
  name: string;
  params: Record<string, number>;
  values: (number | null)[];
}

interface CompositeTestCase {
  name: string;
  params: Record<string, number>;
  values: Record<string, (number | null)[]>;
}

export interface Fixture {
  indicator: string;
  talib_function: string;
  note?: string;
  test_cases: (SingleTestCase | CompositeTestCase)[];
}

export function loadOhlcv(): NormalizedCandle[] {
  const raw = readFileSync(resolve(FIXTURES_DIR, "ohlcv.json"), "utf-8");
  const data: OhlcvFixture = JSON.parse(raw);
  return data.candles;
}

export function loadFixture(name: string): Fixture {
  const raw = readFileSync(resolve(FIXTURES_DIR, `${name}.json`), "utf-8");
  return JSON.parse(raw);
}

export function isSingleTestCase(tc: SingleTestCase | CompositeTestCase): tc is SingleTestCase {
  return Array.isArray(tc.values);
}

/**
 * Compare a TrendCraft Series<number | null> against expected fixture values.
 * Uses toBeCloseTo with the specified number of decimal places.
 *
 * @param startIndex - Skip entries before this index (for warmup divergence).
 *   When TrendCraft and TA-Lib use different warmup strategies, early values
 *   diverge then converge. Set startIndex past the convergence point.
 */
export function assertSeriesMatch(
  actual: { time: number; value: number | null }[],
  expected: (number | null)[],
  decimals: number,
  label: string,
  startIndex = 0,
): void {
  expect(actual.length).toBe(expected.length);

  let compared = 0;
  for (let i = startIndex; i < expected.length; i++) {
    const exp = expected[i];
    const act = actual[i].value;

    if (exp === null || act === null) {
      continue;
    }

    expect(act).toBeCloseTo(exp, decimals);
    compared++;
  }

  // Ensure we actually compared something
  expect(compared).toBeGreaterThan(0);
}
