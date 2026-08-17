import type { BlueprintSheetSet } from "@canopy/geometry";
import { BlueprintSheetSvg } from "./BlueprintSheetSvg.js";

export interface BlueprintPrintPackageProps {
  sheetSet: BlueprintSheetSet;
  /** When supplied, threaded onto every sheet as a compact footer line - lets a permit-package print context put its no-approval disclaimer on every sheet without this component knowing about permits. */
  permitDisclaimer?: string;
}

/**
 * Renders every sheet of the set for printing - not just the one currently
 * shown in the on-screen preview - so a single Print click always produces
 * the full drawing+schedule package. Hidden on screen via CSS, shown only
 * under `@media print`. Only the first page gets no page-break-before, and
 * no page ever gets a page-break-after, so the package prints with exactly
 * one break between sheets and no trailing blank page.
 */
export function BlueprintPrintPackage({ sheetSet, permitDisclaimer }: BlueprintPrintPackageProps) {
  return (
    <div className="blueprint-print-package" data-testid="blueprint-print-package" aria-hidden="true">
      {sheetSet.sheets.map((sheet, index) => (
        <div
          key={sheet.titleBlock.sheetNumber}
          className="blueprint-print-package__page"
          data-testid={`blueprint-print-page-${sheet.titleBlock.sheetNumber}`}
          data-page-break={index === 0 ? "start" : "before"}
        >
          <BlueprintSheetSvg sheet={sheet} mode="print" permitDisclaimer={permitDisclaimer} />
        </div>
      ))}
    </div>
  );
}
