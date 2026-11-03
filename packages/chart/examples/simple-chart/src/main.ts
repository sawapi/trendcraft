/**
 * simple-chart: the smallest useful @trendcraft/chart app.
 *
 * 1. Create a chart and load candles.
 * 2. Add trendcraft indicators; the chart picks the pane and style from the
 *    series shape, so an overlay (SMA, Bollinger Bands) lands on the price
 *    pane and an oscillator (RSI, MACD) gets its own pane.
 * 3. Show a backtest, and switch between dark and light themes.
 */
import { createChart, type SeriesHandle } from "@trendcraft/chart";
import { registerBacktest } from "@trendcraft/chart/features";
import {
  bollingerBands,
  deadCrossCondition,
  goldenCrossCondition,
  macd,
  normalizeCandles,
  rsi,
  runBacktest,
  sma,
} from "trendcraft";
import candles from "../data.json";

// index.html sets data-theme from prefers-color-scheme before first paint.
let theme: "dark" | "light" = document.documentElement.dataset.theme === "light" ? "light" : "dark";

const container = document.getElementById("chart") as HTMLElement;
const chart = createChart(container, { theme });
// addBacktest is an optional feature, so its code stays out of apps that skip it
registerBacktest(chart);
chart.setCandles(candles);

// --- Indicators: each button adds a series and removes it again ---

const indicators: Record<string, () => SeriesHandle> = {
  // The optional second argument sets the style; here a colour that stands
  // apart from the Bollinger Bands' blue
  sma: () => chart.addIndicator(sma(candles, { period: 50 }), { color: "#ab47bc" }),
  bb: () => chart.addIndicator(bollingerBands(candles, { period: 20, stdDev: 2 })),
  rsi: () => chart.addIndicator(rsi(candles, { period: 14 })),
  macd: () => chart.addIndicator(macd(candles)),
};
const handles = new Map<string, SeriesHandle>();

function setIndicator(key: string, on: boolean): void {
  if (on) handles.set(key, indicators[key]());
  else {
    handles.get(key)?.remove();
    handles.delete(key);
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-indicator]")) {
  const key = button.dataset.indicator as string;
  if (button.getAttribute("aria-pressed") === "true") setIndicator(key, true);
  button.addEventListener("click", () => {
    const on = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(on));
    setIndicator(key, on);
  });
}

// --- Backtest: buy when SMA 5 crosses above SMA 25, sell when it crosses below ---

const backtestButton = document.getElementById("btn-backtest") as HTMLButtonElement;
backtestButton.addEventListener("click", () => {
  const on = backtestButton.getAttribute("aria-pressed") !== "true";
  backtestButton.setAttribute("aria-pressed", String(on));
  if (on) {
    const result = runBacktest(
      normalizeCandles(candles),
      goldenCrossCondition(5, 25),
      deadCrossCondition(5, 25),
      { capital: 100_000 },
    );
    // Trade markers on the price pane, an equity pane and a summary line
    chart.addBacktest(result);
  } else {
    chart.removeBacktest();
  }
});

// --- Theme ---

const themeButton = document.getElementById("btn-theme") as HTMLButtonElement;
const themeLabel = () => `Theme: ${theme === "dark" ? "Dark" : "Light"}`;
themeButton.textContent = themeLabel();
themeButton.addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  chart.setTheme(theme);
  themeButton.textContent = themeLabel();
});
