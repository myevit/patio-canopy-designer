import { useId, type ChangeEvent } from "react";
import type { DisplayLengthUnit } from "@canopy/shared";

export interface ProjectMenuProps {
  canUndo: boolean;
  canRedo: boolean;
  canExport?: boolean;
  exportBlockedReason?: string;
  displayUnits: DisplayLengthUnit;
  onNew: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onUndo: () => void;
  onRedo: () => void;
  onChangeDisplayUnits: (displayUnits: DisplayLengthUnit) => void;
}

export function ProjectMenu({
  canUndo,
  canRedo,
  canExport = true,
  exportBlockedReason,
  displayUnits,
  onNew,
  onExport,
  onImport,
  onUndo,
  onRedo,
  onChangeDisplayUnits,
}: ProjectMenuProps) {
  const importInputId = useId();
  const unitsId = useId();

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
      <label htmlFor={unitsId} className="project-menu__units-label">
        Units
        <select
          id={unitsId}
          value={displayUnits}
          onChange={(event) => onChangeDisplayUnits(event.target.value as DisplayLengthUnit)}
        >
          <option value="mm">mm</option>
          <option value="m">m</option>
          <option value="ft-in">ft-in</option>
        </select>
      </label>
    </div>
  );
}
