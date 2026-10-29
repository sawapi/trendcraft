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

// Internal storage type — erases the config generic to allow heterogeneous plugins
// biome-ignore lint/suspicious/noExplicitAny: Required for heterogeneous plugin storage
type AnyRendererPlugin = SeriesRendererPlugin<any>;

export class RendererRegistry {
  private _renderers = new Map<string, AnyRendererPlugin>();
  private _primitives = new Map<string, PrimitiveEntry>();

  /**
   * Register a custom series renderer. Registering the same plugin object
   * again does nothing, so a framework wrapper can re-apply its props; a
   * different plugin for a registered type replaces it, with a warning, after
   * running the old one's `destroy` hook.
   */
  registerRenderer<TConfig>(plugin: SeriesRendererPlugin<TConfig>): void {
    const existing = this._renderers.get(plugin.type);
    if (existing === plugin) return;
    if (existing) {
      console.warn(`[trendcraft/chart] Renderer "${plugin.type}" already registered, overwriting.`);
      existing.destroy?.();
    }
    plugin.init?.();
    this._renderers.set(plugin.type, plugin);
  }

  /**
   * Remove a renderer by type, running its `destroy` hook. Unknown types are
   * ignored. With `plugin`, only that plugin is removed: nothing happens when
   * another one has since been registered for the type.
   */
  unregisterRenderer<TConfig>(type: string, plugin?: SeriesRendererPlugin<TConfig>): void {
    const current = this._renderers.get(type);
    if (!current || (plugin !== undefined && current !== plugin)) return;
    current.destroy?.();
    this._renderers.delete(type);
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

  /**
   * Remove every registered primitive in one call. Runs each plugin's
   * `destroy` hook before dropping the entry. Renderers are not touched.
   */
  removeAllPrimitives(): void {
    if (this._primitives.size === 0) return;
    for (const entry of this._primitives.values()) {
      entry.plugin.destroy?.();
    }
    this._primitives.clear();
  }

  private static readonly _emptyPrimitives: PrimitiveEntry[] = [];

  /** Get all primitives for a given pane and z-order */
  getPrimitives(paneId: string, zOrder: "below" | "above"): PrimitiveEntry[] {
    if (this._primitives.size === 0) return RendererRegistry._emptyPrimitives;
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
