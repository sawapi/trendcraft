/**
 * Settings view — interactive strategy parameters, capital, symbols, and override management
 */

import { Box, Text, useInput } from "ink";
import type React from "react";
import { useState } from "react";
import { DEFAULT_SYMBOLS } from "../../config/symbols.js";
import { loadOverrides } from "../../review/applier.js";
import { getAllStrategies } from "../../strategy/registry.js";
import { PRESET_TEMPLATES } from "../../strategy/template.js";
import { KeyHint } from "../components/KeyHint.js";
import { MultiSelect } from "../components/MultiSelect.js";
import type { SettingsActions, TuiSettings } from "../hooks/useSettings.js";

const CAPITAL_PRESETS = [50000, 100000, 200000, 500000];

type Section = "capital" | "symbols" | "overrides";

type SettingsProps = {
  settings: TuiSettings;
  actions: SettingsActions;
};

export function Settings({ settings, actions }: SettingsProps): React.ReactElement {
  const strategies = getAllStrategies();
  const overrides = loadOverrides();

  const [section, setSection] = useState<Section>("capital");
  const [symbolCursor, setSymbolCursor] = useState(0);
  const [overrideCursor, setOverrideCursor] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const capitalIndex = CAPITAL_PRESETS.indexOf(settings.capital);

  useInput((input, key) => {
    // Section switching with tab
    if (key.tab || input === "n") {
      setSection((prev) => {
        if (prev === "capital") return "symbols";
        if (prev === "symbols") return "overrides";
        return "capital";
      });
      setDeleteConfirm(null);
      return;
    }

    if (section === "capital") {
      if (key.leftArrow) {
        const idx = Math.max(0, capitalIndex - 1);
        actions.setCapital(CAPITAL_PRESETS[idx]);
      }
      if (key.rightArrow) {
        const idx = Math.min(CAPITAL_PRESETS.length - 1, capitalIndex + 1);
        actions.setCapital(CAPITAL_PRESETS[idx]);
      }
    }

    if (section === "overrides" && overrides.length > 0) {
      if (key.upArrow) {
        setOverrideCursor((prev) => Math.max(0, prev - 1));
        setDeleteConfirm(null);
      }
      if (key.downArrow) {
        setOverrideCursor((prev) => Math.min(overrides.length - 1, prev + 1));
        setDeleteConfirm(null);
      }
      if (key.delete || input === "x") {
        const override = overrides[overrideCursor];
        if (override) {
          if (deleteConfirm === override.strategyId) {
            actions.deleteOverride(override.strategyId);
            setDeleteConfirm(null);
            setOverrideCursor((prev) => Math.min(prev, overrides.length - 2));
          } else {
            setDeleteConfirm(override.strategyId);
          }
        }
      }
    }
  });

  const handleSymbolToggle = (symbol: string) => {
    actions.toggleSymbol(symbol);
  };

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {" "}
          Settings{" "}
        </Text>
      </Box>

      {/* Capital section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={section === "capital" ? "cyan" : "white"}>
          Capital per Agent
        </Text>
        <Box marginTop={1} gap={2}>
          {CAPITAL_PRESETS.map((preset) => {
            const isActive = settings.capital === preset;
            return (
              <Box key={preset}>
                <Text color={isActive ? "cyan" : "gray"} bold={isActive}>
                  {isActive ? "[" : " "}${preset.toLocaleString()}
                  {isActive ? "]" : " "}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Default symbols section */}
      <Box flexDirection="column" marginBottom={1}>
        <MultiSelect
          items={DEFAULT_SYMBOLS}
          selected={new Set(settings.defaultSymbols)}
          focused={section === "symbols"}
          cursor={symbolCursor}
          onToggle={handleSymbolToggle}
          onCursorChange={setSymbolCursor}
          label="Default Symbols"
        />
      </Box>

      {/* Active overrides section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={section === "overrides" ? "cyan" : "white"}>
          Active Overrides ({overrides.length})
        </Text>
        {overrides.length === 0 ? (
          <Text color="gray"> No active overrides.</Text>
        ) : (
          overrides.map((o, i) => {
            const isCursor = section === "overrides" && i === overrideCursor;
            const isDeleteTarget = deleteConfirm === o.strategyId;
            return (
              <Box key={i} flexDirection="column">
                <Text color={isCursor ? "cyan" : "yellow"}>
                  {isCursor ? "> " : "  "}
                  {o.strategyId}
                  {isDeleteTarget && <Text color="red"> [press x again to delete]</Text>}
                </Text>
                {o.overrides && (
                  <Text color="gray">
                    {"    "}Overrides: {JSON.stringify(o.overrides).slice(0, 80)}
                  </Text>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {/* Strategies overview */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Registered Strategies ({strategies.length})</Text>
        {strategies.map((s) => (
          <Box key={s.id}>
            <Text>
              {"  "}
              {s.id.padEnd(30)} <Text color="gray">interval: {s.intervalMs}ms</Text>
            </Text>
          </Box>
        ))}
      </Box>

      {/* Preset template count */}
      <Box marginBottom={1}>
        <Text>
          Preset Templates: <Text bold>{PRESET_TEMPLATES.length}</Text>
        </Text>
      </Box>

      {/* Key hints */}
      <Box marginTop={1}>
        <KeyHint
          hints={
            section === "capital"
              ? [
                  { key: "Left/Right", action: "Change capital" },
                  { key: "Tab/n", action: "Next section" },
                ]
              : section === "symbols"
                ? [
                    { key: "Space", action: "Toggle symbol" },
                    { key: "Up/Down", action: "Navigate" },
                    { key: "Tab/n", action: "Next section" },
                  ]
                : [
                    { key: "x", action: "Delete override" },
                    { key: "Up/Down", action: "Navigate" },
                    { key: "Tab/n", action: "Next section" },
                  ]
          }
        />
      </Box>
    </Box>
  );
}
