import { useEffect, useCallback } from "react";
import { useSimulatorStore } from "../store/simulatorStore";

export function useKeyboardShortcuts() {
  // アクションのみを取得（状態はハンドラ内で最新を取得）
  const togglePlay = useSimulatorStore((state) => state.togglePlay);
  const stepForward = useSimulatorStore((state) => state.stepForward);
  const stepBackward = useSimulatorStore((state) => state.stepBackward);
  const switchSymbol = useSimulatorStore((state) => state.switchSymbol);
  const nextSymbol = useSimulatorStore((state) => state.nextSymbol);
  const previousSymbol = useSimulatorStore((state) => state.previousSymbol);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // ハンドラ内で最新の状態を取得
      const state = useSimulatorStore.getState();
      const { phase, isPlaying, symbols, activeSymbolId, commonDateRange, currentDateIndex } = state;

      // アクティブ銘柄のデータを取得
      const activeSymbol = symbols.find(s => s.id === activeSymbolId) || symbols[0];
      const positions = activeSymbol?.positions || [];

      // Ignore if user is typing in an input or textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // タブ切り替えショートカット (Ctrl/Cmd + 数字)
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
        const num = parseInt(event.key);
        if (num >= 1 && num <= 9 && num <= symbols.length) {
          event.preventDefault();
          switchSymbol(symbols[num - 1].id);
          return;
        }

        // Cmd/Ctrl+→ - 次のタブへ
        if (event.key === "ArrowRight") {
          event.preventDefault();
          nextSymbol();
          return;
        }

        // Cmd/Ctrl+← - 前のタブへ
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          previousSymbol();
          return;
        }

        // Ctrl+T - 新規タブを追加
        if (event.key === "t" || event.key === "T") {
          event.preventDefault();
          // setupフェーズでのみ許可
          if (phase === "setup") {
            const addBtn = document.querySelector(".add-tab-btn") as HTMLButtonElement;
            if (addBtn) addBtn.click();
          }
          return;
        }

        // Ctrl+W - 現在のタブを閉じる
        if (event.key === "w" || event.key === "W") {
          event.preventDefault();
          // 複数タブがある場合のみ
          if (symbols.length > 1) {
            const closeBtn = document.querySelector(".tab.active .tab-close") as HTMLElement;
            if (closeBtn) closeBtn.click();
          }
          return;
        }
      }


      // Only handle other shortcuts during running phase
      if (phase !== "running") return;

      // commonDateRangeベースで終端判定
      const isAtEnd = commonDateRange ? currentDateIndex >= commonDateRange.dates.length - 1 : true;
      const canStepBackward = currentDateIndex > 0;
      const hasPosition = positions.length > 0;

      switch (event.key) {
        case " ": // Space - Play/Pause
          event.preventDefault();
          if (!isAtEnd) {
            togglePlay();
          }
          break;

        case "ArrowRight": // Right arrow - Step Forward (Cmd/Ctrlなしの場合のみ)
          if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            if (!isAtEnd && !isPlaying) {
              stepForward();
            }
          }
          break;

        case "ArrowLeft": // Left arrow - Step Backward (Cmd/Ctrlなしの場合のみ)
          if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            if (canStepBackward && !isPlaying) {
              stepBackward();
            }
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
    [togglePlay, stepForward, stepBackward, switchSymbol, nextSymbol, previousSymbol]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
