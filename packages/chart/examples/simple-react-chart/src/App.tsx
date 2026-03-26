import { definePrimitive, defineSeriesRenderer } from "@trendcraft/chart";
import { TrendChart } from "@trendcraft/chart/react";
import { useMemo, useState } from "react";
import {
  bollingerBands,
  goldenCrossCondition,
  macd,
  normalizeCandles,
  rsi,
  rsiBelow,
  runBacktest,
  sma,
} from "trendcraft";
import sampleData from "../../simple-chart/data.json";

// --- Plugin: S/R Zone Primitive ---
const srZonePrimitive = definePrimitive({
  name: "srZones",
  pane: "main",
  zOrder: "below",
  defaultState: { zones: [] as { price: number; height: number; color: string }[] },
  render: ({ draw }, state) => {
    for (const zone of state.zones) {
      draw.rect(
        draw.startIndex,
        zone.price + zone.height / 2,
        draw.endIndex - draw.startIndex,
        zone.price - zone.height / 2,
        { color: zone.color },
      );
    }
  },
});

// --- Plugin: Trailing Stop Renderer ---
const trailRenderer = defineSeriesRenderer({
  type: "trailingStop",
  render: ({ draw, series }) => {
    draw.scope((ctx) => {
      ctx.strokeStyle = series.config.color ?? "#FF9800";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      let moved = false;
      for (let i = draw.startIndex; i < draw.endIndex && i < series.data.length; i++) {
        const val = series.data[i]?.value as number | null;
        if (val === null || val === undefined) continue;
        if (!moved) {
          ctx.moveTo(draw.x(i), draw.y(val));
          moved = true;
        } else {
          const prev = (series.data[i - 1]?.value as number) ?? val;
          ctx.lineTo(draw.x(i), draw.y(prev));
          ctx.lineTo(draw.x(i), draw.y(val));
        }
      }
      ctx.stroke();
    });
  },
  priceRange: (series, start, end) => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = start; i <= end && i < series.data.length; i++) {
      const v = series.data[i]?.value as number | null;
      if (v != null) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return [min, max];
  },
  formatValue: (series, index) => {
    const v = series.data[index]?.value as number | null;
    return v != null ? `Trail: ${v.toFixed(2)}` : null;
  },
});

function computeTrailingStop(candles: typeof sampleData) {
  const period = 20;
  const atrPeriod = 14;
  return candles.map((c, i) => {
    if (i < Math.max(period, atrPeriod)) return { time: c.time, value: null };
    let hh = Number.NEGATIVE_INFINITY;
    for (let j = i - period + 1; j <= i; j++) if (candles[j].high > hh) hh = candles[j].high;
    let atrSum = 0;
    for (let j = i - atrPeriod + 1; j <= i; j++) {
      atrSum += Math.max(
        candles[j].high - candles[j].low,
        Math.abs(candles[j].high - candles[j - 1].close),
        Math.abs(candles[j].low - candles[j - 1].close),
      );
    }
    return { time: c.time, value: hh - 2 * (atrSum / atrPeriod) };
  });
}

export function App() {
  const candles = sampleData;
  const [showSma, setShowSma] = useState(true);
  const [showBb, setShowBb] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [showMacd, setShowMacd] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [showSrZones, setShowSrZones] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const indicators = useMemo(() => {
    const list: { time: number; value: unknown }[][] = [];
    if (showSma) list.push(sma(candles, { period: 20 }));
    if (showBb) list.push(bollingerBands(candles));
    if (showRsi) list.push(rsi(candles));
    if (showMacd) list.push(macd(candles));
    if (showTrail) list.push(computeTrailingStop(candles));
    return list;
  }, [showSma, showBb, showRsi, showMacd, showTrail, candles]);

  const backtestResult = useMemo(() => {
    if (!showBacktest) return undefined;
    const normalized = normalizeCandles(candles);
    return runBacktest(normalized, goldenCrossCondition(), rsiBelow(70), { capital: 100000 });
  }, [showBacktest, candles]);

  // Compute S/R zones
  const plugins = useMemo(() => {
    if (!showSrZones) return { renderers: [trailRenderer] };
    const recent = candles.slice(-60);
    let high = Number.NEGATIVE_INFINITY;
    let low = Number.POSITIVE_INFINITY;
    for (const c of recent) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
    }
    const h = (high - low) * 0.02;
    srZonePrimitive.defaultState = {
      zones: [
        { price: high, height: h, color: "rgba(239,83,80,0.15)" },
        { price: low, height: h, color: "rgba(38,166,154,0.15)" },
      ],
    };
    return { renderers: [trailRenderer], primitives: [srZonePrimitive] };
  }, [showSrZones, candles]);

  return (
    <>
      <header
        style={{
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          background: "#131722",
          borderBottom: "1px solid #2a2e39",
        }}
      >
        <h1 style={{ fontSize: 14, fontWeight: 600 }}>React Demo</h1>
        <span
          style={{
            fontSize: 10,
            background: "#4caf50",
            color: "#fff",
            padding: "2px 6px",
            borderRadius: 3,
          }}
        >
          React
        </span>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto", flexWrap: "wrap" }}>
          <Btn active={showSma} onClick={() => setShowSma(!showSma)}>
            SMA 20
          </Btn>
          <Btn active={showBb} onClick={() => setShowBb(!showBb)}>
            BB
          </Btn>
          <Btn active={showRsi} onClick={() => setShowRsi(!showRsi)}>
            RSI
          </Btn>
          <Btn active={showMacd} onClick={() => setShowMacd(!showMacd)}>
            MACD
          </Btn>
          <Btn active={showBacktest} onClick={() => setShowBacktest(!showBacktest)}>
            Backtest
          </Btn>
          <Btn active={showSrZones} onClick={() => setShowSrZones(!showSrZones)}>
            S/R Zones
          </Btn>
          <Btn active={showTrail} onClick={() => setShowTrail(!showTrail)}>
            Trail Stop
          </Btn>
          <Btn active={false} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "Light" : "Dark"}
          </Btn>
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <TrendChart
          candles={candles}
          indicators={indicators}
          backtest={backtestResult}
          plugins={plugins}
          theme={theme}
          options={{ watermark: "REACT" }}
        />
      </div>
    </>
  );
}

function Btn({
  active,
  onClick,
  children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 8px",
        fontSize: 11,
        background: active ? "#2196F3" : "#1e222d",
        color: active ? "#fff" : "#d1d4dc",
        border: `1px solid ${active ? "#2196F3" : "#2a2e39"}`,
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
