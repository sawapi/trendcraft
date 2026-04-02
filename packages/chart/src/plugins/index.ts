/** Plugin barrel — tree-shakeable SMC and regime visualization plugins. */

export { createRegimeHeatmap, connectRegimeHeatmap } from "./regime-heatmap";
export { createSmcLayer, connectSmcLayer } from "./smc-layer";
export type { SmcState, SmcZone, SmcMarker, SmcLevel } from "./smc-layer";
