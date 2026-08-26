/**
 * Screening must not turn "could not evaluate" into an ordinary value.
 *
 * Every case below is a symbol (or an argument) the screener cannot judge.
 * The failure mode they share is substitution: a non-finite ATR% that passes
 * a minimum, a `1` that means both "average volume" and "no volume data", a
 * dropped CLI flag that becomes a default screen, and counters that overlap
 * so the summary cannot be reconciled.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calculateAtrPercentDetail, passesAtrFilter } from "../../indicators/volatility/atr-filter";
import type { NormalizedCandle } from "../../types";
import { parseScreenArgs } from "../cli-args";
import { firstUncomputableField, screenStock } from "../screen-stock";
import { runScreening } from "../screener";

/** Low-volatility series: true ATR% sits well under 1%. */
function lowVolatilityRows(count: number): string[] {
  const rows: string[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const date = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    price *= 1 + ((i % 7) - 3) * 0.0004;
    const high = price * 1.001;
    const low = price * 0.999;
    rows.push(
      `${date},${price.toFixed(4)},${high.toFixed(4)},${low.toFixed(4)},${price.toFixed(4)},1000000`,
    );
  }
  return rows;
}

function writeCsv(dir: string, ticker: string, rows: string[]): void {
  const header = "Date,Open,High,Low,Close,Volume";
  writeFileSync(join(dir, `${ticker}.csv`), [header, ...rows].join("\n"));
}

const CRITERIA = {
  name: "Test",
  entry: { type: "preset" as const, name: "always", evaluate: () => true },
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tc-screen-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("a symbol whose ATR% cannot be computed", () => {
  beforeEach(() => {
    for (const ticker of ["AAAA", "BBBB", "CCCC", "DDDD"]) {
      writeCsv(dir, ticker, lowVolatilityRows(150));
    }
    // The literal spelling used by historical CSV exports for a halted day.
    const broken = lowVolatilityRows(150);
    broken[50] = "2024-02-20,null,null,null,null,null";
    writeCsv(dir, "ZZZZ", broken);
  });

  it("is skipped rather than passing a minimum it cannot be compared to", () => {
    const result = runScreening({ dataPath: dir, criteria: CRITERIA, minAtrPercent: 2.3 });

    // Previously the only survivor of this screen was the broken symbol:
    // `NaN < 2.3` is false, so the negated test kept it.
    expect(result.results).toEqual([]);
    const zzzz = result.skipped.find((s) => s.ticker === "ZZZZ");
    expect(zzzz?.reason).toMatch(/not computable/);
    for (const ticker of ["AAAA", "BBBB", "CCCC", "DDDD"]) {
      expect(result.skipped.find((s) => s.ticker === ticker)?.reason).toMatch(/ATR% too low/);
    }
  });

  it("is skipped even when no ATR% filter is requested", () => {
    const result = runScreening({ dataPath: dir, criteria: CRITERIA });

    // `atrPercent` is the result sort key, so a NaN here left the ordering
    // undefined as well as reporting an unusable number.
    expect(result.results.map((r) => r.ticker).sort()).toEqual(["AAAA", "BBBB", "CCCC", "DDDD"]);
    expect(result.results.every((r) => Number.isFinite(r.atrPercent))).toBe(true);
    expect(result.skipped.find((s) => s.ticker === "ZZZZ")?.reason).toMatch(/not computable/);
  });

  it("is skipped when the malformed row is the LAST one", () => {
    // A trailing bad row leaves atrPercent finite — calculateAtrPercent only
    // averages bars whose own close is positive — and takes out currentPrice
    // instead, so an ATR%-only guard would report `currentPrice: NaN`.
    const broken = lowVolatilityRows(150);
    broken[broken.length - 1] = "2024-05-29,null,null,null,null,null";
    writeCsv(dir, "TAIL", broken);

    const result = runScreening({ dataPath: dir, criteria: CRITERIA });

    expect(result.results.find((r) => r.ticker === "TAIL")).toBeUndefined();
    expect(result.skipped.find((s) => s.ticker === "TAIL")?.reason).toMatch(
      /currentPrice not computable/,
    );
  });

  it("keeps a clean high-volatility symbol passing the same filter", () => {
    const volatile = lowVolatilityRows(150).map((row, i) => {
      const [date] = row.split(",");
      const price = 100 * (1 + (i % 2 === 0 ? 0.05 : -0.04));
      return `${date},${price.toFixed(4)},${(price * 1.05).toFixed(4)},${(price * 0.95).toFixed(4)},${price.toFixed(4)},1000000`;
    });
    writeCsv(dir, "HIGH", volatile);

    const result = runScreening({ dataPath: dir, criteria: CRITERIA, minAtrPercent: 2.3 });
    expect(result.results.map((r) => r.ticker)).toEqual(["HIGH"]);
  });
});

/** A flat but fully measurable series: ATR% is a real 0, not a placeholder. */
function flatBars(count: number): NormalizedCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: Date.UTC(2024, 0, 1 + i),
    open: 100,
    high: 100,
    low: 100,
    close: 100,
    volume: 1000,
  }));
}

describe("an ATR% that was substituted rather than measured", () => {
  it("is skipped even though it is finite", () => {
    // Fewer candles than the 14-bar ATR period: calculateAtrPercent has no
    // bar to measure and substitutes 0, which every finiteness check passes.
    writeCsv(dir, "TINY", lowVolatilityRows(8));

    const result = runScreening({ dataPath: dir, criteria: CRITERIA, minDataPoints: 5 });

    expect(result.results).toEqual([]);
    expect(result.skipped[0]?.reason).toMatch(/atrPercent not computable/);
  });

  it("is skipped when no bar has a positive close", () => {
    const negative = lowVolatilityRows(150).map((row) => {
      const [date, o, h, l, c, v] = row.split(",");
      return [date, `-${o}`, `-${l}`, `-${h}`, `-${c}`, v].join(",");
    });
    writeCsv(dir, "NEG", negative);

    const result = runScreening({ dataPath: dir, criteria: CRITERIA });

    expect(result.results).toEqual([]);
    expect(result.skipped[0]?.reason).toMatch(/atrPercent not computable/);
  });

  it("does not clear a zero volatility threshold in passesAtrFilter either", () => {
    const short = Array.from({ length: 8 }, (_, i) => ({
      time: Date.UTC(2024, 0, 1 + i),
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000,
    }));
    // `0 >= 0` used to pass a series whose volatility was never measured.
    expect(passesAtrFilter(short, { threshold: 0 }).passes).toBe(false);
    expect(calculateAtrPercentDetail(short).sampleCount).toBe(0);
  });

  it("rejects a sample count that is not a whole number of bars", () => {
    // firstUncomputableField is exported, so the count also arrives from
    // JavaScript callers and from results that have been through JSON.
    const base = screenStock("OK", flatBars(60), CRITERIA);
    expect(firstUncomputableField(base)).toBeNull();

    for (const bad of [undefined, Number.NaN, -1, 0, 0.5, Number.POSITIVE_INFINITY]) {
      const tampered = { ...base, atrSampleCount: bad as unknown as number };
      expect(firstUncomputableField(tampered)).toBe("atrPercent");
    }
  });

  it("still reports a genuinely flat series as measured", () => {
    const flat = flatBars(60);
    const detail = calculateAtrPercentDetail(flat);
    expect(detail.atrPercent).toBe(0);
    expect(detail.sampleCount).toBeGreaterThan(0);
    expect(passesAtrFilter(flat, { threshold: 0 }).passes).toBe(true);
  });
});

describe("summary counters", () => {
  function assertPartition(result: ReturnType<typeof runScreening>): void {
    expect(result.summary.processedFiles + result.summary.skippedFiles).toBe(
      result.summary.totalFiles,
    );
    expect(result.summary.processedFiles).toBe(result.results.length);
    expect(result.summary.skippedFiles).toBe(result.skipped.length);
  }

  it("partition the total when every symbol is filtered out", () => {
    writeCsv(dir, "AAAA", lowVolatilityRows(150));
    writeCsv(dir, "BBBB", lowVolatilityRows(150));

    const result = runScreening({ dataPath: dir, criteria: CRITERIA, minAtrPercent: 99 });

    // Previously: totalFiles 2 / processedFiles 2 / skippedFiles 2.
    expect(result.summary.totalFiles).toBe(2);
    expect(result.summary.processedFiles).toBe(0);
    expect(result.summary.skippedFiles).toBe(2);
    assertPartition(result);
  });

  it("partition the total across a mix of load errors, short series and hits", () => {
    writeCsv(dir, "GOOD", lowVolatilityRows(150));
    writeCsv(dir, "SHORT", lowVolatilityRows(10));
    writeFileSync(join(dir, "BAD.csv"), "not,a,valid\ncsv,at,all");

    const result = runScreening({ dataPath: dir, criteria: CRITERIA });

    expect(result.summary.totalFiles).toBe(3);
    assertPartition(result);
  });

  it("partition the total when everything screens through", () => {
    writeCsv(dir, "AAAA", lowVolatilityRows(150));
    writeCsv(dir, "BBBB", lowVolatilityRows(150));

    const result = runScreening({ dataPath: dir, criteria: CRITERIA });

    expect(result.summary.processedFiles).toBe(2);
    expect(result.summary.skippedFiles).toBe(0);
    assertPartition(result);
  });
});

describe("runScreening rejects bounds that would disable a filter", () => {
  it("throws on a negative minDataPoints or minAtrPercent", () => {
    writeCsv(dir, "AAAA", lowVolatilityRows(150));
    expect(() => runScreening({ dataPath: dir, criteria: CRITERIA, minDataPoints: -100 })).toThrow(
      /minDataPoints must be a non-negative integer/,
    );
    expect(() => runScreening({ dataPath: dir, criteria: CRITERIA, minAtrPercent: -1 })).toThrow(
      /minAtrPercent must be a non-negative number/,
    );
  });
});

describe("volumeRatio when there is no average to compare against", () => {
  function candles(count: number, volume: number): NormalizedCandle[] {
    return Array.from({ length: count }, (_, i) => ({
      time: Date.UTC(2024, 0, 1 + i),
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume,
    }));
  }

  it("is undefined during the 20-bar warm-up, like rsi14 beside it", () => {
    const result = screenStock("SHORT", candles(10, 1_000_000), CRITERIA);
    // `1` used to be reported here — the exact value meaning "precisely average".
    expect(result.metrics.volumeRatio).toBeUndefined();
    expect(result.metrics.rsi14).toBeUndefined();
  });

  it("is undefined for a symbol that never traded", () => {
    const result = screenStock("DEAD", candles(60, 0), CRITERIA);
    expect(result.metrics.volumeRatio).toBeUndefined();
  });

  it("is absent, not NaN, when the volume average overflows", () => {
    const bars = candles(60, 1e308);
    bars[bars.length - 1].volume = 1e308;
    // The 20-bar sum overflows to Infinity: Infinity/Infinity is NaN and
    // 1e308/Infinity is a plausible-looking 0 for a bar whose ratio is 1.
    expect(screenStock("OVER", bars, CRITERIA).metrics.volumeRatio).toBeUndefined();
  });

  it("reports an absent volume rather than a NaN one", () => {
    const bars = candles(60, 1_000_000);
    bars[bars.length - 1].volume = Number.NaN;
    const metrics = screenStock("BADVOL", bars, CRITERIA).metrics;
    expect(metrics.volume).toBeUndefined();
    expect(metrics.volumeRatio).toBeUndefined();
  });

  it("is still a real ratio for a symbol with volume history", () => {
    const bars = candles(60, 1_000_000);
    bars[bars.length - 1].volume = 2_000_000;
    const result = screenStock("LIVE", bars, CRITERIA);
    // The 20-bar average includes the last bar itself:
    // (19 * 1M + 2M) / 20 = 1.05M, so the ratio is 2M / 1.05M.
    expect(result.metrics.volumeRatio).toBeCloseTo(2_000_000 / 1_050_000, 9);
  });
});

describe("CLI arguments", () => {
  it("accepts --opt=value identically to the space-separated form", () => {
    const inline = parseScreenArgs(["./data", "--entry=rsiAbove70", "--min-atr=2.3"]);
    const spaced = parseScreenArgs(["./data", "--entry", "rsiAbove70", "--min-atr", "2.3"]);

    expect(inline.ok).toBe(true);
    expect(spaced.ok).toBe(true);
    if (inline.ok && spaced.ok) {
      expect(inline.args).toEqual(spaced.args);
      // Previously the inline form was dropped, leaving the DEFAULT screen.
      expect(inline.args.entry).toEqual(["rsiAbove70"]);
      expect(inline.args.minAtr).toBe(2.3);
    }
  });

  it("treats an empty value as a missing one", () => {
    // The old parser gated on truthiness, so `--entry ""` fell back to the
    // default screen. Accepting it instead would produce an empty condition
    // name that only fails much later, inside criteria lookup.
    expect(parseScreenArgs(["--entry", ""])).toEqual({
      ok: false,
      error: "Missing value for --entry",
    });
    expect(parseScreenArgs(["--entry="])).toEqual({
      ok: false,
      error: "Missing value for --entry",
    });
    expect(parseScreenArgs(["--entry", "a,"])).toEqual({
      ok: false,
      error: "Invalid value for --entry: a, (empty condition name)",
    });
  });

  it("does not tear apart a value that looks like an inline option", () => {
    // `--opt=value` is split at the option, not over the whole argv: a
    // pre-pass cannot tell an option from an option's value, and the tail
    // used to leak out as a positional that overwrote the data path.
    const result = parseScreenArgs(["--exit", "--entry=a=b"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args.exit).toEqual(["--entry=a=b"]);
      expect(result.args.dataPath).toBeUndefined();
    }
  });

  it("rejects a value on a flag that takes none", () => {
    expect(parseScreenArgs(["./data", "--all=x"])).toEqual({
      ok: false,
      error: "--all does not take a value",
    });
  });

  it("rejects a numeric prefix rather than truncating it", () => {
    expect(parseScreenArgs(["./d", "--min-atr", "2.5abc"])).toEqual({
      ok: false,
      error: "Invalid value for --min-atr: 2.5abc (expected a number)",
    });
    // The error message promises an integer, so 2.9 must not become 2.
    expect(parseScreenArgs(["./d", "--min-data", "2.9"])).toEqual({
      ok: false,
      error: "Invalid value for --min-data: 2.9 (expected an integer)",
    });
    const zero = parseScreenArgs(["./d", "--min-data", "0", "--min-atr", "0"]);
    expect(zero.ok).toBe(true);
    if (zero.ok) {
      expect(zero.args.minData).toBe(0);
      expect(zero.args.minAtr).toBe(0);
    }
  });

  it("rejects an unknown option instead of running the default screen", () => {
    const result = parseScreenArgs(["./data", "--entries", "rsiAbove70"]);
    expect(result).toEqual({ ok: false, error: "Unknown option: --entries" });
  });

  it("rejects a numeric option that does not parse", () => {
    expect(parseScreenArgs(["./data", "--min-atr", "abc"])).toEqual({
      ok: false,
      error: "Invalid value for --min-atr: abc (expected a number)",
    });
    expect(parseScreenArgs(["./data", "--min-data", "x"])).toEqual({
      ok: false,
      error: "Invalid value for --min-data: x (expected an integer)",
    });
  });

  it("rejects a bound that would silently disable a filter", () => {
    expect(parseScreenArgs(["./d", "--min-atr", "-1"])).toEqual({
      ok: false,
      error: "Invalid value for --min-atr: -1 (must not be negative)",
    });
    expect(parseScreenArgs(["./d", "--min-data", "-100"])).toEqual({
      ok: false,
      error: "Invalid value for --min-data: -100 (must not be negative)",
    });
  });

  it("rejects a second positional instead of overwriting the data path", () => {
    expect(parseScreenArgs(["./correct-data", "accidental-token"])).toEqual({
      ok: false,
      error: "Unexpected argument: accidental-token (data path already set to ./correct-data)",
    });
  });

  it("rejects a missing value rather than silently keeping the default", () => {
    expect(parseScreenArgs(["./data", "--entry"])).toEqual({
      ok: false,
      error: "Missing value for --entry",
    });
  });

  it("rejects an unsupported output format", () => {
    const result = parseScreenArgs(["./data", "--output", "yaml"]);
    expect(result).toEqual({
      ok: false,
      error: "Invalid value for --output: yaml (expected json, table, csv)",
    });
  });

  it("still applies the default entry conditions when none are named", () => {
    const result = parseScreenArgs(["./data"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args.entry).toEqual(["goldenCross", "volumeAnomaly"]);
      expect(result.args.dataPath).toBe("./data");
    }
  });

  it("keeps an equals sign inside a value", () => {
    const result = parseScreenArgs(["--entry=a,b", "./data"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.args.entry).toEqual(["a", "b"]);
  });
});
