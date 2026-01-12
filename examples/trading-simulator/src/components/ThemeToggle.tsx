import { useTheme } from "../hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      title={theme === "dark" ? "ライトモードに切替" : "ダークモードに切替"}
    >
      <span className="material-icons">{theme === "dark" ? "light_mode" : "dark_mode"}</span>
    </button>
  );
}
