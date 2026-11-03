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
import { bumpUntilUnique, createParamInput, isValidParam } from "./param-input";

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

/**
 * Callbacks that add or change an indicator return whether it was applied.
 * `false` means the indicator rejected the params (for example a fast period
 * not below the slow one), and the sidebar puts its own state back.
 */
export type SidebarCallbacks = {
  /** Toggle the primary (default-snapshotName) instance for this preset. */
  onToggle: (id: string, active: boolean, params: Record<string, unknown>) => boolean;
  /** Change params for the primary instance (only fires if active). */
  onParamChange: (id: string, params: Record<string, unknown>) => boolean;
  /** Add an extra instance with an explicit snapshotName. */
  onAddExtra: (extra: ExtraInstance) => boolean;
  /** Remove an extra instance by its snapshotName. */
  onRemoveExtra: (snapshotName: string) => void;
  /** Change params of an extra instance by its snapshotName. */
  onChangeExtraParams: (extra: ExtraInstance) => boolean;
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
  container.style.cssText =
    "display:flex;flex-direction:column;height:100%;background:var(--surface);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;overflow:hidden;";

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

  /** Params for a new "+" instance that differ from every existing one. */
  function differentiateParams(
    entry: SidebarEntry,
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    const used: string[] = [];
    if (activeIds.has(entry.id)) used.push(JSON.stringify(getParams(entry.id)));
    for (const ex of extraInstances.values()) {
      if (ex.presetId === entry.id) used.push(JSON.stringify(ex.params));
    }
    return bumpUntilUnique(entry.params, params, used);
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
            if (!callbacks.onAddExtra(extra)) extraInstances.delete(snapshotName);
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
          if (!callbacks.onToggle(entry.id, nowActive, getParams(entry.id))) {
            activeIds.delete(entry.id);
          }
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
              const paramMap = currentParams.get(entry.id);
              if (!paramMap || !isValidParam(p, val)) {
                // Out of range or not a whole step: put the current value back
                input.value = String(paramMap?.[p.key] ?? p.default);
                return;
              }
              const previous = paramMap[p.key];
              paramMap[p.key] = val;
              if (activeIds.has(entry.id)) {
                if (!callbacks.onParamChange(entry.id, getParams(entry.id))) {
                  // Rejected by the indicator: keep the values it still runs with
                  paramMap[p.key] = previous;
                  input.value = String(previous ?? p.default);
                }
                // Keep the pill in the active bar in step with the panel
                renderActiveBar();
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
          const schema = entry.params.find((p) => p.key === editKey);
          if (paramMap && editKey && schema && isValidParam(schema, newVal)) {
            const previous = paramMap[editKey];
            paramMap[editKey] = newVal;
            if (!callbacks.onParamChange(id, getParams(id))) paramMap[editKey] = previous;
            renderList();
          }
          // An invalid value leaves the indicator as it was; redraw the pill
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
          const schema = entry.params.find((p) => p.key === editKey);
          if (editKey && schema && isValidParam(schema, newVal)) {
            const previous = extra.params;
            extra.params = { ...extra.params, [editKey]: newVal };
            if (!callbacks.onChangeExtraParams(extra)) extra.params = previous;
          }
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
      if (!callbacks.onToggle(id, active, getParams(id))) activeIds.delete(id);
      renderList();
      renderActiveBar();
    },
    getScrollSlot() {
      return scrollSlot;
    },
  };
}
