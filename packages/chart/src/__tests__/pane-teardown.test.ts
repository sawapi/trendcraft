/** Removing a series tore down a pane a hidden series still used. */

import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";

describe("pane teardown", () => {
  it("keeps a pane while a hidden series is still assigned to it", () => {
    const dl = new DataLayer();
    const emptied: string[] = [];
    dl.setOnPaneEmpty((id) => emptied.push(id));
    const a = dl.addSeries([{ time: 0, value: 1 }], { pane: "rsi" }, "line");
    const b = dl.addSeries([{ time: 0, value: 2 }], { pane: "rsi" }, "line");
    a.setVisible(false);
    b.remove();
    expect(emptied).toEqual([]);
    a.remove();
    expect(emptied).toEqual(["rsi"]);
  });
});
