import { createChart } from "@trendcraft/chart";
import { bollingerBands, ichimoku, macd, rsi, sma } from "trendcraft";
import sampleData from "../data.json";

const candles = sampleData;
const container = document.getElementById("chart-container");
const statusEl = document.getElementById("status");
if (!container || !statusEl) throw new Error("Missing DOM elements");

// Create chart
const chart = createChart(container, { theme: "dark", watermark: "SAMPLE" });
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

// Drawing tools
let hlineId = 0;
document.getElementById("btn-hline")?.addEventListener("click", () => {
  // Add horizontal line at the median visible price
  const range = chart.getVisibleRange();
  if (!range) return;
  const midIdx = Math.floor((range.startIndex + range.endIndex) / 2);
  const midCandle = candles[midIdx];
  if (!midCandle) return;
  chart.addDrawing({
    id: `hline_${hlineId++}`,
    type: "hline",
    price: midCandle.close,
    color: "#FF9800",
  });
});

let currentFibId: string | null = null;
document.getElementById("btn-fib")?.addEventListener("click", () => {
  // Remove previous fib before adding new one
  if (currentFibId) chart.removeDrawing(currentFibId);

  const range = chart.getVisibleRange();
  if (!range) return;
  const start = Math.max(0, range.startIndex);
  const end = Math.min(candles.length - 1, range.endIndex);
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  let lowTime = candles[start].time;
  let highTime = candles[end].time;
  for (let i = start; i <= end; i++) {
    if (candles[i].low < low) {
      low = candles[i].low;
      lowTime = candles[i].time;
    }
    if (candles[i].high > high) {
      high = candles[i].high;
      highTime = candles[i].time;
    }
  }
  currentFibId = `fib_${Date.now()}`;
  chart.addDrawing({
    id: currentFibId,
    type: "fibRetracement",
    startTime: lowTime,
    startPrice: low,
    endTime: highTime,
    endPrice: high,
  });
});

document.getElementById("btn-fit")?.addEventListener("click", () => chart.fitContent());

let isDark = true;
document.getElementById("btn-theme")?.addEventListener("click", (e) => {
  isDark = !isDark;
  chart.setTheme(isDark ? "dark" : "light");
  document.body.style.background = isDark ? "#0a0e17" : "#f5f5f5";
  document.body.style.color = isDark ? "#d1d4dc" : "#131722";
  (e.target as HTMLButtonElement).textContent = isDark ? "Light Theme" : "Dark Theme";
});
