import { describe, expect, it } from "vitest";
import type { DataPoint } from "../core/types";
import {
  buildSmcState,
  extractBosLevels,
  extractFvgZones,
  extractOrderBlocks,
  extractSweepMarkers,
} from "../plugins/smc-adapter";

function dp<T>(value: T, time = 1000): DataPoint<T> {
  return { time, value };
}

describe("extractOrderBlocks", () => {
  it("extracts active order blocks from last bar", () => {
    const data = [
      dp({
        newOrderBlock: null,
        activeOrderBlocks: [
          { type: "bullish", high: 110, low: 100, startIndex: 5, strength: 80 },
          { type: "bearish", high: 130, low: 125, startIndex: 8, strength: 60 },
        ],
        mitigatedThisBar: [],
        atBullishOB: false,
        atBearishOB: false,
      }),
    ];

    const zones = extractOrderBlocks(data);
    expect(zones).toHaveLength(2);
    expect(zones[0].type).toBe("bullish");
    expect(zones[0].mitigated).toBe(false);
    expect(zones[0].endIndex).toBeNull();
    expect(zones[0].strength).toBe(80);
    expect(zones[1].type).toBe("bearish");
  });

  it("extracts mitigated order blocks from all bars", () => {
    const data = [
      dp({
        newOrderBlock: null,
        activeOrderBlocks: [],
        mitigatedThisBar: [
          { type: "bullish", high: 110, low: 100, startIndex: 2, mitigatedIndex: 10, strength: 70 },
        ],
        atBullishOB: false,
        atBearishOB: false,
      }),
      dp({
        newOrderBlock: null,
        activeOrderBlocks: [],
        mitigatedThisBar: [],
        atBullishOB: false,
        atBearishOB: false,
      }),
    ];

    const zones = extractOrderBlocks(data);
    expect(zones).toHaveLength(1);
    expect(zones[0].mitigated).toBe(true);
    expect(zones[0].endIndex).toBe(10);
  });

  it("deduplicates between active and mitigated", () => {
    const ob = { type: "bullish", high: 110, low: 100, startIndex: 5, strength: 50 };
    const data = [
      dp({
        newOrderBlock: null,
        activeOrderBlocks: [ob],
        mitigatedThisBar: [{ ...ob, mitigatedIndex: 10 }],
        atBullishOB: false,
        atBearishOB: false,
      }),
    ];

    const zones = extractOrderBlocks(data);
    // Mitigated is processed first, so only 1 entry
    expect(zones).toHaveLength(1);
  });

  it("returns empty for empty input", () => {
    expect(extractOrderBlocks([])).toEqual([]);
  });
});

describe("extractFvgZones", () => {
  it("extracts active FVGs from last bar", () => {
    const data = [
      dp({
        newBullishFvg: false,
        newBearishFvg: false,
        newFvg: null,
        activeBullishFvgs: [
          { type: "bullish", high: 105, low: 100, startIndex: 3, filled: false, filledIndex: null },
        ],
        activeBearishFvgs: [
          { type: "bearish", high: 120, low: 118, startIndex: 7, filled: false, filledIndex: null },
        ],
        filledFvgs: [],
      }),
    ];

    const zones = extractFvgZones(data);
    expect(zones).toHaveLength(2);
    expect(zones[0].type).toBe("bullish");
    expect(zones[0].mitigated).toBe(false);
    expect(zones[1].type).toBe("bearish");
  });

  it("extracts filled FVGs from all bars", () => {
    const data = [
      dp({
        newBullishFvg: false,
        newBearishFvg: false,
        newFvg: null,
        activeBullishFvgs: [],
        activeBearishFvgs: [],
        filledFvgs: [
          { type: "bullish", high: 105, low: 100, startIndex: 3, filled: true, filledIndex: 8 },
        ],
      }),
    ];

    const zones = extractFvgZones(data);
    expect(zones).toHaveLength(1);
    expect(zones[0].mitigated).toBe(true);
    expect(zones[0].endIndex).toBe(8);
  });

  it("returns empty for empty input", () => {
    expect(extractFvgZones([])).toEqual([]);
  });
});

describe("extractSweepMarkers", () => {
  it("extracts markers from sweep bars", () => {
    const data = [
      dp({ isSweep: false, sweep: null, recentSweeps: [], recoveredThisBar: [] }),
      dp({
        isSweep: true,
        sweep: { type: "bullish", sweepExtreme: 95, sweepIndex: 1, recovered: false },
        recentSweeps: [],
        recoveredThisBar: [],
      }),
      dp({ isSweep: false, sweep: null, recentSweeps: [], recoveredThisBar: [] }),
    ];

    const markers = extractSweepMarkers(data);
    expect(markers).toHaveLength(1);
    expect(markers[0].type).toBe("bullish");
    expect(markers[0].price).toBe(95);
    expect(markers[0].index).toBe(1);
  });

  it("skips bars with isSweep=false", () => {
    const data = [dp({ isSweep: false, sweep: null, recentSweeps: [], recoveredThisBar: [] })];

    expect(extractSweepMarkers(data)).toEqual([]);
  });

  it("returns empty for empty input", () => {
    expect(extractSweepMarkers([])).toEqual([]);
  });
});

describe("extractBosLevels", () => {
  it("extracts bullish BOS levels", () => {
    const data = [
      dp({
        bullishBos: true,
        bearishBos: false,
        brokenLevel: 120,
        trend: "bullish",
        swingHighLevel: 120,
        swingLowLevel: 100,
      }),
    ];

    const levels = extractBosLevels(data);
    expect(levels).toHaveLength(1);
    expect(levels[0].type).toBe("bullish");
    expect(levels[0].price).toBe(120);
    expect(levels[0].label).toBe("BOS");
  });

  it("extracts bearish BOS levels", () => {
    const data = [
      dp({
        bullishBos: false,
        bearishBos: true,
        brokenLevel: 95,
        trend: "bearish",
        swingHighLevel: 120,
        swingLowLevel: 95,
      }),
    ];

    const levels = extractBosLevels(data);
    expect(levels).toHaveLength(1);
    expect(levels[0].type).toBe("bearish");
  });

  it("skips bars with no BOS", () => {
    const data = [
      dp({
        bullishBos: false,
        bearishBos: false,
        brokenLevel: null,
        trend: "neutral",
        swingHighLevel: null,
        swingLowLevel: null,
      }),
    ];

    expect(extractBosLevels(data)).toEqual([]);
  });

  it("skips bars with null brokenLevel", () => {
    const data = [
      dp({
        bullishBos: true,
        bearishBos: false,
        brokenLevel: null,
        trend: "bullish",
        swingHighLevel: 120,
        swingLowLevel: 100,
      }),
    ];

    expect(extractBosLevels(data)).toEqual([]);
  });

  it("returns empty for empty input", () => {
    expect(extractBosLevels([])).toEqual([]);
  });

  it("honors a custom label (e.g. CHoCH)", () => {
    const data = [
      dp({
        bullishBos: true,
        bearishBos: false,
        brokenLevel: 130,
        trend: "bullish",
        swingHighLevel: 130,
        swingLowLevel: 100,
      }),
    ];

    const levels = extractBosLevels(data, "CHoCH");
    expect(levels).toHaveLength(1);
    expect(levels[0].label).toBe("CHoCH");
  });
});

describe("buildSmcState", () => {
  it("builds composite state from multiple sources", () => {
    const state = buildSmcState({
      orderBlocks: [
        dp({
          newOrderBlock: null,
          activeOrderBlocks: [{ type: "bullish", high: 110, low: 100, startIndex: 5 }],
          mitigatedThisBar: [],
          atBullishOB: false,
          atBearishOB: false,
        }),
      ],
      bos: [
        dp({
          bullishBos: true,
          bearishBos: false,
          brokenLevel: 120,
          trend: "bullish",
          swingHighLevel: 120,
          swingLowLevel: 100,
        }),
      ],
    });

    expect(state.orderBlocks).toHaveLength(1);
    expect(state.bosLevels).toHaveLength(1);
    expect(state.fvgZones).toEqual([]);
    expect(state.sweepMarkers).toEqual([]);
  });

  it("handles empty sources", () => {
    const state = buildSmcState({});
    expect(state.orderBlocks).toEqual([]);
    expect(state.fvgZones).toEqual([]);
    expect(state.sweepMarkers).toEqual([]);
    expect(state.bosLevels).toEqual([]);
  });

  it("merges bos and choch levels into bosLevels with separate labels", () => {
    const state = buildSmcState({
      bos: [
        dp({
          bullishBos: true,
          bearishBos: false,
          brokenLevel: 120,
          trend: "bullish",
          swingHighLevel: 120,
          swingLowLevel: 100,
        }),
      ],
      choch: [
        dp({
          bullishBos: false,
          bearishBos: true,
          brokenLevel: 95,
          trend: "bearish",
          swingHighLevel: 120,
          swingLowLevel: 95,
        }),
      ],
    });

    expect(state.bosLevels).toHaveLength(2);
    const labels = state.bosLevels.map((l) => l.label).sort();
    expect(labels).toEqual(["BOS", "CHoCH"]);
  });
});
