import { describe, expect, it } from "vitest";
import type { SectorId } from "../../sec/types.js";
import { checkSectorExposure } from "../correlation-guard.js";

describe("checkSectorExposure", () => {
  const sectorMap = new Map<string, SectorId>([
    ["AAPL", "technology"],
    ["MSFT", "technology"],
    ["GOOGL", "technology"],
    ["JPM", "finance"],
    ["GS", "finance"],
    ["XOM", "energy"],
  ]);

  it("allows when no sector map data", () => {
    const result = checkSectorExposure("AAPL", [], new Map(), 2);
    expect(result.allowed).toBe(true);
  });

  it("allows when sector limit not reached", () => {
    const result = checkSectorExposure("MSFT", [{ symbol: "AAPL" }], sectorMap, 2);
    expect(result.allowed).toBe(true);
  });

  it("blocks when sector limit reached", () => {
    const result = checkSectorExposure(
      "GOOGL",
      [{ symbol: "AAPL" }, { symbol: "MSFT" }],
      sectorMap,
      2,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("technology");
    expect(result.reason).toContain("2/2");
  });

  it("allows unknown symbol (not in sector map)", () => {
    const result = checkSectorExposure(
      "UNKNOWN",
      [{ symbol: "AAPL" }, { symbol: "MSFT" }],
      sectorMap,
      2,
    );
    expect(result.allowed).toBe(true);
  });

  it("allows symbol with 'other' sector", () => {
    const mapWithOther = new Map<string, SectorId>([...sectorMap, ["MISC", "other"]]);
    const result = checkSectorExposure(
      "MISC",
      [{ symbol: "AAPL" }, { symbol: "MSFT" }],
      mapWithOther,
      2,
    );
    expect(result.allowed).toBe(true);
  });

  it("counts only same-sector positions", () => {
    const result = checkSectorExposure(
      "GS",
      [{ symbol: "AAPL" }, { symbol: "MSFT" }, { symbol: "JPM" }],
      sectorMap,
      2,
    );
    // JPM is the only financial, count=1 < max=2
    expect(result.allowed).toBe(true);
  });
});
