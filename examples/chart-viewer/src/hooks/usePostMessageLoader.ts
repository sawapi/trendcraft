import { useEffect } from "react";
import { useChartStore } from "../store/chartStore";
import type { NormalizedCandle } from "trendcraft";
import type {
  FundamentalData,
  IndicatorParams,
  OverlayType,
  SignalType,
  SubChartType,
  ZoomRange,
} from "../types";

interface IndicatorSettings {
  overlays?: OverlayType[];
  indicators?: SubChartType[];
  signals?: SignalType[];
  params?: Partial<IndicatorParams>;
  zoom?: ZoomRange;
}

interface ChartDataMessage extends IndicatorSettings {
  type: "LOAD_CHART_DATA";
  candles: NormalizedCandle[];
  fundamentals?: FundamentalData | null;
  fileName?: string;
}

interface SetIndicatorsMessage extends IndicatorSettings {
  type: "SET_INDICATORS";
}

type PostMessage = ChartDataMessage | SetIndicatorsMessage;

/**
 * Apply indicator settings to the store
 */
function applyIndicatorSettings(
  settings: IndicatorSettings,
  actions: {
    setEnabledOverlays: (overlays: OverlayType[]) => void;
    setEnabledIndicators: (indicators: SubChartType[]) => void;
    setEnabledSignals: (signals: SignalType[]) => void;
    setIndicatorParams: (params: Partial<IndicatorParams>) => void;
    setZoomRange: (range: ZoomRange) => void;
  },
) {
  if (settings.overlays) actions.setEnabledOverlays(settings.overlays);
  if (settings.indicators) actions.setEnabledIndicators(settings.indicators);
  if (settings.signals) actions.setEnabledSignals(settings.signals);
  if (settings.params) actions.setIndicatorParams(settings.params);
  if (settings.zoom) actions.setZoomRange(settings.zoom);
}

/**
 * Listen for postMessage from parent window to load chart data and configure indicators
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
 *       fileName: 'MyData',
 *       overlays: ['orderBlock'],
 *       params: { orderBlockSwingPeriod: 3 },
 *       zoom: { start: 0, end: 100 }
 *     }, '*');
 *   }
 * });
 * ```
 *
 * Usage for indicator-only updates (no data reload):
 * ```javascript
 * window.postMessage({
 *   type: 'SET_INDICATORS',
 *   overlays: ['fvg'],
 *   indicators: ['rsi'],
 *   zoom: { start: 0, end: 100 }
 * }, '*');
 * ```
 */
export function usePostMessageLoader() {
  const loadCandles = useChartStore((state) => state.loadCandles);
  const setEnabledOverlays = useChartStore((state) => state.setEnabledOverlays);
  const setEnabledIndicators = useChartStore((state) => state.setEnabledIndicators);
  const setEnabledSignals = useChartStore((state) => state.setEnabledSignals);
  const setIndicatorParams = useChartStore((state) => state.setIndicatorParams);
  const setZoomRange = useChartStore((state) => state.setZoomRange);

  useEffect(() => {
    const actions = {
      setEnabledOverlays,
      setEnabledIndicators,
      setEnabledSignals,
      setIndicatorParams,
      setZoomRange,
    };

    const handleMessage = (event: MessageEvent<PostMessage>) => {
      const { data } = event;

      if (data?.type === "LOAD_CHART_DATA") {
        const { candles, fundamentals, fileName } = data;
        if (!Array.isArray(candles) || candles.length === 0) {
          console.warn("[chart-viewer] Invalid candles data received");
          return;
        }

        console.log("[chart-viewer] Received postMessage data:", {
          candleCount: candles.length,
          hasFundamentals: !!fundamentals,
          fileName: fileName ?? "External Data",
          hasIndicatorSettings: !!(data.overlays || data.indicators || data.signals || data.params),
          origin: event.origin,
        });

        // Load data into store
        loadCandles(candles, fundamentals ?? null, fileName ?? "External Data");

        // Apply indicator settings if provided
        applyIndicatorSettings(data, actions);
        return;
      }

      if (data?.type === "SET_INDICATORS") {
        console.log("[chart-viewer] Received SET_INDICATORS:", {
          overlays: data.overlays,
          indicators: data.indicators,
          signals: data.signals,
          hasParams: !!data.params,
          zoom: data.zoom,
        });

        applyIndicatorSettings(data, actions);
        return;
      }
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
  }, [
    loadCandles,
    setEnabledOverlays,
    setEnabledIndicators,
    setEnabledSignals,
    setIndicatorParams,
    setZoomRange,
  ]);
}
