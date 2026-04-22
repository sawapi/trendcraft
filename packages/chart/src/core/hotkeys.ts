/**
 * Keyboard shortcut handling.
 *
 * We match on `KeyboardEvent.code` instead of `key` because macOS Option+letter produces
 * altered characters (e.g. Option+H → "˙") that break `key`-based matching,
 * while `code` stays stable across platforms.
 */

import type { HotkeyAction } from "./types";

export type HotkeyMap = Partial<Record<string, HotkeyAction>>;

/** Default shortcut bindings. */
export const DEFAULT_HOTKEYS: HotkeyMap = {
  "Alt+KeyH": "hline",
  "Alt+KeyV": "vline",
  "Alt+KeyT": "trendline",
  "Alt+KeyF": "fibRetracement",
  "Alt+KeyC": "channel",
  Escape: "cancel",
  "Ctrl+Alt+KeyH": "toggleOverlays",
};

/**
 * Build a normalized key string from a KeyboardEvent.
 * Ctrl and Meta (Cmd on macOS) are treated as equivalent so Ctrl+Alt+H works
 * as Cmd+Option+H on macOS without needing a second entry in the map.
 */
export function eventToHotkey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  // Escape has no modifiers — use the bare key name to match the default map.
  if (e.code === "Escape") return "Escape";
  parts.push(e.code);
  return parts.join("+");
}

/** Resolve a keyboard event to an action via the provided (or default) map. */
export function resolveHotkey(
  e: KeyboardEvent,
  map: HotkeyMap = DEFAULT_HOTKEYS,
): HotkeyAction | undefined {
  return map[eventToHotkey(e)];
}
