import { useState } from "react";

const SHORTCUTS = [
  { key: "Space", action: "Play/Pause" },
  { key: "→", action: "Next Day" },
  { key: "←", action: "Prev Day" },
  { key: "B", action: "Buy/Add" },
  { key: "S", action: "Sell All" },
  { key: "Q", action: "Partial Sell" },
  { key: "1-5", action: "Shares Preset" },
  { key: "+/-", action: "Shares ±100" },
  { key: "T", action: "Bracket Order" },
  { key: "J", action: "Journal" },
  { key: "I", action: "Indicator Settings" },
  { key: "R", action: "Review" },
  { key: "⌘Z", action: "Undo" },
  { key: "⌘⇧Z", action: "Redo" },
];

const TAB_SHORTCUTS = [
  { key: "⌘1-9", action: "Switch Tab" },
  { key: "⌘→", action: "Next Tab" },
  { key: "⌘←", action: "Prev Tab" },
  { key: "⌘T", action: "New Tab" },
  { key: "⌘W", action: "Close Tab" },
];

export function ShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="shortcuts-help">
      <button
        type="button"
        className="shortcuts-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Keyboard Shortcuts"
      >
        <span className="material-icons">keyboard</span>
      </button>
      {isOpen && (
        <div className="shortcuts-popup">
          <h4>Keyboard Shortcuts</h4>
          <ul>
            {SHORTCUTS.map(({ key, action }) => (
              <li key={key}>
                <kbd>{key}</kbd>
                <span>{action}</span>
              </li>
            ))}
          </ul>
          <h4 style={{ marginTop: "12px" }}>Tab Controls</h4>
          <ul>
            {TAB_SHORTCUTS.map(({ key, action }) => (
              <li key={key}>
                <kbd>{key}</kbd>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
