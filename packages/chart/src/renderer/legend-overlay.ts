/**
 * DOM-based per-series legend with click-to-toggle plus hover-revealed
 * ⚙ edit / ✕ remove affordances. Edit and remove emit callbacks; the chart
 * never mutates series in response — host owns indicator lifecycle.
 *
 * Uses event delegation so only one click listener exists regardless of how
 * many rows are rendered.
 */

import type { InternalSeries } from "../core/data-layer";
import { escapeHtml } from "../core/html";
import { type ChartLocale, DEFAULT_LOCALE } from "../core/i18n";
import type { ThemeColors } from "../core/types";

type LegendAction = "toggle" | "edit" | "remove";

export class LegendOverlay {
  private _el: HTMLElement;
  private _theme: ThemeColors;
  private _onToggle: ((seriesId: string, visible: boolean) => void) | null = null;
  private _onEdit: ((seriesId: string, anchorEl: HTMLElement) => void) | null = null;
  private _onRemove: ((seriesId: string, anchorEl: HTMLElement) => void) | null = null;
  private _currentSeries: InternalSeries[] = [];
  private _handleClick: (e: MouseEvent) => void;
  private _lastHtml = "";
  private _locale: ChartLocale;

  private _styleEl: HTMLStyleElement | null = null;

  constructor(container: HTMLElement, theme: ThemeColors, locale?: ChartLocale) {
    this._theme = theme;
    this._locale = locale ?? DEFAULT_LOCALE;

    this._styleEl = document.createElement("style");
    this._styleEl.textContent =
      '.tc-legend{position:absolute;top:22px;right:68px;left:4px;z-index:10;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;font-size:11px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;pointer-events:none}' +
      ".tc-legend-row{display:inline-flex;align-items:center;gap:2px;pointer-events:auto}" +
      ".tc-legend-btn,.tc-legend-action{cursor:pointer;background:none;border:none;font:inherit;color:inherit;pointer-events:auto}" +
      ".tc-legend-btn{white-space:nowrap;padding:2px 4px;line-height:inherit;min-height:24px}" +
      ".tc-legend-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px;vertical-align:middle}" +
      ".tc-legend-actions{display:inline-flex;opacity:0;transition:opacity 120ms ease}" +
      ".tc-legend-row:hover .tc-legend-actions,.tc-legend-row:focus-within .tc-legend-actions{opacity:1}" +
      ".tc-legend-action{padding:2px 4px;line-height:1;min-height:24px;min-width:20px;opacity:.65}" +
      ".tc-legend-action:hover,.tc-legend-action:focus-visible{opacity:1;outline:none}" +
      "@media(pointer:coarse){.tc-legend-btn{min-height:36px;padding:6px 10px;font-size:13px}.tc-legend-action{min-height:36px;min-width:32px;padding:6px 8px;font-size:13px}.tc-legend-actions{opacity:1}}" +
      "@media(max-width:480px){.tc-legend{right:4px;top:auto;bottom:4px;gap:4px;font-size:10px;justify-content:flex-start}}";
    container.appendChild(this._styleEl);

    this._el = document.createElement("div");
    this._el.className = "tc-legend";
    container.appendChild(this._el);

    // Single delegated click handler — never leaked across `update()` calls.
    this._handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-series-id]") as HTMLElement | null;
      if (!target) return;
      const id = target.dataset.seriesId;
      if (!id) return;
      const action = (target.dataset.action ?? "toggle") as LegendAction;
      if (action === "edit") {
        this._onEdit?.(id, target);
        return;
      }
      if (action === "remove") {
        this._onRemove?.(id, target);
        return;
      }
      const series = this._currentSeries.find((s) => s.id === id);
      if (!series) return;
      this._onToggle?.(id, !series.visible);
    };
    this._el.addEventListener("click", this._handleClick);
  }

  setOnToggle(cb: (seriesId: string, visible: boolean) => void): void {
    this._onToggle = cb;
  }

  /**
   * Edit and remove affordances are only rendered when a callback is wired,
   * so the legend doesn't promise actions the host won't service. Pass `null`
   * to clear. Toggling presence after rows are already on screen forces a
   * re-render.
   */
  setOnEdit(cb: ((seriesId: string, anchorEl: HTMLElement) => void) | null): void {
    const presenceChanged = (this._onEdit === null) !== (cb === null);
    this._onEdit = cb;
    if (presenceChanged && this._currentSeries.length > 0) this._rerender();
  }

  setOnRemove(cb: ((seriesId: string, anchorEl: HTMLElement) => void) | null): void {
    const presenceChanged = (this._onRemove === null) !== (cb === null);
    this._onRemove = cb;
    if (presenceChanged && this._currentSeries.length > 0) this._rerender();
  }

  private _rerender(): void {
    this._lastHtml = "";
    this.update(this._currentSeries);
  }

  setTheme(theme: ThemeColors): void {
    this._theme = theme;
  }

  /**
   * Live lookup of the legend row element for a given series id. Hosts that
   * anchor a popover to a row need this after a remove+add cycle (param edit)
   * because the row's DOM is rebuilt and the original `anchorEl` is detached.
   * Returns the always-present toggle button (`.tc-legend-btn`); action
   * buttons depend on listener presence and may not exist.
   */
  getRowAnchor(seriesId: string): HTMLElement | null {
    const sel = `.tc-legend-btn[data-series-id="${CSS.escape(seriesId)}"]`;
    return this._el.querySelector(sel) as HTMLElement | null;
  }

  update(allSeries: InternalSeries[]): void {
    this._currentSeries = allSeries;

    const labeled = allSeries.filter((s) => s.config.label);
    if (labeled.length === 0) {
      if (this._lastHtml !== "") {
        this._el.innerHTML = "";
        this._lastHtml = "";
      }
      return;
    }

    const html = labeled.map((s) => this._renderRow(s)).join("");

    if (html !== this._lastHtml) {
      this._el.innerHTML = html;
      this._lastHtml = html;
    }
  }

  private _renderRow(s: InternalSeries): string {
    const rawLabel = s.config.label ?? "";
    const color = escapeHtml(s.config.color ?? this._theme.text);
    const style = s.visible ? "" : "opacity:.35;text-decoration:line-through";
    const label = escapeHtml(rawLabel);
    const id = escapeHtml(s.id);
    const t = escapeHtml(this._theme.text);
    const visAria = escapeHtml(this._locale.toggleVisibility(rawLabel));
    let actions = "";
    if (this._onEdit) {
      const aria = escapeHtml(this._locale.editSeries?.(rawLabel) ?? `Edit ${rawLabel}`);
      actions += `<button type="button" class="tc-legend-action" data-series-id="${id}" data-action="edit" aria-label="${aria}" title="${aria}">⚙</button>`;
    }
    if (this._onRemove) {
      const aria = escapeHtml(this._locale.removeSeries?.(rawLabel) ?? `Remove ${rawLabel}`);
      actions += `<button type="button" class="tc-legend-action" data-series-id="${id}" data-action="remove" aria-label="${aria}" title="${aria}">✕</button>`;
    }
    const actionsSpan = actions ? `<span class="tc-legend-actions">${actions}</span>` : "";
    return `<span class="tc-legend-row" style="color:${t}"><button type="button" class="tc-legend-btn" data-series-id="${id}" data-action="toggle" aria-pressed="${s.visible}" aria-label="${visAria}" style="${style}"><span class="tc-legend-dot" style="background:${color}"></span>${label}</button>${actionsSpan}</span>`;
  }

  destroy(): void {
    this._el.removeEventListener("click", this._handleClick);
    this._el.remove();
    this._styleEl?.remove();
  }
}
