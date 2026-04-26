import { describe, expect, it } from "vitest";
import { listSignalsHandler } from "../tools/list-signals";

describe("listSignalsHandler", () => {
  it("returns every registered signal with kind/shape/oneLiner/paramsHint", () => {
    const all = listSignalsHandler({});
    expect(all.length).toBeGreaterThanOrEqual(11);
    for (const s of all) {
      expect(typeof s.kind).toBe("string");
      expect(typeof s.oneLiner).toBe("string");
      expect(typeof s.paramsHint).toBe("string");
      expect(["series", "events"]).toContain(s.shape);
    }
  });

  it("filters by shape=series", () => {
    const series = listSignalsHandler({ shape: "series" });
    expect(series.length).toBeGreaterThan(0);
    for (const s of series) expect(s.shape).toBe("series");
    // sanity: the well-known series-shape signals are present
    const kinds = new Set(series.map((s) => s.kind));
    expect(kinds.has("goldenCross")).toBe(true);
    expect(kinds.has("perfectOrder")).toBe(true);
    expect(kinds.has("candlestickPatterns")).toBe(true);
  });

  it("filters by shape=events", () => {
    const events = listSignalsHandler({ shape: "events" });
    expect(events.length).toBeGreaterThan(0);
    for (const s of events) expect(s.shape).toBe("events");
    const kinds = new Set(events.map((s) => s.kind));
    expect(kinds.has("bollingerSqueeze")).toBe(true);
    expect(kinds.has("volumeBreakout")).toBe(true);
  });

  it("returns kinds in stable alphabetical order", () => {
    const all = listSignalsHandler({});
    const kinds = all.map((s) => s.kind);
    const sorted = [...kinds].sort((a, b) => a.localeCompare(b));
    expect(kinds).toEqual(sorted);
  });
});
