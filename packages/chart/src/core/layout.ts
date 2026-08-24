/**
 * Layout Engine — Flex-based multi-pane layout calculator.
 * No pixel math nightmares: panes declare flex proportions,
 * the engine allocates pixel heights.
 */

import type { LayoutConfig, PaneConfig, PaneRect } from "./types";

const DEFAULT_GAP = 4;

/**
 * Deep-freeze a layout template so it cannot be adopted as mutable state.
 *
 * The engine mutates its own config in place (panes are pushed, spliced, and
 * their `flex` rewritten by divider drags), so a template held by reference
 * would become every later chart's create-time default. Freezing makes that
 * mistake throw in strict mode instead of silently corrupting the module.
 */
function freezeLayout(config: LayoutConfig): LayoutConfig {
  for (const pane of config.panes) Object.freeze(pane);
  Object.freeze(config.panes);
  return Object.freeze(config);
}

/**
 * Copy a pane so the engine owns the object it mutates.
 *
 * One level deep is the right depth, and the whole depth that is needed:
 * `flex` is the only field written after construction (by `resizePanes` and
 * the zero-flex normalisation in `recompute`). The nested `yRange`,
 * `referenceLines` and `leftScale` are read-only to the engine, so they are
 * shared rather than duplicated on every layout change.
 */
function clonePane(pane: PaneConfig): PaneConfig {
  return { ...pane };
}

/**
 * Clone a layout config so the engine owns every object it mutates.
 *
 * Both the `panes` array and each `PaneConfig` inside it are copied — a
 * shallow copy of the array would leave the panes themselves shared.
 */
function cloneLayout(config: LayoutConfig): LayoutConfig {
  return { ...config, panes: config.panes.map(clonePane) };
}

/**
 * Default layout: main chart + volume.
 *
 * An immutable template. {@link LayoutEngine} clones it rather than adopting
 * it, so runtime pane changes on one chart never reach another.
 */
export const DEFAULT_LAYOUT: LayoutConfig = freezeLayout({
  panes: [
    { id: "main", flex: 3 },
    { id: "volume", flex: 0.7 },
  ],
  gap: DEFAULT_GAP,
  scrollbar: true,
});

/** Default layout without volume pane. An immutable template, as above. */
export const DEFAULT_LAYOUT_NO_VOLUME: LayoutConfig = freezeLayout({
  panes: [{ id: "main", flex: 3 }],
  gap: DEFAULT_GAP,
  scrollbar: true,
});

export class LayoutEngine {
  private _config: LayoutConfig = cloneLayout(DEFAULT_LAYOUT);
  private _totalWidth = 0;
  private _totalHeight = 0;
  private _priceAxisWidth = 60;
  private _timeAxisHeight = 32;
  private _scrollbarHeight = 16;
  private _paneRects: PaneRect[] = [];

  get config(): LayoutConfig {
    return this._config;
  }

  get paneRects(): readonly PaneRect[] {
    return this._paneRects;
  }

  /** Width available for chart data area (excluding price axis) */
  get dataAreaWidth(): number {
    return Math.max(0, this._totalWidth - this._priceAxisWidth);
  }

  /** Height available for panes (excluding time axis and scrollbar) */
  get dataAreaHeight(): number {
    let h = this._totalHeight - this._timeAxisHeight;
    if (this._config.scrollbar) h -= this._scrollbarHeight;
    return Math.max(0, h);
  }

  get priceAxisWidth(): number {
    return this._priceAxisWidth;
  }

  get timeAxisHeight(): number {
    return this._timeAxisHeight;
  }

  get scrollbarHeight(): number {
    return this._config.scrollbar ? this._scrollbarHeight : 0;
  }

  /** Time axis y position */
  get timeAxisY(): number {
    return this._totalHeight - this._timeAxisHeight - this.scrollbarHeight;
  }

  /** Scrollbar y position */
  get scrollbarY(): number {
    return this._totalHeight - this._scrollbarHeight;
  }

  setDimensions(
    width: number,
    height: number,
    priceAxisWidth?: number,
    timeAxisHeight?: number,
  ): void {
    this._totalWidth = width;
    this._totalHeight = height;
    if (priceAxisWidth !== undefined) this._priceAxisWidth = priceAxisWidth;
    if (timeAxisHeight !== undefined) this._timeAxisHeight = timeAxisHeight;
    this.recompute();
  }

  /**
   * Replace the layout. The config is cloned: the engine mutates panes in
   * place, and the caller's object — often a shared default template — must
   * not be rewritten by this chart's later pane changes.
   */
  setLayout(config: LayoutConfig): void {
    this._config = cloneLayout(config);
    this.recompute();
  }

  /**
   * Add a new pane dynamically.
   *
   * The config is copied, for the same reason {@link setLayout} copies: the
   * engine writes `flex` onto its panes, so storing the caller's object would
   * let a divider drag here rewrite a pane the caller still holds — or one it
   * handed to another engine.
   */
  addPane(paneConfig: PaneConfig): void {
    this._config.panes.push(clonePane(paneConfig));
    this.recompute();
  }

  /** Remove a pane by id (does not remove 'main') */
  removePane(id: string): boolean {
    if (id === "main") return false;
    const idx = this._config.panes.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this._config.panes.splice(idx, 1);
    this.recompute();
    return true;
  }

  /** Check if a pane id already exists */
  hasPane(id: string): boolean {
    return this._config.panes.some((p) => p.id === id);
  }

  /** Get pane config by id */
  getPane(id: string): PaneConfig | undefined {
    return this._config.panes.find((p) => p.id === id);
  }

  /** Find which pane rect contains a given y coordinate */
  paneAtY(y: number): PaneRect | undefined {
    return this._paneRects.find((p) => y >= p.y && y < p.y + p.height);
  }

  /** Check if y coordinate is on a gap between panes. Returns index of gap (pane above). */
  gapAtY(y: number): number | null {
    const gap = this._config.gap ?? 4;
    for (let i = 0; i < this._paneRects.length - 1; i++) {
      const bottom = this._paneRects[i].y + this._paneRects[i].height;
      if (y >= bottom && y < bottom + gap) return i;
    }
    return null;
  }

  /** Resize two adjacent panes by moving the divider. Delta in pixels. */
  resizePanes(gapIndex: number, deltaY: number): void {
    const panes = this._config.panes;
    if (gapIndex < 0 || gapIndex >= panes.length - 1) return;

    const totalFlex = panes[gapIndex].flex + panes[gapIndex + 1].flex;
    const totalHeight = this._paneRects[gapIndex].height + this._paneRects[gapIndex + 1].height;
    if (totalHeight <= 0) return;

    const newTopHeight = Math.max(30, this._paneRects[gapIndex].height + deltaY);
    const newBottomHeight = Math.max(30, totalHeight - newTopHeight);
    const ratio = newTopHeight / (newTopHeight + newBottomHeight);

    panes[gapIndex].flex = totalFlex * ratio;
    panes[gapIndex + 1].flex = totalFlex * (1 - ratio);
    this.recompute();
  }

  private recompute(): void {
    const panes = this._config.panes;
    if (panes.length === 0) {
      this._paneRects = [];
      return;
    }

    const gap = this._config.gap ?? DEFAULT_GAP;
    const totalGaps = (panes.length - 1) * gap;
    const availableHeight = this.dataAreaHeight - totalGaps;

    if (availableHeight <= 0) {
      this._paneRects = [];
      return;
    }

    // If every pane is configured with `flex: 0` (or any other
    // shape that sums to 0), normalize each pane's flex to 1 in
    // place so the layout becomes interactive again. Without this
    // normalisation the equal-share fallback would render the panes,
    // but any subsequent `resizePanes()` would compute totalFlex = 0
    // and immediately revert to equal share — divider drags would
    // appear to do nothing.
    let totalFlex = panes.reduce((sum, p) => sum + p.flex, 0);
    if (totalFlex <= 0) {
      for (const p of panes) p.flex = 1;
      totalFlex = panes.length;
    }

    const dataWidth = this.dataAreaWidth;

    let currentY = 0;
    this._paneRects = panes.map((pane, i) => {
      const height = Math.round((pane.flex / totalFlex) * availableHeight);
      const rect: PaneRect = {
        id: pane.id,
        x: 0,
        y: currentY,
        width: dataWidth,
        height,
        config: pane,
      };
      currentY += height + (i < panes.length - 1 ? gap : 0);
      return rect;
    });
  }
}
