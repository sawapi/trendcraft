/**
 * Signals Panel Component
 * Display signal event list (toggles moved to Settings dialog)
 */

import { useChartStore } from "../store/chartStore";
import { useSignals } from "../hooks/useSignals";

/**
 * Format timestamp to date string
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function SignalsPanel() {
  const currentCandles = useChartStore((state) => state.currentCandles);
  const enabledSignals = useChartStore((state) => state.enabledSignals);
  const zoomRange = useChartStore((state) => state.zoomRange);

  const signals = useSignals(currentCandles, enabledSignals);

  // Don't render if no signals are enabled
  if (enabledSignals.length === 0) {
    return null;
  }

  // Calculate visible date range
  const totalCandles = currentCandles.length;
  const startIdx = Math.floor((zoomRange.start / 100) * totalCandles);
  const endIdx = Math.ceil((zoomRange.end / 100) * totalCandles) - 1;
  const startDate = currentCandles[Math.max(0, startIdx)]?.time ?? 0;
  const endDate = currentCandles[Math.min(totalCandles - 1, endIdx)]?.time ?? Number.POSITIVE_INFINITY;

  return (
    <div className="signals-panel">
      <div className="signals-panel-header">Signal Events</div>

      {/* Perfect Order Events */}
      {enabledSignals.includes("perfectOrder") && signals.perfectOrder && (
        <PerfectOrderEvents
          data={signals.perfectOrder}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {/* Range-Bound Events */}
      {enabledSignals.includes("rangeBound") && signals.rangeBound && (
        <RangeBoundEvents
          data={signals.rangeBound}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {/* Cross Events */}
      {enabledSignals.includes("cross") && signals.crossSignals && (
        <CrossEvents
          data={signals.crossSignals}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </div>
  );
}

// ============================================================================
// Perfect Order Events
// ============================================================================

import type { PerfectOrderValueEnhanced, Series } from "trendcraft";

interface PerfectOrderEventsProps {
  data: Series<PerfectOrderValueEnhanced>;
  startDate: number;
  endDate: number;
}

type POEventType =
  | "bullish_confirmed"
  | "bearish_confirmed"
  | "pre_bullish"
  | "pre_bearish"
  | "breakdown"
  | "collapsed"
  | "pullback_buy";

interface POEvent {
  time: number;
  type: POEventType;
  confidence: number;
  gapPercent?: number;
}

function PerfectOrderEvents({ data, startDate, endDate }: PerfectOrderEventsProps) {
  const events: POEvent[] = [];

  let hasEverConfirmedBullish = false;
  let hasEverConfirmedBearish = false;

  data.forEach((po) => {
    if (po.value.state === "BULLISH_PO" && po.value.isConfirmed) hasEverConfirmedBullish = true;
    if (po.value.state === "BEARISH_PO" && po.value.isConfirmed) hasEverConfirmedBearish = true;

    if (po.time < startDate || po.time > endDate) return;

    if (po.value.confirmationFormed && po.value.state === "BULLISH_PO") {
      events.push({ time: po.time, type: "bullish_confirmed", confidence: po.value.confidence });
    }
    if (po.value.confirmationFormed && po.value.state === "BEARISH_PO") {
      events.push({ time: po.time, type: "bearish_confirmed", confidence: po.value.confidence });
    }
    if (po.value.state === "PRE_BULLISH_PO" && po.value.persistCount === 1 && !hasEverConfirmedBullish) {
      events.push({ time: po.time, type: "pre_bullish", confidence: po.value.confidence });
    }
    if (po.value.state === "PRE_BEARISH_PO" && po.value.persistCount === 1 && !hasEverConfirmedBearish) {
      events.push({ time: po.time, type: "pre_bearish", confidence: po.value.confidence });
    }
    if (po.value.breakdownDetected) {
      events.push({ time: po.time, type: "breakdown", confidence: po.value.confidence });
    }
    if (po.value.collapseDetected) {
      events.push({ time: po.time, type: "collapsed", confidence: po.value.confidence });
    }
    if (po.value.pullbackBuySignal && po.value.type === "bullish") {
      const shortMa = po.value.maValues[0];
      const midMa = po.value.maValues[1];
      const gapPercent = shortMa !== null && midMa !== null && midMa !== 0
        ? ((shortMa - midMa) / midMa) * 100
        : 0;
      events.push({ time: po.time, type: "pullback_buy", confidence: po.value.confidence, gapPercent });
    }
  });

  events.sort((a, b) => b.time - a.time);
  const limitedEvents = events.slice(0, 30);

  if (limitedEvents.length === 0) {
    return (
      <div className="events-section">
        <div className="events-header">Perfect Order</div>
        <div className="events-empty">No events in visible range</div>
      </div>
    );
  }

  return (
    <div className="events-section">
      <div className="events-header">Perfect Order</div>
      <div className="events-list">
        {limitedEvents.map((e, i) => {
          const confPercent = Math.round(e.confidence * 100);
          let className = "po-event";
          let label = "";
          let icon = "";

          switch (e.type) {
            case "bullish_confirmed":
              className += " bullish";
              icon = "↑";
              label = `Bullish [${confPercent}%]`;
              break;
            case "bearish_confirmed":
              className += " bearish";
              icon = "↓";
              label = `Bearish [${confPercent}%]`;
              break;
            case "pre_bullish":
              className += " pre-bullish";
              icon = "?";
              label = `Pre-Bull [${confPercent}%]`;
              break;
            case "pre_bearish":
              className += " pre-bearish";
              icon = "?";
              label = `Pre-Bear [${confPercent}%]`;
              break;
            case "breakdown":
              className += " breakdown";
              icon = "▼";
              label = "Breakdown";
              break;
            case "collapsed":
              className += " collapsed";
              icon = "■";
              label = "Collapsed";
              break;
            case "pullback_buy":
              className += " pullback-buy";
              icon = "▲";
              label = `Pullback Buy [${e.gapPercent?.toFixed(1)}%]`;
              break;
          }

          return (
            <span key={i} className={className} title={`Confidence: ${confPercent}%`}>
              {icon} {label} {formatDate(e.time)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Range-Bound Events
// ============================================================================

import type { RangeBoundValue } from "trendcraft";

interface RangeBoundEventsProps {
  data: Series<RangeBoundValue>;
  startDate: number;
  endDate: number;
}

type RBEventType =
  | "range_confirmed"
  | "tight_range"
  | "breakout_risk_up"
  | "breakout_risk_down"
  | "range_broken";

interface RBEvent {
  time: number;
  type: RBEventType;
  rangeScore: number;
}

function RangeBoundEvents({ data, startDate, endDate }: RangeBoundEventsProps) {
  const events: RBEvent[] = [];

  data.forEach((rb) => {
    if (rb.time < startDate || rb.time > endDate) return;

    if (rb.value.rangeConfirmed && rb.value.state === "RANGE_CONFIRMED") {
      events.push({ time: rb.time, type: "range_confirmed", rangeScore: rb.value.rangeScore });
    }
    if (rb.value.state === "RANGE_TIGHT") {
      events.push({ time: rb.time, type: "tight_range", rangeScore: rb.value.rangeScore });
    }
    if (rb.value.breakoutRiskDetected && rb.value.state === "BREAKOUT_RISK_UP") {
      events.push({ time: rb.time, type: "breakout_risk_up", rangeScore: rb.value.rangeScore });
    }
    if (rb.value.breakoutRiskDetected && rb.value.state === "BREAKOUT_RISK_DOWN") {
      events.push({ time: rb.time, type: "breakout_risk_down", rangeScore: rb.value.rangeScore });
    }
    if (rb.value.rangeBroken) {
      events.push({ time: rb.time, type: "range_broken", rangeScore: rb.value.rangeScore });
    }
  });

  events.sort((a, b) => b.time - a.time);
  const limitedEvents = events.slice(0, 30);

  if (limitedEvents.length === 0) {
    return (
      <div className="events-section">
        <div className="events-header">Range-Bound</div>
        <div className="events-empty">No events in visible range</div>
      </div>
    );
  }

  return (
    <div className="events-section">
      <div className="events-header">Range-Bound</div>
      <div className="events-list">
        {limitedEvents.map((e, i) => {
          const scoreStr = e.rangeScore.toFixed(0);
          let className = "rb-event";
          let label = "";
          let icon = "";

          switch (e.type) {
            case "range_confirmed":
              className += " range-confirmed";
              icon = "■";
              label = `Range [${scoreStr}]`;
              break;
            case "tight_range":
              className += " tight";
              icon = "■";
              label = `Tight [${scoreStr}]`;
              break;
            case "breakout_risk_up":
              className += " breakout-risk";
              icon = "▲";
              label = `Risk↑ [${scoreStr}]`;
              break;
            case "breakout_risk_down":
              className += " breakout-risk";
              icon = "▼";
              label = `Risk↓ [${scoreStr}]`;
              break;
            case "range_broken":
              className += " broken";
              icon = "◆";
              label = "Broken";
              break;
          }

          return (
            <span key={i} className={className} title={`Range Score: ${scoreStr}`}>
              {icon} {label} {formatDate(e.time)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Cross Events
// ============================================================================

import type { CrossSignalQuality } from "trendcraft";

interface CrossEventsProps {
  data: CrossSignalQuality[];
  startDate: number;
  endDate: number;
}

function CrossEvents({ data, startDate, endDate }: CrossEventsProps) {
  const visibleSignals = data
    .filter((s) => s.time >= startDate && s.time <= endDate)
    .sort((a, b) => b.time - a.time)
    .slice(0, 30);

  if (visibleSignals.length === 0) {
    return (
      <div className="events-section">
        <div className="events-header">GC/DC</div>
        <div className="events-empty">No events in visible range</div>
      </div>
    );
  }

  return (
    <div className="events-section">
      <div className="events-header">GC/DC</div>
      <div className="events-list">
        {visibleSignals.map((s, i) => {
          const isGolden = s.type === "golden";
          const label = isGolden ? "GC" : "DC";
          const fakeLabel = s.isFake ? " (fake?)" : "";
          const daysLabel = s.details.daysUntilReverse !== null ? ` [→${s.details.daysUntilReverse}d]` : "";

          const volIcon = s.details.volumeConfirmed ? "✓" : "✗";
          const trendIcon = s.details.trendConfirmed ? "✓" : "✗";
          const holdIcon = s.details.holdingConfirmed === true ? "✓" : s.details.holdingConfirmed === false ? "✗" : "?";
          const priceIcon = s.details.pricePositionConfirmed ? "✓" : "✗";
          const tooltip = `Vol: ${volIcon} / Trend: ${trendIcon} / Hold: ${holdIcon} / Price: ${priceIcon}`;

          let className = "cross-event";
          className += isGolden ? " gc" : " dc";
          if (s.isFake) className += " fake";

          return (
            <span key={i} className={className} title={tooltip}>
              {label} {formatDate(s.time)}{daysLabel}{fakeLabel}
            </span>
          );
        })}
      </div>
    </div>
  );
}
