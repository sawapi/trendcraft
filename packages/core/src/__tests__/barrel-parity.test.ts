// @vitest-environment node
/**
 * Root barrel parity — sub-barrel exports must be reachable from the root
 * entry.
 *
 * None of the modules below has a published `exports` subpath in
 * package.json, so the root entry is the ONLY public path to them. A name
 * exported by a sub-barrel but never re-exported from `src/index.ts` is
 * silently unreachable for package consumers — exactly how 22 scoring
 * evaluators (createStochOversoldEvaluator, goldenCross50200, …) shipped
 * as dead API: documented in JSDoc examples yet impossible to import.
 *
 * The check matches by value identity where possible so that aliased
 * re-exports (e.g. `perfectOrderBullish as poBullishSignal`) count as
 * reachable; primitive values fall back to a name match.
 */
import { describe, expect, it } from "vitest";
import * as root from "../index";

// Sub-barrels whose export surface is public API reachable only via the root.
const BARRELS: Record<string, () => Promise<Record<string, unknown>>> = {
  scoring: () => import("../scoring"),
  backtest: () => import("../backtest"),
  optimization: () => import("../optimization"),
  risk: () => import("../risk"),
  "meta-strategy": () => import("../meta-strategy"),
  signals: () => import("../signals"),
  "position-sizing": () => import("../position-sizing"),
  strategy: () => import("../strategy"),
};

// ---------------------------------------------------------------------------
// Names a sub-barrel exports for cross-module use but that are intentionally
// NOT published on the root entry. EVERY entry needs a justification; an
// entry that is actually a drift bug must be re-exported from src/index.ts
// and removed from here, not parked forever. A stale entry (name gone from
// the barrel, or meanwhile published on the root) fails the guard test below.
// ---------------------------------------------------------------------------
const INTERNAL_ONLY: Record<string, string[]> = {
  backtest: [
    // Engine internals surfaced on the barrel for sibling modules
    // (optimization, screening, strategy hydration) — not consumer API.
    "applyVolumeConstraint",
    "evaluateCondition",
    "getRequiredTimeframes",
    "requiresMtf",
    "resolvePrice",
    "resolveTimeInForce",
  ],
  optimization: [
    // Metrics plumbing shared between the optimizers (grid search, Pareto,
    // walk-forward) — consumers get the composed results, not the plumbing.
    "calculateDailyReturns",
    "calculateMAR",
    "checkConstraint",
    "getMetricValue",
  ],
  "position-sizing": [
    // Shared input-validation/result-assembly helpers behind the public
    // sizing calculators.
    "applyConstraints",
    "createResult",
    "validateInputs",
  ],
};

function isReachableFromRoot(
  key: string,
  value: unknown,
  rootValues: Set<unknown>,
  rootNames: Set<string>,
): boolean {
  if (typeof value === "function" || (typeof value === "object" && value !== null)) {
    return rootValues.has(value);
  }
  // Primitive exports (constants) can't be identity-matched reliably.
  return rootNames.has(key);
}

describe("root barrel parity", () => {
  const rootValues = new Set<unknown>(Object.values(root));
  const rootNames = new Set(Object.keys(root));

  for (const [name, load] of Object.entries(BARRELS)) {
    it(`every public ${name} export is reachable from the root entry`, {
      timeout: 30_000,
    }, async () => {
      const mod = await load();
      const internal = new Set(INTERNAL_ONLY[name] ?? []);
      const missing = Object.entries(mod)
        .filter(([key]) => !internal.has(key))
        .filter(([key, value]) => !isReachableFromRoot(key, value, rootValues, rootNames))
        .map(([key]) => key);

      expect(
        missing,
        `src/${name}/index.ts exports not reachable from src/index.ts ` +
          `(re-export them from the root, or move them to INTERNAL_ONLY with a justification):\n` +
          missing.map((k) => `  - ${k}`).join("\n"),
      ).toEqual([]);
    });
  }

  it("INTERNAL_ONLY entries are still present in their barrel and still unpublished", async () => {
    const stale: string[] = [];
    for (const [name, keys] of Object.entries(INTERNAL_ONLY)) {
      const mod = await BARRELS[name]();
      for (const key of keys) {
        if (!(key in mod)) {
          stale.push(`${name}.${key} — no longer exported by the barrel; remove the entry`);
        } else if (isReachableFromRoot(key, mod[key], rootValues, rootNames)) {
          stale.push(`${name}.${key} — now published on the root; remove the entry`);
        }
      }
    }
    expect(stale, `Stale INTERNAL_ONLY entries:\n${stale.join("\n")}`).toEqual([]);
  });
});
