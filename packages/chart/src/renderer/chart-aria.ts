/**
 * ChartAria — Accessibility helpers for CanvasChart.
 * Manages ARIA attributes and a live region for screen reader announcements.
 */

import type { ChartLocale } from "../core/i18n";
import type { CandleData } from "../core/types";

export class ChartAria {
  private _liveEl: HTMLElement;
  private _timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    container: HTMLElement,
    private _locale: ChartLocale,
  ) {
    // Visually-hidden live region for screen reader announcements
    this._liveEl = document.createElement("div");
    this._liveEl.setAttribute("role", "status");
    this._liveEl.setAttribute("aria-live", "polite");
    this._liveEl.setAttribute("aria-atomic", "true");
    Object.assign(this._liveEl.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: "0",
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0,0,0,0)",
      whiteSpace: "nowrap",
      border: "0",
    });
    container.appendChild(this._liveEl);
  }

  /** Set initial ARIA attributes on the canvas element */
  initCanvas(canvas: HTMLCanvasElement): void {
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-roledescription", this._locale.chartDescription);
    canvas.setAttribute("tabindex", "0");
    canvas.setAttribute("aria-description", this._locale.keyboardShortcuts);
  }

  /** Update the canvas aria-label with current chart description */
  updateLabel(
    canvas: HTMLCanvasElement,
    chartType: string,
    candleCount: number,
    indicatorCount: number,
  ): void {
    const l = this._locale;
    const parts = [`${chartType} chart`];
    if (candleCount > 0) parts.push(`${candleCount} ${l.dataPoints}`);
    if (indicatorCount > 0)
      parts.push(`${indicatorCount} ${indicatorCount > 1 ? l.indicators : l.indicator}`);
    canvas.setAttribute("aria-label", parts.join(", "));
  }

  /** Debounced update to aria-live region with OHLCV at crosshair */
  updateLive(
    crosshairIndex: number | null,
    candles: readonly CandleData[],
    priceFormatter: (price: number) => string,
  ): void {
    if (crosshairIndex === null) return;

    const idx = crosshairIndex;
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      const candle = candles[idx];
      if (!candle) return;
      const l = this._locale;
      this._liveEl.textContent =
        `${l.open} ${priceFormatter(candle.open)}, ` +
        `${l.high} ${priceFormatter(candle.high)}, ` +
        `${l.low} ${priceFormatter(candle.low)}, ` +
        `${l.close} ${priceFormatter(candle.close)}, ` +
        `${l.volume} ${candle.volume.toLocaleString()}`;
    }, 300);
  }

  destroy(): void {
    if (this._timer !== null) clearTimeout(this._timer);
    this._liveEl.remove();
  }
}
