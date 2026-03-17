/**
 * Hook for pattern replay animation
 *
 * Drives bar-by-bar replay of a detected chart pattern,
 * progressing from pattern start through formation and projection phases.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedCandle, PatternSignal } from "trendcraft";
import { useChartStore } from "../store/chartStore";

export type ReplayPhase = "forming" | "projecting" | "done";

export interface PatternReplayState {
  /** Current replay index (absolute candle index) */
  replayIndex: number;
  /** Start index of the replay range */
  startIndex: number;
  /** End index (pattern completion + projection horizon) */
  maxIndex: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Current phase */
  phase: ReplayPhase;
  /** Playback speed multiplier */
  speed: number;
  /** Pattern end index (where projection starts) */
  patternEndIndex: number;

  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  seekTo: (index: number) => void;
}

const PROJECTION_HORIZON = 20;
const BASE_INTERVAL_MS = 500;

/**
 * Hook to manage pattern replay animation state
 */
export function usePatternReplay(
  pattern: PatternSignal | null,
  candles: NormalizedCandle[],
): PatternReplayState {
  const setReplayEndIndex = useChartStore((s) => s.setReplayEndIndex);
  const setZoomRange = useChartStore((s) => s.setZoomRange);

  // Build time → index map
  const timeToIndex = useRef(new Map<number, number>());
  useEffect(() => {
    const map = new Map<number, number>();
    candles.forEach((c, i) => map.set(c.time, i));
    timeToIndex.current = map;
  }, [candles]);

  // Compute start/end indices from pattern
  const patternStartIndex = pattern ? (timeToIndex.current.get(pattern.pattern.startTime) ?? 0) : 0;
  const patternEndIndex = pattern
    ? (timeToIndex.current.get(pattern.pattern.endTime) ?? patternStartIndex)
    : 0;
  const maxIndex = pattern ? Math.min(patternEndIndex + PROJECTION_HORIZON, candles.length - 1) : 0;

  const [replayIndex, setReplayIndex] = useState(patternStartIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState(1);

  // Save the zoom range before replay starts so we can restore it later
  const savedZoomRef = useRef<{ start: number; end: number } | null>(null);

  // Reset when pattern changes — zoom to show pattern area
  useEffect(() => {
    if (pattern) {
      const startIdx = timeToIndex.current.get(pattern.pattern.startTime) ?? 0;
      setReplayIndex(startIdx);
      setIsPlaying(false);
      setReplayEndIndex(startIdx);

      // Save current zoom and set initial zoom to frame the pattern
      if (candles.length > 0) {
        savedZoomRef.current = useChartStore.getState().zoomRange;
        const margin = 10; // bars of padding before pattern start
        const totalSpan = maxIndex - startIdx + margin + 10;
        const zoomStart = Math.max(0, ((startIdx - margin) / candles.length) * 100);
        const zoomEnd = Math.min(100, ((startIdx + totalSpan) / candles.length) * 100);
        setZoomRange({ start: zoomStart, end: zoomEnd });
      }
    } else {
      setReplayEndIndex(null);
      // Restore saved zoom range when replay ends
      if (savedZoomRef.current) {
        setZoomRange(savedZoomRef.current);
        savedZoomRef.current = null;
      }
    }
  }, [pattern, setReplayEndIndex, setZoomRange, candles.length, maxIndex]);

  // Sync replayEndIndex to store + auto-scroll when replay bar nears visible edge
  useEffect(() => {
    if (pattern && candles.length > 0) {
      setReplayEndIndex(replayIndex);

      // Check if replayIndex is near the right edge of the visible window
      const { zoomRange } = useChartStore.getState();
      const visibleEndIdx = Math.ceil((zoomRange.end / 100) * candles.length) - 1;
      const visibleStartIdx = Math.floor((zoomRange.start / 100) * candles.length);
      const visibleSpan = visibleEndIdx - visibleStartIdx;

      // When replay bar is within 5 bars of the right edge, shift the window
      if (replayIndex > visibleEndIdx - 5 && replayIndex < candles.length - 1) {
        const newStart = Math.max(0, ((replayIndex - visibleSpan + 10) / candles.length) * 100);
        const newEnd = Math.min(100, ((replayIndex + 10) / candles.length) * 100);
        setZoomRange({ start: newStart, end: newEnd });
      }
    }
  }, [replayIndex, pattern, setReplayEndIndex, setZoomRange, candles.length]);

  // Determine phase
  const phase: ReplayPhase =
    replayIndex < patternEndIndex ? "forming" : replayIndex >= maxIndex ? "done" : "projecting";

  // Timer for playback
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isPlaying && pattern) {
      timerRef.current = setInterval(() => {
        setReplayIndex((prev) => {
          if (prev >= maxIndex) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, BASE_INTERVAL_MS / speed);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, speed, maxIndex, pattern]);

  const play = useCallback(() => {
    if (replayIndex >= maxIndex) {
      // Reset to start if at end
      setReplayIndex(patternStartIndex);
    }
    setIsPlaying(true);
  }, [replayIndex, maxIndex, patternStartIndex]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setReplayIndex((prev) => Math.min(prev + 1, maxIndex));
  }, [maxIndex]);

  const stepBackward = useCallback(() => {
    setIsPlaying(false);
    setReplayIndex((prev) => Math.max(prev - 1, patternStartIndex));
  }, [patternStartIndex]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setReplayIndex(patternStartIndex);
  }, [patternStartIndex]);

  const setSpeed = useCallback((s: number) => {
    setSpeedState(s);
  }, []);

  const seekTo = useCallback(
    (index: number) => {
      setReplayIndex(Math.max(patternStartIndex, Math.min(index, maxIndex)));
    },
    [patternStartIndex, maxIndex],
  );

  return {
    replayIndex,
    startIndex: patternStartIndex,
    maxIndex,
    isPlaying,
    phase,
    speed,
    patternEndIndex,
    play,
    pause,
    stepForward,
    stepBackward,
    reset,
    setSpeed,
    seekTo,
  };
}
