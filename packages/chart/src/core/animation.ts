/**
 * View Transition — Animates viewport state using center-index + visible-count
 * interpolation for smooth, centered zoom/scroll transitions.
 */

/** Ease-out cubic: fast start, smooth deceleration */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Interpolate between two values */
function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export class ViewTransition {
  private _rafId: number | null = null;
  private _startTime = 0;
  private _duration = 0;
  private _fromCenter = 0;
  private _fromCount = 0;
  private _toCenter = 0;
  private _toCount = 0;
  private _width = 0;
  private _onFrame: ((startIndex: number, barSpacing: number) => void) | null = null;
  private _onDone: (() => void) | null = null;

  get isRunning(): boolean {
    return this._rafId !== null;
  }

  /**
   * Start an animated transition between two viewport states.
   * Interpolates center index and visible count for a smooth centered animation.
   * Cancels any in-progress animation.
   */
  animate(
    fromStart: number,
    fromSpacing: number,
    toStart: number,
    toSpacing: number,
    width: number,
    duration: number,
    onFrame: (startIndex: number, barSpacing: number) => void,
    onDone?: () => void,
  ): void {
    this.cancel();

    // Convert to center + count representation
    const fromCount = width / Math.max(0.1, fromSpacing);
    const toCount = width / Math.max(0.1, toSpacing);
    const fromCenter = fromStart + fromCount / 2;
    const toCenter = toStart + toCount / 2;

    // Skip animation if duration is too short or values are identical
    if (
      duration <= 0 ||
      (Math.abs(fromCenter - toCenter) < 0.5 && Math.abs(fromCount - toCount) < 0.5)
    ) {
      onFrame(toStart, toSpacing);
      onDone?.();
      return;
    }

    this._fromCenter = fromCenter;
    this._fromCount = fromCount;
    this._toCenter = toCenter;
    this._toCount = toCount;
    this._width = width;
    this._duration = duration;
    this._onFrame = onFrame;
    this._onDone = onDone ?? null;
    this._startTime = performance.now();
    this._rafId = requestAnimationFrame(this._tick);
  }

  /** Cancel any running animation */
  cancel(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._onFrame = null;
    this._onDone = null;
  }

  private _tick = (now: number): void => {
    const elapsed = now - this._startTime;
    const progress = Math.min(1, elapsed / this._duration);
    const eased = easeOutCubic(progress);

    // Interpolate center and count, then derive startIndex and barSpacing
    const center = lerp(this._fromCenter, this._toCenter, eased);
    const count = lerp(this._fromCount, this._toCount, eased);
    const barSpacing = this._width / Math.max(1, count);
    const startIndex = center - count / 2;

    this._onFrame?.(startIndex, barSpacing);

    if (progress < 1) {
      this._rafId = requestAnimationFrame(this._tick);
    } else {
      this._rafId = null;
      this._onDone?.();
      this._onFrame = null;
      this._onDone = null;
    }
  };
}
