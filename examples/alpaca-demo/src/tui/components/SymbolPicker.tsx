/**
 * SymbolPicker — source selector + sector filter + scrollable symbol multi-select
 *
 * Combines useSymbolSource with a paginated MultiSelect so users can browse
 * thousands of SEC universe symbols without overwhelming the terminal.
 */

import { Box, Text, useInput } from "ink";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { SymbolSourceActions, SymbolSourceState } from "../hooks/useSymbolSource.js";
import { SYMBOL_SOURCES } from "../hooks/useSymbolSource.js";

const DEFAULT_PAGE_SIZE = 10;

type SymbolPickerProps = {
  symbolSource: SymbolSourceState;
  symbolSourceActions: SymbolSourceActions;
  selected: Set<string>;
  onToggle: (symbol: string) => void;
  focused: boolean;
  /** Maximum visible rows for the symbol list */
  maxListRows?: number;
};

export function SymbolPicker({
  symbolSource,
  symbolSourceActions,
  selected,
  onToggle,
  focused,
  maxListRows,
}: SymbolPickerProps): React.ReactElement {
  const { source, sector, sectors, symbols } = symbolSource;
  const [cursor, setCursor] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Overhead: header(1) + above/below hints(2) + search(0-1) + selected(0-1)
  const overhead = 3 + (searchQuery ? 1 : 0) + (selected.size > 0 ? 1 : 0);
  const pageSize = Math.max(3, (maxListRows ?? DEFAULT_PAGE_SIZE) - overhead);

  // Filter symbols by search query
  const filteredSymbols = useMemo(() => {
    if (!searchQuery) return symbols;
    const q = searchQuery.toUpperCase();
    return symbols.filter((s) => s.includes(q));
  }, [symbols, searchQuery]);

  // Reset cursor when source/sector/search changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on value changes
  useEffect(() => {
    setCursor(0);
  }, [source, sector, searchQuery]);

  // Paginated view
  const pageStart = Math.max(
    0,
    Math.min(cursor - Math.floor(pageSize / 2), filteredSymbols.length - pageSize),
  );
  const visibleStart = Math.max(0, pageStart);
  const visibleSymbols = filteredSymbols.slice(visibleStart, visibleStart + pageSize);

  const sourceLabel = SYMBOL_SOURCES.find((s) => s.id === source)?.label ?? source;
  const sectorLabel = sector ? (sectors.find((s) => s.id === sector)?.label ?? sector) : "All";

  useInput(
    (input, key) => {
      if (!focused) return;

      // Source switching (n key — Tab is reserved for panel switching)
      if (input === "n") {
        symbolSourceActions.nextSource();
        setSearchQuery("");
        return;
      }

      // Sector cycling (SEC only)
      if (source === "sec") {
        if (key.leftArrow) {
          symbolSourceActions.prevSector();
          return;
        }
        if (key.rightArrow) {
          symbolSourceActions.nextSector();
          return;
        }
      }

      // Navigation
      if (key.upArrow) {
        setCursor((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setCursor((prev) => Math.min(filteredSymbols.length - 1, prev + 1));
        return;
      }

      // Toggle selection
      if (input === " ") {
        const sym = filteredSymbols[cursor];
        if (sym) onToggle(sym);
        return;
      }

      // Search input (alphanumeric)
      if (input === "/" || (searchQuery && key.backspace)) {
        if (key.backspace) {
          setSearchQuery((prev) => prev.slice(0, -1));
        } else if (input === "/") {
          setSearchQuery("");
        }
        return;
      }

      // Type to search
      if (/^[a-zA-Z0-9]$/.test(input) && input !== " ") {
        if (!"12345qQ".includes(input)) {
          setSearchQuery((prev) => prev + input.toUpperCase());
        }
      }

      // Backspace for search
      if (key.backspace && searchQuery) {
        setSearchQuery((prev) => prev.slice(0, -1));
      }
    },
    { isActive: focused },
  );

  // Truncate selected display to avoid overflow
  const selectedDisplay = [...selected].join(", ");
  const truncatedSelected =
    selectedDisplay.length > 60
      ? `${selectedDisplay.slice(0, 57)}... (${selected.size})`
      : selectedDisplay;

  return (
    <Box flexDirection="column">
      {/* Source + filter header */}
      <Box gap={2}>
        <Text bold color={focused ? "cyan" : "gray"}>
          Symbols
        </Text>
        <Text color="gray">
          Source: <Text color="yellow">{sourceLabel}</Text>
        </Text>
        {source === "sec" && (
          <Text color="gray">
            Sector: <Text color="yellow">{sectorLabel}</Text>
          </Text>
        )}
        <Text color="gray">({filteredSymbols.length})</Text>
      </Box>

      {/* Search indicator */}
      {searchQuery && (
        <Text color="yellow">
          Search: {searchQuery}
          <Text color="gray"> (Backspace to clear)</Text>
        </Text>
      )}

      {/* Symbol list (paginated) */}
      {filteredSymbols.length === 0 ? (
        <Text color="gray">{searchQuery ? "No matches." : "No symbols available."}</Text>
      ) : (
        <Box flexDirection="column">
          {visibleStart > 0 && (
            <Text color="gray">
              {"  "}... {visibleStart} more above
            </Text>
          )}
          {visibleSymbols.map((sym, i) => {
            const globalIdx = visibleStart + i;
            const isCursor = focused && globalIdx === cursor;
            const checked = selected.has(sym);
            return (
              <Box key={sym}>
                <Text color={isCursor ? "cyan" : "white"}>
                  {isCursor ? "> " : "  "}
                  {checked ? "[x]" : "[ ]"} {sym}
                </Text>
              </Box>
            );
          })}
          {visibleStart + pageSize < filteredSymbols.length && (
            <Text color="gray">
              {"  "}... {filteredSymbols.length - visibleStart - pageSize} more below
            </Text>
          )}
        </Box>
      )}

      {/* Selected summary */}
      {selected.size > 0 && <Text color="green">Selected: {truncatedSelected}</Text>}
    </Box>
  );
}
