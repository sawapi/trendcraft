import { Sparkline, SparklineList } from "@trendcraft/chart/react/sparkline";
import { useEffect, useMemo, useState } from "react";
import type { BacktestResult, StrategyJSON } from "trendcraft";
import { NumInput } from "../components/NumInput";
import { usePortfolioSymbols } from "../hooks/usePortfolioSymbols";
import type { DataSource } from "../lib/data-sources";
import { overridesFromResult } from "../lib/meta-strategy";
import {
  type AllocationMode,
  type PortfolioInputs,
  defaultPortfolioInputs,
  runPortfolio,
  symbolEquityCurve,
} from "../lib/portfolio";

type Props = {
  /** Builder JSON to apply to all symbols. */
  strategy: StrategyJSON | undefined;
  /** Most recent solo backtest, used to inherit settings (stops, fees, etc.). */
  lastResult: BacktestResult | undefined;
  /**
   * Calendar time window — the first and last `time` values of the host's
   * `backtestCandles`. Each portfolio symbol is filtered to bars whose
   * `time` falls inside this range so the multi-symbol backtest runs on
   * the same wall-clock window the chart and solo backtest show. Slicing
   * by bar count instead would misalign symbols with different listing
   * dates / histories (e.g. an IPO ticker on the main chart vs. SPY/AAPL/
   * NVDA in the portfolio).
   *
   * `null` means "use each symbol's full history" — appropriate when the
   * host has no candles loaded yet.
   */
  sliceStartTime: number | null;
  sliceEndTime: number | null;
  /** Replay playing → freeze recompute (multi-symbol backtest is heavy). */
  isReplayPlaying: boolean;
  /** Drives synthetic vs real-data symbol selection. */
  dataSource: DataSource;
  /** Reload counter from `useDataSource` — busts the symbol cache in lockstep. */
  reloadTick: number;
};

const ALLOCATIONS: ReadonlyArray<{ id: AllocationMode; label: string }> = [
  { id: "equal", label: "Equal" },
  { id: "custom", label: "Custom" },
];

export function PortfolioPanel({
  strategy,
  lastResult,
  sliceStartTime,
  sliceEndTime,
  isReplayPlaying,
  dataSource,
  reloadTick,
}: Props) {
  const {
    symbols: portfolioSymbols,
    loading: symbolsLoading,
    error: symbolsError,
  } = usePortfolioSymbols(dataSource, reloadTick);

  const [inputs, setInputs] = useState<PortfolioInputs>(() =>
    defaultPortfolioInputs(portfolioSymbols),
  );

  // When the symbol set changes (synthetic ↔ alpaca, or Alpaca timeframe
  // switch), reset weights to a valid equal-weight default for the new keys.
  // Without this, custom weights from the previous symbol set carry over and
  // sum to the wrong value.
  const symbolKey = portfolioSymbols.map((s) => s.symbol).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to symbol identity changes.
  useEffect(() => {
    setInputs((prev) => ({
      ...defaultPortfolioInputs(portfolioSymbols),
      capital: prev.capital,
      allocation: prev.allocation,
    }));
  }, [symbolKey]);

  const slicedSymbols = useMemo(
    () =>
      portfolioSymbols.map((s) => {
        if (sliceStartTime == null || sliceEndTime == null) return s;
        return {
          ...s,
          candles: s.candles.filter((c) => c.time >= sliceStartTime && c.time <= sliceEndTime),
        };
      }),
    [portfolioSymbols, sliceStartTime, sliceEndTime],
  );

  // Recompute on strategy / inputs / settings change. We don't need to key on
  // the candle slice — sampleSymbols is fixed (synthetic, not playhead-bound).
  // Replay playback freezes the *result state* below so the panel doesn't
  // churn at Max speed; setting changes still flow through immediately when
  // playback isn't active.
  const overridesKey = lastResult
    ? `${lastResult.initialCapital}|${lastResult.settings.stopLoss ?? ""}|${lastResult.settings.takeProfit ?? ""}|${lastResult.settings.trailingStop ?? ""}|${lastResult.settings.direction ?? ""}|${lastResult.settings.fillMode}|${lastResult.settings.slTpMode}|${lastResult.settings.slippage}|${lastResult.settings.commission}|${lastResult.settings.commissionRate}|${lastResult.settings.taxRate}`
    : "";

  const [computation, setComputation] = useState<ReturnType<typeof runPortfolio>>(() => ({
    kind: "empty",
  }));

  const strategyKey = strategy ? JSON.stringify(strategy) : "";
  const inputsKey = `${inputs.capital}|${inputs.allocation}|${Object.entries(inputs.customWeights)
    .map(([k, v]) => `${k}=${v}`)
    .join(",")}`;

  // Content hash of the symbol payload itself — `symbolKey` only carries the
  // ticker identity, so a timeframe switch that returns the same three
  // tickers with similar bar counts (1Day vs 1Hour both ~2,000 bars) would
  // not invalidate this effect on its own. Including bar count + last-bar
  // time + last-bar close + first-bar close catches every realistic refresh
  // path: TF/source switches, intraday reloads where the still-open bar's
  // OHLC moved without changing count or endpoint timestamp, and split
  // adjustments that preserve bar count and timestamps.
  const symbolContentKey = portfolioSymbols
    .map((s) => {
      const last = s.candles[s.candles.length - 1];
      const first = s.candles[0];
      return `${s.symbol}:${s.candles.length}:${last?.time ?? 0}:${last?.close ?? 0}:${first?.close ?? 0}`;
    })
    .join("|");

  // biome-ignore lint/correctness/useExhaustiveDependencies: strategyKey + inputsKey + overridesKey + sliceStartTime + sliceEndTime + symbolKey + symbolContentKey are content hashes; raw `strategy`/`slicedSymbols` references shift on every render so we key on hashes instead.
  useEffect(() => {
    if (isReplayPlaying) return;
    if (symbolsLoading) return;
    if (slicedSymbols.length === 0) return;
    const overrides = lastResult ? overridesFromResult(lastResult) : {};
    setComputation(runPortfolio(strategy, slicedSymbols, inputs, overrides));
  }, [
    strategyKey,
    inputsKey,
    isReplayPlaying,
    overridesKey,
    sliceStartTime,
    sliceEndTime,
    symbolKey,
    symbolContentKey,
    symbolsLoading,
  ]);

  const customWeightSum = useMemo(
    () => Object.values(inputs.customWeights).reduce((s, w) => s + w, 0),
    [inputs.customWeights],
  );
  // Match `batchBacktest`'s weight-sum tolerance (`> 0.01` throws). A
  // tighter UI check would yell "invalid" on inputs the engine accepts
  // (e.g. 0.99 / 1.01), confusing the user.
  const customWeightsValid = Math.abs(customWeightSum - 1) <= 0.01;

  return (
    <div className="risk-panel">
      <div className="pane-header">Portfolio</div>

      <section className="risk-section">
        <div className="risk-tabs">
          {ALLOCATIONS.map((a) => (
            <button
              type="button"
              key={a.id}
              className={`risk-tab${inputs.allocation === a.id ? " active" : ""}`}
              onClick={() => setInputs((prev) => ({ ...prev, allocation: a.id }))}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="risk-inputs">
          <NumInput
            label="Capital total $"
            value={inputs.capital}
            min={1000}
            step={10_000}
            onChange={(v) => setInputs((prev) => ({ ...prev, capital: v }))}
          />
        </div>

        {inputs.allocation === "custom" && (
          <>
            <div className="risk-inputs">
              {portfolioSymbols.map((s) => (
                <NumInput
                  key={s.symbol}
                  label={`${s.symbol} weight`}
                  value={inputs.customWeights[s.symbol] ?? 0}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) =>
                    setInputs((prev) => ({
                      ...prev,
                      customWeights: { ...prev.customWeights, [s.symbol]: v },
                    }))
                  }
                />
              ))}
            </div>
            {!customWeightsValid && (
              <div className="meta-strategy-caption">
                Weights sum to {customWeightSum.toFixed(2)} (must be 1.00) — backtest will skip
                until corrected.
              </div>
            )}
          </>
        )}

        {symbolsLoading && (
          <div className="meta-strategy-caption">
            Loading {portfolioSymbols.length || 3} symbols…
          </div>
        )}
        {symbolsError && <div className="risk-error">{symbolsError.message}</div>}
        {!symbolsLoading && !symbolsError && (
          <PortfolioBody computation={computation} customWeightsValid={customWeightsValid} />
        )}
        {isReplayPlaying && (
          <div className="meta-strategy-caption">Frozen during replay playback.</div>
        )}
      </section>
    </div>
  );
}

function PortfolioBody({
  computation,
  customWeightsValid,
}: {
  computation: ReturnType<typeof runPortfolio>;
  customWeightsValid: boolean;
}) {
  if (computation.kind === "empty") {
    return <div className="meta-strategy-caption">Run a backtest to compare across symbols.</div>;
  }
  if (computation.kind === "error") {
    if (!customWeightsValid) return null;
    return <div className="risk-error">{computation.message}</div>;
  }
  const { result } = computation;
  return (
    <>
      <SparklineList hover={{ format: formatEquityHover }} className="symbol-list">
        {result.symbols.map((s) => {
          const equity = symbolEquityCurve(s);
          const ret = s.result.totalReturnPercent;
          return (
            <div key={s.symbol} className="symbol-row">
              <span className="symbol-name">{s.symbol}</span>
              <Sparkline
                type="line"
                data={equity}
                width={80}
                height={22}
                color={{ fixed: ret >= 0 ? "#26a69a" : "#ef5350" }}
                fill
              />
              <span
                className={`symbol-return ${ret >= 0 ? "good" : "bad"}`}
              >{`${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%`}</span>
              <span className="symbol-trades">{s.result.trades.length}t</span>
            </div>
          );
        })}
      </SparklineList>

      <div className="risk-result" style={{ marginTop: 8 }}>
        <PortfolioMetric
          label="Total return"
          value={`${result.portfolio.totalReturnPercent >= 0 ? "+" : ""}${result.portfolio.totalReturnPercent.toFixed(2)}%`}
          tone={result.portfolio.totalReturnPercent >= 0 ? "good" : "bad"}
        />
        <PortfolioMetric label="Sharpe" value={result.portfolio.sharpeRatio.toFixed(2)} />
        <PortfolioMetric
          label="Max DD"
          value={`${result.portfolio.maxDrawdown.toFixed(2)}%`}
          tone="bad"
        />
        <PortfolioMetric
          label="PF"
          value={
            Number.isFinite(result.portfolio.profitFactor)
              ? result.portfolio.profitFactor.toFixed(2)
              : "∞"
          }
        />
        <PortfolioMetric label="Trades" value={String(result.portfolio.tradeCount)} />
        <PortfolioMetric label="Win rate" value={`${result.portfolio.winRate.toFixed(1)}%`} />
      </div>
    </>
  );
}

function PortfolioMetric({
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

const EQUITY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatEquityHover(d: { value: number }): string {
  // Prefixed with `Equity` so the number isn't mistaken for a price. The
  // sparkline plots accumulated capital (initialCapital + Σ trade P&L), not
  // the underlying ticker's price.
  return `Equity ${EQUITY_FORMATTER.format(d.value)}`;
}
