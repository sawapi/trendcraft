/**
 * Info Overlay — DOM-based OHLCV + indicator value display.
 * Positioned over the canvas, updated on crosshair move.
 */

import type { InternalSeries } from "../core/data-layer";
import { defaultRegistry } from "../core/series-registry";
import type { CandleData, PaneRect, ThemeColors } from "../core/types";

export class InfoOverlay {
  private _container: HTMLElement;
  private _mainInfo: HTMLElement;
  private _paneInfos = new Map<string, HTMLElement>();
  private _theme: ThemeColors;

  constructor(container: HTMLElement, theme: ThemeColors) {
    this._container = container;
    this._container.style.position = "relative";
    this._theme = theme;

    // Main pane OHLCV info
    this._mainInfo = this.createInfoElement();
    this._mainInfo.style.top = "4px";
    this._mainInfo.style.left = "4px";
    container.appendChild(this._mainInfo);
  }

  private createInfoElement(): HTMLElement {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.zIndex = "10";
    el.style.pointerEvents = "none";
    el.style.fontSize = "11px";
    el.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    el.style.lineHeight = "1.4";
    el.style.whiteSpace = "nowrap";
    return el;
  }

  setTheme(theme: ThemeColors): void {
    this._theme = theme;
  }

  /**
   * Update the info display for a given crosshair index.
   */
  update(
    index: number | null,
    candles: readonly CandleData[],
    paneRects: readonly PaneRect[],
    seriesByPane: Map<string, InternalSeries[]>,
  ): void {
    if (index === null || index < 0 || index >= candles.length) {
      this._mainInfo.textContent = "";
      for (const el of this._paneInfos.values()) el.textContent = "";
      return;
    }

    const candle = candles[index];
    const isUp = candle.close >= candle.open;
    const color = isUp ? this._theme.upColor : this._theme.downColor;

    // Main pane: OHLCV
    const mainSeries = seriesByPane.get("main") ?? [];
    const indicatorParts = mainSeries.map((s) => this.formatSeriesValue(s, index)).filter(Boolean);

    this._mainInfo.innerHTML = [
      `<span style="color:${this._theme.textSecondary}">O</span> <span style="color:${color}">${fmt(candle.open)}</span>`,
      `<span style="color:${this._theme.textSecondary}">H</span> <span style="color:${color}">${fmt(candle.high)}</span>`,
      `<span style="color:${this._theme.textSecondary}">L</span> <span style="color:${color}">${fmt(candle.low)}</span>`,
      `<span style="color:${this._theme.textSecondary}">C</span> <span style="color:${color}">${fmt(candle.close)}</span>`,
      `<span style="color:${this._theme.textSecondary}">V</span> <span style="color:${this._theme.text}">${fmtVol(candle.volume)}</span>`,
      ...indicatorParts,
    ].join("&nbsp;&nbsp;");

    // Sub panes: indicator values
    for (const pane of paneRects) {
      if (pane.id === "main" || pane.id === "volume") continue;

      let el = this._paneInfos.get(pane.id);
      if (!el) {
        el = this.createInfoElement();
        this._container.appendChild(el);
        this._paneInfos.set(pane.id, el);
      }
      el.style.top = `${pane.y + 4}px`;
      el.style.left = "4px";

      const paneSeries = seriesByPane.get(pane.id) ?? [];
      const parts = paneSeries.map((s) => this.formatSeriesValue(s, index)).filter(Boolean);
      el.innerHTML = parts.join("&nbsp;&nbsp;");
    }

    // Clean up removed panes
    for (const [id, el] of this._paneInfos) {
      if (!paneRects.some((p) => p.id === id)) {
        el.remove();
        this._paneInfos.delete(id);
      }
    }
  }

  private formatSeriesValue(s: InternalSeries, index: number): string {
    const point = s.data[index];
    if (!point || point.value === null || point.value === undefined) return "";

    const label = s.config.label ?? "?";
    const color = s.config.color ?? this._theme.text;
    const rule = defaultRegistry.detect(s.data);

    if (rule?.name === "number") {
      return `<span style="color:${color}">${label} ${fmt(point.value as number)}</span>`;
    }

    if (rule) {
      const decomposed = rule.decompose(point.value);
      const parts = Object.entries(decomposed)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}:${fmt(v as number)}`)
        .join(" ");
      return `<span style="color:${color}">${label}</span> <span style="color:${this._theme.text}">${parts}</span>`;
    }

    return "";
  }

  destroy(): void {
    this._mainInfo.remove();
    for (const el of this._paneInfos.values()) el.remove();
    this._paneInfos.clear();
  }
}

function fmt(n: number): string {
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(4);
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
