/**
 * Active Bar — the strip pinned to the bottom of the sidebar that lists every
 * mounted indicator instance as a pill.
 *
 * The sidebar owns the selection state; it passes the current instances to
 * `render()` on every change. Each pill shows the shortName, lets the user
 * edit the first numeric param inline, and has a × to remove the instance.
 */

/** One pill: an active primary or extra indicator instance. */
export type ActiveBarItem = {
  shortName: string;
  params: Record<string, unknown>;
  /** Param shown as the inline-editable number, or null to show all params. */
  editableKey: string | null;
  onEdit: (newValue: number) => void;
  onRemove: () => void;
};

export type ActiveBarHandle = {
  /** Replace the pills with `items` (an empty list shows the hint). */
  render(items: readonly ActiveBarItem[]): void;
};

export function createActiveBar(container: HTMLElement): ActiveBarHandle {
  const bar = document.createElement("div");
  bar.style.cssText =
    "padding:8px 12px;border-top:1px solid var(--border);flex-shrink:0;display:flex;flex-wrap:wrap;gap:4px;align-items:center;min-height:36px;background:var(--surface);";
  container.appendChild(bar);

  let lastItems: readonly ActiveBarItem[] = [];

  function render(items: readonly ActiveBarItem[]): void {
    lastItems = items;
    bar.innerHTML = "";
    if (items.length === 0) {
      const hint = document.createElement("span");
      hint.style.cssText = "font-size:11px;color:var(--text-muted);";
      hint.textContent = "Click an indicator to add it to the chart";
      bar.appendChild(hint);
      return;
    }

    // Cancelling an inline edit restores the pills as they were.
    const rerender = () => render(lastItems);
    for (const item of items) bar.appendChild(makePill(item, rerender));

    const count = document.createElement("span");
    count.style.cssText = "font-size:11px;color:var(--text-muted);margin-left:auto;";
    count.textContent = `${items.length} active`;
    bar.appendChild(count);
  }

  return { render };
}

/**
 * Render an active-indicator pill. The shortName prefix is static; the
 * first numeric param is editable inline — click the number to turn it
 * into an input, then press Enter or blur to apply via `onEdit`.
 * The × on the right removes the instance.
 */
function makePill(item: ActiveBarItem, rerender: () => void): HTMLSpanElement {
  const { shortName, params, editableKey, onEdit, onRemove } = item;
  const pill = document.createElement("span");
  pill.style.cssText =
    "display:inline-flex;align-items:center;gap:4px;padding:2px 4px 2px 8px;background:color-mix(in srgb, var(--accent) 12%, transparent);border:1px solid var(--accent);border-radius:12px;font-size:11px;color:var(--accent);white-space:nowrap;";

  const prefix = document.createElement("span");
  prefix.textContent = shortName;
  pill.appendChild(prefix);

  if (editableKey !== null) {
    const open = document.createElement("span");
    open.textContent = "(";
    pill.appendChild(open);

    const numericEl = document.createElement("span");
    numericEl.textContent = String(params[editableKey] ?? "");
    numericEl.title = "Click to edit";
    numericEl.style.cssText =
      "cursor:text;padding:0 2px;border-radius:2px;background:color-mix(in srgb, var(--accent) 12%, transparent);";
    numericEl.addEventListener("click", (e) => {
      e.stopPropagation();
      // Swap span → input for inline editing
      const input = document.createElement("input");
      input.type = "number";
      input.value = numericEl.textContent ?? "";
      input.style.cssText =
        "width:40px;padding:0 2px;background:var(--bg);border:1px solid var(--accent);border-radius:2px;color:var(--accent);font-size:11px;text-align:center;outline:none;";
      numericEl.replaceWith(input);
      input.focus();
      input.select();
      const commit = () => {
        const v = Number.parseFloat(input.value);
        if (!Number.isNaN(v)) onEdit(v);
        else rerender();
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") input.blur();
        else if (ev.key === "Escape") {
          input.value = numericEl.textContent ?? "";
          rerender();
        }
      });
    });
    pill.appendChild(numericEl);

    const close = document.createElement("span");
    close.textContent = ")";
    pill.appendChild(close);
  } else {
    const summary = paramsSummaryRaw(params);
    if (summary) {
      const s = document.createElement("span");
      s.textContent = summary;
      pill.appendChild(s);
    }
  }

  const removeBtn = document.createElement("span");
  removeBtn.textContent = "×";
  removeBtn.style.cssText =
    "font-size:14px;line-height:1;opacity:0.7;cursor:pointer;padding:0 4px;margin-left:2px;";
  removeBtn.addEventListener("mouseenter", () => {
    removeBtn.style.opacity = "1";
  });
  removeBtn.addEventListener("mouseleave", () => {
    removeBtn.style.opacity = "0.7";
  });
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onRemove();
  });
  pill.appendChild(removeBtn);

  return pill;
}

function paramsSummaryRaw(params: Record<string, unknown>): string {
  const vals = Object.values(params);
  if (vals.length === 0) return "";
  return `(${vals.join(", ")})`;
}
