import { useCallback, useEffect } from "react";
import { useSimulatorStore } from "../store/simulatorStore";

export function useKeyboardShortcuts() {
  const togglePlay = useSimulatorStore((state) => state.togglePlay);
  const stepForward = useSimulatorStore((state) => state.stepForward);
  const stepBackward = useSimulatorStore((state) => state.stepBackward);
  const switchSymbol = useSimulatorStore((state) => state.switchSymbol);
  const nextSymbol = useSimulatorStore((state) => state.nextSymbol);
  const previousSymbol = useSimulatorStore((state) => state.previousSymbol);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const state = useSimulatorStore.getState();
      const { phase, isPlaying, symbols, activeSymbolId, commonDateRange, currentDateIndex } =
        state;

      const activeSymbol = symbols.find((s) => s.id === activeSymbolId) || symbols[0];
      const positions = activeSymbol?.positions || [];

      // Ignore if user is typing in an input or textarea
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // === Undo/Redo (works in running & finished phase) ===
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        state.undoTrade();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        ((event.key === "z" && event.shiftKey) || event.key === "y")
      ) {
        event.preventDefault();
        state.redoTrade();
        return;
      }

      // Tab switching shortcuts (Ctrl/Cmd + number)
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
        const num = Number.parseInt(event.key);
        if (num >= 1 && num <= 9 && num <= symbols.length) {
          event.preventDefault();
          switchSymbol(symbols[num - 1].id);
          return;
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          nextSymbol();
          return;
        }

        if (event.key === "ArrowLeft") {
          event.preventDefault();
          previousSymbol();
          return;
        }

        if (event.key === "t" || event.key === "T") {
          event.preventDefault();
          if (phase === "setup") {
            const addBtn = document.querySelector(".add-tab-btn") as HTMLButtonElement;
            if (addBtn) addBtn.click();
          }
          return;
        }

        if (event.key === "w" || event.key === "W") {
          event.preventDefault();
          if (symbols.length > 1) {
            const closeBtn = document.querySelector(".tab.active .tab-close") as HTMLElement;
            if (closeBtn) closeBtn.click();
          }
          return;
        }
      }

      // Only handle other shortcuts during running phase
      if (phase !== "running") return;

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

        case "ArrowRight": // Right arrow - Step Forward
          if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            if (!isAtEnd && !isPlaying) {
              stepForward();
            }
          }
          break;

        case "ArrowLeft": // Left arrow - Step Backward
          if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            if (canStepBackward && !isPlaying) {
              stepBackward();
            }
          }
          break;

        case "b": // B - Buy
        case "B":
          if (!isPlaying) {
            event.preventDefault();
            const buyBtn = document.querySelector(".trade-buttons .buy-btn") as HTMLButtonElement;
            if (buyBtn && !buyBtn.disabled) {
              buyBtn.focus();
              buyBtn.click();
            }
          }
          break;

        case "s": // S - Sell All
        case "S":
          if (hasPosition && !isPlaying) {
            event.preventDefault();
            const sellAllBtn = document.querySelector(
              ".trade-buttons .sell-all",
            ) as HTMLButtonElement;
            if (sellAllBtn && !sellAllBtn.disabled) {
              sellAllBtn.focus();
              sellAllBtn.click();
            }
          }
          break;

        case "q": // Q - Partial sell
        case "Q":
          if (hasPosition && !isPlaying) {
            event.preventDefault();
            const sellBtn = document.querySelector(
              ".trade-buttons .sell-btn:not(.sell-all)",
            ) as HTMLButtonElement;
            if (sellBtn && !sellBtn.disabled) {
              sellBtn.focus();
              sellBtn.click();
            }
          }
          break;

        case "j": // J - Toggle journal
        case "J":
          if (!isPlaying) {
            event.preventDefault();
            const journalBtn = document.querySelector(".journal-toggle-btn") as HTMLButtonElement;
            if (journalBtn) journalBtn.click();
          }
          break;

        case "i": // I - Indicator settings
        case "I":
          if (!isPlaying) {
            event.preventDefault();
            const settingsBtn = document.querySelector(
              ".indicator-settings-btn",
            ) as HTMLButtonElement;
            if (settingsBtn) settingsBtn.click();
          }
          break;

        case "r": // R - Finish & go to review
        case "R":
          if (!isPlaying) {
            event.preventDefault();
            state.finishSimulation();
          }
          break;

        case "t": // T - Toggle bracket order
        case "T":
          if (!isPlaying && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            const bracketCheckbox = document.querySelector(
              ".bracket-toggle input[type='checkbox']",
            ) as HTMLInputElement;
            if (bracketCheckbox) bracketCheckbox.click();
          }
          break;

        // 1-5: Preset share quantities
        case "1":
        case "2":
        case "3":
        case "4":
        case "5": {
          if (!isPlaying && !event.ctrlKey && !event.metaKey) {
            const presets = [100, 200, 500, 1000, 50];
            const idx = Number(event.key) - 1;
            const sharesInput = document.querySelector(
              ".shares-input .shares-input-field",
            ) as HTMLInputElement;
            if (sharesInput) {
              event.preventDefault();
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                "value",
              )?.set;
              nativeInputValueSetter?.call(sharesInput, presets[idx].toString());
              sharesInput.dispatchEvent(new Event("input", { bubbles: true }));
              sharesInput.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
          break;
        }

        case "+": // + - Increase shares by 100
        case "=":
          if (!isPlaying) {
            event.preventDefault();
            const plusBtn = document.querySelector(
              ".shares-step-buttons .shares-step-btn.plus:last-child",
            ) as HTMLButtonElement;
            if (plusBtn && !plusBtn.disabled) plusBtn.click();
          }
          break;

        case "-": // - - Decrease shares by 100
        case "_":
          if (!isPlaying) {
            event.preventDefault();
            const minusBtn = document.querySelector(
              ".shares-step-buttons .shares-step-btn.minus:first-child",
            ) as HTMLButtonElement;
            if (minusBtn && !minusBtn.disabled) minusBtn.click();
          }
          break;

        default:
          break;
      }
    },
    [togglePlay, stepForward, stepBackward, switchSymbol, nextSymbol, previousSymbol],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
