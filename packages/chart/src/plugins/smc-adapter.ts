/**
 * SMC Adapter — Converts trendcraft core SMC indicator output into SmcState.
 *
 * All functions are duck-typed (no core dependency).
 * They accept DataPoint<unknown>[] and extract the relevant fields.
 */

import type { DataPoint } from "../core/types";
import type { SmcLevel, SmcMarker, SmcState, SmcZone } from "./smc-layer";

// ---- Helpers ----

function has<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return typeof obj === "object" && obj !== null && key in obj;
}

function asArray(val: unknown): unknown[] {
  return Array.isArray(val) ? val : [];
}

// ---- Order Blocks ----

/**
 * Extract SmcZone[] from orderBlock() output.
 * Uses the last bar's activeOrderBlocks + all bars' mitigatedThisBar.
 */
export function extractOrderBlocks(data: readonly DataPoint<unknown>[]): SmcZone[] {
  const zones: SmcZone[] = [];
  const seen = new Set<string>();

  // Collect mitigated blocks from all bars
  for (const point of data) {
    const val = point.value;
    if (!has(val, "mitigatedThisBar")) continue;
    for (const ob of asArray(val.mitigatedThisBar)) {
      if (!has(ob, "high") || !has(ob, "low") || !has(ob, "startIndex") || !has(ob, "type"))
        continue;
      const key = `${ob.type}-${ob.startIndex}-${ob.high}-${ob.low}`;
      if (seen.has(key)) continue;
      seen.add(key);
      zones.push({
        type: ob.type as "bullish" | "bearish",
        high: ob.high as number,
        low: ob.low as number,
        startIndex: ob.startIndex as number,
        endIndex: has(ob, "mitigatedIndex") ? (ob.mitigatedIndex as number) : null,
        strength: has(ob, "strength") ? (ob.strength as number) : 50,
        mitigated: true,
      });
    }
  }

  // Active blocks from last bar
  const lastVal = data.length > 0 ? data[data.length - 1].value : null;
  if (has(lastVal, "activeOrderBlocks")) {
    for (const ob of asArray(lastVal.activeOrderBlocks)) {
      if (!has(ob, "high") || !has(ob, "low") || !has(ob, "startIndex") || !has(ob, "type"))
        continue;
      const key = `${ob.type}-${ob.startIndex}-${ob.high}-${ob.low}`;
      if (seen.has(key)) continue;
      seen.add(key);
      zones.push({
        type: ob.type as "bullish" | "bearish",
        high: ob.high as number,
        low: ob.low as number,
        startIndex: ob.startIndex as number,
        endIndex: null,
        strength: has(ob, "strength") ? (ob.strength as number) : 50,
        mitigated: false,
      });
    }
  }

  return zones;
}

// ---- Fair Value Gaps ----

/**
 * Extract SmcZone[] from fairValueGap() output.
 * Uses the last bar's active FVGs + all bars' filledFvgs.
 */
export function extractFvgZones(data: readonly DataPoint<unknown>[]): SmcZone[] {
  const zones: SmcZone[] = [];
  const seen = new Set<string>();

  // Collect filled FVGs from all bars
  for (const point of data) {
    const val = point.value;
    if (!has(val, "filledFvgs")) continue;
    for (const fvg of asArray(val.filledFvgs)) {
      if (!has(fvg, "high") || !has(fvg, "low") || !has(fvg, "startIndex") || !has(fvg, "type"))
        continue;
      const key = `fvg-${fvg.type}-${fvg.startIndex}-${fvg.high}-${fvg.low}`;
      if (seen.has(key)) continue;
      seen.add(key);
      zones.push({
        type: fvg.type as "bullish" | "bearish",
        high: fvg.high as number,
        low: fvg.low as number,
        startIndex: fvg.startIndex as number,
        endIndex: has(fvg, "filledIndex") ? (fvg.filledIndex as number) : null,
        strength: 30,
        mitigated: true, // filled = mitigated
      });
    }
  }

  // Active FVGs from last bar
  const lastVal = data.length > 0 ? data[data.length - 1].value : null;
  if (lastVal) {
    const activeFvgs = [
      ...asArray(has(lastVal, "activeBullishFvgs") ? lastVal.activeBullishFvgs : []),
      ...asArray(has(lastVal, "activeBearishFvgs") ? lastVal.activeBearishFvgs : []),
    ];
    for (const fvg of activeFvgs) {
      if (!has(fvg, "high") || !has(fvg, "low") || !has(fvg, "startIndex") || !has(fvg, "type"))
        continue;
      const key = `fvg-${fvg.type}-${fvg.startIndex}-${fvg.high}-${fvg.low}`;
      if (seen.has(key)) continue;
      seen.add(key);
      zones.push({
        type: fvg.type as "bullish" | "bearish",
        high: fvg.high as number,
        low: fvg.low as number,
        startIndex: fvg.startIndex as number,
        endIndex: null,
        strength: 60,
        mitigated: false,
      });
    }
  }

  return zones;
}

// ---- Liquidity Sweeps ----

/**
 * Extract SmcMarker[] from liquiditySweep() output.
 * Creates markers for bars where isSweep === true.
 */
export function extractSweepMarkers(data: readonly DataPoint<unknown>[]): SmcMarker[] {
  const markers: SmcMarker[] = [];

  for (let i = 0; i < data.length; i++) {
    const val = data[i].value;
    if (!has(val, "isSweep") || val.isSweep !== true) continue;
    if (!has(val, "sweep") || !val.sweep) continue;

    const sweep = val.sweep;
    if (!has(sweep, "type") || !has(sweep, "sweepExtreme")) continue;

    markers.push({
      type: sweep.type as "bullish" | "bearish",
      index: has(sweep, "sweepIndex") ? (sweep.sweepIndex as number) : i,
      price: sweep.sweepExtreme as number,
      label: "Sweep",
    });
  }

  return markers;
}

// ---- Break of Structure ----

/**
 * Extract SmcLevel[] from breakOfStructure() output.
 * Creates levels at bars where bullishBos or bearishBos is true.
 */
export function extractBosLevels(data: readonly DataPoint<unknown>[]): SmcLevel[] {
  const levels: SmcLevel[] = [];

  for (let i = 0; i < data.length; i++) {
    const val = data[i].value;
    if (typeof val !== "object" || val === null) continue;
    const rec = val as Record<string, unknown>;

    const isBullish = rec.bullishBos === true;
    const isBearish = rec.bearishBos === true;
    if (!isBullish && !isBearish) continue;

    if (rec.brokenLevel === null || rec.brokenLevel === undefined) continue;

    levels.push({
      type: isBullish ? "bullish" : "bearish",
      price: rec.brokenLevel as number,
      startIndex: i,
      endIndex: null,
      label: "BOS",
    });
  }

  return levels;
}

// ---- Composite builder ----

/**
 * Build SmcState from multiple indicator outputs.
 */
export function buildSmcState(sources: {
  orderBlocks?: readonly DataPoint<unknown>[];
  fvgs?: readonly DataPoint<unknown>[];
  sweeps?: readonly DataPoint<unknown>[];
  bos?: readonly DataPoint<unknown>[];
}): SmcState {
  return {
    orderBlocks: sources.orderBlocks ? extractOrderBlocks(sources.orderBlocks) : [],
    fvgZones: sources.fvgs ? extractFvgZones(sources.fvgs) : [],
    sweepMarkers: sources.sweeps ? extractSweepMarkers(sources.sweeps) : [],
    bosLevels: sources.bos ? extractBosLevels(sources.bos) : [],
  };
}
