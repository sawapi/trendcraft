/**
 * JSON file-based state persistence
 *
 * Atomic writes to prevent corruption on crash.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { streaming } from "trendcraft";
import type { AgentState } from "../agent/types.js";

export type PersistentState = {
  version: 1;
  savedAt: number;
  agents: AgentState[];
  portfolioGuardState?: streaming.PortfolioGuardState;
  deactivatedStrategies?: string[];
};

const DEFAULT_PATH = resolve(import.meta.dirname, "../../data/state.json");

export type StateStore = {
  save(
    agents: AgentState[],
    portfolioGuardState?: streaming.PortfolioGuardState,
    deactivatedStrategies?: string[],
  ): void;
  load(): PersistentState | null;
  exists(): boolean;
};

export function createStateStore(path: string = DEFAULT_PATH): StateStore {
  // Ensure directory exists
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });

  return {
    save(
      agents: AgentState[],
      portfolioGuardState?: streaming.PortfolioGuardState,
      deactivatedStrategies?: string[],
    ): void {
      const state: PersistentState = {
        version: 1,
        savedAt: Date.now(),
        agents,
        portfolioGuardState,
        deactivatedStrategies,
      };

      const json = JSON.stringify(state, null, 2);
      const tmpPath = `${path}.tmp`;

      // Atomic write: write to temp file, then rename
      writeFileSync(tmpPath, json, "utf-8");
      renameSync(tmpPath, path);

      console.log(`[STORE] State saved (${agents.length} agents) at ${new Date().toISOString()}`);
    },

    load(): PersistentState | null {
      if (!existsSync(path)) return null;

      try {
        const json = readFileSync(path, "utf-8");
        const state = JSON.parse(json) as PersistentState;
        if (state.version !== 1) {
          console.warn(`[STORE] Unknown state version: ${state.version}`);
          return null;
        }
        console.log(
          `[STORE] State loaded (${state.agents.length} agents, saved at ${new Date(state.savedAt).toISOString()})`,
        );
        return state;
      } catch (err) {
        console.error("[STORE] Failed to load state:", err);
        return null;
      }
    },

    exists(): boolean {
      return existsSync(path);
    },
  };
}

// ---------------------------------------------------------------------------
// Daily cache utilities (optimizer overrides, earnings calendar)
// ---------------------------------------------------------------------------

const DATA_DIR = resolve(import.meta.dirname, "../../data");

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Save optimizer overrides for today. Skips re-optimization if a cache exists.
 */
export function saveOptimizerCache(overrides: unknown[]): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const filePath = resolve(DATA_DIR, `optimizer-overrides-${todayString()}.json`);
  writeFileSync(filePath, JSON.stringify(overrides, null, 2), "utf-8");
}

/**
 * Load today's optimizer cache. Returns null if no cache exists.
 */
export function loadOptimizerCache(): unknown[] | null {
  const filePath = resolve(DATA_DIR, `optimizer-overrides-${todayString()}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as unknown[];
  } catch {
    return null;
  }
}

/**
 * Save earnings calendar for today.
 */
export function saveEarningsCache(entries: unknown[]): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const filePath = resolve(DATA_DIR, `earnings-${todayString()}.json`);
  writeFileSync(filePath, JSON.stringify(entries, null, 2), "utf-8");
}

/**
 * Load today's earnings cache. Returns null if no cache exists.
 */
export function loadEarningsCache(): unknown[] | null {
  const filePath = resolve(DATA_DIR, `earnings-${todayString()}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as unknown[];
  } catch {
    return null;
  }
}
