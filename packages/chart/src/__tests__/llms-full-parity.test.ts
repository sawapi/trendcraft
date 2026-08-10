/**
 * llms-full.txt is a generated concatenation of README, CHANGELOG, and
 * docs/*.md (see scripts/gen-llms-full.mjs). It has historically drifted —
 * at one point it carried a CHANGELOG ending at 0.2.0 and event payload
 * shapes from several revisions back — because nothing checked it.
 *
 * This test pins byte-exact parity with the generator. If it fails, run
 * `pnpm gen:llms` from packages/chart and commit the result.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs module without type declarations
import { buildLlmsFull } from "../../scripts/gen-llms-full.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..", "..");

describe("llms-full.txt parity", () => {
  it("matches the generator output byte-for-byte", () => {
    const expected: string = buildLlmsFull(root);
    const actual = readFileSync(join(root, "llms-full.txt"), "utf8");
    expect(actual).toBe(expected);
  });
});
