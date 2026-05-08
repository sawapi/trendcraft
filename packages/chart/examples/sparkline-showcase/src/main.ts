import {
  type ColorSpec,
  createSparklineGroup,
  type SparklineCandle,
  type SparklineGroup,
  type SparklineOptions,
} from "@trendcraft/chart/sparkline";

type Ticker = {
  symbol: string;
  name: string;
  closes: number[];
  candles: SparklineCandle[];
  last: number;
  change: number;
  changePct: number;
};

const FIRST = ["AAPL", "MSFT", "GOOG", "AMZN", "META", "NVDA", "TSLA", "JPM", "V", "WMT"];
const SUFFIX = ["A", "B", "C", "X", "Y", "Z"];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function makeTicker(i: number, len: number, timestamps?: number[]): Ticker {
  const r = rng(i + 1);
  const drift = (r() - 0.5) * 0.0015;
  const vol = 0.005 + r() * 0.012;
  const price = 100 + r() * 50;
  const closes: number[] = [];
  const candles: SparklineCandle[] = [];
  let prev = price;
  for (let t = 0; t < len; t++) {
    const ret = drift + (r() - 0.5) * vol;
    const open = prev;
    const close = open * (1 + ret);
    const hi = Math.max(open, close) * (1 + r() * vol * 0.4);
    const lo = Math.min(open, close) * (1 - r() * vol * 0.4);
    closes.push(close);
    const time = timestamps ? timestamps[t] : t;
    candles.push({ time, open, high: hi, low: lo, close, volume: 0 });
    prev = close;
  }
  const symbol =
    i < FIRST.length ? FIRST[i] : `T${i.toString().padStart(3, "0")}${SUFFIX[i % SUFFIX.length]}`;
  const last = closes[closes.length - 1];
  const first = closes[0];
  return {
    symbol,
    name: `${symbol} Holdings, Inc.`,
    closes,
    candles,
    last,
    change: last - first,
    changePct: ((last - first) / first) * 100,
  };
}

function fmtPrice(v: number): string {
  return v.toFixed(2);
}

function fmtChange(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

const root = document.getElementById("root") as HTMLElement;
const statsEl = document.getElementById("stats") as HTMLElement;
const modeSel = document.getElementById("mode") as HTMLSelectElement;
const colorSel = document.getElementById("color") as HTMLSelectElement;
const countSel = document.getElementById("count") as HTMLSelectElement;
const sessionSel = document.getElementById("session") as HTMLSelectElement;
const regenBtn = document.getElementById("regen") as HTMLButtonElement;

let group: SparklineGroup | null = null;
let regenSeed = 0;

function colorSpec(_mode: "line" | "candle"): ColorSpec {
  const v = colorSel.value;
  if (v === "fixed") return { fixed: "#60a5fa" };
  if (v === "baseline") return { baseline: 100 };
  return { trend: v as "auto" | "period" };
}

function render() {
  if (group) {
    group.destroy();
    group = null;
  }
  root.innerHTML = "";

  const t0 = performance.now();
  const count = Number(countSel.value);
  const sessionMode = sessionSel.value;
  const useJpx = sessionMode === "jpx";

  // JPX session: 09:00-15:30 with 11:30-12:30 lunch break (5h active).
  // 30 morning bars (09:00..11:25, 5min) + 37 afternoon bars (12:30..15:30, 5min) = 67.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const at = (h: number, m: number) => today.getTime() + (h * 60 + m) * 60_000;
  const jpxTimestamps: number[] = [];
  for (let m = 0; m < 150; m += 5) jpxTimestamps.push(at(9, m));
  for (let m = 0; m <= 180; m += 5) jpxTimestamps.push(at(12, 30 + m));
  const jpxSession = {
    start: at(9, 0),
    end: at(15, 30),
    breaks: [{ start: at(11, 30), end: at(12, 30) }],
  };

  const len = useJpx ? jpxTimestamps.length : 60;
  const tickers = Array.from({ length: count }, (_, i) =>
    makeTicker(i + regenSeed * count, len, useJpx ? jpxTimestamps : undefined),
  );

  group = createSparklineGroup({ container: root, hover: true });

  const groupEl = document.createElement("div");
  groupEl.className = "group";
  const header = document.createElement("div");
  header.className = "group-header";
  header.textContent = `${tickers.length} tickers`;
  groupEl.appendChild(header);

  const mode = modeSel.value as "line" | "candle";
  const cspec = colorSpec(mode);

  // Simulate intraday-so-far: data length stays the same, but totalSlots
  // pretends the session is longer so the right side is blank.
  const totalSlots = sessionMode === "mid" ? 60 / 0.4 : sessionMode === "late" ? 60 / 0.8 : 60;

  for (const t of tickers) {
    const row = document.createElement("div");
    row.className = "row";

    const sym = document.createElement("div");
    sym.innerHTML = `<div class="symbol">${t.symbol}</div><div class="name">${t.name}</div>`;

    const sparkWrap = document.createElement("div");
    const cv = document.createElement("canvas");
    cv.className = "spark";
    cv.style.width = "120px";
    cv.style.height = "32px";
    sparkWrap.appendChild(cv);

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = fmtPrice(t.last);

    const change = document.createElement("div");
    change.className = `change ${t.change >= 0 ? "up" : "down"}`;
    change.textContent = `${fmtChange(t.change)} (${fmtPct(t.changePct)})`;

    row.append(sym, sparkWrap, price, change);
    groupEl.appendChild(row);

    const opts: SparklineOptions = useJpx
      ? {
          type: mode,
          // session mode requires time-bearing data (Candle[]), so use
          // candles even in line mode (line picks up .close from candles).
          data: t.candles,
          color: cspec,
          fill: true,
          baseline: "auto",
          session: jpxSession,
        }
      : {
          type: mode,
          data: mode === "candle" ? t.candles : t.closes,
          color: cspec,
          fill: true,
          baseline: "auto",
          totalSlots: Math.round(totalSlots),
        };
    group.add(cv, opts);
  }

  root.appendChild(groupEl);

  const t1 = performance.now();
  statsEl.textContent = `Rendered ${tickers.length} sparklines in ${(t1 - t0).toFixed(1)} ms (${((t1 - t0) / tickers.length).toFixed(2)} ms/ea)`;
}

modeSel.addEventListener("change", render);
colorSel.addEventListener("change", render);
countSel.addEventListener("change", render);
sessionSel.addEventListener("change", render);
regenBtn.addEventListener("click", () => {
  regenSeed++;
  render();
});

render();
