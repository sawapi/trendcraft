/**
 * Info Overlay — DOM-based OHLCV + indicator value display.
 * Positioned over the canvas, updated on crosshair move.
 */

import type { InternalSeries } from "../core/data-layer";
import { autoFormatPrice, formatVolume } from "../core/format";
import { type ChartLocale, DEFAULT_LOCALE } from "../core/i18n";
import type { RendererRegistry } from "../core/renderer-registry";
import { defaultRegistry } from "../core/series-registry";
import type { CandleData, InfoOverlayData, PaneRect, ThemeColors } from "../core/types";

export class InfoOverlay {
  private _container: HTMLElement;
  private _mainInfo: HTMLElement;
  private _paneInfos = new Map<string, HTMLElement>();
  private _theme: ThemeColors;
  private _rendererRegistry: RendererRegistry | null = null;
  private _lastMainHtml = "";
  private _lastPaneHtml = new Map<string, string>();
  private _priceFormatter: (price: number) => string;
  private _formatInfoOverlay: ((data: InfoOverlayData) => string | null) | null;
  private _locale: ChartLocale;

  private _styleEl: HTMLStyleElement | null = null;

  constructor(
    container: HTMLElement,
    theme: ThemeColors,
    priceFormatter?: (price: number) => string,
    formatInfoOverlay?: (data: InfoOverlayData) => string | null,
    locale?: ChartLocale,
  ) {
    this._container = container;
    this._container.style.position = "relative";
    this._theme = theme;
    this._priceFormatter = priceFormatter ?? autoFormatPrice;
    this._formatInfoOverlay = formatInfoOverlay ?? null;
    this._locale = locale ?? DEFAULT_LOCALE;

    // Inject responsive styles once
    this._styleEl = document.createElement("style");
    this._styleEl.textContent = `
      .tc-info { position:absolute; z-index:10; pointer-events:none; font-size:11px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; line-height:1.4; white-space:nowrap; }
      @media (max-width:480px) { .tc-info { white-space:normal; font-size:10px; max-width:90vw; } }
    `;
    container.appendChild(this._styleEl);

    // Main pane OHLCV info
    this._mainInfo = this.createInfoElement();
    this._mainInfo.style.top = "4px";
    this._mainInfo.style.left = "4px";
    container.appendChild(this._mainInfo);
  }

  private createInfoElement(): HTMLElement {
    const el = document.createElement("div");
    el.className = "tc-info";
    return el;
  }

  setTheme(theme: ThemeColors): void {
    this._theme = theme;
  }

  setRendererRegistry(registry: RendererRegistry): void {
    this._rendererRegistry = registry;
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
    const fmtP = (n: number) => escapeHtml(this._priceFormatter(n));

    // Main pane: OHLCV
    const mainSeries = seriesByPane.get("main") ?? [];

    // Try custom formatter first
    let mainHtml: string | null = null;
    if (this._formatInfoOverlay) {
      const seriesData = mainSeries.map((s) => ({
        label: s.config.label ?? "",
        color: s.config.color ?? this._theme.text,
        value: s.data[index]?.value ?? null,
      }));
      mainHtml = this._formatInfoOverlay({ candle, index, paneId: "main", series: seriesData });
    }

    if (mainHtml === null) {
      const indicatorParts = mainSeries
        .map((s) => this.formatSeriesValue(s, index))
        .filter(Boolean);
      const l = this._locale;
      mainHtml = [
        `<span style="color:${this._theme.textSecondary}">${escapeHtml(l.open)}</span> <span style="color:${color}">${fmtP(candle.open)}</span>`,
        `<span style="color:${this._theme.textSecondary}">${escapeHtml(l.high)}</span> <span style="color:${color}">${fmtP(candle.high)}</span>`,
        `<span style="color:${this._theme.textSecondary}">${escapeHtml(l.low)}</span> <span style="color:${color}">${fmtP(candle.low)}</span>`,
        `<span style="color:${this._theme.textSecondary}">${escapeHtml(l.close)}</span> <span style="color:${color}">${fmtP(candle.close)}</span>`,
        `<span style="color:${this._theme.textSecondary}">${escapeHtml(l.volume)}</span> <span style="color:${this._theme.text}">${fmtVol(candle.volume)}</span>`,
        ...indicatorParts,
      ].join("&nbsp;&nbsp;");
    }

    if (mainHtml !== this._lastMainHtml) {
      this._mainInfo.innerHTML = mainHtml;
      this._lastMainHtml = mainHtml;
    }

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
      const paneHtml = parts.join("&nbsp;&nbsp;");
      if (paneHtml !== this._lastPaneHtml.get(pane.id)) {
        el.innerHTML = paneHtml;
        this._lastPaneHtml.set(pane.id, paneHtml);
      }
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

    const label = escapeHtml(s.config.label ?? "?");
    const color = escapeHtml(s.config.color ?? this._theme.text);

    // Check custom renderer formatValue first
    if (this._rendererRegistry) {
      const custom = this._rendererRegistry.getRenderer(s.type);
      if (custom?.formatValue) {
        const formatted = custom.formatValue(s, index);
        if (formatted !== null) return escapeHtml(formatted);
      }
    }

    const rule = defaultRegistry.detect(s.data);

    const fmtP = (n: number) => escapeHtml(this._priceFormatter(n));

    if (rule?.name === "number") {
      return `<span style="color:${color}">${label} ${fmtP(point.value as number)}</span>`;
    }

    if (rule) {
      const decomposed = rule.decompose(point.value as Record<string, number | null>);
      const parts = Object.entries(decomposed)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${escapeHtml(k)}:${fmtP(v as number)}`)
        .join(" ");
      return `<span style="color:${color}">${label}</span> <span style="color:${this._theme.text}">${parts}</span>`;
    }

    return "";
  }

  destroy(): void {
    this._mainInfo.remove();
    for (const el of this._paneInfos.values()) el.remove();
    this._paneInfos.clear();
    this._styleEl?.remove();
  }
}

const fmtVol = (n: number) => escapeHtml(formatVolume(n));

/** Prevent XSS from custom formatters */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}
