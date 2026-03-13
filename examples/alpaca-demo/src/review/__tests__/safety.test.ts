import { describe, expect, it } from "vitest";
import { PRESET_TEMPLATES } from "../../strategy/template.js";
import type { StrategyTemplate } from "../../strategy/template.js";
import { validateIntraSessionActions } from "../intra-session-safety.js";
import { validateRecommendation } from "../safety.js";
import type {
  AppliedAction,
  IntraSessionReviewRecord,
  LLMAction,
  LLMRecommendation,
  ReviewRecord,
} from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecommendation(actions: LLMAction[]): LLMRecommendation {
  return { summary: "test", actions, marketAnalysis: "test" };
}

function makeReviewRecord(actions: LLMAction[], reviewedAt = Date.now()): ReviewRecord {
  return {
    date: new Date(reviewedAt).toISOString().slice(0, 10),
    reviewedAt,
    llmResponse: makeRecommendation(actions),
    appliedActions: actions.map((a) => ({ action: a }) as AppliedAction),
    rejectedActions: [],
  };
}

function makeIntraReviewRecord(actions: LLMAction[], reviewNumber = 1): IntraSessionReviewRecord {
  return {
    timestamp: Date.now(),
    reviewNumber,
    llmResponse: makeRecommendation(actions),
    appliedActions: actions.map((a) => ({ action: a }) as AppliedAction),
    rejectedActions: [],
  };
}

// Use the "rsi-mean-reversion" preset which has rsi with period: 14
const RSI_STRATEGY_ID = "rsi-mean-reversion";

// ---------------------------------------------------------------------------
// safety.ts  validateRecommendation()
// ---------------------------------------------------------------------------

describe("validateRecommendation (daily safety)", () => {
  const activeTemplates: StrategyTemplate[] = [...PRESET_TEMPLATES];

  it("passes valid adjust_params within limits", () => {
    // RSI period 14 -> 16 = 14.3% change, within 20% limit
    const action: LLMAction = {
      action: "adjust_params",
      strategyId: RSI_STRATEGY_ID,
      changes: {
        indicators: [{ type: "rsi", name: "rsi", params: { period: 16 } }],
      },
      reasoning: "slightly increase RSI period",
    };

    const result = validateRecommendation(makeRecommendation([action]), [], activeTemplates);

    expect(result.valid).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("rejects param change exceeding +/-20% daily limit", () => {
    // RSI period 14 -> 20 = 42.9% change, exceeds 20%
    const action: LLMAction = {
      action: "adjust_params",
      strategyId: RSI_STRATEGY_ID,
      changes: {
        indicators: [{ type: "rsi", name: "rsi", params: { period: 20 } }],
      },
      reasoning: "increase RSI period significantly",
    };

    const result = validateRecommendation(makeRecommendation([action]), [], activeTemplates);

    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("exceeds");
    expect(result.rejected[0].reason).toContain("20%");
  });

  it("rejects when kill limit reached", () => {
    // One kill already applied today
    const previousKill: LLMAction = {
      action: "kill_agent",
      agentId: "rsi-mean-reversion:AAPL",
      reasoning: "bad performance",
    };
    const todayReviews: ReviewRecord[] = [makeReviewRecord([previousKill])];

    const newKill: LLMAction = {
      action: "kill_agent",
      agentId: "macd-trend:SPY",
      reasoning: "also bad",
    };

    const result = validateRecommendation(
      makeRecommendation([newKill]),
      todayReviews,
      activeTemplates,
    );

    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("Kill limit reached");
  });

  it("rejects unknown indicator type in adjust_params", () => {
    const action: LLMAction = {
      action: "adjust_params",
      strategyId: RSI_STRATEGY_ID,
      changes: {
        indicators: [{ type: "nonexistent_indicator", name: "mystery", params: { period: 10 } }],
      },
      reasoning: "try unknown indicator",
    };

    const result = validateRecommendation(makeRecommendation([action]), [], activeTemplates);

    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("Unknown indicator type");
  });

  it("rejects param out of palette range", () => {
    // RSI palette min is 5, trying period = 1
    const action: LLMAction = {
      action: "adjust_params",
      strategyId: RSI_STRATEGY_ID,
      changes: {
        indicators: [{ type: "rsi", name: "rsi", params: { period: 1 } }],
      },
      reasoning: "set RSI period too low",
    };

    const result = validateRecommendation(makeRecommendation([action]), [], activeTemplates);

    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("out of range");
  });

  it("respects weekly adjust_params limit (3/week)", () => {
    // Build 3 recent adjust_params reviews within the past 7 days
    const now = Date.now();
    const adjustAction: LLMAction = {
      action: "adjust_params",
      strategyId: "macd-trend", // different strategy to avoid per-strategy cooldown
      changes: {
        indicators: [
          {
            type: "macd",
            name: "macd",
            params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          },
        ],
      },
      reasoning: "tweak",
    };
    const recentReviews: ReviewRecord[] = [
      makeReviewRecord([adjustAction], now - 1 * 24 * 60 * 60 * 1000),
      makeReviewRecord([adjustAction], now - 2 * 24 * 60 * 60 * 1000),
      makeReviewRecord([adjustAction], now - 3 * 24 * 60 * 60 * 1000),
    ];

    // Try a 4th adjust_params (different strategy to avoid minDaysBetweenChanges)
    const newAdjust: LLMAction = {
      action: "adjust_params",
      strategyId: RSI_STRATEGY_ID,
      changes: {
        indicators: [{ type: "rsi", name: "rsi", params: { period: 15 } }],
      },
      reasoning: "one more tweak",
    };

    const result = validateRecommendation(makeRecommendation([newAdjust]), [], activeTemplates, {
      recentReviews,
    });

    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("Weekly adjust_params limit");
  });
});

// ---------------------------------------------------------------------------
// intra-session-safety.ts  validateIntraSessionActions()
// ---------------------------------------------------------------------------

describe("validateIntraSessionActions (intra-session safety)", () => {
  it("blocks create_strategy during intra-session", () => {
    const action: LLMAction = {
      action: "create_strategy",
      template: PRESET_TEMPLATES[0], // content doesn't matter, should be blocked outright
      reasoning: "try to create during session",
    };

    const result = validateIntraSessionActions(makeRecommendation([action]), []);

    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("create_strategy is not allowed");
  });

  it("passes valid kill_agent within session limits", () => {
    const action: LLMAction = {
      action: "kill_agent",
      agentId: "rsi-mean-reversion:AAPL",
      reasoning: "underperforming",
    };

    const result = validateIntraSessionActions(makeRecommendation([action]), []);

    expect(result.valid).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("rejects param change exceeding +/-10% intra-session limit", () => {
    // RSI period 14 -> 16 = 14.3% change, exceeds 10% intra-session limit
    const action: LLMAction = {
      action: "adjust_params",
      strategyId: RSI_STRATEGY_ID,
      changes: {
        indicators: [{ type: "rsi", name: "rsi", params: { period: 16 } }],
      },
      reasoning: "bump rsi period",
    };

    const result = validateIntraSessionActions(makeRecommendation([action]), []);

    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("exceeds");
    expect(result.rejected[0].reason).toContain("10%");
  });

  it("blocks entry/exit changes while position is open", () => {
    const agentPositions = new Map<string, boolean>([[`${RSI_STRATEGY_ID}:AAPL`, true]]);

    const action: LLMAction = {
      action: "adjust_params",
      strategyId: RSI_STRATEGY_ID,
      changes: {
        entry: { type: "rsiBelow", params: { threshold: 25 } },
      },
      reasoning: "change entry while holding",
    };

    const result = validateIntraSessionActions(makeRecommendation([action]), [], agentPositions);

    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("Cannot change entry");
    expect(result.rejected[0].reason).toContain("position is open");
  });

  it("allows safe position params (stopLoss/takeProfit) while position is open", () => {
    const agentPositions = new Map<string, boolean>([[`${RSI_STRATEGY_ID}:AAPL`, true]]);

    // stopLoss 3 -> 3.2 = 6.7% change, within 10% intra-session limit
    const action: LLMAction = {
      action: "adjust_params",
      strategyId: RSI_STRATEGY_ID,
      changes: {
        position: { stopLoss: 3.2, takeProfit: 6.5 },
      },
      reasoning: "tighten risk management while holding",
    };

    const result = validateIntraSessionActions(makeRecommendation([action]), [], agentPositions);

    expect(result.valid).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("rejects session adjust limit when reached", () => {
    // Build 3 previous intra-session adjust_params (default maxAdjustsPerSession = 3)
    const adjustAction: LLMAction = {
      action: "adjust_params",
      strategyId: RSI_STRATEGY_ID,
      changes: {
        position: { stopLoss: 3.1 },
      },
      reasoning: "tweak",
    };

    const todayIntraReviews: IntraSessionReviewRecord[] = [
      makeIntraReviewRecord([adjustAction], 1),
      makeIntraReviewRecord([adjustAction], 2),
      makeIntraReviewRecord([adjustAction], 3),
    ];

    const newAdjust: LLMAction = {
      action: "adjust_params",
      strategyId: RSI_STRATEGY_ID,
      changes: {
        position: { stopLoss: 3.2 },
      },
      reasoning: "one more tweak",
    };

    const result = validateIntraSessionActions(makeRecommendation([newAdjust]), todayIntraReviews);

    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("Session adjust limit reached");
  });
});
