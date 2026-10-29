import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as streamingConditions from "../../streaming/conditions";
import { and, not, or } from "../../streaming/conditions";
import { ConditionRegistry } from "../registry";
import { streamingRegistry } from "../registry-streaming";

const COMBINATORS = { and, or, not };

/** Old streaming name → the name that says what the condition tests. */
const RENAMED: Record<string, string> = {
  perfectOrderBullish: "emaRibbonBullish",
  perfectOrderBearish: "emaRibbonBearish",
  perfectOrderCollapsed: "emaRibbonContracting",
  obvRising: "obvUpTick",
  obvFalling: "obvDownTick",
  obvCrossUp: "obvSignalCrossUp",
  obvCrossDown: "obvSignalCrossDown",
  volatilityExpanding: "atrRising",
  volatilityContracting: "atrFalling",
};

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe("renamed streaming conditions", () => {
  it("are registered under the new names only", () => {
    const names = streamingRegistry.names();
    for (const [oldName, newName] of Object.entries(RENAMED)) {
      expect(names).toContain(newName);
      expect(names).not.toContain(oldName);
    }
  });

  it("still load under the old names, as the renamed condition", () => {
    for (const [oldName, newName] of Object.entries(RENAMED)) {
      expect(streamingRegistry.has(oldName)).toBe(true);
      expect(streamingRegistry.aliasTarget(oldName)).toBe(newName);
      expect(streamingRegistry.get(oldName)).toBe(streamingRegistry.get(newName));
      const viaOld = streamingRegistry.hydrate({ name: oldName }, COMBINATORS);
      const viaNew = streamingRegistry.hydrate({ name: newName }, COMBINATORS);
      // Fresh closures each time, so compare what they are, not identity.
      expect((viaOld as { name: string }).name).toBe((viaNew as { name: string }).name);
      expect((viaNew as { name: string }).name.startsWith(newName)).toBe(true);
    }
  });

  it("keep the old factory exports as the same functions", () => {
    const exports = streamingConditions as unknown as Record<string, unknown>;
    for (const [oldName, newName] of Object.entries(RENAMED)) {
      expect(exports[oldName]).toBe(exports[newName]);
    }
  });
});

describe("ConditionRegistry.alias", () => {
  function registry() {
    const r = new ConditionRegistry<string>();
    r.register({
      name: "current",
      displayName: "Current",
      category: "trend",
      params: {},
      create: () => "c",
    });
    r.alias("old", "current");
    return r;
  }

  it("warns once per alias when hydrating it", () => {
    const r = registry();
    expect(r.hydrate({ name: "old" }, { and: (a) => a, or: (a) => a, not: (a) => a })).toBe("c");
    r.hydrate({ name: "old" }, { and: (a) => a, or: (a) => a, not: (a) => a });
    r.hydrate({ name: "current" }, { and: (a) => a, or: (a) => a, not: (a) => a });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('"old" is deprecated; use "current"');
  });

  it("does not list aliases", () => {
    const r = registry();
    expect(r.names()).toEqual(["current"]);
    expect(r.list()).toHaveLength(1);
    expect(r.size).toBe(1);
  });

  it("refuses an alias to an unknown name or over an existing one", () => {
    const r = registry();
    expect(() => r.alias("x", "missing")).toThrow(/not registered/);
    expect(() => r.alias("current", "current")).toThrow(/already registered/);
    expect(() => r.alias("old", "current")).toThrow(/already registered/);
    expect(() =>
      r.register({ name: "old", displayName: "", category: "trend", params: {}, create: () => "" }),
    ).toThrow(/already registered/);
  });
});
