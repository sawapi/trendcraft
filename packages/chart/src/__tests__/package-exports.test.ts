/**
 * The package ships an ESM build (.js) and a CJS build (.cjs) under
 * "type": "module". One .d.ts for both made TypeScript read the require side
 * as ESM (TS1479 for node16 CommonJS projects), so each `exports` condition
 * must name its own declarations: .d.mts for import, .d.cts for require.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Condition = { types?: string; default?: string };
type Entry = { import?: Condition; require?: Condition };

const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf8")) as {
  main: string;
  types: string;
  exports: Record<string, Entry | string>;
  files: string[];
};

describe("package.json exports", () => {
  const entries = Object.entries(pkg.exports).filter(
    (e): e is [string, Entry] => typeof e[1] === "object",
  );

  it.each(entries)("%s gives import and require their own declarations", (_subpath, entry) => {
    expect(Object.keys(entry.import ?? {})).toEqual(["types", "default"]);
    expect(Object.keys(entry.require ?? {})).toEqual(["types", "default"]);
    expect(entry.import?.types).toMatch(/\.d\.mts$/);
    expect(entry.import?.default).toMatch(/\.js$/);
    expect(entry.require?.types).toMatch(/\.d\.cts$/);
    expect(entry.require?.default).toMatch(/\.cjs$/);
  });

  it("points the top-level types at the CJS declarations, like main", () => {
    expect(pkg.main).toMatch(/\.cjs$/);
    expect(pkg.types).toMatch(/\.d\.cts$/);
  });

  it("leaves declaration maps out of the published files", () => {
    expect(pkg.files).toContain("!dist/**/*.d.*ts.map");
  });
});
