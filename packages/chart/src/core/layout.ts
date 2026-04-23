/**
 * Layout Engine — Flex-based multi-pane layout calculator.
 * No pixel math nightmares: panes declare flex proportions,
 * the engine allocates pixel heights.
 */

import type { LayoutConfig, PaneConfig, PaneRect } from "./types";

const DEFAULT_GAP = 4;

/** Default layout: main chart + volume */
export const DEFAULT_LAYOUT: LayoutConfig = {
  panes: [
    { id: "main", flex: 3 },
    { id: "volume", flex: 0.7 },
  ],
  gap: DEFAULT_GAP,
  scrollbar: true,
};

/** Default layout without volume pane */
export const DEFAULT_LAYOUT_NO_VOLUME: LayoutConfig = {
  panes: [{ id: "main", flex: 3 }],
  gap: DEFAULT_GAP,
  scrollbar: true,
};

export class LayoutEngine {
  private _config: LayoutConfig = DEFAULT_LAYOUT;
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

  setLayout(config: LayoutConfig): void {
    this._config = config;
    this.recompute();
  }

  /** Add a new pane dynamically */
  addPane(paneConfig: PaneConfig): void {
    this._config.panes.push(paneConfig);
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

    // Sum flex values
    const totalFlex = panes.reduce((sum, p) => sum + p.flex, 0);
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
