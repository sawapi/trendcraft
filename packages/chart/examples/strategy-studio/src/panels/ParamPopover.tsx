import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { IndicatorInstance } from "../App";
import { localStudioAPI } from "../lib/studio-api";
import { ParamCardBody } from "./ParamCardBody";

type Props = {
  instance: IndicatorInstance;
  /** DOM element the popover is positioned relative to (the legend row). */
  anchorEl: HTMLElement;
  onParamChange: (id: string, key: string, value: number) => void;
  onReset: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

const POPOVER_WIDTH = 260;
const GAP = 6;
const MARGIN = 8;
/** Used for the first-frame placement before ResizeObserver measures real height. */
const FALLBACK_HEIGHT = 240;

/**
 * Floating editor anchored to a chart legend row. Closes on outside click,
 * Escape, or scroll. Position is recomputed on window resize so the popover
 * stays attached even as the chart relayouts.
 */
export function ParamPopover({
  instance,
  anchorEl,
  onParamChange,
  onReset,
  onRemove,
  onClose,
}: Props) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // Always read the latest anchor for outside-click + window-resize re-anchor,
  // but keep position frozen otherwise — re-anchoring on every slider step
  // (the legend reflows each remount) made the popover jitter.
  const anchorRef = useRef(anchorEl);
  anchorRef.current = anchorEl;

  const { preset, displayName } = useMemo(() => {
    const p = localStudioAPI.getIndicatorPreset(instance.kind);
    const name =
      localStudioAPI.listIndicators().find((m) => m.kind === instance.kind)?.displayName ??
      p?.name ??
      instance.kind;
    return { preset: p, displayName: name };
  }, [instance.kind]);

  // Position is recomputed when the user switches to a different instance's
  // editor, when the popover's own dimensions change (ResizeObserver), or on
  // window resize. It is *not* recomputed when `anchorEl` is swapped for the
  // same instance — that happens on every slider step (legend reflows after
  // each param remount) and would make the popover jitter. Trade-off: the
  // popover doesn't follow scroll once opened.
  // biome-ignore lint/correctness/useExhaustiveDependencies: instance.id is the trigger key — effect reads anchorEl via anchorRef so that swap doesn't reposition.
  useLayoutEffect(() => {
    let frame = 0;
    function compute(): void {
      const a = anchorRef.current;
      if (!a) return;
      const rect = a.getBoundingClientRect();
      const popH = popoverRef.current?.offsetHeight ?? FALLBACK_HEIGHT;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const left = Math.min(Math.max(rect.left, MARGIN), vw - POPOVER_WIDTH - MARGIN);
      const spaceBelow = vh - rect.bottom - MARGIN;
      const spaceAbove = rect.top - MARGIN;
      let top: number;
      if (popH + GAP <= spaceBelow) {
        top = rect.bottom + GAP;
      } else if (popH + GAP <= spaceAbove) {
        top = rect.top - GAP - popH;
      } else {
        top = Math.max(MARGIN, Math.min(rect.bottom + GAP, vh - MARGIN - popH));
      }
      setPos({ top, left });
    }
    function schedule(): void {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        compute();
      });
    }
    compute();
    const ro = popoverRef.current ? new ResizeObserver(schedule) : null;
    if (popoverRef.current) ro?.observe(popoverRef.current);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [instance.id]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent): void {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      // Re-clicking the same ⚙ that opened us shouldn't close+reopen.
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!preset) return null;

  return (
    <div
      ref={popoverRef}
      className="param-popover"
      role="dialog"
      aria-label={`${displayName} parameters`}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width: POPOVER_WIDTH,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <div className="param-popover-header">
        <div className="param-popover-titles">
          <span className="param-card-title">{displayName}</span>
          <span className="param-card-kind">{instance.kind}</span>
        </div>
        <button type="button" className="ghost" onClick={onClose} aria-label="Close" title="Close">
          ✕
        </button>
      </div>
      <ParamCardBody
        instance={instance}
        preset={preset}
        onChange={(key, value) => onParamChange(instance.id, key, value)}
        onReset={() => onReset(instance.id)}
        onRemove={() => {
          onRemove(instance.id);
          onClose();
        }}
        showRemoveButton
      />
    </div>
  );
}
