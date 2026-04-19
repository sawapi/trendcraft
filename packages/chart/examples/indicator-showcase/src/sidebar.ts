/**
 * Sidebar UI Component
 *
 * Renders a categorized, searchable indicator panel with parameter controls.
 *
 * Multi-instance support:
 * - Primary instance: created by row click. Its snapshotName matches the
 *   preset's own default (e.g. `"sma20"`). Toggles on/off like before.
 * - Extra instances: created via the "+" button next to each row. Each extra
 *   gets an auto-generated snapshotName (`${presetId}#${n}`) so the chart can
 *   hold SMA(5) and SMA(25) simultaneously. Extras are removed via their own
 *   pill in the active bar (independent lifecycle from the primary).
 */

import type { IndicatorCategory, ParamSchema } from "trendcraft";

/** Sidebar entry derived from IndicatorPreset */
export type SidebarEntry = {
  id: string;
  shortName: string;
  name: string;
  description: string;
  category: IndicatorCategory;
  overlay: boolean;
  params: ParamSchema[];
};

const CATEGORIES: IndicatorCategory[] = [
  "Moving Averages",
  "Momentum",
  "Volatility",
  "Trend",
  "Volume",
  "Price",
  "Filter",
  "Adaptive",
  "Session",
  "SMC",
  "Wyckoff",
];

/** Params change for the primary instance (no explicit snapshotName). */
type ExtraInstance = {
  presetId: string;
  snapshotName: string;
  params: Record<string, unknown>;
};

export type SidebarCallbacks = {
  /** Toggle the primary (default-snapshotName) instance for this preset. */
  onToggle: (id: string, active: boolean, params: Record<string, unknown>) => void;
  /** Change params for the primary instance (only fires if active). */
  onParamChange: (id: string, params: Record<string, unknown>) => void;
  /** Add an extra instance with an explicit snapshotName. */
  onAddExtra: (extra: ExtraInstance) => void;
  /** Remove an extra instance by its snapshotName. */
  onRemoveExtra: (snapshotName: string) => void;
  /** Change params of an extra instance by its snapshotName. */
  onChangeExtraParams: (extra: ExtraInstance) => void;
};

export type SidebarAPI = {
  updateActive: (activeIds: Set<string>) => void;
  /** Element that auxiliary panels (plugins, signals) should be appended into
   * so they share the sidebar's single scroll viewport. */
  getScrollSlot: () => HTMLElement;
};

export function createSidebar(
  container: HTMLElement,
  catalog: SidebarEntry[],
  callbacks: SidebarCallbacks,
): SidebarAPI {
  const activeIds = new Set<string>();
  const expandedParams = new Set<string>();
  const currentParams = new Map<string, Record<string, unknown>>();
  const extraInstances = new Map<string, ExtraInstance>();
  const extraCounters = new Map<string, number>();

  // Initialize default params
  for (const entry of catalog) {
    const defaults: Record<string, unknown> = {};
    for (const p of entry.params) {
      defaults[p.key] = p.default;
    }
    currentParams.set(entry.id, defaults);
  }

  // Group by category
  const grouped = new Map<IndicatorCategory, SidebarEntry[]>();
  for (const cat of CATEGORIES) {
    grouped.set(cat, []);
  }
  for (const entry of catalog) {
    grouped.get(entry.category)?.push(entry);
  }

  // Expanded categories
  const expandedCats = new Set<IndicatorCategory>([CATEGORIES[0]]);

  // Search state
  let searchQuery = "";

  // Build DOM
  container.innerHTML = "";
  container.style.cssText =
    "display:flex;flex-direction:column;height:100%;background:#131722;color:#d1d4dc;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;overflow:hidden;";

  // Search bar
  const searchBox = document.createElement("div");
  searchBox.style.cssText = "padding:12px;border-bottom:1px solid #2a2e39;flex-shrink:0;";
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Search indicators...";
  searchInput.style.cssText =
    "width:100%;box-sizing:border-box;padding:8px 12px;background:#1e222d;border:1px solid #2a2e39;border-radius:6px;color:#d1d4dc;font-size:13px;outline:none;";
  searchInput.addEventListener("focus", () => {
    searchInput.style.borderColor = "#2196F3";
  });
  searchInput.addEventListener("blur", () => {
    searchInput.style.borderColor = "#2a2e39";
  });
  searchBox.appendChild(searchInput);
  container.appendChild(searchBox);

  // Scroll wrapper: contains the indicator list AND any panels appended by
  // the caller (plugins / signals). main.ts appends those panels to this
  // wrapper via `getScrollSlot()` so the three share one scroll context and
  // the active bar below can stay pinned.
  const scrollSlot = document.createElement("div");
  scrollSlot.dataset.role = "sidebar-scroll";
  scrollSlot.style.cssText = "flex:1 1 auto;overflow-y:auto;overflow-x:hidden;";
  container.appendChild(scrollSlot);
  const listEl = document.createElement("div");
  listEl.style.cssText = "flex:0 0 auto;";
  scrollSlot.appendChild(listEl);

  // Active bar — pinned at the bottom of the sidebar (outside the scroll area)
  const activeBar = document.createElement("div");
  activeBar.style.cssText =
    "padding:8px 12px;border-top:1px solid #2a2e39;flex-shrink:0;display:flex;flex-wrap:wrap;gap:4px;align-items:center;min-height:36px;background:#131722;";
  container.appendChild(activeBar);

  function matchesSearch(entry: SidebarEntry): boolean {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.name.toLowerCase().includes(q) ||
      entry.shortName.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.id.toLowerCase().includes(q)
    );
  }

  function getParams(id: string): Record<string, unknown> {
    return { ...(currentParams.get(id) ?? {}) };
  }

  function nextExtraKey(presetId: string): string {
    const n = (extraCounters.get(presetId) ?? 1) + 1;
    extraCounters.set(presetId, n);
    return `${presetId}#${n}`;
  }

  /**
   * When the user clicks "+" repeatedly without editing params, we'd end up
   * with identical overlapping instances. Auto-bump the first numeric param
   * until the resulting param tuple doesn't collide with any existing
   * instance (primary or extra) for this preset.
   */
  function differentiateParams(
    entry: SidebarEntry,
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    const used: string[] = [];
    if (activeIds.has(entry.id)) used.push(JSON.stringify(getParams(entry.id)));
    for (const ex of extraInstances.values()) {
      if (ex.presetId === entry.id) used.push(JSON.stringify(ex.params));
    }
    const firstNumericKey = entry.params.find((p) => typeof p.default === "number")?.key;
    if (!firstNumericKey) return params;

    const result = { ...params };
    const schema = entry.params.find((p) => p.key === firstNumericKey);
    const step = typeof schema?.step === "number" ? schema.step : 1;
    const max = typeof schema?.max === "number" ? schema.max : Number.POSITIVE_INFINITY;
    for (let i = 0; i < 50; i++) {
      if (!used.includes(JSON.stringify(result))) return result;
      const cur = Number(result[firstNumericKey] ?? 0);
      const next = cur + Math.max(step, Math.round(cur * 0.5));
      if (next > max) break;
      result[firstNumericKey] = next;
    }
    return result;
  }

  function renderList() {
    listEl.innerHTML = "";

    for (const cat of CATEGORIES) {
      const entries = grouped.get(cat) ?? [];
      const visibleEntries = entries.filter(matchesSearch);
      if (visibleEntries.length === 0) continue;

      const activeCount = visibleEntries.filter((e) => activeIds.has(e.id)).length;
      const isExpanded = searchQuery ? true : expandedCats.has(cat);

      // Category header
      const header = document.createElement("div");
      header.style.cssText =
        "padding:10px 12px;cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1e222d;background:#181c27;";
      header.addEventListener("mouseenter", () => {
        header.style.background = "#1e222d";
      });
      header.addEventListener("mouseleave", () => {
        header.style.background = "#181c27";
      });

      const headerLeft = document.createElement("span");
      headerLeft.style.cssText =
        "font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;";
      headerLeft.textContent = `${isExpanded ? "\u25BC" : "\u25B6"} ${cat}`;
      header.appendChild(headerLeft);

      const headerRight = document.createElement("span");
      headerRight.style.cssText = "font-size:11px;color:#787b86;";
      headerRight.textContent =
        activeCount > 0 ? `${activeCount}/${visibleEntries.length}` : `${visibleEntries.length}`;
      header.appendChild(headerRight);

      header.addEventListener("click", () => {
        if (expandedCats.has(cat)) {
          expandedCats.delete(cat);
        } else {
          expandedCats.add(cat);
        }
        renderList();
      });

      listEl.appendChild(header);

      if (!isExpanded) continue;

      // Indicator rows
      for (const entry of visibleEntries) {
        const isActive = activeIds.has(entry.id);
        const hasParams = entry.params.length > 0;
        const isParamExpanded = expandedParams.has(entry.id);

        const row = document.createElement("div");
        row.style.cssText = `padding:6px 12px 6px 20px;cursor:pointer;display:flex;align-items:center;gap:8px;border-bottom:1px solid #1a1e2b;${isActive ? "background:#1a2332;" : ""}`;
        row.addEventListener("mouseenter", () => {
          row.style.background = isActive ? "#1f2940" : "#1e222d";
        });
        row.addEventListener("mouseleave", () => {
          row.style.background = isActive ? "#1a2332" : "transparent";
        });

        // Checkbox
        const checkbox = document.createElement("span");
        checkbox.style.cssText = `width:16px;height:16px;border-radius:3px;border:1.5px solid ${isActive ? "#2196F3" : "#4a4e59"};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;${isActive ? "background:#2196F3;color:#fff;" : ""}`;
        checkbox.textContent = isActive ? "\u2713" : "";
        row.appendChild(checkbox);

        // Label
        const labelWrap = document.createElement("div");
        labelWrap.style.cssText = "flex:1;min-width:0;";
        const nameEl = document.createElement("div");
        nameEl.style.cssText = `font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${isActive ? "color:#2196F3;" : ""}`;
        nameEl.textContent = entry.shortName;
        nameEl.title = `${entry.name}\n${entry.description}`;
        labelWrap.appendChild(nameEl);
        const descEl = document.createElement("div");
        descEl.style.cssText =
          "font-size:10px;color:#787b86;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
        descEl.textContent = entry.name;
        labelWrap.appendChild(descEl);
        row.appendChild(labelWrap);

        // Overlay badge
        if (entry.overlay) {
          const badge = document.createElement("span");
          badge.style.cssText =
            "font-size:9px;padding:1px 4px;border-radius:3px;background:#2a2e39;color:#787b86;flex-shrink:0;";
          badge.textContent = "overlay";
          row.appendChild(badge);
        }

        // "+" button: add another instance with current form params
        if (hasParams) {
          const addBtn = document.createElement("span");
          addBtn.style.cssText =
            "font-size:14px;color:#787b86;flex-shrink:0;padding:2px 6px;border:1px solid #2a2e39;border-radius:4px;line-height:1;";
          addBtn.textContent = "+";
          addBtn.title = "Add another instance with the current parameters";
          addBtn.addEventListener("mouseenter", () => {
            addBtn.style.color = "#2196F3";
            addBtn.style.borderColor = "#2196F3";
          });
          addBtn.addEventListener("mouseleave", () => {
            addBtn.style.color = "#787b86";
            addBtn.style.borderColor = "#2a2e39";
          });
          addBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const params = differentiateParams(entry, getParams(entry.id));
            const snapshotName = nextExtraKey(entry.id);
            const extra: ExtraInstance = { presetId: entry.id, snapshotName, params };
            extraInstances.set(snapshotName, extra);
            callbacks.onAddExtra(extra);
            renderActiveBar();
          });
          row.appendChild(addBtn);
        }

        // Params expand button
        if (hasParams) {
          const expandBtn = document.createElement("span");
          expandBtn.style.cssText = "font-size:11px;color:#787b86;flex-shrink:0;padding:2px 4px;";
          expandBtn.textContent = isParamExpanded ? "\u25B4" : "\u25BE";
          expandBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (expandedParams.has(entry.id)) {
              expandedParams.delete(entry.id);
            } else {
              expandedParams.add(entry.id);
            }
            renderList();
          });
          row.appendChild(expandBtn);
        }

        // Click to toggle
        row.addEventListener("click", () => {
          const nowActive = !activeIds.has(entry.id);
          if (nowActive) {
            activeIds.add(entry.id);
          } else {
            activeIds.delete(entry.id);
          }
          callbacks.onToggle(entry.id, nowActive, getParams(entry.id));
          renderList();
          renderActiveBar();
        });

        listEl.appendChild(row);

        // Parameter controls (expanded)
        if (hasParams && isParamExpanded) {
          const paramBox = document.createElement("div");
          paramBox.style.cssText =
            "padding:8px 12px 8px 36px;background:#161a25;border-bottom:1px solid #1a1e2b;";
          paramBox.addEventListener("click", (e) => e.stopPropagation());

          for (const p of entry.params) {
            const paramRow = document.createElement("div");
            paramRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:4px;";

            const label = document.createElement("label");
            label.style.cssText = "font-size:11px;color:#787b86;width:70px;flex-shrink:0;";
            label.textContent = p.label;
            paramRow.appendChild(label);

            const input = createParamInput(
              p,
              (currentParams.get(entry.id)?.[p.key] ?? p.default) as number,
            );
            input.addEventListener("change", () => {
              const val = Number.parseFloat(input.value);
              if (!Number.isNaN(val)) {
                const paramMap = currentParams.get(entry.id);
                if (paramMap) paramMap[p.key] = val;
                if (activeIds.has(entry.id)) {
                  callbacks.onParamChange(entry.id, getParams(entry.id));
                }
              }
            });
            paramRow.appendChild(input);
            paramBox.appendChild(paramRow);
          }

          listEl.appendChild(paramBox);
        }
      }
    }
  }

  function createParamInput(p: ParamSchema, value: number): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "number";
    input.value = String(value);
    if (p.min !== undefined) input.min = String(p.min);
    if (p.max !== undefined) input.max = String(p.max);
    if (p.step !== undefined) input.step = String(p.step);
    input.style.cssText =
      "width:70px;padding:4px 6px;background:#1e222d;border:1px solid #2a2e39;border-radius:4px;color:#d1d4dc;font-size:12px;text-align:right;outline:none;";
    input.addEventListener("focus", () => {
      input.style.borderColor = "#2196F3";
    });
    input.addEventListener("blur", () => {
      input.style.borderColor = "#2a2e39";
    });
    return input;
  }

  /**
   * Render an active-indicator pill. The shortName prefix is static; the
   * first numeric param is editable inline — click the number to turn it
   * into an input, then press Enter or blur to apply via `onEditNumeric`.
   * The × on the right removes the instance.
   */
  function makePill(
    shortName: string,
    currentParams: Record<string, unknown>,
    editableKey: string | null,
    onEditNumeric: (newValue: number) => void,
    onRemove: () => void,
  ): HTMLSpanElement {
    const pill = document.createElement("span");
    pill.style.cssText =
      "display:inline-flex;align-items:center;gap:4px;padding:2px 4px 2px 8px;background:#1a2332;border:1px solid #2196F3;border-radius:12px;font-size:11px;color:#2196F3;white-space:nowrap;";

    const prefix = document.createElement("span");
    prefix.textContent = shortName;
    pill.appendChild(prefix);

    if (editableKey !== null) {
      const open = document.createElement("span");
      open.textContent = "(";
      pill.appendChild(open);

      const numericEl = document.createElement("span");
      numericEl.textContent = String(currentParams[editableKey] ?? "");
      numericEl.title = "Click to edit";
      numericEl.style.cssText =
        "cursor:text;padding:0 2px;border-radius:2px;background:rgba(33,150,243,0.12);";
      numericEl.addEventListener("click", (e) => {
        e.stopPropagation();
        // Swap span → input for inline editing
        const input = document.createElement("input");
        input.type = "number";
        input.value = numericEl.textContent ?? "";
        input.style.cssText =
          "width:40px;padding:0 2px;background:#0f1421;border:1px solid #2196F3;border-radius:2px;color:#2196F3;font-size:11px;text-align:center;outline:none;";
        numericEl.replaceWith(input);
        input.focus();
        input.select();
        const commit = () => {
          const v = Number.parseFloat(input.value);
          if (!Number.isNaN(v)) onEditNumeric(v);
          else renderActiveBar();
        };
        input.addEventListener("blur", commit);
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") input.blur();
          else if (ev.key === "Escape") {
            input.value = numericEl.textContent ?? "";
            renderActiveBar();
          }
        });
      });
      pill.appendChild(numericEl);

      const close = document.createElement("span");
      close.textContent = ")";
      pill.appendChild(close);
    } else {
      const summary = paramsSummaryRaw(currentParams);
      if (summary) {
        const s = document.createElement("span");
        s.textContent = summary;
        pill.appendChild(s);
      }
    }

    const removeBtn = document.createElement("span");
    removeBtn.textContent = "\u00D7";
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

  function renderActiveBar() {
    activeBar.innerHTML = "";
    if (activeIds.size === 0 && extraInstances.size === 0) {
      const hint = document.createElement("span");
      hint.style.cssText = "font-size:11px;color:#787b86;";
      hint.textContent = "Click an indicator to add it to the chart";
      activeBar.appendChild(hint);
      return;
    }

    // Primary instances first
    for (const id of activeIds) {
      const entry = catalog.find((e) => e.id === id);
      if (!entry) continue;
      const editKey = entry.params.find((p) => typeof p.default === "number")?.key ?? null;
      const pill = makePill(
        entry.shortName,
        getParams(id),
        editKey,
        (newVal) => {
          const paramMap = currentParams.get(id);
          if (paramMap && editKey) paramMap[editKey] = newVal;
          callbacks.onParamChange(id, getParams(id));
          renderList();
          renderActiveBar();
        },
        () => {
          activeIds.delete(id);
          callbacks.onToggle(id, false, getParams(id));
          renderList();
          renderActiveBar();
        },
      );
      activeBar.appendChild(pill);
    }

    // Extra instances
    for (const extra of extraInstances.values()) {
      const entry = catalog.find((e) => e.id === extra.presetId);
      if (!entry) continue;
      const editKey = entry.params.find((p) => typeof p.default === "number")?.key ?? null;
      const pill = makePill(
        entry.shortName,
        extra.params,
        editKey,
        (newVal) => {
          if (editKey) extra.params = { ...extra.params, [editKey]: newVal };
          callbacks.onChangeExtraParams(extra);
          renderActiveBar();
        },
        () => {
          extraInstances.delete(extra.snapshotName);
          callbacks.onRemoveExtra(extra.snapshotName);
          renderActiveBar();
        },
      );
      activeBar.appendChild(pill);
    }

    const total = activeIds.size + extraInstances.size;
    const count = document.createElement("span");
    count.style.cssText = "font-size:11px;color:#787b86;margin-left:auto;";
    count.textContent = `${total} active`;
    activeBar.appendChild(count);
  }

  // Search handler
  let searchTimer: ReturnType<typeof setTimeout>;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      renderList();
    }, 150);
  });

  // Initial render
  renderList();
  renderActiveBar();

  return {
    updateActive(ids: Set<string>) {
      activeIds.clear();
      for (const id of ids) activeIds.add(id);
      renderList();
      renderActiveBar();
    },
    getScrollSlot() {
      return scrollSlot;
    },
  };
}
