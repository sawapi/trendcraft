/**
 * Legend Overlay — DOM-based series list with visibility toggles.
 * Uses event delegation to avoid listener leaks on frequent updates.
 */

import type { InternalSeries } from "../core/data-layer";
import type { ThemeColors } from "../core/types";

export class LegendOverlay {
  private _container: HTMLElement;
  private _el: HTMLElement;
  private _theme: ThemeColors;
  private _onToggle: ((seriesId: string, visible: boolean) => void) | null = null;
  private _currentSeries: InternalSeries[] = [];
  private _handleClick: (e: MouseEvent) => void;
  private _lastHtml = "";

  private _styleEl: HTMLStyleElement | null = null;

  constructor(container: HTMLElement, theme: ThemeColors) {
    this._container = container;
    this._theme = theme;

    // Inject responsive styles once
    this._styleEl = document.createElement("style");
    this._styleEl.textContent = `
      .tc-legend { position:absolute; top:4px; right:68px; z-index:10; display:flex; gap:8px; flex-wrap:wrap; font-size:11px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
      .tc-legend-btn { cursor:pointer; white-space:nowrap; background:none; border:none; padding:2px 4px; font:inherit; line-height:inherit; min-height:24px; }
      @media (pointer:coarse) { .tc-legend-btn { min-height:36px; padding:6px 10px; font-size:13px; } }
      @media (max-width:480px) { .tc-legend { right:4px; top:2px; gap:4px; font-size:10px; } }
    `;
    container.appendChild(this._styleEl);

    this._el = document.createElement("div");
    this._el.className = "tc-legend";
    container.appendChild(this._el);

    // Single delegated click handler — never leaked
    this._handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-series-id]") as HTMLElement | null;
      if (!target) return;
      const id = target.dataset.seriesId;
      if (!id) return;
      const series = this._currentSeries.find((s) => s.id === id);
      if (!series) return;
      this._onToggle?.(id, !series.visible);
    };
    this._el.addEventListener("click", this._handleClick);
  }

  setOnToggle(cb: (seriesId: string, visible: boolean) => void): void {
    this._onToggle = cb;
  }

  setTheme(theme: ThemeColors): void {
    this._theme = theme;
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

    const html = labeled
      .map((s) => {
        const color = s.config.color ?? this._theme.text;
        const opacity = s.visible ? "1" : "0.35";
        const textDecoration = s.visible ? "none" : "line-through";
        const label = escapeHtml(s.config.label ?? "");
        return `<button
          type="button"
          class="tc-legend-btn"
          data-series-id="${escapeHtml(s.id)}"
          aria-pressed="${s.visible}"
          aria-label="Toggle ${label} visibility"
          style="opacity:${opacity};text-decoration:${textDecoration};color:${this._theme.text}"
        ><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escapeHtml(color)};margin-right:3px;vertical-align:middle"></span>${label}</button>`;
      })
      .join("");

    // Only update DOM when content actually changed
    if (html !== this._lastHtml) {
      this._el.innerHTML = html;
      this._lastHtml = html;
    }
  }

  destroy(): void {
    this._el.removeEventListener("click", this._handleClick);
    this._el.remove();
    this._styleEl?.remove();
  }
}

/** Prevent XSS from user-supplied labels/colors */
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
