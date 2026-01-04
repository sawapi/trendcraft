import { useEffect, useCallback } from "react";
import { useSimulatorStore } from "../store/simulatorStore";

export function useKeyboardShortcuts() {
  // アクションのみを取得（状態はハンドラ内で最新を取得）
  const togglePlay = useSimulatorStore((state) => state.togglePlay);
  const stepForward = useSimulatorStore((state) => state.stepForward);
  const stepBackward = useSimulatorStore((state) => state.stepBackward);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // ハンドラ内で最新の状態を取得
      const state = useSimulatorStore.getState();
      const { phase, isPlaying, positions, currentIndex, allCandles, startIndex, initialCandleCount } = state;

      // Only handle shortcuts during running phase
      if (phase !== "running") return;

      // Ignore if user is typing in an input or textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const isAtEnd = currentIndex >= allCandles.length - 1;
      const minIndex = startIndex + initialCandleCount;
      const canStepBackward = currentIndex > minIndex;
      const hasPosition = positions.length > 0;

      switch (event.key) {
        case " ": // Space - Play/Pause
          event.preventDefault();
          if (!isAtEnd) {
            togglePlay();
          }
          break;

        case "ArrowRight": // Right arrow - Step Forward
          event.preventDefault();
          if (!isAtEnd && !isPlaying) {
            stepForward();
          }
          break;

        case "ArrowLeft": // Left arrow - Step Backward
          event.preventDefault();
          if (canStepBackward && !isPlaying) {
            stepBackward();
          }
          break;

        case "b": // B - Buy (新規買いまたは追加買い)
        case "B":
          if (!isPlaying) {
            event.preventDefault();
            const buyBtn = document.querySelector(
              ".trade-buttons .buy-btn"
            ) as HTMLButtonElement;
            if (buyBtn && !buyBtn.disabled) {
              buyBtn.focus();
              buyBtn.click();
            }
          }
          break;

        case "s": // S - 全売り
        case "S":
          if (hasPosition && !isPlaying) {
            event.preventDefault();
            const sellAllBtn = document.querySelector(
              ".trade-buttons .sell-all"
            ) as HTMLButtonElement;
            if (sellAllBtn && !sellAllBtn.disabled) {
              sellAllBtn.focus();
              sellAllBtn.click();
            }
          }
          break;

        default:
          break;
      }
    },
    [togglePlay, stepForward, stepBackward]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
