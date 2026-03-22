/**
 * Position Sizing Calculator Panel
 *
 * Calculates position sizes using 4 methods:
 * - Risk-Based: shares = (capital x risk%) / |entry - stoploss|
 * - ATR-Based: shares = (capital x risk%) / (ATR x multiplier)
 * - Kelly Criterion: kelly% then shares = (capital x kelly%) / entry
 * - Fixed Fractional: shares = (capital x fraction) / entry
 *
 * Auto-populates Kelly parameters from backtest results when available.
 */

import { useCallback, useMemo, useState } from "react";
import {
  atrBasedSize,
  calculateKellyPercent,
  fixedFractionalSize,
  kellySize,
  riskBasedSize,
} from "trendcraft";
import type { PositionSizeResult } from "trendcraft";
import { useChartStore } from "../store/chartStore";

/** Input state for the calculator */
interface SizingInputs {
  capital: number;
  entryPrice: number;
  stopLossPrice: number;
  riskPercent: number;
  atrValue: number;
  atrMultiplier: number;
  kellyWinRate: number;
  kellyPayoffRatio: number;
  kellyFraction: number;
  fixedFraction: number;
}

/** Result row for display */
interface SizingResultRow {
  method: string;
  shares: number;
  positionValue: number;
  riskAmount: number;
  stopPrice: number | null;
  error?: string;
}

/**
 * Compute Kelly win rate and payoff ratio from backtest trades
 */
function deriveKellyFromBacktest(trades: { return: number }[]): {
  winRate: number;
  payoffRatio: number;
} | null {
  if (trades.length === 0) return null;

  const wins = trades.filter((t) => t.return > 0);
  const losses = trades.filter((t) => t.return < 0);

  if (wins.length === 0 || losses.length === 0) return null;

  const winRate = wins.length / trades.length;
  const avgWin = wins.reduce((s, t) => s + t.return, 0) / wins.length;
  const avgLoss = Math.abs(losses.reduce((s, t) => s + t.return, 0) / losses.length);

  if (avgLoss === 0) return null;

  return { winRate, payoffRatio: avgWin / avgLoss };
}

/**
 * Safely run a sizing function, catching errors
 */
function safeSizing(fn: () => PositionSizeResult, method: string): SizingResultRow {
  try {
    const r = fn();
    return {
      method,
      shares: r.shares,
      positionValue: r.positionValue,
      riskAmount: r.riskAmount,
      stopPrice: r.stopPrice,
    };
  } catch (e) {
    return {
      method,
      shares: 0,
      positionValue: 0,
      riskAmount: 0,
      stopPrice: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Format a number with comma separators
 */
function fmt(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function PositionSizingPanel() {
  const backtestResult = useChartStore((s) => s.backtestResult);
  const backtestConfig = useChartStore((s) => s.backtestConfig);
  const currentCandles = useChartStore((s) => s.currentCandles);

  // Derive last close as default entry price
  const lastClose = currentCandles.length > 0 ? currentCandles[currentCandles.length - 1].close : 0;

  const [inputs, setInputs] = useState<SizingInputs>({
    capital: backtestConfig.capital,
    entryPrice: 0,
    stopLossPrice: 0,
    riskPercent: 2,
    atrValue: 0,
    atrMultiplier: 2,
    kellyWinRate: 50,
    kellyPayoffRatio: 1.5,
    kellyFraction: 0.5,
    fixedFraction: 10,
  });

  // Auto-populate entry price from last close if not yet set
  const entryPrice = inputs.entryPrice || lastClose;

  // Auto-populate Kelly params from backtest result
  const kellyFromBacktest = useMemo(
    () => (backtestResult ? deriveKellyFromBacktest(backtestResult.trades) : null),
    [backtestResult],
  );

  const applyBacktestKelly = useCallback(() => {
    if (kellyFromBacktest) {
      setInputs((prev) => ({
        ...prev,
        kellyWinRate: Math.round(kellyFromBacktest.winRate * 100 * 10) / 10,
        kellyPayoffRatio: Math.round(kellyFromBacktest.payoffRatio * 100) / 100,
      }));
    }
  }, [kellyFromBacktest]);

  const update = useCallback((patch: Partial<SizingInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
  }, []);

  // Calculate all 4 methods
  const results = useMemo((): SizingResultRow[] => {
    const rows: SizingResultRow[] = [];
    const capital = inputs.capital;
    const entry = entryPrice;
    const stopLoss = inputs.stopLossPrice;

    // 1. Risk-Based
    if (entry > 0 && stopLoss > 0 && stopLoss !== entry) {
      rows.push(
        safeSizing(
          () =>
            riskBasedSize({
              accountSize: capital,
              entryPrice: entry,
              riskPercent: inputs.riskPercent,
              stopLossPrice: stopLoss,
              direction: stopLoss < entry ? "long" : "short",
            }),
          "Risk-Based",
        ),
      );
    } else {
      rows.push({
        method: "Risk-Based",
        shares: 0,
        positionValue: 0,
        riskAmount: 0,
        stopPrice: null,
        error: "Set entry & stop loss",
      });
    }

    // 2. ATR-Based
    if (entry > 0 && inputs.atrValue > 0) {
      rows.push(
        safeSizing(
          () =>
            atrBasedSize({
              accountSize: capital,
              entryPrice: entry,
              riskPercent: inputs.riskPercent,
              atrValue: inputs.atrValue,
              atrMultiplier: inputs.atrMultiplier,
            }),
          "ATR-Based",
        ),
      );
    } else {
      rows.push({
        method: "ATR-Based",
        shares: 0,
        positionValue: 0,
        riskAmount: 0,
        stopPrice: null,
        error: "Set entry & ATR value",
      });
    }

    // 3. Kelly
    if (entry > 0 && inputs.kellyWinRate > 0 && inputs.kellyPayoffRatio > 0) {
      const winRate = inputs.kellyWinRate / 100;
      const kellyPct = calculateKellyPercent(winRate, inputs.kellyPayoffRatio);
      if (kellyPct <= 0) {
        rows.push({
          method: "Kelly",
          shares: 0,
          positionValue: 0,
          riskAmount: 0,
          stopPrice: null,
          error: "Kelly% = 0 (edge negative)",
        });
      } else {
        rows.push(
          safeSizing(
            () =>
              kellySize({
                accountSize: capital,
                entryPrice: entry,
                winRate,
                winLossRatio: inputs.kellyPayoffRatio,
                kellyFraction: inputs.kellyFraction,
              }),
            "Kelly",
          ),
        );
      }
    } else {
      rows.push({
        method: "Kelly",
        shares: 0,
        positionValue: 0,
        riskAmount: 0,
        stopPrice: null,
        error: "Set entry & Kelly params",
      });
    }

    // 4. Fixed Fractional
    if (entry > 0) {
      rows.push(
        safeSizing(
          () =>
            fixedFractionalSize({
              accountSize: capital,
              entryPrice: entry,
              fractionPercent: inputs.fixedFraction,
            }),
          "Fixed Frac.",
        ),
      );
    } else {
      rows.push({
        method: "Fixed Frac.",
        shares: 0,
        positionValue: 0,
        riskAmount: 0,
        stopPrice: null,
        error: "Set entry price",
      });
    }

    return rows;
  }, [inputs, entryPrice]);

  return (
    <div className="position-sizing-panel">
      <div className="backtest-header">Position Sizing</div>

      {/* Input Fields */}
      <div className="settings-grid">
        <div className="setting-row">
          <label>Capital</label>
          <input
            type="number"
            value={inputs.capital}
            onChange={(e) => update({ capital: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="setting-row">
          <label>Entry Price</label>
          <input
            type="number"
            placeholder={lastClose ? lastClose.toFixed(2) : "0"}
            value={inputs.entryPrice || ""}
            onChange={(e) => update({ entryPrice: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="setting-row">
          <label>Stop Loss</label>
          <input
            type="number"
            placeholder="Price"
            value={inputs.stopLossPrice || ""}
            onChange={(e) => update({ stopLossPrice: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="setting-row">
          <label>Risk %</label>
          <input
            type="number"
            step="0.5"
            value={inputs.riskPercent}
            onChange={(e) => update({ riskPercent: Number(e.target.value) || 0 })}
          />
        </div>
      </div>

      {/* ATR Settings */}
      <details className="backtest-settings">
        <summary>ATR Settings</summary>
        <div className="settings-grid">
          <div className="setting-row">
            <label>ATR Value</label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 2.50"
              value={inputs.atrValue || ""}
              onChange={(e) => update({ atrValue: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="setting-row">
            <label>Multiplier</label>
            <input
              type="number"
              step="0.5"
              value={inputs.atrMultiplier}
              onChange={(e) => update({ atrMultiplier: Number(e.target.value) || 2 })}
            />
          </div>
        </div>
      </details>

      {/* Kelly Settings */}
      <details className="backtest-settings">
        <summary>Kelly Settings</summary>
        <div className="settings-grid">
          <div className="setting-row">
            <label>Win Rate %</label>
            <input
              type="number"
              step="1"
              value={inputs.kellyWinRate}
              onChange={(e) => update({ kellyWinRate: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="setting-row">
            <label>Payoff Ratio</label>
            <input
              type="number"
              step="0.1"
              value={inputs.kellyPayoffRatio}
              onChange={(e) => update({ kellyPayoffRatio: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="setting-row">
            <label>Fraction</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="1"
              value={inputs.kellyFraction}
              onChange={(e) => update({ kellyFraction: Number(e.target.value) || 0.5 })}
            />
          </div>
          {kellyFromBacktest && (
            <button
              type="button"
              className="sizing-auto-btn"
              onClick={applyBacktestKelly}
              title={`Win: ${(kellyFromBacktest.winRate * 100).toFixed(1)}%, Payoff: ${kellyFromBacktest.payoffRatio.toFixed(2)}`}
            >
              Apply from Backtest
            </button>
          )}
        </div>
      </details>

      {/* Fixed Fractional Settings */}
      <details className="backtest-settings">
        <summary>Fixed Fractional</summary>
        <div className="settings-grid">
          <div className="setting-row">
            <label>Fraction %</label>
            <input
              type="number"
              step="1"
              value={inputs.fixedFraction}
              onChange={(e) => update({ fixedFraction: Number(e.target.value) || 10 })}
            />
          </div>
        </div>
      </details>

      {/* Results */}
      <div className="sizing-results">
        {results.map((r) => (
          <div key={r.method} className="sizing-result-card">
            <div className="sizing-method-name">{r.method}</div>
            {r.error ? (
              <div className="sizing-error">{r.error}</div>
            ) : (
              <div className="sizing-values">
                <div className="sizing-row">
                  <span className="sizing-label">Shares</span>
                  <span className="sizing-value">{fmt(r.shares)}</span>
                </div>
                <div className="sizing-row">
                  <span className="sizing-label">Position</span>
                  <span className="sizing-value">{fmt(r.positionValue)}</span>
                </div>
                <div className="sizing-row">
                  <span className="sizing-label">Risk</span>
                  <span className="sizing-value sizing-risk">{fmt(r.riskAmount)}</span>
                </div>
                {r.stopPrice != null && (
                  <div className="sizing-row">
                    <span className="sizing-label">Stop</span>
                    <span className="sizing-value">{fmt(r.stopPrice, 2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
