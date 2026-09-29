/**
 * Hand-written JSON response examples in the docs are executed against the
 * real tool handlers.
 *
 * The type-level doc harnesses only see code they can interpret as
 * TypeScript; a `json`/`jsonc` fence showing what a tool returns is bound to
 * no type, so a field added to (or renamed in) a response left the example
 * stale with nothing failing. This test closes that gap the same way the
 * doctest harness does — by running the thing and comparing.
 *
 * Every ```json / ```jsonc fence in EXAMPLES.md and README.md must carry a
 * marker on one of the three lines above it:
 *
 *   <!-- doctest-example: calc_indicator <kind> [<params-json>] -->
 *       the fence is a calc_indicator response; keys are compared with a real
 *       response (top level and, for `series`, the first element)
 *   <!-- doctest-example: detect_signal <kind> -->
 *       same for a detect_signal response
 *   <!-- doctest-example: detect_signal elements -->
 *       the fence lists output elements, each introduced by a
 *       `// <kind> output element` comment; each is compared with a firing
 *       element of that kind's real output
 *   <!-- doctest-example: candles -->
 *       the fence is the candle input shape; validated by the input schema
 *   <!-- doctest-example-skip: <reason> -->
 *       not a tool payload (e.g. an MCP client config)
 *
 * Comparison rule: every key the example shows must exist in the real
 * output, recursively. A fence that contains an ellipsis comment (`...`) is
 * "open" — it may omit keys; a fence without one must show every key the
 * real output has (and must not show a primitive where the real output is an
 * object or array), so a newly added field also fails until documented.
 * Every element the example lists in an array is compared with the real
 * element at the same position (the real output must have at least as many);
 * an empty array in the example is not compared — there is no element to
 * read. Values and types are not compared, only keys.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listSupportedSignals } from "../dispatcher/signal-map";
import type { Candle } from "../schemas/candle";
import { candlesArraySchema } from "../schemas/candle";
import { calcIndicatorHandler } from "../tools/calc";
import { detectSignalHandler } from "../tools/detect-signal";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "../..");
const DOCS = ["EXAMPLES.md", "README.md"];

// ---- fixture ---------------------------------------------------------------

/** Seeded PRNG (mulberry32) so the fixture is the same on every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random walk with drift and volatility regimes — enough variety that every registered signal fires within a few seeds. */
function walkCandles(seed: number, n = 300): Candle[] {
  const rnd = mulberry32(seed);
  const out: Candle[] = [];
  let close = 100;
  let drift = 0;
  let vol = 1;
  for (let i = 0; i < n; i++) {
    if (rnd() < 0.05) drift = (rnd() - 0.5) * 0.02;
    if (rnd() < 0.05) vol = 0.3 + rnd() * 2;
    const open = close;
    close = Math.max(1, open * (1 + drift + (rnd() - 0.5) * 0.02 * vol));
    out.push({
      time: 1_700_000_000_000 + i * 86_400_000,
      open,
      high: Math.max(open, close) * (1 + rnd() * 0.006 * vol),
      low: Math.min(open, close) * (1 - rnd() * 0.006 * vol),
      close,
      volume: Math.round(1000 + rnd() * 3000),
    });
  }
  return out;
}

/** First seed (1..50) on which the signal fires; the element at its first firing time. */
function firingSignal(kind: string): { response: Record<string, unknown>; element: unknown } {
  for (let seed = 1; seed <= 50; seed++) {
    const response = detectSignalHandler({ kind, candles: walkCandles(seed), lastN: 0 });
    if (response.firedAt.length > 0) {
      const t = response.firedAt[0];
      const element =
        (response.output as Array<{ time: number }>).find((e) => e.time === t) ??
        response.output[0];
      return { response: response as unknown as Record<string, unknown>, element };
    }
  }
  throw new Error(`no seed in 1..50 makes "${kind}" fire — the fixture needs a new regime`);
}

// ---- jsonc -----------------------------------------------------------------

type Parsed = { value: unknown; open: boolean };

/**
 * Turn a jsonc fence into a value. Comments are stripped outside string
 * literals; an ellipsis inside a comment marks the fence as open (keys may be
 * omitted); numeric separators (`1_200_000`) and trailing commas are allowed.
 */
function parseJsonc(text: string): Parsed {
  let out = "";
  let open = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      // copy the literal verbatim, honouring escapes (\" and \\)
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      if (j >= text.length) throw new Error("unterminated string literal in the example");
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (ch === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i);
      const comment = end < 0 ? text.slice(i) : text.slice(i, end);
      if (comment.includes("...")) open = true;
      i = end < 0 ? text.length : end;
    } else if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) throw new Error("unterminated block comment in the example");
      if (text.slice(i, end).includes("...")) open = true;
      i = end + 2;
    } else if (/\d/.test(ch)) {
      // a number outside a string: allow `1_200_000`
      let j = i;
      while (j < text.length && /[\d_.eE+-]/.test(text[j])) j++;
      out += text.slice(i, j).replace(/_/g, "");
      i = j;
    } else {
      // a closing bracket outside a string drops a trailing comma before it
      if (ch === "}" || ch === "]") out = out.replace(/,\s*$/, "");
      out += ch;
      i++;
    }
  }
  return { value: JSON.parse(out), open };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Keys the example shows vs keys the real value has; returns human-readable problems. */
function compareShape(doc: unknown, actual: unknown, open: boolean, at = "$"): string[] {
  const problems: string[] = [];
  if (!open && isRecord(actual) && !isRecord(doc)) {
    return [
      `${at}: the real output is an object with keys [${Object.keys(actual).join(", ")}], the example shows ${JSON.stringify(doc)}`,
    ];
  }
  if (!open && Array.isArray(actual) && !Array.isArray(doc)) {
    return [`${at}: the real output is an array, the example shows ${JSON.stringify(doc)}`];
  }
  if (isRecord(doc)) {
    if (!isRecord(actual)) return [`${at}: example is an object, real output is ${typeof actual}`];
    for (const key of Object.keys(doc)) {
      if (!(key in actual))
        problems.push(`${at}.${key}: shown in the example, absent from the real output`);
      else problems.push(...compareShape(doc[key], actual[key], open, `${at}.${key}`));
    }
    if (!open) {
      for (const key of Object.keys(actual)) {
        if (!(key in doc))
          problems.push(`${at}.${key}: present in the real output, missing from the example`);
      }
    }
  } else if (Array.isArray(doc)) {
    if (!Array.isArray(actual))
      return [`${at}: example is an array, real output is ${typeof actual}`];
    if (doc.length > actual.length) {
      return [
        `${at}: the example lists ${doc.length} element(s), the real output has ${actual.length}`,
      ];
    }
    doc.forEach((element, i) => {
      problems.push(...compareShape(element, actual[i], open, `${at}[${i}]`));
    });
  }
  return problems;
}

// ---- fences ----------------------------------------------------------------

type Fence = {
  file: string;
  line: number;
  lang: string;
  /** Anything after the language on the fence line — must be empty. */
  info: string;
  body: string;
  marker: string | null;
};

function collectFences(file: string): Fence[] {
  const lines = fs.readFileSync(path.join(pkgRoot, file), "utf8").split("\n");
  const fences: Fence[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*```(jsonc?)\b(.*)$/.exec(lines[i]);
    if (!m) continue;
    const info = m[2].trim();
    let end = i + 1;
    while (end < lines.length && !/^\s*```\s*$/.test(lines[end])) end++;
    let marker: string | null = null;
    for (let back = i - 1; back >= Math.max(0, i - 3); back--) {
      const mm = /<!--\s*(doctest-example(?:-skip)?:.*?)\s*-->/.exec(lines[back]);
      if (mm) {
        marker = mm[1];
        break;
      }
    }
    fences.push({
      file,
      line: i + 1,
      lang: m[1],
      info,
      body: lines.slice(i + 1, end).join("\n"),
      marker,
    });
    i = end;
  }
  return fences;
}

function parseParams(rest: string[]): Record<string, unknown> | undefined {
  const json = rest.join(" ").trim();
  return json ? (JSON.parse(json) as Record<string, unknown>) : undefined;
}

function checkFence(fence: Fence): string[] {
  if (fence.info !== "") {
    return [
      `fence info string "${fence.info}" is not supported — use a bare \`\`\`${fence.lang} fence`,
    ];
  }
  const marker = fence.marker;
  if (marker === null) {
    return [`no <!-- doctest-example: ... --> marker on the three lines above the fence`];
  }
  if (marker.startsWith("doctest-example-skip:")) return [];
  const [tool, kind, ...rest] = marker.replace(/^doctest-example:\s*/, "").split(/\s+/);

  if (tool === "candles") {
    const { value } = parseJsonc(fence.body);
    const result = candlesArraySchema.safeParse(value);
    return result.success
      ? []
      : [`candle example does not satisfy the input schema: ${result.error.message}`];
  }

  if (tool === "calc_indicator") {
    const { value, open } = parseJsonc(fence.body);
    const actual = calcIndicatorHandler({
      kind,
      candles: walkCandles(1),
      params: parseParams(rest),
      lastN: 5,
    });
    return compareShape(value, actual, open);
  }

  if (tool === "detect_signal" && kind === "elements") {
    const problems: string[] = [];
    const blocks = fence.body.split(/^\s*\/\/\s*(\w+) output element\s*$/m);
    // split yields [preamble, kind1, body1, kind2, body2, ...]
    if (blocks.length < 3) return ["an `elements` fence needs `// <kind> output element` headings"];
    if (blocks[0].trim() !== "") {
      return [
        `content before the first \`// <kind> output element\` heading: ${blocks[0].trim().slice(0, 60)}`,
      ];
    }
    for (let i = 1; i < blocks.length; i += 2) {
      const elementKind = blocks[i];
      let parsed: Parsed;
      try {
        parsed = parseJsonc(blocks[i + 1]);
      } catch (e) {
        return [
          `${elementKind}: example does not parse (is every element introduced by its own heading?): ${(e as Error).message}`,
        ];
      }
      const { element } = firingSignal(elementKind);
      problems.push(...compareShape(parsed.value, element, parsed.open, `${elementKind}`));
    }
    return problems;
  }

  if (tool === "detect_signal") {
    const { value, open } = parseJsonc(fence.body);
    const { response } = firingSignal(kind);
    return compareShape(value, response, open);
  }

  return [`unknown marker "${marker}"`];
}

// ---- the harness's own parser and comparator --------------------------------

describe("parseJsonc", () => {
  it("keeps escapes and comment-looking text inside strings", () => {
    expect(parseJsonc('{ "label": "a\\" // b", "url": "http://x/y" }').value).toEqual({
      label: 'a" // b',
      url: "http://x/y",
    });
  });
  it("removes trailing commas outside strings only", () => {
    expect(parseJsonc('{ "field,}": 1, "arr": [1, 2, ], }').value).toEqual({
      "field,}": 1,
      arr: [1, 2],
    });
  });
  it("accepts numeric separators outside strings and leaves them inside", () => {
    expect(parseJsonc('{ "volume": 1_200_000, "name": "sma_20_50" }').value).toEqual({
      volume: 1200000,
      name: "sma_20_50",
    });
  });
  it("marks a fence open only for an ellipsis inside a comment", () => {
    expect(parseJsonc('{ "a": 1 /* ... */ }').open).toBe(true);
    expect(parseJsonc('{ "a": 1 } // ...').open).toBe(true);
    expect(parseJsonc('{ "a": "..." }').open).toBe(false);
  });
  it("throws on an unterminated string or block comment instead of looping", () => {
    expect(() => parseJsonc('{ "a": 1 "b }')).toThrow(/unterminated string/);
    expect(() => parseJsonc('{ "a": 1 /* oops }')).toThrow(/unterminated block comment/);
  });
});

describe("compareShape", () => {
  const real = {
    kind: "x",
    series: [
      { time: 1, value: 2 },
      { time: 2, value: 3 },
    ],
  };
  it("flags a wrong key in the second element of an array", () => {
    const doc = {
      kind: "x",
      series: [
        { time: 1, value: 2 },
        { time: 2, wrongKey: 3 },
      ],
    };
    expect(compareShape(doc, real, false)).toEqual([
      "$.series[1].wrongKey: shown in the example, absent from the real output",
      "$.series[1].value: present in the real output, missing from the example",
    ]);
  });
  it("flags an example that lists more elements than the real output has", () => {
    const doc = {
      kind: "x",
      series: [
        { time: 1, value: 2 },
        { time: 2, value: 3 },
        { time: 3, value: 4 },
      ],
    };
    expect(compareShape(doc, real, false)).toEqual([
      "$.series: the example lists 3 element(s), the real output has 2",
    ]);
    expect(
      compareShape({ kind: "x", series: [{ time: 1, value: 2 }] }, { kind: "x", series: [] }, true),
    ).toEqual(["$.series: the example lists 1 element(s), the real output has 0"]);
  });
  it("in a closed fence, flags a primitive standing in for an object and an undocumented key", () => {
    expect(
      compareShape(
        { time: 1, value: false },
        { time: 1, value: { type: "b", formed: true } },
        false,
      ),
    ).toEqual([
      "$.value: the real output is an object with keys [type, formed], the example shows false",
    ]);
    expect(compareShape({ kind: "x" }, { kind: "x", extra: 1 }, false)).toEqual([
      "$.extra: present in the real output, missing from the example",
    ]);
    expect(compareShape({ kind: "x" }, { kind: "x", extra: 1 }, true)).toEqual([]);
  });
});

// ---- tests -----------------------------------------------------------------

describe("JSON response examples in the docs match the real tool output", () => {
  const fences = DOCS.flatMap(collectFences);

  it("finds the fences (the docs are not silently empty)", () => {
    expect(fences.length).toBeGreaterThanOrEqual(6);
  });

  for (const fence of fences) {
    it(`${fence.file}:${fence.line} (${fence.marker ?? "unmarked"})`, () => {
      const problems = checkFence(fence);
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }

  it("the fixture makes every registered signal kind fire (so element checks are never vacuous)", () => {
    const kinds = listSupportedSignals().map((summary) => summary.kind);
    expect(kinds.length).toBeGreaterThanOrEqual(12);
    for (const kind of kinds) {
      expect(firingSignal(kind).response.firedAt, kind).not.toEqual([]);
    }
  });
});
