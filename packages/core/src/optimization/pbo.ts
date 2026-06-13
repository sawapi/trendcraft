/**
 * Probability of Backtest Overfitting (PBO) via Combinatorially Symmetric
 * Cross-Validation (CSCV).
 *
 * Reference: Bailey, Borwein, López de Prado & Zhu, "The Probability of
 * Backtest Overfitting" (Journal of Computational Finance, 2017).
 *
 * The procedure: split the T×N matrix of per-period returns (T periods,
 * N strategy configurations) into S contiguous blocks of rows. For each
 * of the C(S, S/2) ways to pick S/2 blocks as in-sample (IS), select the
 * configuration with the best IS metric and look up its rank among all N
 * configurations out-of-sample (OOS, the complementary blocks). The
 * relative rank ω̄ ∈ (0, 1) maps to a logit λ = ln(ω̄ / (1 − ω̄)); PBO is
 * the fraction of combinations with λ < 0 — i.e. how often the IS winner
 * ranks *below* the OOS median (Bailey et al.'s "underperforms the median
 * OOS"). A winner exactly at the median (λ = 0) is neutral, not overfit.
 */

import { perReturnSharpe } from "../scoring/deflated-sharpe";
import type { Result } from "../types/result";
import { err, ok, tcError } from "../types/result";

/** Options for {@link pbo}. */
export type PboOptions = {
  /**
   * Number of contiguous row blocks S to partition the observations into
   * (default: 10). Must be an even integer ≥ 2. The analysis evaluates
   * C(S, S/2) IS/OOS splits — 252 for S=10, 12,870 for S=16 — so cost
   * grows combinatorially; S ≤ 20 is enforced.
   */
  blocks?: number;
  /**
   * Ranking metric applied to each configuration's concatenated IS or OOS
   * returns (default: per-return Sharpe, mean/std; 0 when std is 0).
   */
  metric?: (returns: number[]) => number;
};

/** Result of {@link pbo}. */
export type PboResult = {
  /**
   * Probability of backtest overfitting in [0, 1]: the fraction of CSCV
   * splits whose IS-best configuration ranked *below* the OOS median.
   * ~0 = the selection generalizes; ≥ 0.5 = selection is no better than
   * chance; values near 1 = the IS winner systematically degrades OOS.
   */
  pbo: number;
  /** OOS rank logit λ per CSCV split (ln(ω̄ / (1 − ω̄))). */
  logits: number[];
  /** Number of IS/OOS splits evaluated, C(blocks, blocks/2). */
  combinations: number;
  /** Number of row blocks used (S). */
  blocks: number;
  /** Number of strategy configurations (N, matrix columns). */
  trials: number;
  /**
   * Observations actually used per configuration. Rows beyond the largest
   * multiple of `blocks` are dropped so blocks stay equal-sized.
   */
  observationsUsed: number;
};

/**
 * Enumerate all C(S, S/2) subsets of {0..S-1} of size S/2, invoking
 * `visit` with the IS block indices for each.
 */
function forEachHalfSubset(blocks: number, visit: (isBlocks: number[]) => void): void {
  const half = blocks / 2;
  const pick: number[] = [];

  function recurse(next: number): void {
    if (pick.length === half) {
      visit(pick);
      return;
    }
    // Not enough remaining elements to fill the subset — prune
    if (blocks - next < half - pick.length) return;
    pick.push(next);
    recurse(next + 1);
    pick.pop();
    recurse(next + 1);
  }

  recurse(0);
}

/** Binomial coefficient C(n, k) for the small n used here. */
function binomial(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i;
  }
  return Math.round(result);
}

/**
 * Probability of Backtest Overfitting via CSCV.
 *
 * @param returnsMatrix T×N matrix of per-period returns: `returnsMatrix[t][n]`
 *   is configuration `n`'s return in period `t`. All rows must have the
 *   same length N ≥ 2, and T must be ≥ `blocks`.
 *
 *   Building the matrix is the caller's responsibility: every parameter
 *   combination must be evaluated over the SAME period grid — e.g. run
 *   `runBacktest` per combination and derive aligned per-bar (or
 *   per-week) equity returns. `gridSearch` results retain per-combination
 *   trades but not aligned per-period returns, so there is no automatic
 *   bridge yet; a grid-search adapter is planned.
 * @param options Block count and ranking metric
 * @returns PBO with per-split logits
 *
 * @example
 * ```ts
 * import { pbo } from "trendcraft";
 *
 * // returns[t][n]: period-t return of the n-th parameter combination
 * const { pbo: probability, combinations } = pbo(returns, { blocks: 10 });
 * console.log(`PBO ${(probability * 100).toFixed(1)}% over ${combinations} splits`);
 * // PBO ≥ ~50% → the in-sample winner is indistinguishable from chance OOS
 * ```
 */
export function pbo(returnsMatrix: number[][], options: PboOptions = {}): PboResult {
  const blocks = options.blocks ?? 10;
  const metric = options.metric ?? perReturnSharpe;

  if (!Number.isInteger(blocks) || blocks < 2 || blocks % 2 !== 0) {
    throw new Error(`pbo: blocks must be an even integer >= 2, got ${blocks}`);
  }
  if (blocks > 20) {
    throw new Error(
      `pbo: blocks must be <= 20 (C(${blocks}, ${blocks / 2}) splits would be intractable)`,
    );
  }

  const totalRows = returnsMatrix.length;
  if (totalRows < blocks) {
    throw new Error(`pbo: need at least ${blocks} observations (one per block), got ${totalRows}`);
  }
  const trials = returnsMatrix[0]?.length ?? 0;
  if (trials < 2) {
    throw new Error(`pbo: need at least 2 strategy configurations (columns), got ${trials}`);
  }

  // Equal-sized contiguous blocks; the tail remainder is dropped
  const blockSize = Math.floor(totalRows / blocks);
  const observationsUsed = blockSize * blocks;

  // Validate only the rows actually used — the dropped tail remainder may be
  // ragged or incomplete (it never enters the analysis), so rejecting it
  // would contradict the documented tail-dropping behavior.
  for (let t = 0; t < observationsUsed; t++) {
    if (returnsMatrix[t].length !== trials) {
      throw new Error(
        `pbo: ragged matrix — row ${t} has ${returnsMatrix[t].length} columns, expected ${trials}`,
      );
    }
  }

  // Pre-slice each block's rows once: blockRows[b] = row indices of block b
  const blockRanges: Array<[number, number]> = [];
  for (let b = 0; b < blocks; b++) {
    blockRanges.push([b * blockSize, (b + 1) * blockSize]);
  }

  /** Concatenate one configuration's returns over the given blocks. */
  function collectColumn(column: number, blockIndices: readonly number[]): number[] {
    const out: number[] = [];
    for (const b of blockIndices) {
      const [start, end] = blockRanges[b];
      for (let t = start; t < end; t++) {
        out.push(returnsMatrix[t][column]);
      }
    }
    return out;
  }

  const allBlocks = Array.from({ length: blocks }, (_, b) => b);
  const logits: number[] = [];
  let overfitCount = 0;

  forEachHalfSubset(blocks, (isBlocks) => {
    const isSet = new Set(isBlocks);
    const oosBlocks = allBlocks.filter((b) => !isSet.has(b));

    // IS winner: configuration with the best in-sample metric (first wins ties)
    let best = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    const oosScores = new Array<number>(trials);
    for (let n = 0; n < trials; n++) {
      const isScore = metric(collectColumn(n, isBlocks));
      if (isScore > bestScore) {
        bestScore = isScore;
        best = n;
      }
      oosScores[n] = metric(collectColumn(n, oosBlocks));
    }

    // OOS relative rank of the IS winner, in (0, 1). Ties take the average
    // (mid) rank so a tie group is placed at its centre, not its bottom —
    // without this, a fully-tied split (common with flat / no-trade
    // configs all scoring 0) would rank the winner last and bias PBO up.
    const bestOos = oosScores[best];
    let nLess = 0;
    let nEqual = 0; // includes the winner itself
    for (let n = 0; n < trials; n++) {
      if (oosScores[n] < bestOos) nLess++;
      else if (oosScores[n] === bestOos) nEqual++;
    }
    const midRank = nLess + (nEqual + 1) / 2;
    const omega = midRank / (trials + 1);
    const logit = Math.log(omega / (1 - omega));
    logits.push(logit);
    // Overfit = the IS winner ranks strictly BELOW the OOS median (λ < 0);
    // exactly-median (logit 0, e.g. an all-tied split) is neutral, not overfit.
    if (logit < 0) overfitCount++;
  });

  return {
    pbo: overfitCount / logits.length,
    logits,
    combinations: binomial(blocks, blocks / 2),
    blocks,
    trials,
    observationsUsed,
  };
}

/**
 * Safe variant of {@link pbo} returning a Result instead of throwing.
 */
export function pboSafe(returnsMatrix: number[][], options: PboOptions = {}): Result<PboResult> {
  try {
    return ok(pbo(returnsMatrix, options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("need at least")
      ? ("INSUFFICIENT_DATA" as const)
      : ("INVALID_PARAMETER" as const);
    return err(tcError(code, message, {}, error instanceof Error ? error : undefined));
  }
}
