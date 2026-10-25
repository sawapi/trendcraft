/**
 * llms-full.txt is a generated concatenation of README, CHANGELOG, and
 * docs/*.md (see scripts/gen-llms-full.mjs). It has historically drifted —
 * at one point it carried a CHANGELOG ending at 0.2.0 and event payload
 * shapes from several revisions back — because nothing checked it.
 *
 * This test pins byte-exact parity with the generator. If it fails, run
 * `pnpm gen:llms` from packages/chart and commit the result.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs module without type declarations
import { buildLlmsFull, isShipped, SECTIONS } from "../../scripts/gen-llms-full.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..", "..");
const repoRoot = join(root, "..", "..");

/** GitHub's heading anchor: lowercase, punctuation dropped, spaces to `-`. */
function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

/** Anchors of every heading outside code fences, with `-n` for repeats. */
function anchorsOf(markdown: string): Set<string> {
  return new Set(headingAnchors(markdown).keys());
}

/** `text` with code fences blanked out, keeping every offset in place. */
function withoutFences(text: string): string {
  return text.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, " "));
}

/** Each heading anchor of `markdown` (outside code fences) and its offset. */
function headingAnchors(markdown: string): Map<string, number> {
  const anchors = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const m of withoutFences(markdown).matchAll(/^#{1,6} (.+)$/gm)) {
    const s = slug(m[1]);
    const n = seen.get(s) ?? 0;
    seen.set(s, n + 1);
    anchors.set(n === 0 ? s : `${s}-${n}`, m.index);
  }
  return anchors;
}

/** Link targets of a markdown text (outside code fences) and their offsets. */
function linkTargets(markdown: string): { target: string; at: number }[] {
  return [...withoutFences(markdown).matchAll(/\]\(([^)\s]+)\)/g)].map((m) => ({
    target: m[1],
    at: m.index,
  }));
}

describe("llms-full.txt parity", () => {
  it("matches the generator output byte-for-byte", () => {
    const expected: string = buildLlmsFull(root);
    const actual = readFileSync(join(root, "llms-full.txt"), "utf8");
    expect(actual).toBe(expected);
  });

  // llms-full.txt ships at the package root, without docs/ (ops #127).
  it("links only to shipped files or to files that exist in the repo", () => {
    const text = readFileSync(join(root, "llms-full.txt"), "utf8");
    const repoPath =
      /^https:\/\/(?:github\.com\/sawapi\/trendcraft\/blob|raw\.githubusercontent\.com\/sawapi\/trendcraft)\/main\/([^#]+)(#.*)?$/;
    const dead: string[] = [];
    let checked = 0;
    for (const { target } of linkTargets(text)) {
      if (target.startsWith("#")) continue;
      const local = /^\.\/([^#]+)$/.exec(target);
      const remote = repoPath.exec(target);
      if (local) {
        checked++;
        if (!isShipped(root, local[1]) || !existsSync(join(root, local[1]))) dead.push(target);
      } else if (remote) {
        checked++;
        const file = join(repoRoot, remote[1]);
        const hash = remote[2]?.slice(1);
        if (!existsSync(file)) dead.push(target);
        else if (hash && !anchorsOf(readFileSync(file, "utf8")).has(decodeURIComponent(hash)))
          dead.push(target);
      } else if (!/^[a-z][a-z0-9+.-]*:/i.test(target)) {
        dead.push(target);
      }
    }
    expect(checked).toBeGreaterThan(20);
    expect(dead).toEqual([]);
  });

  // Concatenation numbers a slug repeated across sections (`-1`, ...), so an
  // in-page link can silently land on a same-named heading of another source.
  it("resolves every #anchor to a heading in the link's own section", () => {
    const text = readFileSync(join(root, "llms-full.txt"), "utf8");
    const starts: number[] = [];
    for (const [title] of SECTIONS as [string, string][]) {
      const at = text.indexOf(`\n# ${title}\n`, starts.at(-1) ?? 0);
      expect(at, title).toBeGreaterThan(-1);
      starts.push(at);
    }
    const sectionOf = (at: number) => {
      let i = 0;
      while (i + 1 < starts.length && starts[i + 1] <= at) i++;
      return i;
    };
    const anchors = headingAnchors(text);
    const wrong: string[] = [];
    let checked = 0;
    for (const { target, at } of linkTargets(text)) {
      if (!target.startsWith("#")) continue;
      checked++;
      const heading = anchors.get(decodeURIComponent(target.slice(1)));
      if (heading === undefined || sectionOf(heading) !== sectionOf(at)) {
        wrong.push(`${SECTIONS[sectionOf(at)][0]}: ${target}`);
      }
    }
    expect(checked).toBeGreaterThan(50);
    expect(wrong).toEqual([]);
  });
});
