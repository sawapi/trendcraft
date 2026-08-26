import { describe, expect, it } from "vitest";
import { backtestRegistry } from "../registry-backtest";
import { streamingRegistry } from "../registry-streaming";
import type { ParamDef } from "../types";

/**
 * Registry parity contract (backtest ↔ streaming).
 *
 * `backtestRegistry` and `streamingRegistry` are two independently hand-
 * maintained tables. A StrategyJSON leaf `{ name, params }` is meant to be
 * portable: validating or hydrating it against either registry should behave
 * the same. That only holds when conditions registered under the SAME name
 * agree on the params they share.
 *
 * The two sides use deliberately different execution models:
 *   - streaming conditions read a pre-computed snapshot via a `key` param
 *   - backtest conditions compute the indicator inline from `period`/`fast`…
 * So params that exist in only ONE registry (streaming `key`, backtest
 * `period`, …) are an intentional paradigm difference and are NOT compared.
 *
 * What this guards: for a condition present in both registries, every param
 * key common to both must have an identical portability-relevant schema, and
 * `isFilter`/`category` must match. This catches silent drift — e.g. a shared
 * `threshold` whose default diverged so a portable JSON omitting it behaves
 * differently per side. (See the 2026-06 reconciliation that aligned cmf/atr/
 * priceDroppedAtr defaults and the dmi `minAdx`→`threshold` rename.)
 */

// Portability-relevant schema fields. UI-only hints (suggestedMin/suggestedMax,
// precision, integer, tunable, description) are intentionally excluded — they
// don't affect validateConditionSpec / hydrate behavior, so they may differ
// between a UI-facing backtest entry and a leaner streaming entry.
const COMPARED_FIELDS: (keyof ParamDef)[] = ["type", "default", "min", "max", "required", "enum"];

function paramFingerprint(def: ParamDef): string {
  const picked: Record<string, unknown> = {};
  for (const f of COMPARED_FIELDS) picked[f] = def[f];
  return JSON.stringify(picked);
}

/**
 * Documented, intentional shared-param differences. Each key is
 * `${condition}.${param}`; the value explains why the divergence is allowed.
 *
 * Empty by design: every known shared-param drift has been reconciled. Adding
 * an entry here is the explicit, reviewable escape hatch for a difference that
 * genuinely cannot be unified. The test below also fails if an entry here no
 * longer drifts, forcing stale exceptions to be removed.
 */
const KNOWN_DRIFTS: Record<string, string> = {};

/**
 * Shared names whose param sets do not overlap at all.
 *
 * The comparison above skips any param the other registry lacks, so a pair
 * with NO shared params runs zero comparisons and passes automatically. That
 * blind spot is where the worst kind of drift hides: not a mismatched schema
 * but a different RULE behind the same name. Listing each pair here forces
 * the difference to be stated and reviewed.
 *
 * Four are the paradigm difference the exemption was designed for — a backtest
 * condition computes its indicator from periods, a streaming one reads a
 * precomputed snapshot key — and the rule is the same. The other NINE are
 * marked RULE DIFFERS: the same portable name resolves to two different
 * conditions. Reconciling those means either changing streaming semantics or
 * renaming published entries, so they are recorded rather than silently
 * exempted.
 */
const DISJOINT_PARAMS: Record<string, string> = {
  // Same rule, different way of obtaining the indicator.
  macdCrossUp:
    "same rule (MACD crosses its signal); backtest computes it from fast/slow/signal, streaming reads a snapshot key",
  macdCrossDown:
    "same rule (MACD crosses its signal); backtest computes it from fast/slow/signal, streaming reads a snapshot key",
  stochCrossUp:
    "same rule (%K crosses %D); backtest computes them from kPeriod/dPeriod, streaming reads a snapshot key",
  stochCrossDown:
    "same rule (%K crosses %D); backtest computes them from kPeriod/dPeriod, streaming reads a snapshot key",

  // RULE DIFFERS — a portable leaf resolves to two different conditions.
  perfectOrderBullish:
    "RULE DIFFERS: backtest fires on the bar the order FORMS (`formed` edge, plus a strength floor) over an SMA ribbon; streaming fires on any bar where an EMA ribbon is bullish (a level)",
  perfectOrderBearish:
    "RULE DIFFERS: backtest fires on the `formed` edge over an SMA ribbon; streaming tests strict ordering of an EMA ribbon on every bar",
  perfectOrderCollapsed:
    "RULE DIFFERS: backtest reads `collapsed` (the alignment broke); streaming reads `expanding === false` (the spread stopped widening) — a different quantity",
  obvCrossUp:
    "RULE DIFFERS: backtest crosses SMA(OBV, shortPeriod) over SMA(OBV, longPeriod); streaming crosses raw OBV over a single signal line",
  obvCrossDown:
    "RULE DIFFERS: backtest crosses SMA(OBV, shortPeriod) under SMA(OBV, longPeriod); streaming crosses raw OBV under a single signal line",
  obvRising:
    "RULE DIFFERS: backtest compares OBV to its value `period` bars ago; streaming compares to the previous bar only",
  obvFalling:
    "RULE DIFFERS: backtest compares OBV to its value `period` bars ago; streaming compares to the previous bar only",
  volatilityExpanding:
    "RULE DIFFERS: backtest needs the ATR percentile to exceed its lookback mean by `threshold`; streaming fires on any tick up",
  volatilityContracting:
    "RULE DIFFERS: backtest needs the ATR percentile to fall below its lookback mean by `threshold`; streaming fires on any tick down",
};

describe("registry parity (backtest ↔ streaming)", () => {
  const sharedNames = backtestRegistry
    .names()
    .filter((name) => streamingRegistry.has(name))
    .sort();

  it("has a non-trivial overlap to guard", () => {
    // Sanity floor: if this drops, an import or registration regressed.
    expect(sharedNames.length).toBeGreaterThan(20);
  });

  it("every shared name with no overlapping params is accounted for", () => {
    const observed = new Set<string>();
    const unexpected: string[] = [];

    for (const name of sharedNames) {
      const bt = backtestRegistry.get(name)!;
      const st = streamingRegistry.get(name)!;
      const btKeys = Object.keys(bt.params);
      const stKeys = Object.keys(st.params);
      if (btKeys.length === 0 && stKeys.length === 0) continue; // nothing to compare
      if (btKeys.some((k) => stKeys.includes(k))) continue; // the other test covers these

      observed.add(name);
      if (!(name in DISJOINT_PARAMS)) {
        unexpected.push(
          `  ${name}: backtest[${btKeys.join(", ")}] streaming[${stKeys.join(", ")}]`,
        );
      }
    }

    expect(
      unexpected,
      `Shared name with no overlapping params — zero comparisons run, so any rule difference is invisible.\nState why in DISJOINT_PARAMS, or give the entries a shared param:\n${unexpected.join("\n")}`,
    ).toEqual([]);

    const stale = Object.keys(DISJOINT_PARAMS).filter((name) => !observed.has(name));
    expect(
      stale,
      `DISJOINT_PARAMS entries whose params now overlap (or that are no longer shared) — remove them:\n${stale.map((s) => `  ${s}`).join("\n")}`,
    ).toEqual([]);
  });

  it("shared params agree on portability-relevant schema", () => {
    const observedDrifts = new Set<string>();
    const unexpected: string[] = [];

    for (const name of sharedNames) {
      const bt = backtestRegistry.get(name)!;
      const st = streamingRegistry.get(name)!;
      for (const param of Object.keys(bt.params)) {
        if (!(param in st.params)) continue; // param unique to backtest — paradigm difference
        const key = `${name}.${param}`;
        const btFp = paramFingerprint(bt.params[param]);
        const stFp = paramFingerprint(st.params[param]);
        if (btFp !== stFp) {
          observedDrifts.add(key);
          if (!(key in KNOWN_DRIFTS)) {
            unexpected.push(`  ${key}: backtest=${btFp} streaming=${stFp}`);
          }
        }
      }
    }

    expect(
      unexpected,
      `Shared-param drift between registries (align them, or add to KNOWN_DRIFTS with a reason):\n${unexpected.join("\n")}`,
    ).toEqual([]);

    // Stale-allowlist guard: every KNOWN_DRIFTS entry must still drift.
    const stale = Object.keys(KNOWN_DRIFTS).filter((key) => !observedDrifts.has(key));
    expect(
      stale,
      `KNOWN_DRIFTS entries no longer drift — remove them:\n${stale.map((s) => `  ${s}`).join("\n")}`,
    ).toEqual([]);
  });

  it("shared conditions agree on isFilter and category", () => {
    const mismatches: string[] = [];
    for (const name of sharedNames) {
      const bt = backtestRegistry.get(name)!;
      const st = streamingRegistry.get(name)!;
      if (Boolean(bt.isFilter) !== Boolean(st.isFilter)) {
        mismatches.push(
          `  ${name}.isFilter: backtest=${Boolean(bt.isFilter)} streaming=${Boolean(st.isFilter)}`,
        );
      }
      if (bt.category !== st.category) {
        mismatches.push(`  ${name}.category: backtest=${bt.category} streaming=${st.category}`);
      }
    }
    expect(mismatches, `Metadata drift between registries:\n${mismatches.join("\n")}`).toEqual([]);
  });
});
