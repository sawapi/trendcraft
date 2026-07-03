// @vitest-environment node
/**
 * EN/JA doc parity check.
 *
 * The package keeps English/Japanese twin docs (API.md ↔ API.ja.md,
 * GUIDE.md ↔ GUIDE.ja.md, README.md ↔ README.ja.md). Audits repeatedly found
 * the twins drifting independently — a fix lands in one language and not the
 * other, or code examples diverge. This test pins the twins together at the
 * code-fence level:
 *
 *   1. Fence-count parity — both files of a pair must contain the same number
 *      of `ts`/`typescript` fences, in the same order (cheapest drift signal).
 *   2. Normalized content parity — each fence pair must be identical after
 *      stripping comments, collapsing whitespace, and replacing string-literal
 *      CONTENTS with a placeholder. Japanese docs legitimately translate
 *      comments and string literals, but the code itself — identifiers, option
 *      keys, call shapes, and NUMBERS — must match exactly. (Numbers are
 *      deliberately NOT normalized away: a wrong documented default, e.g. 20
 *      vs "all candles", was a real bug class in past audits.)
 *
 * Escape hatch: place `<!-- ja-parity-skip -->` on its own line before a fence
 * to exempt that fence from parity (it is removed from the sequence on that
 * side, so a one-sided extra fence can also be excused). Skips are counted in
 * an assertion so every exemption stays deliberate.
 *
 * Note: `@trendcraft/chart` has no Japanese doc twins (verified 2026-07 —
 * packages/chart ships English-only docs), so this check is core-only.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "../..");

// Every EN doc that has a Japanese twin (paths relative to the package root).
const DOC_PAIRS: Array<{ en: string; ja: string }> = [
  { en: "docs/API.md", ja: "docs/API.ja.md" },
  { en: "docs/GUIDE.md", ja: "docs/GUIDE.ja.md" },
  { en: "README.md", ja: "README.ja.md" },
];

const SKIP_MARKER = "<!-- ja-parity-skip -->";

// Total `ja-parity-skip` markers expected across all pairs. Bump this number
// in the same commit that adds a marker, with a reason — the assertion exists
// so exemptions cannot accumulate silently.
const EXPECTED_SKIPS = 0;

interface Fence {
  /** 0-based position among the ts fences of the file (before skip removal). */
  index: number;
  /** Nearest markdown heading above the fence, for orientation in reports. */
  heading: string;
  /** 1-based line number of the opening ``` in the source file. */
  line: number;
  code: string;
  skipped: boolean;
}

/**
 * Extract `ts`/`typescript` fenced code plus orientation metadata. Fence
 * detection mirrors docs-import-check.test.ts (` ```ts `/` ```typescript `
 * opener, bare ` ``` ` closer); other-language fences are consumed so their
 * bodies can't produce false headings or markers.
 */
function extractFences(relPath: string): Fence[] {
  const lines = readFileSync(path.join(pkgRoot, relPath), "utf8").split("\n");
  const fences: Fence[] = [];
  let heading = "(top of file)";
  let pendingSkip = false;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#{1,6}\s/.test(line)) {
      heading = line.trim();
      pendingSkip = false; // a marker must sit under the same heading as its fence
      i++;
      continue;
    }
    if (line.trim() === SKIP_MARKER) {
      pendingSkip = true;
      i++;
      continue;
    }
    if (/^```(ts|typescript)\s*$/.test(line)) {
      const start = i + 1;
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      fences.push({
        index: fences.length,
        heading,
        line: start,
        code: body.join("\n"),
        skipped: pendingSkip,
      });
      pendingSkip = false;
    } else if (/^```/.test(line)) {
      // Non-ts fence: consume its body so nothing inside is misread.
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) i++;
    }
    i++;
  }
  return fences;
}

/**
 * Normalize a fence for cross-language comparison: strip `//` and `/* *​/`
 * comments, replace string-literal contents with a placeholder (quote style
 * is kept; template-literal `${…}` interpolations are code and are preserved),
 * then collapse whitespace per line and drop blank lines. Identifiers, option
 * keys, call shapes, and numeric literals all survive normalization.
 */
function normalizeFence(code: string): string[] {
  let out = "";
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    if (c === "/" && code[i + 1] === "/") {
      while (i < n && code[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      i += 2;
      while (i < n && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      out += `${c}S${c}`;
      i++;
      while (i < n && code[i] !== c) i += code[i] === "\\" ? 2 : 1;
      i++; // closing quote
      continue;
    }
    if (c === "`") {
      // Template literal: text segments are translatable (dropped entirely —
      // translation reshapes text around interpolations, so even a placeholder
      // per segment would be position-sensitive), but `${…}` interpolations
      // are code and are kept verbatim (brace-balanced).
      out += "`";
      i++;
      while (i < n && code[i] !== "`") {
        if (code[i] === "\\") {
          i += 2;
          continue;
        }
        if (code[i] === "$" && code[i + 1] === "{") {
          let depth = 1;
          let j = i + 2;
          while (j < n && depth > 0) {
            if (code[j] === "{") depth++;
            else if (code[j] === "}") depth--;
            if (depth > 0) j++;
          }
          out += `\${${code.slice(i + 2, j)}}`;
          i = j + 1;
          continue;
        }
        i++;
      }
      out += "`";
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);
}

function active(fences: Fence[]): Fence[] {
  return fences.filter((f) => !f.skipped);
}

function describeFence(file: string, f: Fence): string {
  return `${file}:${f.line} (fence #${f.index + 1}, under "${f.heading}")`;
}

const extracted = DOC_PAIRS.map((pair) => ({
  pair,
  en: extractFences(pair.en),
  ja: extractFences(pair.ja),
}));

describe("doc snippets — EN/JA parity", () => {
  it("found fences to compare in every pair", () => {
    for (const { pair, en, ja } of extracted) {
      expect(en.length, `${pair.en} has no ts fences`).toBeGreaterThan(0);
      expect(ja.length, `${pair.ja} has no ts fences`).toBeGreaterThan(0);
    }
  });

  it.each(
    extracted.map((e) => [`${e.pair.en} ↔ ${e.pair.ja}`, e] as const),
  )("fence count parity: %s", (_label, { pair, en, ja }) => {
    const enA = active(en);
    const jaA = active(ja);
    if (enA.length === jaA.length) return;

    // Locate the first index where normalized content diverges — the extra
    // fence(s) are at or after this point — and report the longer side's
    // tail from there for orientation.
    let firstDiff = Math.min(enA.length, jaA.length);
    for (let k = 0; k < firstDiff; k++) {
      const a = normalizeFence(enA[k].code).join("\n");
      const b = normalizeFence(jaA[k].code).join("\n");
      if (a !== b) {
        firstDiff = k;
        break;
      }
    }
    const [longSide, longFile] = enA.length > jaA.length ? [enA, pair.en] : [jaA, pair.ja];
    const tail = longSide
      .slice(firstDiff)
      .map((f) => `  ${describeFence(longFile, f)}`)
      .join("\n");
    expect.fail(
      `Fence count mismatch: ${pair.en} has ${enA.length} ts fences, ${pair.ja} has ${jaA.length} ` +
        `(after excluding ${SKIP_MARKER}).\n` +
        `Sequences first diverge at fence pair #${firstDiff + 1}. ` +
        `Fences on the longer side (${longFile}) from that point:\n${tail}`,
    );
  });

  it.each(
    extracted.map((e) => [`${e.pair.en} ↔ ${e.pair.ja}`, e] as const),
  )("fence content parity (normalized): %s", (_label, { pair, en, ja }) => {
    const enA = active(en);
    const jaA = active(ja);
    const len = Math.min(enA.length, jaA.length);
    const reports: string[] = [];
    for (let k = 0; k < len; k++) {
      const a = normalizeFence(enA[k].code);
      const b = normalizeFence(jaA[k].code);
      if (a.join("\n") === b.join("\n")) continue;
      let d = 0;
      while (d < a.length && d < b.length && a[d] === b[d]) d++;
      reports.push(
        [
          `Pair #${k + 1}:`,
          `  EN ${describeFence(pair.en, enA[k])}`,
          `  JA ${describeFence(pair.ja, jaA[k])}`,
          `  first differing normalized line (#${d + 1}):`,
          `    EN: ${a[d] ?? "(no line — fence ends here)"}`,
          `    JA: ${b[d] ?? "(no line — fence ends here)"}`,
        ].join("\n"),
      );
    }
    expect(
      reports.length,
      `Normalized fence divergence in ${pair.en} ↔ ${pair.ja} — the twins must show ` +
        `identical code (comments/string contents may be translated):\n${reports.join("\n")}`,
    ).toBe(0);
  });

  it(`ja-parity-skip markers are deliberate (expected: ${EXPECTED_SKIPS})`, () => {
    const skips = extracted.flatMap(({ pair, en, ja }) => [
      ...en.filter((f) => f.skipped).map((f) => describeFence(pair.en, f)),
      ...ja.filter((f) => f.skipped).map((f) => describeFence(pair.ja, f)),
    ]);
    expect(
      skips.length,
      `Update EXPECTED_SKIPS (with a reason) when adding/removing ${SKIP_MARKER}.\nCurrent skips:\n${skips
        .map((s) => `  ${s}`)
        .join("\n")}`,
    ).toBe(EXPECTED_SKIPS);
  });
});
