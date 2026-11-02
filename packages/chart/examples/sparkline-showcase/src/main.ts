import {
  type ColorSpec,
  createSparklineGroup,
  type ResolvedColors,
  type SparklineCandle,
  type SparklineGroup,
  type SparklineHandle,
  type SparklineOptions,
} from "@trendcraft/chart/sparkline";

type Ticker = {
  symbol: string;
  closes: number[];
  candles: SparklineCandle[];
  last: number;
  change: number;
  changePct: number;
};

const FIRST = ["AAPL", "MSFT", "GOOG", "AMZN", "META", "NVDA", "TSLA", "JPM", "V", "WMT"];

// mulberry32: small, deterministic and well mixed even for consecutive small
// seeds. (A raw LCG seeded with 1, 2, 3, ... returns almost the same first draw
// for every seed, which made nearly every ticker drift down.)
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fictional tickers: two distinct syllables from this list ("KOVA", "ZIQU"),
// 24 × 23 = 552 symbols, shuffled once with a fixed seed. The syllables were
// chosen so that no pair spells a word. Index i maps to FICTIONAL[i % 552], so
// any 500 consecutive indices are unique, whatever the Regenerate seed.
const SYLLABLES = [
  ...["KO", "VA", "VO", "ZI", "ZU", "XA", "XI", "VU", "XO", "WI", "HU", "QO"],
  ...["QI", "YI", "WO", "RU", "MU", "QU", "QA", "QE", "JU", "YE", "WE", "ZE"],
];
const FICTIONAL: string[] = (() => {
  const out: string[] = [];
  for (const a of SYLLABLES) for (const b of SYLLABLES) if (a !== b) out.push(a + b);
  const r = rng(20240501);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
})();

function tickerSymbol(i: number): string {
  return i < FIRST.length ? FIRST[i] : FICTIONAL[i % FICTIONAL.length];
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
  const symbol = tickerSymbol(i);
  const last = closes[closes.length - 1];
  const first = closes[0];
  return {
    symbol,
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
const themeBtn = document.getElementById("theme") as HTMLButtonElement;

let group: SparklineGroup | null = null;
let handles: SparklineHandle[] = [];
let regenSeed = 0;

type Theme = "light" | "dark";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Sparkline palette taken from the page theme tokens. */
function themeColors(): Partial<ResolvedColors> {
  return { up: cssVar("--up"), down: cssVar("--down"), baseline: cssVar("--text-muted") };
}

function colorSpec(_mode: "line" | "candle"): ColorSpec {
  const v = colorSel.value;
  if (v === "fixed") return { fixed: cssVar("--accent") };
  if (v === "baseline") return { baseline: 100 };
  return { trend: v as "auto" | "period" };
}

function render() {
  if (group) {
    group.destroy();
    group = null;
  }
  handles = [];
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
  const rowsEl = document.createElement("div");
  rowsEl.className = "rows";
  groupEl.appendChild(rowsEl);
  const colors = themeColors();

  const mode = modeSel.value as "line" | "candle";
  const cspec = colorSpec(mode);

  // Simulate intraday-so-far: data length stays the same, but totalSlots
  // pretends the session is longer so the right side is blank.
  const totalSlots = sessionMode === "mid" ? 60 / 0.4 : sessionMode === "late" ? 60 / 0.8 : 60;

  for (const t of tickers) {
    const row = document.createElement("div");
    row.className = "row";

    const sym = document.createElement("div");
    sym.className = "symbol";
    sym.textContent = t.symbol;

    const sparkWrap = document.createElement("div");
    const cv = document.createElement("canvas");
    cv.className = "spark";
    sparkWrap.appendChild(cv);

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = fmtPrice(t.last);

    const change = document.createElement("div");
    change.className = `change ${t.change >= 0 ? "up" : "down"}`;
    change.textContent = `${fmtChange(t.change)} (${fmtPct(t.changePct)})`;

    row.append(sym, sparkWrap, price, change);
    rowsEl.appendChild(row);

    const opts: SparklineOptions = useJpx
      ? {
          type: mode,
          // session mode requires time-bearing data (Candle[]), so use
          // candles even in line mode (line picks up .close from candles).
          data: t.candles,
          color: cspec,
          colors,
          fill: true,
          baseline: "auto",
          session: jpxSession,
        }
      : {
          type: mode,
          data: mode === "candle" ? t.candles : t.closes,
          color: cspec,
          colors,
          fill: true,
          baseline: "auto",
          totalSlots: Math.round(totalSlots),
        };
    handles.push(group.add(cv, opts));
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

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  // The button names the theme it switches to.
  themeBtn.textContent = theme === "dark" ? "Light" : "Dark";
  const colors = themeColors();
  const fixed = colorSel.value === "fixed" ? { color: colorSpec("line") } : {};
  for (const h of handles) h.update({ colors, ...fixed });
}

themeBtn.addEventListener("click", () => {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
});

// The sparkline column stretches with the layout, so repaint when it resizes.
let resizeFrame = 0;
let rootWidth = 0;
new ResizeObserver(([entry]) => {
  const width = entry.contentRect.width;
  if (width === rootWidth) return;
  rootWidth = width;
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    for (const h of handles) h.render();
  });
}).observe(root);

applyTheme(currentTheme());
render();
