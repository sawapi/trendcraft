/**
 * Sparkline e2e fixture page: an empty body plus the sparkline API on
 * `window.__spark`, so specs build the canvases and their CSS themselves.
 * `.fluid` is a stylesheet-sized canvas (width 100%, height 30px).
 */

import { createSparkline, createSparklineGroup } from "../../src/sparkline";

declare global {
  interface Window {
    __spark: {
      createSparkline: typeof createSparkline;
      createSparklineGroup: typeof createSparklineGroup;
      ready: boolean;
    };
  }
}

window.__spark = { createSparkline, createSparklineGroup, ready: true };
