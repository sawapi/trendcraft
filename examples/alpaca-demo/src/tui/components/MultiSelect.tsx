/**
 * MultiSelect — reusable multi-select list component
 *
 * Displays a list of items with checkboxes. When focused, accepts keyboard
 * input for navigation (up/down) and toggling (space).
 */

import { Box, Text, useInput } from "ink";
import type React from "react";

type MultiSelectProps = {
  items: string[];
  selected: Set<string>;
  focused: boolean;
  cursor: number;
  onToggle: (item: string) => void;
  onCursorChange: (cursor: number) => void;
  label?: string;
};

export function MultiSelect({
  items,
  selected,
  focused,
  cursor,
  onToggle,
  onCursorChange,
  label,
}: MultiSelectProps): React.ReactElement {
  useInput(
    (input, key) => {
      if (!focused) return;

      if (key.upArrow) {
        onCursorChange(Math.max(0, cursor - 1));
      }
      if (key.downArrow) {
        onCursorChange(Math.min(items.length - 1, cursor + 1));
      }
      if (input === " ") {
        const item = items[cursor];
        if (item) onToggle(item);
      }
    },
    { isActive: focused },
  );

  return (
    <Box flexDirection="column">
      {label && (
        <Text bold color={focused ? "cyan" : "white"}>
          {label}
        </Text>
      )}
      {items.map((item, i) => {
        const checked = selected.has(item);
        const isCursor = focused && i === cursor;
        return (
          <Box key={item}>
            <Text color={isCursor ? "cyan" : "white"}>
              {isCursor ? "> " : "  "}
              {checked ? "[x]" : "[ ]"} {item}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
