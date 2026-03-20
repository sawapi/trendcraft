import { describe, expect, it } from "vitest";
import { backtestRegistry } from "../registry-backtest";
import { validateConditionSpec, validateStrategyJSON } from "../validate";

describe("validateConditionSpec", () => {
  it("valid leaf condition", () => {
    const result = validateConditionSpec(
      { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
      backtestRegistry,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("valid leaf condition with defaults", () => {
    const result = validateConditionSpec({ name: "goldenCross" }, backtestRegistry);
    expect(result.valid).toBe(true);
  });

  it("unknown condition name", () => {
    const result = validateConditionSpec({ name: "doesNotExist" }, backtestRegistry);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("doesNotExist: unknown condition");
  });

  it("wrong parameter type", () => {
    const result = validateConditionSpec(
      { name: "rsiBelow", params: { threshold: "not-a-number" } },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("expected number, got string");
  });

  it("number below minimum", () => {
    const result = validateConditionSpec(
      { name: "goldenCross", params: { shortPeriod: 0 } },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("below minimum");
  });

  it("number above maximum", () => {
    const result = validateConditionSpec(
      { name: "rsiBelow", params: { threshold: 150 } },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("exceeds maximum");
  });

  it("unknown parameter", () => {
    const result = validateConditionSpec(
      { name: "rsiBelow", params: { threshold: 30, unknownParam: 42 } },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("unknown parameter");
  });

  it("required parameter missing", () => {
    const result = validateConditionSpec({ name: "perBelow", params: {} }, backtestRegistry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("required parameter missing");
  });

  it("enum validation", () => {
    const result = validateConditionSpec(
      { name: "bollingerBreakout", params: { band: "middle" } },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("not in allowed values");
  });

  it("valid combinator (and)", () => {
    const result = validateConditionSpec(
      {
        op: "and",
        conditions: [{ name: "goldenCross" }, { name: "rsiBelow", params: { threshold: 30 } }],
      },
      backtestRegistry,
    );
    expect(result.valid).toBe(true);
  });

  it("valid combinator (not)", () => {
    const result = validateConditionSpec(
      { op: "not", conditions: [{ name: "rsiAbove", params: { threshold: 70 } }] },
      backtestRegistry,
    );
    expect(result.valid).toBe(true);
  });

  it("not with wrong number of conditions", () => {
    const result = validateConditionSpec(
      {
        op: "not",
        conditions: [
          { name: "rsiAbove", params: { threshold: 70 } },
          { name: "rsiBelow", params: { threshold: 30 } },
        ],
      },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("must have exactly 1 condition");
  });

  it("nested combinator with errors", () => {
    const result = validateConditionSpec(
      {
        op: "and",
        conditions: [{ name: "goldenCross" }, { name: "doesNotExist" }],
      },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("unknown condition");
  });

  it("empty conditions array", () => {
    const result = validateConditionSpec({ op: "and", conditions: [] }, backtestRegistry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("non-empty array");
  });
});

describe("validateStrategyJSON", () => {
  it("valid strategy", () => {
    const result = validateStrategyJSON({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "test",
      name: "Test",
      entry: { name: "goldenCross" },
      exit: { name: "deadCross" },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("missing required fields", () => {
    const result = validateStrategyJSON({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("$schema"))).toBe(true);
    expect(result.errors.some((e) => e.includes("version"))).toBe(true);
    expect(result.errors.some((e) => e.includes("id"))).toBe(true);
    expect(result.errors.some((e) => e.includes("name"))).toBe(true);
    expect(result.errors.some((e) => e.includes("entry"))).toBe(true);
    expect(result.errors.some((e) => e.includes("exit"))).toBe(true);
  });

  it("wrong schema", () => {
    const result = validateStrategyJSON({
      $schema: "wrong",
      version: 1,
      id: "test",
      name: "Test",
      entry: { name: "a" },
      exit: { name: "b" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("$schema");
  });

  it("wrong version", () => {
    const result = validateStrategyJSON({
      $schema: "trendcraft/strategy",
      version: 99,
      id: "test",
      name: "Test",
      entry: { name: "a" },
      exit: { name: "b" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("version");
  });

  it("non-object input", () => {
    const result = validateStrategyJSON("not-an-object");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toBe("Strategy must be an object");
  });

  it("null input", () => {
    const result = validateStrategyJSON(null);
    expect(result.valid).toBe(false);
  });
});
