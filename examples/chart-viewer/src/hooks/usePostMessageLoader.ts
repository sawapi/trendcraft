import { useEffect } from "react";
import { useChartStore } from "../store/chartStore";
import type { NormalizedCandle } from "trendcraft";
import type { FundamentalData } from "../types";

interface ChartDataMessage {
  type: "LOAD_CHART_DATA";
  candles: NormalizedCandle[];
  fundamentals?: FundamentalData | null;
  fileName?: string;
}

/**
 * Listen for postMessage from parent window to load chart data
 *
 * On mount, sends a "CHART_VIEWER_READY" message to opener/parent.
 *
 * Usage from parent (window.open):
 * ```javascript
 * const popup = window.open('http://localhost:5176/', '_blank');
 *
 * window.addEventListener('message', (event) => {
 *   if (event.data?.type === 'CHART_VIEWER_READY') {
 *     popup.postMessage({
 *       type: 'LOAD_CHART_DATA',
 *       candles: [...],
 *       fileName: 'MyData'
 *     }, '*');
 *   }
 * });
 * ```
 *
 * Usage from parent (iframe):
 * ```javascript
 * const iframe = document.querySelector('iframe');
 * iframe.contentWindow.postMessage({
 *   type: 'LOAD_CHART_DATA',
 *   candles: [...],
 *   fundamentals: { per: [...], pbr: [...] },
 *   fileName: 'MyData'
 * }, '*');
 * ```
 */
export function usePostMessageLoader() {
  const loadCandles = useChartStore((state) => state.loadCandles);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ChartDataMessage>) => {
      // Validate message type
      if (event.data?.type !== "LOAD_CHART_DATA") return;

      // Validate candles data
      const { candles, fundamentals, fileName } = event.data;
      if (!Array.isArray(candles) || candles.length === 0) {
        console.warn("[chart-viewer] Invalid candles data received");
        return;
      }

      console.log("[chart-viewer] Received postMessage data:", {
        candleCount: candles.length,
        hasFundamentals: !!fundamentals,
        fileName: fileName ?? "External Data",
        origin: event.origin,
      });

      // Load data into store
      loadCandles(candles, fundamentals ?? null, fileName ?? "External Data");
    };

    window.addEventListener("message", handleMessage);

    // Notify opener/parent that chart-viewer is ready
    const readyMessage = { type: "CHART_VIEWER_READY" };
    if (window.opener) {
      window.opener.postMessage(readyMessage, "*");
      console.log("[chart-viewer] Sent READY to opener");
    }
    if (window.parent !== window) {
      window.parent.postMessage(readyMessage, "*");
      console.log("[chart-viewer] Sent READY to parent");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, [loadCandles]);
}
