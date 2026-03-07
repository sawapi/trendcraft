/**
 * Outcome Tracker — evaluate whether past LLM recommendations improved or degraded performance
 */

import type {
  ReviewRecord,
  ActionOutcome,
  LeaderboardEntry,
  LLMAction,
} from "./types.js";
import { saveReviewRecord } from "./history.js";

const SCORE_THRESHOLD = 3;
const MIN_DAYS_FOR_EVALUATION = 2;

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
 * Evaluate outcomes of past reviews by comparing pre-action scores with current scores
 *
 * Updates review records in-place with outcome verdicts and saves them to disk.
 */
export function evaluateOutcomes(
  pastReviews: ReviewRecord[],
  currentLeaderboard: LeaderboardEntry[],
): void {
  const now = Date.now();

  for (const review of pastReviews) {
    // Skip reviews with no applied actions
    if (review.appliedActions.length === 0) continue;

    // Skip if already fully evaluated
    if (
      review.outcomes &&
      review.outcomes.length === review.appliedActions.length &&
      review.outcomes.every((o) => o.verdict != null)
    ) {
      continue;
    }

    // Check if enough time has passed
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
        const diff = scoreAfter - scoreBefore;
        if (diff > SCORE_THRESHOLD) verdict = "improved";
        else if (diff < -SCORE_THRESHOLD) verdict = "degraded";
        else verdict = "neutral";
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
