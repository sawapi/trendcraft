/**
 * Every event payload type declared in `core/types/event.ts` is reachable from
 * the package root.
 *
 * `src/index.ts` re-exports types through an explicit allowlist, so a payload
 * type the docs name (`ChartClickData`) can be declared, exported from the
 * internal barrel, and still fail with TS2305 at
 * `import type { ChartClickData } from '@trendcraft/chart'`. The docs harness
 * only checks fenced code, not the names in the event tables, so this pins the
 * whole file rather than one name — by text, and (for the names that exist
 * today) by a type-level import that `tsc` checks.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  ChartClickData,
  ChartErrorPayload,
  SeriesActionData,
  SeriesAddedData,
  SeriesRemovedData,
} from "../index";

const root = join(__dirname, "..");

/** Drop `//` and block comments so a commented-out export does not count. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function exportedTypeNames(source: string): string[] {
  return [...stripComments(source).matchAll(/^export (?:type|interface) (\w+)\b/gm)].map(
    (m) => m[1],
  );
}

/** Names re-exported from `./core/types` by the root barrel's `export type { ... }` blocks. */
function barrelTypeExports(source: string): Set<string> {
  const names = new Set<string>();
  const blocks = stripComments(source).matchAll(
    /export type \{([^}]*)\}\s*from\s*["']\.\/core\/types["']/g,
  );
  for (const block of blocks) {
    for (const raw of block[1].split(",")) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/** Type-level guard: these must resolve from the root, or `tsc` fails this file. */
type RootPayloads = [
  ChartClickData,
  ChartErrorPayload,
  SeriesActionData,
  SeriesAddedData,
  SeriesRemovedData,
];

describe("event payload types are exported from the package root", () => {
  const eventTypes = exportedTypeNames(readFileSync(join(root, "core/types/event.ts"), "utf8"));
  const barrel = barrelTypeExports(readFileSync(join(root, "index.ts"), "utf8"));

  it("declares the payload types this test expects to guard", () => {
    expect(eventTypes).toEqual(
      expect.arrayContaining(["ChartClickData", "SeriesActionData", "ChartErrorPayload"]),
    );
    const guarded: RootPayloads["length"] = 5;
    expect(guarded).toBe(5);
  });

  it("is not fooled by a commented-out export or a trailing comment", () => {
    expect(barrelTypeExports('// export type { ChartClickData } from "./core/types";').size).toBe(
      0,
    );
    expect(
      barrelTypeExports('export type {\n  A, // click payload\n  B,\n} from "./core/types";'),
    ).toEqual(new Set(["A", "B"]));
    expect(barrelTypeExports('export type { C } from "./other";').size).toBe(0);
    expect(exportedTypeNames("// export type Ghost = 1;\nexport interface Real { a: 1 }")).toEqual([
      "Real",
    ]);
  });

  it.each(eventTypes)("%s is in the root barrel allowlist", (name) => {
    expect(barrel.has(name)).toBe(true);
  });
});
