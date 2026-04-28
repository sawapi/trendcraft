/**
 * Live Panel — sidebar dock UI for the showcase Live Mode.
 *
 * Layout (top to bottom):
 *   - Mode pill: [Static] | [Live]    (mutually exclusive)
 *   - When Live is active:
 *       Play/Pause toggle
 *       Speed presets [1x] [4x] [16x]
 *       Progress bar
 *       Reset button
 *
 * The panel doesn't own a simulator — `bindSimulator(sim)` wires the controls
 * to a live `SimulatorHandle`, and is called by `main.ts` after instantiating
 * the simulator on mode change.
 */

import type { SimulatorHandle, SimulatorState } from "./live-simulator";

export type Mode = "static" | "live";

export type LivePanelHandle = {
  destroy(): void;
  /** Wire the panel's controls to a simulator. Pass `null` to detach. */
  bindSimulator(sim: SimulatorHandle | null): void;
  /** Programmatically set the mode (e.g. on initial mount). */
  setMode(mode: Mode): void;
};

const SPEED_PRESETS: { label: string; ms: number }[] = [
  { label: "1×", ms: 250 },
  { label: "4×", ms: 63 },
  { label: "16×", ms: 16 },
];

export function createLivePanel(
  container: HTMLElement,
  opts: {
    onModeChange: (mode: Mode) => void;
    /**
     * Called when the user clicks Reset. The host should rebuild the live
     * pipeline (dispose simulator + chart + connections, then re-mount in
     * Live mode) — resetting just the simulator strands the chart and the
     * existing connectIndicators / connectLivePrimitives subscriptions on
     * the disposed LiveCandle.
     */
    onReset?: () => void;
  },
): LivePanelHandle {
  let mode: Mode = "static";
  let sim: SimulatorHandle | null = null;
  let unsubChange: (() => void) | null = null;
  let activeSpeedIdx = 0;

  // Root
  const root = document.createElement("div");
  root.style.cssText =
    "padding:10px 12px;border-bottom:1px solid #2a2e39;background:#1a1d28;flex-shrink:0;";

  // Header label
  const header = document.createElement("div");
  header.style.cssText =
    "font-size:11px;font-weight:700;color:#787b86;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;";
  header.textContent = "Mode";
  root.appendChild(header);

  // Mode pill
  const pill = document.createElement("div");
  pill.style.cssText =
    "display:flex;background:#131722;border:1px solid #2a2e39;border-radius:6px;overflow:hidden;margin-bottom:10px;";
  const staticBtn = makeSegBtn("Static", true);
  const liveBtn = makeSegBtn("Live", false);
  pill.appendChild(staticBtn);
  pill.appendChild(liveBtn);
  root.appendChild(pill);

  staticBtn.addEventListener("click", () => setMode("static"));
  liveBtn.addEventListener("click", () => setMode("live"));

  // Live controls (hidden when mode = static)
  const controls = document.createElement("div");
  controls.style.cssText = "display:none;flex-direction:column;gap:8px;";
  root.appendChild(controls);

  // Play/Pause row
  const playPauseBtn = document.createElement("button");
  playPauseBtn.textContent = "▶ Play";
  playPauseBtn.style.cssText = controlBtnCss();
  controls.appendChild(playPauseBtn);
  playPauseBtn.addEventListener("click", () => {
    if (!sim) return;
    if (sim.getState() === "playing") sim.pause();
    else sim.play();
  });

  // Speed row
  const speedRow = document.createElement("div");
  speedRow.style.cssText = "display:flex;gap:4px;align-items:center;";
  const speedLabel = document.createElement("span");
  speedLabel.textContent = "Speed";
  speedLabel.style.cssText = "font-size:11px;color:#787b86;flex-shrink:0;width:42px;";
  speedRow.appendChild(speedLabel);
  const speedBtns: HTMLButtonElement[] = SPEED_PRESETS.map((preset, idx) => {
    const b = document.createElement("button");
    b.textContent = preset.label;
    b.style.cssText = segBtnCss(idx === 0);
    b.addEventListener("click", () => {
      activeSpeedIdx = idx;
      speedBtns.forEach((sb, i) => {
        sb.style.cssText = segBtnCss(i === idx);
      });
      sim?.setIntervalMs(preset.ms);
    });
    speedRow.appendChild(b);
    return b;
  });
  controls.appendChild(speedRow);

  // Progress bar
  const progressWrap = document.createElement("div");
  progressWrap.style.cssText =
    "height:6px;background:#131722;border:1px solid #2a2e39;border-radius:3px;overflow:hidden;position:relative;";
  const progressFill = document.createElement("div");
  progressFill.style.cssText =
    "height:100%;width:0;background:linear-gradient(90deg,#2196F3,#26a69a);transition:width 0.05s linear;";
  progressWrap.appendChild(progressFill);
  controls.appendChild(progressWrap);

  // State label
  const stateLabel = document.createElement("div");
  stateLabel.style.cssText = "font-size:10px;color:#787b86;text-align:center;";
  stateLabel.textContent = "idle";
  controls.appendChild(stateLabel);

  // Reset
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "↺ Reset";
  resetBtn.style.cssText = controlBtnCss();
  controls.appendChild(resetBtn);
  resetBtn.addEventListener("click", () => {
    if (opts.onReset) opts.onReset();
    else sim?.reset();
  });

  container.appendChild(root);

  function setMode(next: Mode): void {
    if (mode === next) return;
    mode = next;
    staticBtn.style.cssText = segBtnCss(mode === "static");
    liveBtn.style.cssText = segBtnCss(mode === "live");
    controls.style.display = mode === "live" ? "flex" : "none";
    opts.onModeChange(mode);
  }

  function refreshFromSim(state: SimulatorState, progress: number): void {
    progressFill.style.width = `${(progress * 100).toFixed(1)}%`;
    stateLabel.textContent = state;
    if (state === "playing") {
      playPauseBtn.textContent = "⏸ Pause";
      playPauseBtn.disabled = false;
    } else if (state === "complete") {
      playPauseBtn.textContent = "▶ Play";
      playPauseBtn.disabled = true;
      playPauseBtn.style.opacity = "0.5";
    } else {
      playPauseBtn.textContent = "▶ Play";
      playPauseBtn.disabled = false;
      playPauseBtn.style.opacity = "1";
    }
  }

  return {
    destroy(): void {
      unsubChange?.();
      unsubChange = null;
      sim = null;
      root.remove();
    },
    bindSimulator(next): void {
      unsubChange?.();
      unsubChange = null;
      sim = next;
      if (sim) {
        // sync initial speed to currently selected preset
        sim.setIntervalMs(SPEED_PRESETS[activeSpeedIdx].ms);
        unsubChange = sim.onChange(refreshFromSim);
        refreshFromSim(sim.getState(), sim.getProgress());
      } else {
        progressFill.style.width = "0%";
        stateLabel.textContent = "idle";
        playPauseBtn.textContent = "▶ Play";
        playPauseBtn.disabled = false;
        playPauseBtn.style.opacity = "1";
      }
    },
    setMode,
  };
}

// --- styling helpers ---

function makeSegBtn(label: string, active: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.cssText = segBtnCss(active);
  return b;
}

function segBtnCss(active: boolean): string {
  return `
    flex:1;padding:6px 12px;font-size:12px;font-weight:600;
    border:none;cursor:pointer;
    background:${active ? "#2196F3" : "transparent"};
    color:${active ? "#fff" : "#d1d4dc"};
    transition:background 0.15s;
  `;
}

function controlBtnCss(): string {
  return `
    width:100%;padding:6px 12px;font-size:12px;
    background:#2a2e39;border:1px solid #363a45;border-radius:4px;
    color:#d1d4dc;cursor:pointer;
  `;
}
