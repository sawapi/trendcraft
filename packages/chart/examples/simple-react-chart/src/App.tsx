import { definePrimitive, defineSeriesRenderer } from "@trendcraft/chart";
import { registerBacktest } from "@trendcraft/chart/features";
import { TrendChart } from "@trendcraft/chart/react";
import { useMemo, useState } from "react";
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
import sampleData from "../../simple-chart/data.json";
import { HookDemo } from "./HookDemo";

// --- Plugin: S/R Zone Primitive ---
// Support and resistance bands around the high and low of the last 60 bars
function srZones(): { price: number; height: number; color: string }[] {
  const recent = sampleData.slice(-60);
  let high = Number.NEGATIVE_INFINITY;
  let low = Number.POSITIVE_INFINITY;
  for (const c of recent) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  const h = (high - low) * 0.1;
  return [
    { price: high, height: h, color: "rgba(239,83,80,0.2)" },
    { price: low, height: h, color: "rgba(38,166,154,0.2)" },
  ];
}

const srZonePrimitive = definePrimitive({
  name: "srZones",
  pane: "main",
  zOrder: "below",
  // The sample data never changes, so the zones are worked out once here
  defaultState: { zones: srZones() },
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
  const [showVolOverlay, setShowVolOverlay] = useState(false);
  // index.html sets the initial theme from prefers-color-scheme before first paint.
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  const [view, setView] = useState<"component" | "hook">("component");

  const indicators = useMemo(() => {
    const list: (
      | { time: number; value: unknown }[]
      | {
          data: { time: number; value: unknown }[];
          config: import("@trendcraft/chart").SeriesConfig;
        }
    )[] = [];
    if (showSma) {
      // A colour that stands apart from the Bollinger Bands' blue
      list.push({ data: sma(candles, { period: 50 }), config: { color: "#ab47bc" } });
    }
    if (showBb) list.push(bollingerBands(candles));
    if (showRsi) list.push(rsi(candles));
    if (showMacd) list.push(macd(candles));
    if (showTrail) {
      // `type: "trailingStop"` routes the series to the custom renderer passed via `plugins`.
      list.push({
        data: computeTrailingStop(candles),
        config: { type: "trailingStop", pane: "main", color: "#FF9800", label: "Trail Stop" },
      });
    }
    if (showVolOverlay) {
      list.push({
        data: candles.map((c) => ({ time: c.time, value: c.volume })),
        config: {
          pane: "main",
          scaleId: "left",
          type: "histogram",
          maxHeightRatio: 0.2,
          // No `color`: bars follow each candle's direction in the theme's
          // volume colours, and the legend swatch takes the up colour
          label: "Volume",
        },
      });
    }
    return list;
  }, [showSma, showBb, showRsi, showMacd, showTrail, showVolOverlay]);

  const backtestResult = useMemo(() => {
    if (!showBacktest) return undefined;
    const normalized = normalizeCandles(candles);
    // Buy when SMA 5 crosses above SMA 25, sell when it crosses back below
    return runBacktest(normalized, goldenCrossCondition(5, 25), deadCrossCondition(5, 25), {
      capital: 100000,
    });
  }, [showBacktest]);

  const plugins = useMemo(
    () =>
      showSrZones
        ? { renderers: [trailRenderer], primitives: [srZonePrimitive] }
        : { renderers: [trailRenderer] },
    [showSrZones],
  );

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
  };

  return (
    <>
      <header>
        <h1>React Demo</h1>
        <span className="badge">React</span>
        <div className="tabs">
          <Btn active={view === "component"} onClick={() => setView("component")}>
            Component
          </Btn>
          <Btn active={view === "hook"} onClick={() => setView("hook")}>
            Hook
          </Btn>
        </div>
        <div className="controls">
          {view === "component" && (
            <>
              <Btn active={showSma} onClick={() => setShowSma(!showSma)}>
                SMA 50
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
                Backtest: SMA 5/25 cross
              </Btn>
              <Btn active={showSrZones} onClick={() => setShowSrZones(!showSrZones)}>
                S/R Zones
              </Btn>
              <Btn active={showTrail} onClick={() => setShowTrail(!showTrail)}>
                Trail Stop
              </Btn>
              <Btn active={showVolOverlay} onClick={() => setShowVolOverlay(!showVolOverlay)}>
                Vol Overlay
              </Btn>
            </>
          )}
          <Btn active={false} onClick={toggleTheme}>
            Theme: {theme === "dark" ? "Dark" : "Light"}
          </Btn>
        </div>
      </header>
      <div className="chart-area">
        {view === "component" ? (
          <TrendChart
            candles={candles}
            indicators={indicators}
            backtest={backtestResult}
            features={[registerBacktest]}
            plugins={plugins}
            theme={theme}
            options={{ watermark: "REACT", volume: !showVolOverlay }}
          />
        ) : (
          <HookDemo theme={theme} />
        )}
      </div>
    </>
  );
}

function Btn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={active ? "active" : undefined} onClick={onClick}>
      {children}
    </button>
  );
}
