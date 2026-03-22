import { describe, expect, it } from "vitest";
import type { Condition } from "../../types";
import { ConditionRegistry } from "../registry";
import { backtestRegistry } from "../registry-backtest";
import { streamingRegistry } from "../registry-streaming";

describe("ConditionRegistry", () => {
  it("register and get", () => {
    const reg = new ConditionRegistry<string>();
    reg.register({
      name: "test",
      displayName: "Test",
      params: { x: { type: "number", default: 10 } },
      create: (p) => `test:${p.x}`,
    });

    expect(reg.has("test")).toBe(true);
    expect(reg.has("unknown")).toBe(false);
    expect(reg.get("test")?.displayName).toBe("Test");
    expect(reg.get("unknown")).toBeUndefined();
    expect(reg.size).toBe(1);
  });

  it("throws on duplicate registration", () => {
    const reg = new ConditionRegistry<string>();
    reg.register({ name: "dup", displayName: "Dup", params: {}, create: () => "a" });
    expect(() => {
      reg.register({ name: "dup", displayName: "Dup2", params: {}, create: () => "b" });
    }).toThrow('Condition "dup" is already registered');
  });

  it("list all and filter by category", () => {
    const reg = new ConditionRegistry<string>();
    reg.register({ name: "a", displayName: "A", category: "trend", params: {}, create: () => "a" });
    reg.register({
      name: "b",
      displayName: "B",
      category: "momentum",
      params: {},
      create: () => "b",
    });
    reg.register({ name: "c", displayName: "C", category: "trend", params: {}, create: () => "c" });

    expect(reg.list().length).toBe(3);
    expect(reg.list("trend").length).toBe(2);
    expect(reg.list("momentum").length).toBe(1);
    expect(reg.list("volume").length).toBe(0);
  });

  it("names() returns all condition names", () => {
    const reg = new ConditionRegistry<string>();
    reg.register({ name: "foo", displayName: "Foo", params: {}, create: () => "f" });
    reg.register({ name: "bar", displayName: "Bar", params: {}, create: () => "b" });

    expect(reg.names()).toEqual(["foo", "bar"]);
  });

  it("hydrate leaf condition with defaults", () => {
    const reg = new ConditionRegistry<string>();
    reg.register({
      name: "calc",
      displayName: "Calc",
      params: {
        a: { type: "number", default: 10 },
        b: { type: "number", default: 20 },
      },
      create: (p) => `${p.a}+${p.b}`,
    });

    const combinators = {
      and: (...cs: string[]) => cs.join("&"),
      or: (...cs: string[]) => cs.join("|"),
      not: (c: string) => `!${c}`,
    };

    // Use all defaults
    expect(reg.hydrate({ name: "calc" }, combinators)).toBe("10+20");

    // Override one param
    expect(reg.hydrate({ name: "calc", params: { a: 5 } }, combinators)).toBe("5+20");
  });

  it("hydrate combinator (and/or/not)", () => {
    const reg = new ConditionRegistry<string>();
    reg.register({ name: "x", displayName: "X", params: {}, create: () => "X" });
    reg.register({ name: "y", displayName: "Y", params: {}, create: () => "Y" });

    const combinators = {
      and: (...cs: string[]) => `(${cs.join("&")})`,
      or: (...cs: string[]) => `(${cs.join("|")})`,
      not: (c: string) => `!${c}`,
    };

    expect(
      reg.hydrate({ op: "and", conditions: [{ name: "x" }, { name: "y" }] }, combinators),
    ).toBe("(X&Y)");

    expect(reg.hydrate({ op: "or", conditions: [{ name: "x" }, { name: "y" }] }, combinators)).toBe(
      "(X|Y)",
    );

    expect(reg.hydrate({ op: "not", conditions: [{ name: "x" }] }, combinators)).toBe("!X");
  });

  it("hydrate throws on unknown condition", () => {
    const reg = new ConditionRegistry<string>();
    const combinators = {
      and: (...cs: string[]) => cs.join("&"),
      or: (...cs: string[]) => cs.join("|"),
      not: (c: string) => `!${c}`,
    };

    expect(() => reg.hydrate({ name: "nonexistent" }, combinators)).toThrow(
      'Unknown condition: "nonexistent"',
    );
  });
});

describe("backtestRegistry", () => {
  it("has 90+ registered conditions", () => {
    expect(backtestRegistry.size).toBeGreaterThanOrEqual(90);
  });

  it("contains key conditions", () => {
    expect(backtestRegistry.has("goldenCross")).toBe(true);
    expect(backtestRegistry.has("rsiBelow")).toBe(true);
    expect(backtestRegistry.has("macdCrossUp")).toBe(true);
    expect(backtestRegistry.has("bollingerBreakout")).toBe(true);
    expect(backtestRegistry.has("perfectOrderBullish")).toBe(true);
    expect(backtestRegistry.has("dmiBullish")).toBe(true);
    expect(backtestRegistry.has("volumeAboveAvg")).toBe(true);
    expect(backtestRegistry.has("regimeIs")).toBe(true);
    expect(backtestRegistry.has("patternDetected")).toBe(true);
    expect(backtestRegistry.has("priceAtBullishOrderBlock")).toBe(true);
    expect(backtestRegistry.has("perBelow")).toBe(true);
  });

  it("lists by category", () => {
    const trend = backtestRegistry.list("trend");
    const momentum = backtestRegistry.list("momentum");
    const volume = backtestRegistry.list("volume");

    expect(trend.length).toBeGreaterThan(0);
    expect(momentum.length).toBeGreaterThan(0);
    expect(volume.length).toBeGreaterThan(0);

    expect(trend.some((e) => e.name === "goldenCross")).toBe(true);
    expect(momentum.some((e) => e.name === "rsiBelow")).toBe(true);
    expect(volume.some((e) => e.name === "volumeAboveAvg")).toBe(true);
  });

  it("creates executable conditions from registry", () => {
    const entry = backtestRegistry.get("goldenCross");
    expect(entry).toBeDefined();

    const condition = entry!.create({ shortPeriod: 5, longPeriod: 25 });
    expect(condition).toBeDefined();
    // Should be a PresetCondition
    expect((condition as { type: string }).type).toBe("preset");
  });
});

describe("streamingRegistry", () => {
  it("has 50+ registered conditions", () => {
    expect(streamingRegistry.size).toBeGreaterThanOrEqual(50);
  });

  it("contains key streaming conditions", () => {
    expect(streamingRegistry.has("rsiBelow")).toBe(true);
    expect(streamingRegistry.has("macdCrossUp")).toBe(true);
    expect(streamingRegistry.has("bollingerBreakout")).toBe(true);
    expect(streamingRegistry.has("stochBelow")).toBe(true);
    expect(streamingRegistry.has("adxStrong")).toBe(true);
    expect(streamingRegistry.has("supertrendBullish")).toBe(true);
    expect(streamingRegistry.has("crossOver")).toBe(true);
  });
});
