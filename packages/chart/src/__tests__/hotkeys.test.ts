import { describe, expect, it } from "vitest";
import { DEFAULT_HOTKEYS, eventToHotkey, resolveHotkey } from "../core/hotkeys";

// Minimal KeyboardEvent stand-in — we only read the fields used by eventToHotkey.
function ke(partial: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    code: "",
    key: "",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...partial,
  } as KeyboardEvent;
}

describe("eventToHotkey", () => {
  it("encodes Alt+letter using KeyboardEvent.code", () => {
    expect(eventToHotkey(ke({ code: "KeyH", altKey: true }))).toBe("Alt+KeyH");
  });

  it("treats meta (Cmd) as Ctrl for cross-platform parity", () => {
    expect(eventToHotkey(ke({ code: "KeyH", altKey: true, metaKey: true }))).toBe("Ctrl+Alt+KeyH");
  });

  it("returns 'Escape' for the Escape key regardless of modifiers", () => {
    expect(eventToHotkey(ke({ code: "Escape" }))).toBe("Escape");
    expect(eventToHotkey(ke({ code: "Escape", shiftKey: true }))).toBe("Escape");
  });
});

describe("resolveHotkey", () => {
  it("resolves default Alt+letter bindings to drawing tools", () => {
    expect(resolveHotkey(ke({ code: "KeyH", altKey: true }))).toBe("hline");
    expect(resolveHotkey(ke({ code: "KeyV", altKey: true }))).toBe("vline");
    expect(resolveHotkey(ke({ code: "KeyT", altKey: true }))).toBe("trendline");
    expect(resolveHotkey(ke({ code: "KeyF", altKey: true }))).toBe("fibRetracement");
    expect(resolveHotkey(ke({ code: "KeyC", altKey: true }))).toBe("channel");
  });

  it("resolves Escape to cancel", () => {
    expect(resolveHotkey(ke({ code: "Escape" }))).toBe("cancel");
  });

  it("resolves Ctrl+Alt+H to toggleOverlays", () => {
    expect(resolveHotkey(ke({ code: "KeyH", ctrlKey: true, altKey: true }))).toBe("toggleOverlays");
  });

  it("returns undefined for unmapped keys", () => {
    expect(resolveHotkey(ke({ code: "KeyZ" }))).toBeUndefined();
  });

  it("honors custom maps", () => {
    expect(resolveHotkey(ke({ code: "KeyR", altKey: true }), { "Alt+KeyR": "rectangle" })).toBe(
      "rectangle",
    );
  });

  it("DEFAULT_HOTKEYS covers the documented shortcuts", () => {
    expect(Object.keys(DEFAULT_HOTKEYS).sort()).toEqual(
      [
        "Alt+KeyH",
        "Alt+KeyV",
        "Alt+KeyT",
        "Alt+KeyF",
        "Alt+KeyC",
        "Escape",
        "Ctrl+Alt+KeyH",
      ].sort(),
    );
  });
});
