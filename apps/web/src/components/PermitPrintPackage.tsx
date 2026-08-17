import type { PermitPackage } from "@canopy/geometry";
import { formatLengthMm, type ProjectDocument } from "@canopy/shared";
import { BlueprintPrintPackage } from "./BlueprintPrintPackage.js";

export interface PermitPrintPackageProps {
  pkg: PermitPackage;
  document: ProjectDocument;
}

/**
 * Print-only duplicate of the permit package - hidden on screen, shown only
 * under `@media print` - so a single Print click emits every sheet, not just
 * whatever the on-screen preview happens to show. The drawing page reuses
 * `BlueprintPrintPackage` directly rather than re-rendering sheets by hand,
 * so the permit package's plan/elevations page can never drift from the
 * Milestone 6 print pathway.
 */
export function PermitPrintPackage({ pkg, document }: PermitPrintPackageProps) {
  const sectionsById = new Map(document.sections.map((s) => [s.id, s]));
  const materialsById = new Map(document.materials.map((m) => [m.id, m]));

  return (
    <div className="permit-print-package" data-testid="permit-print-package" aria-hidden="true">
      <div className="permit-print-package__page" data-testid="permit-print-page-summary" data-page-break="start">
        <h2>
          {pkg.titleBlock.projectName} - Permit-assist package (Rev {pkg.titleBlock.revision})
        </h2>
        <p>{pkg.disclaimer}</p>

        <h3>Site plan draft</h3>
        <p>
          Address: {pkg.sitePlan.address.provenance === "user-entered" ? pkg.sitePlan.address.value : "not provided"}
        </p>
        <p>Zoning: {pkg.sitePlan.zoning.provenance === "user-entered" ? pkg.sitePlan.zoning.value : "not provided"}</p>
        <p>{pkg.sitePlan.northArrowNote}</p>
        <p>{pkg.sitePlan.propertyLineNote}</p>

        <h3>Post and footing layout</h3>
        <ul>
          {pkg.footingLayout.callouts.map((callout) => (
            <li key={callout.postId}>
              {callout.postId}: {callout.note}
            </li>
          ))}
        </ul>
        <p>{pkg.footingLayout.note}</p>

        <h3>Member schedule</h3>
        <table>
          <thead>
            <tr>
              <th>Section</th>
              <th>Material</th>
              <th>Qty</th>
              <th>Finished length</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            {pkg.memberSchedule.rows.map((row) => (
              <tr key={row.key}>
                <td>{sectionsById.get(row.sectionId)?.name ?? row.sectionId}</td>
                <td>{row.materialId ? (materialsById.get(row.materialId)?.name ?? row.materialId) : "-"}</td>
                <td>{row.quantity}</td>
                <td>{formatLengthMm(row.finishedLengthMm, document.displayUnits)}</td>
                <td>{row.memberIds.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Structural summary</h3>
        <p>{pkg.structuralSummary.saddleEngineerReviewBanner}</p>
        <table>
          <tbody>
            {pkg.structuralSummary.members.map((entry) => (
              <tr key={entry.memberId}>
                <td>{entry.memberId}</td>
                <td>{entry.status}</td>
                <td>{entry.reason ?? ""}</td>
              </tr>
            ))}
            {pkg.structuralSummary.posts.map((entry) => (
              <tr key={entry.postId}>
                <td>{entry.postId}</td>
                <td>{entry.status}</td>
                <td>{entry.reason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Assumptions</h3>
        <p>{pkg.assumptions.unitsNote}</p>
        <p>{pkg.assumptions.toleranceNote}</p>
        <p>
          Model source: {pkg.assumptions.modelSource.projectName} (revision {pkg.assumptions.modelSource.revision},
          generated {pkg.assumptions.modelSource.generatedAt})
        </p>
        <p>
          Jurisdiction:{" "}
          {pkg.assumptions.jurisdiction.provenance === "user-entered"
            ? `${pkg.assumptions.jurisdiction.value.provider} (${pkg.assumptions.jurisdiction.value.edition})`
            : "not provided"}
        </p>
        <ul>
          {pkg.assumptions.limitations.map((limitation, index) => (
            <li key={index}>{limitation}</li>
          ))}
        </ul>
      </div>
      <div className="permit-print-package__page" data-testid="permit-print-page-drawings" data-page-break="before">
        <BlueprintPrintPackage sheetSet={pkg.drawingSheets} />
      </div>
    </div>
  );
}
