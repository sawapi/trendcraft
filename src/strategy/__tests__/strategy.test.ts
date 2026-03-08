import { describe, expect, it } from "vitest";
import { createSessionFromStrategy } from "../factory";
import type { StrategyDefinition } from "../types";

describe("createSessionFromStrategy", () => {
  const baseStrategy: StrategyDefinition = {
    id: "test-strategy",
    name: "Test Strategy",
    intervalMs: 60_000,
    symbols: ["AAPL"],
    pipeline: {
      indicators: [],
    },
    position: {
      capital: 100_000,
      stopLoss: 2,
    },
  };

  it("should create a ManagedSession from a strategy definition", () => {
    const session = createSessionFromStrategy(baseStrategy);
    expect(session).toBeDefined();
    expect(session.onTrade).toBeTypeOf("function");
    expect(session.close).toBeTypeOf("function");
    expect(session.getPosition).toBeTypeOf("function");
    expect(session.getAccount).toBeTypeOf("function");
    expect(session.getTrades).toBeTypeOf("function");
    expect(session.getState).toBeTypeOf("function");
  });

  it("should use overrides for capital", () => {
    const session = createSessionFromStrategy(baseStrategy, { capital: 200_000 });
    const account = session.getAccount();
    expect(account.initialCapital).toBe(200_000);
    expect(account.currentCapital).toBe(200_000);
  });

  it("should use strategy capital when no override", () => {
    const session = createSessionFromStrategy(baseStrategy);
    const account = session.getAccount();
    expect(account.initialCapital).toBe(100_000);
  });

  it("should support guards configuration", () => {
    const strategy: StrategyDefinition = {
      ...baseStrategy,
      guards: {
        riskGuard: { maxDailyLoss: -5000 },
      },
    };
    const session = createSessionFromStrategy(strategy);
    expect(session.riskGuard).not.toBeNull();
  });

  it("should support optional metadata fields", () => {
    const strategy: StrategyDefinition = {
      ...baseStrategy,
      description: "A test",
      version: "1.0.0",
      tags: ["test", "demo"],
      metadata: { author: "test" },
    };
    // Just verify it creates without error
    const session = createSessionFromStrategy(strategy);
    expect(session).toBeDefined();
  });
});
