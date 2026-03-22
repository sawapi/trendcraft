import { useCallback, useEffect, useState } from "react";

interface CollapsiblePanelProps {
  title: string;
  storageKey: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsiblePanel({
  title,
  storageKey,
  defaultOpen = true,
  children,
}: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem(`panel-${storageKey}`);
    return saved !== null ? saved === "true" : defaultOpen;
  });

  useEffect(() => {
    localStorage.setItem(`panel-${storageKey}`, String(isOpen));
  }, [isOpen, storageKey]);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <>
      <div
        className="panel-header"
        onClick={toggle}
        onKeyDown={(e) => e.key === "Enter" && toggle()}
        role="button"
        tabIndex={0}
      >
        <h3>{title}</h3>
        <span className={`material-icons panel-chevron ${!isOpen ? "collapsed" : ""}`}>
          expand_more
        </span>
      </div>
      <div className={`panel-content ${!isOpen ? "collapsed" : ""}`}>{children}</div>
    </>
  );
}
