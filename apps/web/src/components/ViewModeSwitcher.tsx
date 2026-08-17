import type { ViewMode } from "../state/studio-store.js";

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "split", label: "Split" },
  { id: "3d", label: "3D" },
];

export interface ViewModeSwitcherProps {
  viewMode: ViewMode;
  onSelectViewMode: (viewMode: ViewMode) => void;
}

export function ViewModeSwitcher({ viewMode, onSelectViewMode }: ViewModeSwitcherProps) {
  return (
    <div role="group" aria-label="View mode" className="view-mode-switcher">
      {VIEW_MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          aria-pressed={mode.id === viewMode}
          onClick={() => onSelectViewMode(mode.id)}
          className={mode.id === viewMode ? "view-mode-button view-mode-button--active" : "view-mode-button"}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
