/**
 * TabBar — function key tab navigation
 */

import { Box, Text } from "ink";
import type React from "react";

export type Tab = {
  key: string;
  label: string;
};

type TabBarProps = {
  tabs: Tab[];
  activeIndex: number;
};

export function TabBar({ tabs, activeIndex }: TabBarProps): React.ReactElement {
  return (
    <Box>
      {tabs.map((tab, i) => (
        <Box key={tab.key} marginRight={1}>
          <Text bold={i === activeIndex} color={i === activeIndex ? "cyan" : "gray"}>
            [{tab.key}:{tab.label}]
          </Text>
        </Box>
      ))}
      <Box marginLeft={1}>
        <Text color="red">[q:Quit]</Text>
      </Box>
    </Box>
  );
}
