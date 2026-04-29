/**
 * Theme types and built-in themes
 */

export type ThemeColors = {
  background: string;
  text: string;
  textSecondary: string;
  grid: string;
  border: string;
  crosshair: string;
  upColor: string;
  downColor: string;
  upWick: string;
  downWick: string;
  volumeUp: string;
  volumeDown: string;
};

export const DARK_THEME: ThemeColors = {
  background: "#131722",
  text: "#d1d4dc",
  textSecondary: "#787b86",
  grid: "#1e222d",
  border: "#2a2e39",
  crosshair: "#758696",
  upColor: "#26a69a",
  downColor: "#ef5350",
  upWick: "#26a69a",
  downWick: "#ef5350",
  volumeUp: "rgba(38,166,154,0.3)",
  volumeDown: "rgba(239,83,80,0.3)",
};

export const LIGHT_THEME: ThemeColors = {
  background: "#ffffff",
  text: "#131722",
  textSecondary: "#787b86",
  grid: "#f0f3fa",
  border: "#e0e3eb",
  crosshair: "#9598a1",
  upColor: "#26a69a",
  downColor: "#ef5350",
  upWick: "#26a69a",
  downWick: "#ef5350",
  volumeUp: "rgba(38,166,154,0.3)",
  volumeDown: "rgba(239,83,80,0.3)",
};
