import { useState } from "react";

const SHORTCUTS = [
  { key: "Space", action: "再生/一時停止" },
  { key: "→", action: "次の日" },
  { key: "←", action: "前の日" },
  { key: "B", action: "買い/追加買い" },
  { key: "S", action: "全売り" },
];

const TAB_SHORTCUTS = [
  { key: "⌘1-9", action: "タブ切替" },
  { key: "⌘→", action: "次のタブ" },
  { key: "⌘←", action: "前のタブ" },
  { key: "⌘T", action: "タブ追加" },
  { key: "⌘W", action: "タブを閉じる" },
];

export function ShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="shortcuts-help">
      <button
        className="shortcuts-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="キーボードショートカット"
      >
        <span className="material-icons">keyboard</span>
      </button>
      {isOpen && (
        <div className="shortcuts-popup">
          <h4>キーボードショートカット</h4>
          <ul>
            {SHORTCUTS.map(({ key, action }) => (
              <li key={key}>
                <kbd>{key}</kbd>
                <span>{action}</span>
              </li>
            ))}
          </ul>
          <h4 style={{ marginTop: "12px" }}>タブ操作</h4>
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
