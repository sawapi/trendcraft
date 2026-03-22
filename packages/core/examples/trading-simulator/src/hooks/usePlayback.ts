import { useEffect, useRef } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import type { PlaybackSpeed } from "../types";

const INTERVALS: Record<PlaybackSpeed, number> = {
  0.5: 4000,
  1: 2000,
  2: 1000,
  4: 500,
};

export function usePlayback() {
  const { isPlaying, playbackSpeed, stepForward, pause, commonDateRange, currentDateIndex } =
    useSimulatorStore();

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      const hasMore = stepForward();
      if (!hasMore) {
        pause();
      }
    }, INTERVALS[playbackSpeed]);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, stepForward, pause]);

  // Check if at end (use commonDateRange — the global playback boundary)
  const isAtEnd = !commonDateRange || currentDateIndex >= commonDateRange.dates.length - 1;

  return { isAtEnd };
}
