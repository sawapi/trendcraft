/**
 * Singleton-per-group tooltip element. Lives on document.body, hidden by default.
 *
 * Its colours come from CSS custom properties, so a page can restyle it from a
 * stylesheet and a theme switch carries over with no call into the group:
 * `--tc-sparkline-tooltip-bg`, `--tc-sparkline-tooltip-color` and
 * `--tc-sparkline-tooltip-border`, set on `:root` (it is a child of `body`,
 * so variables scoped to a container do not reach it). Unset, it keeps its
 * dark default.
 */
export type Tooltip = {
  show(x: number, y: number, text: string): void;
  hide(): void;
  destroy(): void;
};

export function createTooltip(): Tooltip {
  if (typeof document === "undefined") {
    return {
      show: () => {},
      hide: () => {},
      destroy: () => {},
    };
  }

  const el = document.createElement("div");
  el.setAttribute("data-tc-sparkline-tooltip", "");
  el.style.cssText = [
    "position: fixed",
    "pointer-events: none",
    "background: var(--tc-sparkline-tooltip-bg, rgba(20, 23, 34, 0.92))",
    "color: var(--tc-sparkline-tooltip-color, #e5e7eb)",
    "border: var(--tc-sparkline-tooltip-border, none)",
    "font: 11px/1.3 ui-sans-serif, system-ui, -apple-system, sans-serif",
    "padding: 4px 6px",
    "border-radius: 4px",
    "white-space: nowrap",
    "z-index: 99999",
    "display: none",
    "transform: translate(-50%, -100%)",
  ].join(";");
  document.body.appendChild(el);

  return {
    show(x, y, text) {
      el.textContent = text;
      el.style.left = `${x}px`;
      el.style.top = `${y - 8}px`;
      el.style.display = "block";
    },
    hide() {
      el.style.display = "none";
    },
    destroy() {
      if (el.parentNode) el.parentNode.removeChild(el);
    },
  };
}
