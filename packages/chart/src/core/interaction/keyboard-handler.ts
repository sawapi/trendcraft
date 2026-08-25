/**
 * Keyboard interaction handler — hotkey resolution + built-in nav (arrows,
 * +/-, Home, End, F) + cancel.
 *
 * `hotkeys: false` from ViewportAttachOptions disables every keyboard binding,
 * including the built-in nav. Hosts that handle keys themselves opt out with
 * this single flag.
 */

import { resolveHotkey } from "../hotkeys";
import type { HotkeyAction } from "../types";
import type { InertiaController } from "./inertia";
import type { InteractionContext } from "./types";

export function attachKeyboardHandlers(
  ctx: InteractionContext,
  inertia: InertiaController,
): () => void {
  const { el, timeScale, hotkeyMap, hotkeyDisabled, dispatch } = ctx;

  const resolveAction = (e: KeyboardEvent): HotkeyAction | undefined => {
    if (hotkeyDisabled) return undefined;
    return resolveHotkey(e, hotkeyMap || undefined);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (hotkeyDisabled) return;

    const action = resolveAction(e);
    if (action === "cancel") {
      // Esc cancels every transient interaction: drag, both inertia loops,
      // long-press crosshair lock, and any in-progress drawing tool
      // (delegated to the host via dispatch).
      ctx.viewState.isDragging = false;
      ctx.endScrollbarDrag();
      inertia.stopPan();
      inertia.stopZoom();
      ctx.pan.velocity = 0;
      ctx.wheel.panVelocity = 0;
      ctx.touch.longPressCrosshairLocked = false;
      dispatch?.("cancel");
      e.preventDefault();
      ctx.onUpdate();
      return;
    }
    if (action !== undefined) {
      dispatch?.(action);
      e.preventDefault();
      ctx.onUpdate();
      return;
    }

    const beforeStart = timeScale.rawStartIndex;
    const beforeSpacing = timeScale.barSpacing;
    const beforeGrant = timeScale.hasViewportGrant;
    switch (e.key) {
      case "ArrowLeft":
        timeScale.scrollBy(e.shiftKey ? -10 : -1);
        break;
      case "ArrowRight":
        timeScale.scrollBy(e.shiftKey ? 10 : 1);
        break;
      case "+":
      case "=":
        timeScale.zoom(1.15);
        break;
      case "-":
        timeScale.zoom(0.87);
        break;
      case "Home":
        timeScale.setVisibleRange(0, timeScale.visibleCount);
        break;
      case "End":
        timeScale.scrollToEnd();
        break;
      case "f":
        timeScale.fitContent();
        break;
      default:
        return; // Don't prevent default for unhandled keys
    }
    e.preventDefault();
    // Each key press is a discrete gesture; ratify AND notify as a viewport
    // mutation only when it actually changed something. Position and
    // spacing cover arrows / zoom keys; the grant flag covers Home/End/fit
    // releasing a grant while the visible position happens to be identical
    // — that release is a real mutation. An arrow absorbed at a clamp edge
    // or +/- at the zoom limit changes nothing: it must neither dissolve
    // an in-bounds grant nor cancel a running range animation.
    const changed =
      timeScale.rawStartIndex !== beforeStart ||
      timeScale.barSpacing !== beforeSpacing ||
      timeScale.hasViewportGrant !== beforeGrant;
    if (changed) {
      timeScale.ratifySettledPosition();
      ctx.onViewportMutation();
    } else {
      ctx.onUpdate();
    }
  };

  el.addEventListener("keydown", onKeyDown);
  return () => el.removeEventListener("keydown", onKeyDown);
}
