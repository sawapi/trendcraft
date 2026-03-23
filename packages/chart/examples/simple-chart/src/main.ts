import { createChart } from "@trendcraft/chart";
import { bollingerBands, ichimoku, macd, rsi, sma } from "trendcraft";
import sampleData from "../data.json";

const candles = sampleData;
const container = document.getElementById("chart-container");
const statusEl = document.getElementById("status");
if (!container || !statusEl) throw new Error("Missing DOM elements");

// Create chart
const chart = createChart(container, { theme: "dark" });
chart.setCandles(candles);
chart.fitContent();

statusEl.textContent = `Sample Daily — ${candles.length} candles loaded`;

// Indicator state
type HandleRef = { value: ReturnType<typeof chart.addIndicator> | null };

const smaRef: HandleRef = {
  value: chart.addIndicator(sma(candles, { period: 20 })),
};
const bbRef: HandleRef = { value: null };
const ichimokuRef: HandleRef = { value: null };
const rsiRef: HandleRef = { value: null };
const macdRef: HandleRef = { value: null };

function toggle(
  btnId: string,
  ref: HandleRef,
  create: () => ReturnType<typeof chart.addIndicator>,
) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (ref.value) {
      ref.value.remove();
      ref.value = null;
      btn.classList.remove("active");
    } else {
      ref.value = create();
      btn.classList.add("active");
    }
  });
}

toggle("btn-sma", smaRef, () => chart.addIndicator(sma(candles, { period: 20 })));
toggle("btn-bb", bbRef, () => chart.addIndicator(bollingerBands(candles)));
toggle("btn-ichimoku", ichimokuRef, () => chart.addIndicator(ichimoku(candles)));
toggle("btn-rsi", rsiRef, () => chart.addIndicator(rsi(candles)));
toggle("btn-macd", macdRef, () => chart.addIndicator(macd(candles)));

document.getElementById("btn-fit")?.addEventListener("click", () => chart.fitContent());

let isDark = true;
document.getElementById("btn-theme")?.addEventListener("click", (e) => {
  isDark = !isDark;
  chart.setTheme(isDark ? "dark" : "light");
  document.body.style.background = isDark ? "#0a0e17" : "#f5f5f5";
  document.body.style.color = isDark ? "#d1d4dc" : "#131722";
  (e.target as HTMLButtonElement).textContent = isDark ? "Light Theme" : "Dark Theme";
});
