import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertPeriod, isPeriod } from "../../../utils/validate-period";
import { requirePeriod } from "../state-contract";

const CANDIDATES = [
  -1,
  0,
  0.5,
  1,
  1.5,
  2,
  14,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
];

const accepts = (fn: () => unknown): boolean => {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
};

describe("requirePeriod", () => {
  for (const min of [1, 2]) {
    it(`accepts exactly the values assertPeriod accepts (min ${min})`, () => {
      for (const value of CANDIDATES) {
        const batch = accepts(() => assertPeriod("period", value, min));
        const incremental = accepts(() => requirePeriod("x", { period: value }, "period", min));
        expect({ value, incremental }).toEqual({ value, incremental: batch });
        expect(isPeriod(value, min)).toBe(batch);
      }
    });
  }

  it("keeps the incremental error wording", () => {
    expect(() => requirePeriod("sma", { period: 0 }, "period")).toThrow(
      'sma: option "period" failed validation (must be a positive integer)',
    );
    expect(() => requirePeriod("hurst", { minWindow: 1 }, "minWindow", 2)).toThrow(
      'hurst: option "minWindow" failed validation (must be an integer >= 2)',
    );
    expect(() => requirePeriod("sma", {} as { period?: number }, "period")).toThrow(
      /required option "period" was not provided/,
    );
  });
});

/** Every incremental source file, tests excluded. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sources(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

describe("period rule ownership", () => {
  it("has no inline copy of the period predicate in the incremental factories", () => {
    // The rule lives in isPeriod; an inline `Number.isInteger(v) && v >= 1`
    // could drift from the batch indicators without anything noticing. A
    // bounded range such as anchoredVwap's band count (0 to 2) is not a period.
    const root = join(__dirname, "..");
    const offenders = sources(root).filter((file) =>
      /Number\.isInteger\(\w+\)\s*&&\s*\w+\s*>=\s*[12](?!\s*&&)|!Number\.isInteger\(\w+\)\s*\|\|\s*\w+\s*<\s*[12]\b/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offenders.map((f) => f.slice(root.length + 1))).toEqual([]);
  });
});
