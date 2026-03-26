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

export function App() {
  const candles = sampleData;
  const [showSma, setShowSma] = useState(true);
  const [showBb, setShowBb] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [showMacd, setShowMacd] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const indicators = useMemo(() => {
    const list: unknown[][] = [];
    if (showSma) list.push(sma(candles, { period: 20 }));
    if (showBb) list.push(bollingerBands(candles));
    if (showRsi) list.push(rsi(candles));
    if (showMacd) list.push(macd(candles));
    return list;
  }, [showSma, showBb, showRsi, showMacd, candles]);

  const backtestResult = useMemo(() => {
    if (!showBacktest) return undefined;
    const normalized = normalizeCandles(candles);
    return runBacktest(normalized, goldenCrossCondition(), rsiBelow(70), { capital: 100000 });
  }, [showBacktest, candles]);

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
