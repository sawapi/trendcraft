/**
 * Input checks for the optional features (signals, trades, backtest
 * results). Only the feature modules import this file, so the core bundle
 * does not carry them.
 */

import type { SignalMarker, TradeMarker } from "./types";
import { isFiniteNumber, isObject, type ShapeCheck, type ShapeIssue } from "./validation";

/**
 * Validate `addSignals` input. Each entry must have a finite epoch-ms `time`
 * and `type` of `'buy'` or `'sell'`.
 */
export function checkSignals(input: unknown): ShapeCheck<SignalMarker> {
  if (!Array.isArray(input)) return { ok: false, reason: "expected an array" };
  const issues: ShapeIssue[] = [];
  let valid: SignalMarker[] | null = null;
  for (let i = 0; i < input.length; i++) {
    const m = input[i];
    let reason: string | null = null;
    if (!isObject(m) || !("time" in m) || !("type" in m)) {
      reason = "missing time or type";
    } else if (m.type !== "buy" && m.type !== "sell") {
      reason = `type must be 'buy' or 'sell', got ${String(m.type)}`;
    } else if (!isFiniteNumber(m.time)) {
      reason = "time must be a finite number (epoch ms)";
    }
    if (reason !== null) {
      if (valid === null) valid = input.slice(0, i) as SignalMarker[];
      issues.push({ index: i, reason });
    } else if (valid !== null) {
      valid.push(m as SignalMarker);
    }
  }
  return issues.length === 0
    ? { ok: true, value: input as SignalMarker[] }
    : { ok: true, value: valid ?? [], issues };
}

/**
 * Validate `addTrades` input. Each entry must have entry/exit times and
 * prices, all of which must be finite numbers (epoch ms for times).
 */
export function checkTrades(input: unknown): ShapeCheck<TradeMarker> {
  if (!Array.isArray(input)) return { ok: false, reason: "expected an array" };
  const issues: ShapeIssue[] = [];
  let valid: TradeMarker[] | null = null;
  for (let i = 0; i < input.length; i++) {
    const t = input[i];
    let reason: string | null = null;
    if (
      !isObject(t) ||
      !("entryTime" in t) ||
      !("exitTime" in t) ||
      !("entryPrice" in t) ||
      !("exitPrice" in t)
    ) {
      reason = "missing entryTime/exitTime/entryPrice/exitPrice";
    } else if (!isFiniteNumber(t.entryTime) || !isFiniteNumber(t.exitTime)) {
      reason = "entryTime and exitTime must be finite numbers (epoch ms)";
    } else if (!isFiniteNumber(t.entryPrice) || !isFiniteNumber(t.exitPrice)) {
      reason = "entryPrice and exitPrice must be finite numbers";
    }
    if (reason !== null) {
      if (valid === null) valid = input.slice(0, i) as TradeMarker[];
      issues.push({ index: i, reason });
    } else if (valid !== null) {
      valid.push(t as TradeMarker);
    }
  }
  return issues.length === 0
    ? { ok: true, value: input as TradeMarker[] }
    : { ok: true, value: valid ?? [], issues };
}

/**
 * Validate `addBacktest` input. Confirms the required scalar fields are
 * finite numbers and that `trades` is an array; element-level shape inside
 * `trades` is not checked here — bad rows are dropped at render time.
 */
export function checkBacktest(input: unknown): { ok: true } | { ok: false; reason: string } {
  if (!isObject(input)) return { ok: false, reason: "expected an object" };
  const requiredNumbers = [
    "initialCapital",
    "finalCapital",
    "totalReturnPercent",
    "tradeCount",
    "winRate",
    "maxDrawdown",
  ] as const;
  for (const k of requiredNumbers) {
    const v = input[k];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return { ok: false, reason: `${k} must be a finite number` };
    }
  }
  if (!Array.isArray(input.trades)) {
    return { ok: false, reason: "trades must be an array" };
  }
  if (!Array.isArray(input.drawdownPeriods)) {
    return { ok: false, reason: "drawdownPeriods must be an array" };
  }
  return { ok: true };
}
