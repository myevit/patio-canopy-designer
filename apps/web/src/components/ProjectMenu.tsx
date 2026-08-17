import { useId, type ChangeEvent } from "react";

export interface ProjectMenuProps {
  canUndo: boolean;
  canRedo: boolean;
  canExport?: boolean;
  exportBlockedReason?: string;
  onNew: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function ProjectMenu({
  canUndo,
  canRedo,
  canExport = true,
  exportBlockedReason,
  onNew,
  onExport,
  onImport,
  onUndo,
  onRedo,
}: ProjectMenuProps) {
  const importInputId = useId();

  function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onImport(file);
    }
    event.target.value = "";
  }

  return (
    <div role="group" aria-label="Project" className="project-menu">
      <button type="button" onClick={onNew}>
        New
      </button>
      <button
        type="button"
        onClick={onExport}
        disabled={!canExport}
        title={!canExport ? exportBlockedReason : undefined}
      >
        Export
      </button>
      <label htmlFor={importInputId} className="project-menu__import-label">
        Import
        <input
          id={importInputId}
          type="file"
          accept="application/json"
          onChange={handleImportChange}
          className="project-menu__import-input"
        />
      </label>
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo}>
        Redo
      </button>
    </div>
  );
}
