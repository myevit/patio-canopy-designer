import type { BlueprintSheetSet } from "@canopy/geometry";
import { useState } from "react";
import { BlueprintPrintPackage } from "./BlueprintPrintPackage.js";
import { BlueprintSheetSvg } from "./BlueprintSheetSvg.js";

export interface BlueprintsPanelProps {
  sheetSet: BlueprintSheetSet;
  onPrint: () => void;
}

export function BlueprintsPanel({ sheetSet, onPrint }: BlueprintsPanelProps) {
  const [sheetIndex, setSheetIndex] = useState(0);
  const clampedIndex = Math.min(sheetIndex, sheetSet.sheets.length - 1);
  const sheet = sheetSet.sheets[clampedIndex];

  if (!sheet) {
    return (
      <section aria-label="Blueprints" className="blueprints-panel">
        <p>No blueprint sheets to show yet.</p>
      </section>
    );
  }

  return (
    <section aria-label="Blueprints" className="blueprints-panel">
      <div className="blueprints-panel__toolbar">
        <button
          type="button"
          onClick={() => setSheetIndex((i) => Math.max(0, i - 1))}
          disabled={clampedIndex === 0}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => setSheetIndex((i) => Math.min(sheetSet.sheets.length - 1, i + 1))}
          disabled={clampedIndex === sheetSet.sheets.length - 1}
        >
          Next
        </button>
        <button type="button" onClick={onPrint}>
          Print
        </button>
      </div>
      <div data-testid="blueprint-active-sheet">
        <BlueprintSheetSvg sheet={sheet} />
      </div>
      <BlueprintPrintPackage sheetSet={sheetSet} />
    </section>
  );
}
