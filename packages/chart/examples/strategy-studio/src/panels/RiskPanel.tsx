import { useEffect, useMemo, useRef, useState } from "react";
import type { BacktestResult } from "trendcraft";
import { NumInput } from "../components/NumInput";
import {
  computeSizing,
  computeVar,
  DEFAULT_VAR_INPUTS,
  defaultSizingInputs,
  deriveKellyStats,
  type SizingInputs,
  type SizingMethod,
  type VarInputs,
  type VarMethod,
} from "../lib/risk";
import type { StudioCandle } from "../lib/sample-data";

type Props = {
  /** Playhead-aware candle slice. Same source the backtest sees. */
  candles: StudioCandle[];
  /** Most recent backtest result, used to seed Kelly inputs from realised stats. */
  lastBacktest: BacktestResult | undefined;
};

const SIZING_METHODS: ReadonlyArray<{ id: SizingMethod; label: string }> = [
  { id: "risk-based", label: "Risk %" },
  { id: "atr-based", label: "ATR" },
  { id: "kelly", label: "Kelly" },
];

const VAR_METHODS: ReadonlyArray<{ id: VarMethod; label: string }> = [
  { id: "historical", label: "Historical" },
  { id: "parametric", label: "Parametric" },
  { id: "cornishFisher", label: "Cornish-Fisher" },
];

export function RiskPanel({ candles, lastBacktest }: Props) {
  const lastClose = candles.length > 0 ? candles[candles.length - 1].close : 100;

  const [sizing, setSizing] = useState<SizingInputs>(() => defaultSizingInputs(lastClose));
  const [varInputs, setVarInputs] = useState<VarInputs>(DEFAULT_VAR_INPUTS);
  const [autoFromBacktest, setAutoFromBacktest] = useState(true);

  // Track the last close we auto-seeded into entry/stop. When the playhead
  // advances we only re-seed if the user hasn't overridden the field —
  // detected by entry/stop still matching the previously-seeded values.
  // Without this, every Replay tick wipes manual edits and triggers a
  // no-op re-render even when the new close equals the old one.
  const lastSeedRef = useRef<number>(lastClose);
  useEffect(() => {
    if (lastClose === lastSeedRef.current) return;
    setSizing((prev) => {
      const seedStop = Math.max(0.01, lastClose * 0.95);
      const prevSeedStop = Math.max(0.01, lastSeedRef.current * 0.95);
      const entryUntouched = prev.entryPrice === lastSeedRef.current;
      const stopUntouched = prev.stopLossPrice === undefined || prev.stopLossPrice === prevSeedStop;
      lastSeedRef.current = lastClose;
      if (!entryUntouched && !stopUntouched) return prev;
      return {
        ...prev,
        entryPrice: entryUntouched ? lastClose : prev.entryPrice,
        stopLossPrice:
          prev.stopLossPrice === undefined
            ? prev.stopLossPrice
            : stopUntouched
              ? seedStop
              : prev.stopLossPrice,
      };
    });
  }, [lastClose]);

  const kellyStats = useMemo(
    () => (lastBacktest ? deriveKellyStats(lastBacktest.trades) : null),
    [lastBacktest],
  );

  // When a fresh backtest comes in, optionally seed Kelly inputs from its
  // realised win/loss stats. The toggle gives the user an explicit opt-out
  // in case they want to model a hypothetical strategy.
  useEffect(() => {
    if (!autoFromBacktest || !kellyStats) return;
    setSizing((prev) => ({
      ...prev,
      winRate: kellyStats.winRate,
      winLossRatio: kellyStats.winLossRatio,
    }));
  }, [autoFromBacktest, kellyStats]);

  const sizingResult = useMemo(() => computeSizing(sizing, candles), [sizing, candles]);
  const varResult = useMemo(() => computeVar(varInputs, candles), [varInputs, candles]);

  return (
    <div className="risk-panel">
      <div className="pane-header">Risk</div>

      <section className="risk-section">
        <div className="risk-section-title">Position Sizing</div>

        <div className="risk-tabs">
          {SIZING_METHODS.map((m) => (
            <button
              type="button"
              key={m.id}
              className={`risk-tab${sizing.method === m.id ? " active" : ""}`}
              onClick={() => setSizing((prev) => ({ ...prev, method: m.id }))}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="risk-inputs">
          <NumInput
            label="Account $"
            value={sizing.accountSize}
            min={100}
            step={1000}
            onChange={(v) => setSizing((prev) => ({ ...prev, accountSize: v }))}
          />
          <NumInput
            label="Entry $"
            value={sizing.entryPrice}
            min={0.01}
            step={0.01}
            onChange={(v) => setSizing((prev) => ({ ...prev, entryPrice: v }))}
          />

          {sizing.method === "risk-based" && (
            <>
              <NumInput
                label="Risk %"
                value={sizing.riskPercent}
                min={0.01}
                max={50}
                step={0.1}
                onChange={(v) => setSizing((prev) => ({ ...prev, riskPercent: v }))}
              />
              <NumInput
                label="Stop $"
                value={sizing.stopLossPrice ?? 0}
                min={0.01}
                step={0.01}
                onChange={(v) => setSizing((prev) => ({ ...prev, stopLossPrice: v }))}
              />
            </>
          )}

          {sizing.method === "atr-based" && (
            <>
              <NumInput
                label="Risk %"
                value={sizing.riskPercent}
                min={0.01}
                max={50}
                step={0.1}
                onChange={(v) => setSizing((prev) => ({ ...prev, riskPercent: v }))}
              />
              <NumInput
                label="ATR period"
                value={sizing.atrPeriod}
                min={2}
                max={100}
                step={1}
                integer
                onChange={(v) => setSizing((prev) => ({ ...prev, atrPeriod: v }))}
              />
              <NumInput
                label="× ATR"
                value={sizing.atrMultiplier}
                min={0.1}
                max={10}
                step={0.1}
                onChange={(v) => setSizing((prev) => ({ ...prev, atrMultiplier: v }))}
              />
            </>
          )}

          {sizing.method === "kelly" && (
            <>
              <NumInput
                label="Win rate"
                value={sizing.winRate}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setSizing((prev) => ({ ...prev, winRate: v }))}
              />
              <NumInput
                label="Win/Loss"
                value={sizing.winLossRatio}
                min={0.01}
                step={0.05}
                onChange={(v) => setSizing((prev) => ({ ...prev, winLossRatio: v }))}
              />
              <NumInput
                label="Fraction"
                value={sizing.kellyFraction}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(v) => setSizing((prev) => ({ ...prev, kellyFraction: v }))}
              />
            </>
          )}
        </div>

        {sizing.method === "kelly" && (
          <label className="risk-checkbox">
            <input
              type="checkbox"
              checked={autoFromBacktest}
              onChange={(e) => setAutoFromBacktest(e.target.checked)}
            />
            <span>
              Sync from backtest
              {kellyStats && (
                <span className="risk-hint"> ({kellyStats.sampleSize} decided trades)</span>
              )}
              {!kellyStats && <span className="risk-hint"> (run backtest to enable)</span>}
            </span>
          </label>
        )}

        <div className="risk-result">
          {sizingResult.kind === "error" ? (
            <div className="risk-error">{sizingResult.message}</div>
          ) : (
            <>
              <RiskMetric label="Shares" value={sizingResult.result.shares.toLocaleString()} />
              <RiskMetric label="Position" value={formatMoney(sizingResult.result.positionValue)} />
              <RiskMetric
                label="Risk"
                value={`${formatMoney(sizingResult.result.riskAmount)} (${sizingResult.result.riskPercent.toFixed(2)}%)`}
              />
              {sizingResult.result.stopPrice != null && (
                <RiskMetric label="Stop" value={`$${sizingResult.result.stopPrice.toFixed(2)}`} />
              )}
              {sizingResult.atrValue != null && (
                <RiskMetric label="ATR" value={sizingResult.atrValue.toFixed(2)} />
              )}
            </>
          )}
        </div>
      </section>

      <section className="risk-section">
        <div className="risk-section-title">VaR / CVaR</div>

        <div className="risk-tabs">
          {VAR_METHODS.map((m) => (
            <button
              type="button"
              key={m.id}
              className={`risk-tab${varInputs.method === m.id ? " active" : ""}`}
              onClick={() => setVarInputs((prev) => ({ ...prev, method: m.id }))}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="risk-inputs">
          <NumInput
            label="Confidence"
            value={varInputs.confidence}
            min={0.5}
            max={0.999}
            step={0.005}
            onChange={(v) => setVarInputs((prev) => ({ ...prev, confidence: v }))}
          />
          <NumInput
            label="Lookback bars"
            value={varInputs.lookback}
            min={20}
            max={1000}
            step={10}
            integer
            onChange={(v) => setVarInputs((prev) => ({ ...prev, lookback: v }))}
          />
        </div>

        <div className="risk-result">
          {varResult.kind === "error" ? (
            <div className="risk-error">{varResult.message}</div>
          ) : (
            <>
              <RiskMetric
                label={`VaR ${(varInputs.confidence * 100).toFixed(1)}%`}
                value={formatPercent(varResult.result.var * 100)}
                tone="bad"
              />
              <RiskMetric
                label="CVaR"
                value={formatPercent(varResult.result.cvar * 100)}
                tone="bad"
              />
              <RiskMetric label="Obs" value={String(varResult.returnsCount)} />
              <RiskMetric label="Skew" value={varResult.result.skewness.toFixed(2)} />
              <RiskMetric label="Kurt" value={varResult.result.kurtosis.toFixed(2)} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function RiskMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className={`metric${tone ? ` ${tone}` : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function formatMoney(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatPercent(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(2)}%`;
}
