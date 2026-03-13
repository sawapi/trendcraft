/**
 * KeyHint — display available keyboard shortcuts
 */

import { Box, Text } from "ink";
import type React from "react";

type KeyHintProps = {
  hints: { key: string; action: string }[];
};

export function KeyHint({ hints }: KeyHintProps): React.ReactElement {
  return (
    <Box>
      {hints.map((h, i) => (
        <Box key={h.key} marginRight={2}>
          <Text color="yellow">{h.key}</Text>
          <Text color="gray">:{h.action}</Text>
        </Box>
      ))}
    </Box>
  );
}
