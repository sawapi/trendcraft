/**
 * Renderer Registry — Manages custom series renderers and pane primitives.
 *
 * Separate from SeriesRegistry (which handles data shape introspection).
 * This registry maps type names to render functions.
 */

import type { PrimitivePlugin, SeriesRendererPlugin } from "./plugin-types";

export type PrimitiveEntry = {
  plugin: PrimitivePlugin;
  state: unknown;
};

// Internal storage type — erases the generic to allow heterogeneous plugins
type AnyRendererPlugin = SeriesRendererPlugin<never>;
type AnyPrimitivePlugin = PrimitivePlugin<never>;

export class RendererRegistry {
  private _renderers = new Map<string, AnyRendererPlugin>();
  private _primitives = new Map<string, PrimitiveEntry>();

  /** Register a custom series renderer */
  registerRenderer<TConfig>(plugin: SeriesRendererPlugin<TConfig>): void {
    if (this._renderers.has(plugin.type)) {
      console.warn(`[trendcraft/chart] Renderer "${plugin.type}" already registered, overwriting.`);
    }
    plugin.init?.();
    this._renderers.set(plugin.type, plugin as unknown as AnyRendererPlugin);
  }

  /** Get a renderer by type name */
  getRenderer(type: string): SeriesRendererPlugin | undefined {
    return this._renderers.get(type) as SeriesRendererPlugin | undefined;
  }

  /** Register a pane primitive */
  registerPrimitive<TState>(plugin: PrimitivePlugin<TState>): void {
    // Clean up prior instance if exists
    const existing = this._primitives.get(plugin.name);
    if (existing) {
      existing.plugin.destroy?.();
    }
    this._primitives.set(plugin.name, {
      plugin: plugin as PrimitivePlugin,
      state:
        typeof plugin.defaultState === "object" && plugin.defaultState !== null
          ? { ...plugin.defaultState }
          : plugin.defaultState,
    });
  }

  /** Remove a primitive by name */
  removePrimitive(name: string): void {
    const entry = this._primitives.get(name);
    if (entry) {
      entry.plugin.destroy?.();
      this._primitives.delete(name);
    }
  }

  /** Get all primitives for a given pane and z-order */
  getPrimitives(paneId: string, zOrder: "below" | "above"): PrimitiveEntry[] {
    const result: PrimitiveEntry[] = [];
    for (const entry of this._primitives.values()) {
      if (
        (entry.plugin.pane === paneId || entry.plugin.pane === "all") &&
        entry.plugin.zOrder === zOrder
      ) {
        // Run update hook if provided
        if (entry.plugin.update) {
          entry.state = entry.plugin.update(entry.state);
        }
        result.push(entry);
      }
    }
    return result;
  }

  /** Check if any renderers or primitives are registered */
  get isEmpty(): boolean {
    return this._renderers.size === 0 && this._primitives.size === 0;
  }

  /** Destroy all plugins and clear registries */
  destroyAll(): void {
    for (const r of this._renderers.values()) r.destroy?.();
    for (const p of this._primitives.values()) p.plugin.destroy?.();
    this._renderers.clear();
    this._primitives.clear();
  }
}
