/**
 * Legend Overlay — DOM-based series list with visibility toggles.
 */

import type { InternalSeries } from "../core/data-layer";
import type { ThemeColors } from "../core/types";

export class LegendOverlay {
  private _container: HTMLElement;
  private _el: HTMLElement;
  private _theme: ThemeColors;
  private _onToggle: ((seriesId: string, visible: boolean) => void) | null = null;

  constructor(container: HTMLElement, theme: ThemeColors) {
    this._container = container;
    this._theme = theme;

    this._el = document.createElement("div");
    this._el.style.position = "absolute";
    this._el.style.top = "4px";
    this._el.style.right = "68px"; // Right of price axis
    this._el.style.zIndex = "10";
    this._el.style.display = "flex";
    this._el.style.gap = "8px";
    this._el.style.flexWrap = "wrap";
    this._el.style.fontSize = "11px";
    this._el.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.appendChild(this._el);
  }

  setOnToggle(cb: (seriesId: string, visible: boolean) => void): void {
    this._onToggle = cb;
  }

  setTheme(theme: ThemeColors): void {
    this._theme = theme;
  }

  update(allSeries: InternalSeries[]): void {
    // Only show series that have labels
    const labeled = allSeries.filter((s) => s.config.label);
    if (labeled.length === 0) {
      this._el.innerHTML = "";
      return;
    }

    this._el.innerHTML = labeled
      .map((s) => {
        const color = s.config.color ?? this._theme.text;
        const opacity = s.visible ? "1" : "0.35";
        const textDecoration = s.visible ? "none" : "line-through";
        return `<span
          data-series-id="${s.id}"
          style="cursor:pointer;opacity:${opacity};text-decoration:${textDecoration};color:${this._theme.text};white-space:nowrap"
        ><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:3px;vertical-align:middle"></span>${s.config.label}</span>`;
      })
      .join("");

    // Attach click handlers
    const spans = this._el.querySelectorAll<HTMLSpanElement>("[data-series-id]");
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      span.addEventListener("click", () => {
        const id = span.dataset.seriesId;
        if (!id) return;
        const series = allSeries.find((s) => s.id === id);
        if (!series) return;
        this._onToggle?.(id, !series.visible);
      });
    }
  }

  destroy(): void {
    this._el.remove();
  }
}
