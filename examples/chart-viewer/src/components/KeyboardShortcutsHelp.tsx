/**
 * Keyboard shortcuts help modal
 */

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS: { key: string; description: string }[] = [
  { key: "1-6", description: "Drawing tool (Cursor/HLine/Trend/Fib/Rect/Text)" },
  { key: "D", description: "Daily timeframe" },
  { key: "W", description: "Weekly timeframe" },
  { key: "M", description: "Monthly timeframe" },
  { key: "+ / =", description: "Zoom in" },
  { key: "-", description: "Zoom out" },
  { key: "F", description: "Fullscreen toggle" },
  { key: "Escape", description: "Reset drawing tool to cursor" },
  { key: "Delete", description: "Delete selected drawing" },
  { key: "Ctrl+Z", description: "Undo drawing" },
  { key: "Ctrl+Y", description: "Redo drawing" },
  { key: "?", description: "Show/hide this help" },
];

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h3>Keyboard Shortcuts</h3>
          <button type="button" className="shortcuts-close" onClick={onClose}>
            <span className="material-icons md-18">close</span>
          </button>
        </div>
        <div className="shortcuts-grid">
          {SHORTCUTS.map(({ key, description }) => (
            <div key={key} className="shortcut-row">
              <kbd className="shortcut-key">{key}</kbd>
              <span className="shortcut-desc">{description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
