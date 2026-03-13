/**
 * useSettings — persistent TUI settings (capital, default symbols)
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useCallback, useEffect, useState } from "react";
import { atomicWriteJson } from "../../persistence/atomic-write.js";
import { removeOverride } from "../../review/applier.js";

const SETTINGS_PATH = resolve("data/tui-settings.json");

export type TuiSettings = {
  capital: number;
  defaultSymbols: string[];
};

const DEFAULT_SETTINGS: TuiSettings = {
  capital: 100000,
  defaultSymbols: ["AAPL", "SPY"],
};

export type SettingsActions = {
  setCapital: (capital: number) => void;
  toggleSymbol: (symbol: string) => void;
  deleteOverride: (strategyId: string) => boolean;
};

function loadSettings(): TuiSettings {
  try {
    if (existsSync(SETTINGS_PATH)) {
      const raw = readFileSync(SETTINGS_PATH, "utf-8");
      const parsed = JSON.parse(raw) as Partial<TuiSettings>;
      return {
        capital: parsed.capital ?? DEFAULT_SETTINGS.capital,
        defaultSymbols: parsed.defaultSymbols ?? DEFAULT_SETTINGS.defaultSymbols,
      };
    }
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: TuiSettings): void {
  atomicWriteJson(SETTINGS_PATH, settings);
}

export function useSettings(): [TuiSettings, SettingsActions] {
  const [settings, setSettings] = useState<TuiSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const setCapital = useCallback((capital: number) => {
    setSettings((prev) => {
      const next = { ...prev, capital };
      saveSettings(next);
      return next;
    });
  }, []);

  const toggleSymbol = useCallback((symbol: string) => {
    setSettings((prev) => {
      const syms = new Set(prev.defaultSymbols);
      if (syms.has(symbol)) {
        syms.delete(symbol);
      } else {
        syms.add(symbol);
      }
      const next = { ...prev, defaultSymbols: [...syms] };
      saveSettings(next);
      return next;
    });
  }, []);

  const deleteOverride = useCallback((strategyId: string): boolean => {
    return removeOverride(strategyId);
  }, []);

  return [settings, { setCapital, toggleSymbol, deleteOverride }];
}
