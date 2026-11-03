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
import { type ActiveBarItem, createActiveBar } from "./active-bar";

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
  /** Toggle a primary instance as if its row were clicked (fires `onToggle`). */
  setPrimaryActive: (id: string, active: boolean) => void;
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
  // No height here: the page sizes the sidebar (a stretched flex item on
  // desktop, top/bottom insets in the phone drawer). An inline height:100%
  // overrode the drawer's bottom inset and pushed it off a phone screen.
  container.style.cssText =
    "display:flex;flex-direction:column;background:var(--surface);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;overflow:hidden;";

  // Search bar
  const searchBox = document.createElement("div");
  searchBox.style.cssText = "padding:12px;border-bottom:1px solid var(--border);flex-shrink:0;";
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Search indicators...";
  searchInput.style.cssText =
    "width:100%;box-sizing:border-box;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none;";
  searchInput.addEventListener("focus", () => {
    searchInput.style.borderColor = "var(--accent)";
  });
  searchInput.addEventListener("blur", () => {
    searchInput.style.borderColor = "var(--border)";
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
  const activeBar = createActiveBar(container);

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
        "padding:10px 12px;cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--surface-2);background:var(--bg);";
      header.addEventListener("mouseenter", () => {
        header.style.background = "var(--surface-2)";
      });
      header.addEventListener("mouseleave", () => {
        header.style.background = "var(--bg)";
      });

      const headerLeft = document.createElement("span");
      headerLeft.style.cssText =
        "font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;";
      headerLeft.textContent = `${isExpanded ? "\u25BC" : "\u25B6"} ${cat}`;
      header.appendChild(headerLeft);

      const headerRight = document.createElement("span");
      headerRight.style.cssText = "font-size:11px;color:var(--text-muted);";
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
        row.style.cssText = `padding:6px 12px 6px 20px;cursor:pointer;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);${isActive ? "background:color-mix(in srgb, var(--accent) 12%, transparent);" : ""}`;
        row.addEventListener("mouseenter", () => {
          row.style.background = isActive
            ? "color-mix(in srgb, var(--accent) 20%, transparent)"
            : "var(--surface-2)";
        });
        row.addEventListener("mouseleave", () => {
          row.style.background = isActive
            ? "color-mix(in srgb, var(--accent) 12%, transparent)"
            : "transparent";
        });

        // Checkbox
        const checkbox = document.createElement("span");
        checkbox.style.cssText = `width:16px;height:16px;border-radius:3px;border:1.5px solid ${isActive ? "var(--accent)" : "var(--text-muted)"};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;${isActive ? "background:var(--accent);color:var(--accent-text);" : ""}`;
        checkbox.textContent = isActive ? "\u2713" : "";
        row.appendChild(checkbox);

        // Label
        const labelWrap = document.createElement("div");
        labelWrap.style.cssText = "flex:1;min-width:0;";
        const nameEl = document.createElement("div");
        nameEl.style.cssText = `font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${isActive ? "color:var(--accent);" : ""}`;
        nameEl.textContent = entry.shortName;
        nameEl.title = `${entry.name}\n${entry.description}`;
        labelWrap.appendChild(nameEl);
        const descEl = document.createElement("div");
        descEl.style.cssText =
          "font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
        descEl.textContent = entry.name;
        labelWrap.appendChild(descEl);
        row.appendChild(labelWrap);

        // Overlay badge
        if (entry.overlay) {
          const badge = document.createElement("span");
          badge.style.cssText =
            "font-size:9px;padding:1px 4px;border-radius:3px;background:var(--border);color:var(--text-muted);flex-shrink:0;";
          badge.textContent = "overlay";
          row.appendChild(badge);
        }

        // "+" button: add another instance with current form params
        if (hasParams) {
          const addBtn = document.createElement("span");
          addBtn.style.cssText =
            "font-size:14px;color:var(--text-muted);flex-shrink:0;padding:2px 6px;border:1px solid var(--border);border-radius:4px;line-height:1;";
          addBtn.textContent = "+";
          addBtn.title = "Add another instance with the current parameters";
          addBtn.addEventListener("mouseenter", () => {
            addBtn.style.color = "var(--accent)";
            addBtn.style.borderColor = "var(--accent)";
          });
          addBtn.addEventListener("mouseleave", () => {
            addBtn.style.color = "var(--text-muted)";
            addBtn.style.borderColor = "var(--border)";
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
          expandBtn.style.cssText =
            "font-size:11px;color:var(--text-muted);flex-shrink:0;padding:2px 4px;";
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
            "padding:8px 12px 8px 36px;background:var(--bg);border-bottom:1px solid var(--border);";
          paramBox.addEventListener("click", (e) => e.stopPropagation());

          for (const p of entry.params) {
            const paramRow = document.createElement("div");
            paramRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:4px;";

            const label = document.createElement("label");
            label.style.cssText =
              "font-size:11px;color:var(--text-muted);width:70px;flex-shrink:0;";
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
      "width:70px;padding:4px 6px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:12px;text-align:right;outline:none;";
    input.addEventListener("focus", () => {
      input.style.borderColor = "var(--accent)";
    });
    input.addEventListener("blur", () => {
      input.style.borderColor = "var(--border)";
    });
    return input;
  }

  function renderActiveBar() {
    const items: ActiveBarItem[] = [];

    // Primary instances first
    for (const id of activeIds) {
      const entry = catalog.find((e) => e.id === id);
      if (!entry) continue;
      const editKey = entry.params.find((p) => typeof p.default === "number")?.key ?? null;
      items.push({
        shortName: entry.shortName,
        params: getParams(id),
        editableKey: editKey,
        onEdit: (newVal) => {
          const paramMap = currentParams.get(id);
          if (paramMap && editKey) paramMap[editKey] = newVal;
          callbacks.onParamChange(id, getParams(id));
          renderList();
          renderActiveBar();
        },
        onRemove: () => {
          activeIds.delete(id);
          callbacks.onToggle(id, false, getParams(id));
          renderList();
          renderActiveBar();
        },
      });
    }

    // Extra instances
    for (const extra of extraInstances.values()) {
      const entry = catalog.find((e) => e.id === extra.presetId);
      if (!entry) continue;
      const editKey = entry.params.find((p) => typeof p.default === "number")?.key ?? null;
      items.push({
        shortName: entry.shortName,
        params: extra.params,
        editableKey: editKey,
        onEdit: (newVal) => {
          if (editKey) extra.params = { ...extra.params, [editKey]: newVal };
          callbacks.onChangeExtraParams(extra);
          renderActiveBar();
        },
        onRemove: () => {
          extraInstances.delete(extra.snapshotName);
          callbacks.onRemoveExtra(extra.snapshotName);
          renderActiveBar();
        },
      });
    }

    activeBar.render(items);
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
    setPrimaryActive(id, active) {
      if (activeIds.has(id) === active) return;
      if (active) activeIds.add(id);
      else activeIds.delete(id);
      callbacks.onToggle(id, active, getParams(id));
      renderList();
      renderActiveBar();
    },
    getScrollSlot() {
      return scrollSlot;
    },
  };
}
