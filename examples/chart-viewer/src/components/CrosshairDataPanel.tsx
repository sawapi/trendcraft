/**
 * Crosshair data panel - shows OHLCV + indicator values at hovered bar
 */

import { useMemo } from "react";
import type { IndicatorData } from "../hooks/useIndicators";
import { useIndicators } from "../hooks/useIndicators";
import type { OverlayData } from "../hooks/useOverlays";
import { useOverlays } from "../hooks/useOverlays";
import { useChartStore } from "../store/chartStore";

/** Format price values - always preserve 2 decimal places */
function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "-";
  return v.toFixed(2);
}

/** Format indicator values - compact display */
function fmt(v: number | null | undefined): string {
  if (v == null) return "-";
  return Math.abs(v) >= 1000 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
}

/**
 * Extract displayable values from indicator/overlay data at given index
 */
function extractValues(
  idx: number,
  indicators: IndicatorData,
  overlays: OverlayData,
  enabledIndicators: string[],
  enabledOverlays: string[],
): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];

  // Overlay simple values
  const simpleOverlays: [string, string, keyof OverlayData][] = [
    ["sma5", "SMA5", "sma5"],
    ["sma25", "SMA25", "sma25"],
    ["sma75", "SMA75", "sma75"],
    ["ema12", "EMA12", "ema12"],
    ["ema26", "EMA26", "ema26"],
    ["wma20", "WMA20", "wma20"],
    ["vwma20", "VWMA", "vwma20"],
    ["kama", "KAMA", "kama"],
    ["t3", "T3", "t3"],
    ["superSmoother", "SSF", "superSmoother"],
    ["hma", "HMA", "hma"],
    ["mcginley", "McGinley", "mcginley"],
  ];

  for (const [key, label, dataKey] of simpleOverlays) {
    if (!enabledOverlays.includes(key)) continue;
    const arr = overlays[dataKey] as (number | null)[] | undefined;
    if (arr?.[idx] != null) {
      items.push({ label, value: fmtPrice(arr[idx]) });
    }
  }

  // BB
  if (enabledOverlays.includes("bb") && overlays.bb?.[idx]) {
    const v = overlays.bb[idx];
    items.push({ label: "BB", value: `${fmtPrice(v.lower)}-${fmtPrice(v.upper)}` });
  }

  // Supertrend
  if (enabledOverlays.includes("supertrend") && overlays.supertrend?.[idx]) {
    items.push({ label: "ST", value: fmtPrice(overlays.supertrend[idx].supertrend) });
  }

  // PSAR
  if (enabledOverlays.includes("psar") && overlays.psar?.[idx]) {
    items.push({ label: "SAR", value: fmtPrice(overlays.psar[idx].sar) });
  }

  // VWAP
  if (enabledOverlays.includes("vwap") && overlays.vwap?.[idx]) {
    items.push({ label: "VWAP", value: fmtPrice(overlays.vwap[idx].vwap) });
  }

  // Indicator simple values
  const simpleIndicators: [string, string, keyof IndicatorData][] = [
    ["rsi", "RSI", "rsi"],
    ["mfi", "MFI", "mfi"],
    ["cci", "CCI", "cci"],
    ["williams", "W%R", "williams"],
    ["roc", "ROC", "roc"],
    ["atr", "ATR", "atr"],
    ["cmf", "CMF", "cmf"],
    ["dpo", "DPO", "dpo"],
    ["hurst", "Hurst", "hurst"],
    ["roofingFilter", "RF", "roofingFilter"],
    ["connorsRsi", "CRSI", "connorsRsi"],
    ["choppiness", "CHOP", "choppiness"],
    ["cmo", "CMO", "cmo"],
    ["adxr", "ADXR", "adxr"],
    ["imi", "IMI", "imi"],
    ["elderForce", "EFI", "elderForce"],
  ];

  for (const [key, label, dataKey] of simpleIndicators) {
    if (!enabledIndicators.includes(key)) continue;
    const arr = indicators[dataKey] as (number | null)[] | undefined;
    if (arr?.[idx] != null) {
      items.push({ label, value: fmt(arr[idx]) });
    }
  }

  // MACD
  if (enabledIndicators.includes("macd")) {
    const line = indicators.macdLine?.[idx];
    const signal = indicators.macdSignal?.[idx];
    if (line != null) {
      items.push({ label: "MACD", value: `${fmt(line)}/${fmt(signal)}` });
    }
  }

  // Stochastics
  if (enabledIndicators.includes("stochastics")) {
    const k = indicators.stochK?.[idx];
    if (k != null) {
      items.push({ label: "Stoch", value: `${fmt(k)}/${fmt(indicators.stochD?.[idx])}` });
    }
  }

  // DMI
  if (enabledIndicators.includes("dmi")) {
    const plus = indicators.dmiPlusDi?.[idx];
    if (plus != null) {
      items.push({
        label: "DMI",
        value: `+${fmt(plus)}/-${fmt(indicators.dmiMinusDi?.[idx])} ADX:${fmt(indicators.dmiAdx?.[idx])}`,
      });
    }
  }

  // StochRSI
  if (enabledIndicators.includes("stochrsi")) {
    const k = indicators.stochRsiK?.[idx];
    if (k != null) {
      items.push({ label: "StRSI", value: `${fmt(k)}/${fmt(indicators.stochRsiD?.[idx])}` });
    }
  }

  // OBV
  if (enabledIndicators.includes("obv") && indicators.obv?.[idx] != null) {
    const v = indicators.obv[idx];
    const formatted = Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : fmt(v);
    items.push({ label: "OBV", value: formatted });
  }

  // TRIX
  if (enabledIndicators.includes("trix")) {
    const line = indicators.trixLine?.[idx];
    if (line != null) {
      items.push({ label: "TRIX", value: fmt(line) });
    }
  }

  // Aroon
  if (enabledIndicators.includes("aroon")) {
    const up = indicators.aroonUp?.[idx];
    if (up != null) {
      items.push({ label: "Aroon", value: `${fmt(up)}/${fmt(indicators.aroonDown?.[idx])}` });
    }
  }

  // Vortex
  if (enabledIndicators.includes("vortex")) {
    const plus = indicators.vortexPlus?.[idx];
    if (plus != null) {
      items.push({ label: "VI", value: `+${fmt(plus)}/-${fmt(indicators.vortexMinus?.[idx])}` });
    }
  }

  // Klinger
  if (enabledIndicators.includes("klinger")) {
    const line = indicators.klingerLine?.[idx];
    if (line != null) {
      items.push({ label: "KVO", value: fmt(line) });
    }
  }

  // ADL
  if (enabledIndicators.includes("adl") && indicators.adl?.[idx] != null) {
    const v = indicators.adl[idx];
    const formatted = Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : fmt(v);
    items.push({ label: "ADL", value: formatted });
  }

  return items;
}

export function CrosshairDataPanel() {
  const currentCandles = useChartStore((s) => s.currentCandles);
  const enabledIndicators = useChartStore((s) => s.enabledIndicators);
  const enabledOverlays = useChartStore((s) => s.enabledOverlays);
  const hoveredDataIndex = useChartStore((s) => s.hoveredDataIndex);
  const currentFundamentals = useChartStore((s) => s.currentFundamentals);

  const indicators = useIndicators(currentCandles, enabledIndicators, currentFundamentals);
  const overlays = useOverlays(currentCandles, enabledOverlays);

  const idx = hoveredDataIndex ?? currentCandles.length - 1;
  const candle = currentCandles[idx];

  const values = useMemo(
    () => extractValues(idx, indicators, overlays, enabledIndicators, enabledOverlays),
    [idx, indicators, overlays, enabledIndicators, enabledOverlays],
  );

  if (!candle) return null;

  const date = new Date(candle.time);
  const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  const change = candle.close - candle.open;
  const changeClass = change >= 0 ? "up" : "down";

  return (
    <div className="crosshair-panel">
      <span className="ch-group">
        <span className="ch-label">D</span>
        <span className="ch-value">{dateStr}</span>
      </span>
      <span className="ch-group">
        <span className="ch-label">O</span>
        <span className={`ch-value ${changeClass}`}>{fmtPrice(candle.open)}</span>
      </span>
      <span className="ch-group">
        <span className="ch-label">H</span>
        <span className={`ch-value ${changeClass}`}>{fmtPrice(candle.high)}</span>
      </span>
      <span className="ch-group">
        <span className="ch-label">L</span>
        <span className={`ch-value ${changeClass}`}>{fmtPrice(candle.low)}</span>
      </span>
      <span className="ch-group">
        <span className="ch-label">C</span>
        <span className={`ch-value ${changeClass}`}>{fmtPrice(candle.close)}</span>
      </span>
      <span className="ch-group">
        <span className="ch-label">V</span>
        <span className="ch-value">
          {candle.volume >= 1e6
            ? `${(candle.volume / 1e6).toFixed(1)}M`
            : candle.volume >= 1e3
              ? `${(candle.volume / 1e3).toFixed(0)}K`
              : candle.volume.toFixed(0)}
        </span>
      </span>
      {values.map(({ label, value }) => (
        <span key={label} className="ch-group">
          <span className="ch-label">{label}</span>
          <span className="ch-value">{value}</span>
        </span>
      ))}
    </div>
  );
}
