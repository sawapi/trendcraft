/**
 * Viewport mutation provenance — internal to the package.
 *
 * `syncCharts` must tell "the completion event of a range I forwarded"
 * apart from "a user moved this chart". Comparing range VALUES cannot do
 * that: a time-based multi-timeframe target quantizes the forwarded times
 * to its own bars, so the resulting logical range is not knowable by the
 * sender. Instead, the internal viewport setters carry an opaque
 * origin/generation token through to the completion event, attached to the
 * payload under a non-exported Symbol — invisible to `JSON.stringify`,
 * enumeration, and the public `VisibleRangeChangeData` type.
 *
 * The token never outlives its own mutation: it is captured into the
 * animation's completion closure (a cancelled animation drops its `onDone`
 * without firing, taking the token with it) and the staging slot on the
 * chart is cleared synchronously around the setter call.
 */

/** Provenance of a programmatic viewport mutation. */
export type ViewportOrigin = {
  /** Unique id of the initiator (e.g. one syncCharts group). */
  origin: string;
  /** Monotonic per-target counter, so stale completions are identifiable. */
  generation: number;
};

const VIEWPORT_ORIGIN = Symbol("tc.vo");

/** Internal chart surface for initiating a mutation with provenance. */
export const APPLY_WITH_ORIGIN = Symbol("tc.awo");

export type ViewportOriginCarrier = {
  [APPLY_WITH_ORIGIN](origin: ViewportOrigin, apply: () => void): void;
};

/** Attach a token to an event payload (non-enumerable — never serialized). */
export function attachViewportOrigin(payload: object, token: ViewportOrigin): void {
  Object.defineProperty(payload, VIEWPORT_ORIGIN, {
    value: token,
    enumerable: false,
    configurable: true,
  });
}

/** Read a token off an event payload, if one was attached. */
export function readViewportOrigin(payload: unknown): ViewportOrigin | null {
  if (payload === null || typeof payload !== "object") return null;
  const token = (payload as Record<symbol, unknown>)[VIEWPORT_ORIGIN];
  return (token as ViewportOrigin | undefined) ?? null;
}
