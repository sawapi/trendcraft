/**
 * Outcome Tracker — evaluate whether past LLM recommendations improved or degraded performance
 *
 * Features:
 * - Benchmark-relative scoring (market return delta)
 * - Auto-rollback after 2 consecutive "degraded" verdicts
 * - 5-day minimum evaluation period (reduced market noise)
 */

import type {
  ReviewRecord,
  ActionOutcome,
  LeaderboardEntry,
  LLMAction,
  MarketContext,
} from "./types.js";
import { saveReviewRecord } from "./history.js";

const SCORE_THRESHOLD = 3;
const MIN_DAYS_FOR_EVALUATION = 5;
const CONSECUTIVE_DEGRADED_ROLLBACK = 2;

/**
 * Extract the strategy ID targeted by an action
 */
function getActionStrategyId(action: LLMAction): string | null {
  switch (action.action) {
    case "adjust_params":
      return action.strategyId;
    case "kill_agent":
    case "revive_agent":
      return action.agentId.split(":")[0];
    case "create_strategy":
      return action.template.id;
  }
}

/**
 * Capture the current score for an action's target strategy
 */
export function capturePreMetrics(
  leaderboard: LeaderboardEntry[],
  action: LLMAction,
): number {
  const strategyId = getActionStrategyId(action);
  const entry = leaderboard.find((e) => e.strategyId === strategyId);
  return entry?.score ?? 0;
}

/**
 * Evaluate outcomes of past reviews by comparing pre-action scores with current scores.
 *
 * Uses benchmark-relative scoring: the verdict accounts for overall market movement
 * so that a strategy isn't penalized for market-wide declines.
 *
 * Updates review records in-place with outcome verdicts and saves them to disk.
 */
export function evaluateOutcomes(
  pastReviews: ReviewRecord[],
  currentLeaderboard: LeaderboardEntry[],
  marketContext?: MarketContext[],
): void {
  const now = Date.now();
  const marketReturn = computeAverageMarketReturn(marketContext);

  for (const review of pastReviews) {
    if (review.appliedActions.length === 0) continue;

    // Skip if already fully evaluated
    if (
      review.outcomes &&
      review.outcomes.length === review.appliedActions.length &&
      review.outcomes.every((o) => o.verdict != null)
    ) {
      continue;
    }

    // Check if enough time has passed (5 business days)
    const daysSince = (now - review.reviewedAt) / (1000 * 60 * 60 * 24);
    if (daysSince < MIN_DAYS_FOR_EVALUATION) continue;

    // Build or update outcomes
    const outcomes: ActionOutcome[] = review.appliedActions.map((applied) => {
      const existing = review.outcomes?.find(
        (o) =>
          o.action.action === applied.action.action &&
          o.reviewDate === review.date,
      );

      if (existing?.verdict != null) return existing;

      const strategyId = getActionStrategyId(applied.action);
      const currentEntry = currentLeaderboard.find(
        (e) => e.strategyId === strategyId,
      );
      const scoreAfter = currentEntry?.score ?? null;
      const scoreBefore = applied.backtestScore ?? existing?.scoreBefore ?? 0;

      let verdict: ActionOutcome["verdict"];
      if (scoreAfter != null) {
        // Benchmark-relative: subtract market return from score delta
        const rawDiff = scoreAfter - scoreBefore;
        const relativeDelta = marketReturn != null
          ? rawDiff - marketReturn
          : rawDiff;

        if (relativeDelta > SCORE_THRESHOLD) verdict = "improved";
        else if (relativeDelta < -SCORE_THRESHOLD) verdict = "degraded";
        else verdict = "neutral";

        return {
          reviewDate: review.date,
          action: applied.action,
          scoreBefore,
          scoreAfter: scoreAfter ?? undefined,
          verdict,
          benchmarkReturnPercent: marketReturn ?? undefined,
          relativeDelta,
        };
      }

      return {
        reviewDate: review.date,
        action: applied.action,
        scoreBefore,
        scoreAfter: scoreAfter ?? undefined,
        verdict,
      };
    });

    review.outcomes = outcomes;
    saveReviewRecord(review);
  }
}

/**
 * Detect strategies needing auto-rollback (2+ consecutive "degraded" verdicts).
 *
 * Returns a list of strategy IDs that should be rolled back to their original preset.
 */
export function detectRollbackCandidates(
  pastReviews: ReviewRecord[],
): string[] {
  // Group outcomes by strategy, ordered chronologically
  const strategyOutcomes = new Map<string, ActionOutcome[]>();

  const sorted = [...pastReviews].sort((a, b) => a.reviewedAt - b.reviewedAt);
  for (const review of sorted) {
    if (!review.outcomes) continue;
    for (const outcome of review.outcomes) {
      if (!outcome.verdict) continue;
      const strategyId = getActionStrategyId(outcome.action);
      if (!strategyId) continue;
      const arr = strategyOutcomes.get(strategyId) ?? [];
      arr.push(outcome);
      strategyOutcomes.set(strategyId, arr);
    }
  }

  const rollbackIds: string[] = [];
  for (const [strategyId, outcomes] of strategyOutcomes) {
    // Check last N verdicts for consecutive "degraded"
    const recent = outcomes.slice(-CONSECUTIVE_DEGRADED_ROLLBACK);
    if (recent.length >= CONSECUTIVE_DEGRADED_ROLLBACK &&
        recent.every((o) => o.verdict === "degraded")) {
      rollbackIds.push(strategyId);
    }
  }

  return rollbackIds;
}

/**
 * Compute average market return from market context (used as benchmark baseline)
 */
function computeAverageMarketReturn(
  marketContext?: MarketContext[],
): number | null {
  if (!marketContext || marketContext.length === 0) return null;
  const total = marketContext.reduce((s, mc) => s + mc.dailyChangePercent, 0);
  return total / marketContext.length;
}
