/**
 * JSON file-based state persistence
 *
 * Atomic writes to prevent corruption on crash.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AgentState } from "../agent/types.js";

export type PersistentState = {
  version: 1;
  savedAt: number;
  agents: AgentState[];
};

const DEFAULT_PATH = resolve(import.meta.dirname, "../../data/state.json");

export type StateStore = {
  save(agents: AgentState[]): void;
  load(): PersistentState | null;
  exists(): boolean;
};

export function createStateStore(path: string = DEFAULT_PATH): StateStore {
  // Ensure directory exists
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });

  return {
    save(agents: AgentState[]): void {
      const state: PersistentState = {
        version: 1,
        savedAt: Date.now(),
        agents,
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
