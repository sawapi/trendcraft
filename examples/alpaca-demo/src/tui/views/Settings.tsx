/**
 * Settings view — display strategy parameters and active overrides
 */

import { Box, Text } from "ink";
import type React from "react";
import { loadOverrides } from "../../review/applier.js";
import { getAllStrategies } from "../../strategy/registry.js";
import { PRESET_TEMPLATES } from "../../strategy/template.js";

export function Settings(): React.ReactElement {
  const strategies = getAllStrategies();
  const overrides = loadOverrides();

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {" "}
          Settings{" "}
        </Text>
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

      {/* Active overrides */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Active Overrides ({overrides.length})</Text>
        {overrides.length === 0 ? (
          <Text color="gray"> No active overrides.</Text>
        ) : (
          overrides.map((o, i) => (
            <Box key={i} flexDirection="column">
              <Text color="yellow">
                {"  "}
                {o.strategyId}
              </Text>
              {o.overrides && (
                <Text color="gray">
                  {"    "}Overrides: {JSON.stringify(o.overrides).slice(0, 80)}
                </Text>
              )}
            </Box>
          ))
        )}
      </Box>

      {/* Preset template count */}
      <Box>
        <Text>
          Preset Templates: <Text bold>{PRESET_TEMPLATES.length}</Text>
        </Text>
      </Box>
    </Box>
  );
}
