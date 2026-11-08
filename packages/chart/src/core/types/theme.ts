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
  /**
   * Whether this is a dark or a light theme. It picks the built-in palette
   * and semantic colours when `palette` or `semantic` is not given. When it
   * is omitted, the chart reads it from `background`; a background it cannot
   * read as an opaque colour (`transparent`, a colour with alpha, a CSS
   * variable) counts as dark, with a warning.
   */
  mode?: "dark" | "light";
  /**
   * Colours for series without a colour of their own, in the order they are
   * handed out. A series gets the token `"@palette.N"`, so switching to a
   * theme with another palette recolours it. Defaults to the built-in
   * palette for the theme's mode.
   */
  palette?: readonly string[];
  /**
   * Colours that presets and series refer to by name, such as `"@loss"`.
   * Any name left out takes the built-in colour for the theme's mode.
   */
  semantic?: Partial<SemanticColors>;
};

/**
 * Colours with a meaning, referred to as `"@profit"`, `"@loss"` and so on.
 * Unlike `"@up"` and `"@down"`, which are the candle colours, profit and
 * loss do not follow `upColor` / `downColor`: a stop or a target line stays
 * apart from the candles whatever colours they have.
 */
export type SemanticColors = {
  /** A level or area on the profit side (a take-profit level) */
  profit: string;
  /** A second profit-side line, told apart from `profit` by shade */
  profitSoft: string;
  /** A level or area on the loss side (a stop level) */
  loss: string;
  /** A second loss-side line, told apart from `loss` by shade */
  lossSoft: string;
  /** A state that is neither (a sideways regime) */
  neutral: string;
};

/**
 * A colour token, resolved against the current theme when the chart draws.
 * Any colour option of a series accepts one in place of a CSS colour.
 */
export type ThemeColorToken = "@up" | "@down" | `@${keyof SemanticColors}` | `@palette.${number}`;

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
