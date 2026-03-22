/**
 * Side panel that explains why a signal fired (or didn't) at a specific bar
 */

import { useMemo, useState } from "react";
import type { ConditionTrace, SignalExplanation, Trade } from "trendcraft";
import { explainCondition, explainSignal } from "trendcraft";
import { ENTRY_CONDITIONS, EXIT_CONDITIONS } from "../hooks/useBacktest";
import { useChartStore } from "../store/chartStore";

/**
 * Recursive condition trace tree node
 */
function ConditionTraceNode({
  trace,
  depth,
}: {
  trace: ConditionTrace;
  depth: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = trace.children && trace.children.length > 0;

  // Format indicator values inline
  const valueStr = useMemo(() => {
    const entries = Object.entries(trace.indicatorValues);
    if (entries.length === 0) return null;
    return entries
      .map(([k, v]) => {
        if (typeof v === "number") return `${k}=${Math.round(v * 100) / 100}`;
        return `${k}=${String(v)}`;
      })
      .join(", ");
  }, [trace.indicatorValues]);

  return (
    <div className="condition-node" style={{ paddingLeft: depth * 16 }}>
      <div
        className={`condition-node-row ${trace.passed ? "passed" : "failed"}`}
        onClick={hasChildren ? () => setCollapsed(!collapsed) : undefined}
        style={{ cursor: hasChildren ? "pointer" : "default" }}
      >
        <span className={`material-icons md-14 condition-icon ${trace.passed ? "pass" : "fail"}`}>
          {trace.passed ? "check_circle" : "cancel"}
        </span>
        {hasChildren && (
          <span className="material-icons md-14 condition-toggle">
            {collapsed ? "chevron_right" : "expand_more"}
          </span>
        )}
        <span className="condition-name">{trace.name}</span>
        {valueStr && <span className="indicator-value">{valueStr}</span>}
      </div>
      {hasChildren && !collapsed && (
        <div className="condition-children">
          {trace.children?.map((child, i) => (
            <ConditionTraceNode key={`${child.name}-${i}`} trace={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Format volume for display (e.g. 1.2M, 120K)
 */
function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

/**
 * Format a timestamp as YYYY-MM-DD
 */
function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Find trade context for a given bar:
 * - Is this bar an entry or exit of a trade?
 * - Is this bar within an active trade?
 * Returns the related trade and its role, or null.
 */
function findTradeContext(
  barTime: number,
  trades: Trade[],
): { trade: Trade; role: "entry" | "exit" | "holding" } | null {
  for (const trade of trades) {
    if (trade.entryTime === barTime) return { trade, role: "entry" };
    if (trade.exitTime === barTime) return { trade, role: "exit" };
  }
  // Check if bar is within a trade (holding period)
  for (const trade of trades) {
    if (barTime > trade.entryTime && barTime < trade.exitTime) {
      return { trade, role: "holding" };
    }
  }
  return null;
}

export function ExplainBarPanel() {
  const explainBar = useChartStore((s) => s.explainBar);
  const setExplainBar = useChartStore((s) => s.setExplainBar);
  const currentCandles = useChartStore((s) => s.currentCandles);
  const backtestConfig = useChartStore((s) => s.backtestConfig);
  const backtestResult = useChartStore((s) => s.backtestResult);

  const explanation = useMemo<{
    signal: SignalExplanation | null;
    entryTrace: ConditionTrace | null;
    exitTrace: ConditionTrace | null;
  }>(() => {
    const noResult = { signal: null, entryTrace: null, exitTrace: null };
    if (!explainBar || currentCandles.length === 0) return noResult;

    const entryFactory = ENTRY_CONDITIONS[backtestConfig.entryCondition]?.factory;
    const exitFactory = EXIT_CONDITIONS[backtestConfig.exitCondition]?.factory;
    if (!entryFactory || !exitFactory) return noResult;

    const entryCondition = entryFactory();
    const exitCondition = exitFactory();
    const { barIndex } = explainBar;

    if (barIndex < 0 || barIndex >= currentCandles.length) return noResult;

    const signal = explainSignal(currentCandles, barIndex, entryCondition, exitCondition, {
      language: "en",
      includeValues: true,
    });

    const entryTrace = explainCondition(currentCandles, barIndex, entryCondition, {
      includeValues: true,
    });
    const exitTrace = explainCondition(currentCandles, barIndex, exitCondition, {
      includeValues: true,
    });

    return { signal, entryTrace, exitTrace };
  }, [explainBar, currentCandles, backtestConfig.entryCondition, backtestConfig.exitCondition]);

  // Find trade context for the clicked bar
  const tradeContext = useMemo(() => {
    if (!explainBar || currentCandles.length === 0 || !backtestResult) return null;
    const { barIndex } = explainBar;
    if (barIndex < 0 || barIndex >= currentCandles.length) return null;
    const barTime = currentCandles[barIndex].time;
    return findTradeContext(barTime, backtestResult.trades);
  }, [explainBar, currentCandles, backtestResult]);

  // Find candle index by timestamp for jump navigation
  const findBarIndex = (time: number): number => {
    return currentCandles.findIndex((c) => c.time === time);
  };

  if (!explainBar || currentCandles.length === 0) return null;

  const { barIndex } = explainBar;
  if (barIndex < 0 || barIndex >= currentCandles.length) return null;

  const candle = currentCandles[barIndex];

  return (
    <div className="explain-panel">
      <div className="explain-header">
        <div className="explain-title">
          <span className="material-icons md-18">info</span>
          Explain This Bar
        </div>
        <span className="explain-date">{formatDate(candle.time)}</span>
        <button
          type="button"
          className="explain-close"
          onClick={() => setExplainBar(null)}
          aria-label="Close"
        >
          <span className="material-icons md-18">close</span>
        </button>
      </div>

      <div className="explain-ohlcv">
        O:{candle.open.toFixed(1)} H:{candle.high.toFixed(1)} L:{candle.low.toFixed(1)} C:
        {candle.close.toFixed(1)} V:{formatVolume(candle.volume)}
      </div>

      {/* Trade context: show related trade info with jump links */}
      {tradeContext && (
        <div className="explain-trade-context">
          {tradeContext.role === "entry" && (
            <div className="trade-context-row entry">
              <span className="material-icons md-14">arrow_upward</span>
              Buy @ {tradeContext.trade.entryPrice.toFixed(1)}
              <span className="trade-jump-links">
                {barIndex > 0 && (
                  <button
                    type="button"
                    className="trade-jump-btn"
                    onClick={() => setExplainBar(barIndex - 1)}
                    title="Signal fired on previous bar"
                  >
                    <span className="material-icons md-14">arrow_back</span>
                    Signal
                  </button>
                )}
                <button
                  type="button"
                  className="trade-jump-btn"
                  onClick={() => setExplainBar(findBarIndex(tradeContext.trade.exitTime))}
                >
                  Exit
                  <span className="material-icons md-14">arrow_forward</span>
                </button>
              </span>
            </div>
          )}
          {tradeContext.role === "exit" && (
            <div className="trade-context-row exit">
              <span className="material-icons md-14">arrow_downward</span>
              Sell @ {tradeContext.trade.exitPrice.toFixed(1)}(
              {tradeContext.trade.returnPercent >= 0 ? "+" : ""}
              {tradeContext.trade.returnPercent.toFixed(1)}%)
              <span className="trade-jump-links">
                {barIndex > 0 && (
                  <button
                    type="button"
                    className="trade-jump-btn"
                    onClick={() => setExplainBar(barIndex - 1)}
                    title="Signal fired on previous bar"
                  >
                    <span className="material-icons md-14">arrow_back</span>
                    Signal
                  </button>
                )}
                <button
                  type="button"
                  className="trade-jump-btn"
                  onClick={() => setExplainBar(findBarIndex(tradeContext.trade.entryTime))}
                >
                  Entry
                  <span className="material-icons md-14">arrow_forward</span>
                </button>
              </span>
            </div>
          )}
          {tradeContext.role === "holding" && (
            <div className="trade-context-row holding">
              <span className="material-icons md-14">swap_vert</span>
              In position (entered {formatDate(tradeContext.trade.entryTime)})
              <span className="trade-jump-links">
                <button
                  type="button"
                  className="trade-jump-btn"
                  onClick={() => setExplainBar(findBarIndex(tradeContext.trade.entryTime))}
                >
                  <span className="material-icons md-14">arrow_back</span>
                  Entry
                </button>
                <button
                  type="button"
                  className="trade-jump-btn"
                  onClick={() => setExplainBar(findBarIndex(tradeContext.trade.exitTime))}
                >
                  Exit
                  <span className="material-icons md-14">arrow_forward</span>
                </button>
              </span>
            </div>
          )}
        </div>
      )}

      {explanation.signal && (
        <div className="explain-narrative">
          <p>{explanation.signal.narrative}</p>
        </div>
      )}

      {explanation.entryTrace && (
        <div className="explain-section">
          <div
            className={`explain-section-title ${explanation.entryTrace.passed ? "pass" : "fail"}`}
          >
            <span
              className={`material-icons md-16 ${explanation.entryTrace.passed ? "pass" : "fail"}`}
            >
              {explanation.entryTrace.passed ? "check_circle" : "cancel"}
            </span>
            Entry Condition
          </div>
          <div className="condition-tree">
            <ConditionTraceNode trace={explanation.entryTrace} depth={0} />
          </div>
        </div>
      )}

      {explanation.exitTrace && (
        <div className="explain-section">
          <div
            className={`explain-section-title ${explanation.exitTrace.passed ? "pass" : "fail"}`}
          >
            <span
              className={`material-icons md-16 ${explanation.exitTrace.passed ? "pass" : "fail"}`}
            >
              {explanation.exitTrace.passed ? "check_circle" : "cancel"}
            </span>
            Exit Condition
          </div>
          <div className="condition-tree">
            <ConditionTraceNode trace={explanation.exitTrace} depth={0} />
          </div>
        </div>
      )}

      {!explanation.signal && (
        <div className="explain-narrative">
          <p>Unable to evaluate conditions at this bar index.</p>
        </div>
      )}
    </div>
  );
}
