import type { MemberAnalysisReport, PostAnalysisReport } from "@canopy/calculations";
import { buildPermitPackage, type Point2D } from "@canopy/geometry";
import { formatLengthMm, type ProjectDocument } from "@canopy/shared";
import { useMemo, useState } from "react";
import { BlueprintSheetSvg } from "./BlueprintSheetSvg.js";
import { PermitPrintPackage } from "./PermitPrintPackage.js";

export interface PermitPackagePanelProps {
  document: ProjectDocument;
  /** ISO timestamp for title-block/assumptions dates; passed in rather than read from the clock so assembly stays deterministic. */
  generatedAt: string;
  memberAnalysisReports: MemberAnalysisReport[];
  postAnalysisReports: PostAnalysisReport[];
  onPrint: () => void;
  onSelectObject?: (objectId: string) => void;
}

function footprintPoints(points: Point2D[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

export function PermitPackagePanel({
  document,
  generatedAt,
  memberAnalysisReports,
  postAnalysisReports,
  onPrint,
  onSelectObject,
}: PermitPackagePanelProps) {
  const [address, setAddress] = useState("");
  const [zoning, setZoning] = useState("");
  const [provider, setProvider] = useState("");
  const [edition, setEdition] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const jurisdiction = provider || edition || effectiveDate ? { provider, edition, effectiveDate } : undefined;

  const pkg = useMemo(
    () =>
      buildPermitPackage(document, {
        generatedAt,
        address: address.trim() === "" ? undefined : address,
        zoning: zoning.trim() === "" ? undefined : zoning,
        jurisdiction,
        memberAnalysisReports,
        postAnalysisReports,
      }),
    [document, generatedAt, address, zoning, jurisdiction, memberAnalysisReports, postAnalysisReports],
  );

  const sectionsById = new Map(document.sections.map((s) => [s.id, s]));
  const materialsById = new Map(document.materials.map((m) => [m.id, m]));
  const drawingSheet = pkg.drawingSheets.sheets[0];

  return (
    <section aria-label="Permit package" className="permit-package-panel">
      <div className="permit-package-panel__screen">
      <div className="permit-package-panel__toolbar">
        <button type="button" onClick={onPrint}>
          Print
        </button>
      </div>

      <p
        role="note"
        aria-label="Permit package disclaimer"
        data-testid="permit-package-disclaimer"
        className="permit-package-panel__disclaimer"
      >
        {pkg.disclaimer}
      </p>

      <fieldset aria-label="Site plan draft">
        <legend>Site plan draft</legend>
        <label>
          Address (optional)
          <input value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
        <label>
          Zoning (optional)
          <input value={zoning} onChange={(event) => setZoning(event.target.value)} />
        </label>
        <p data-testid="permit-site-address">
          Address: {pkg.sitePlan.address.provenance === "user-entered" ? pkg.sitePlan.address.value : "not provided"}
        </p>
        <p data-testid="permit-site-zoning">
          Zoning: {pkg.sitePlan.zoning.provenance === "user-entered" ? pkg.sitePlan.zoning.value : "not provided"}
        </p>
        <svg role="img" aria-label="Site plan footprints" viewBox="-6000 -6000 12000 12000" width={280} height={280}>
          {pkg.sitePlan.footprints.map((footprint, index) => (
            <polygon
              key={`${footprint.kind}-${index}`}
              data-testid={`permit-footprint-${footprint.kind}-${index}`}
              points={footprintPoints(footprint.outlineMm)}
              className={`permit-package-panel__footprint permit-package-panel__footprint--${footprint.kind}`}
            />
          ))}
          <g
            data-testid="permit-site-plan-north-arrow"
            className="permit-package-panel__north-arrow"
            transform="translate(4700, -5300)"
          >
            <line x1={0} y1={0} x2={0} y2={650} className="permit-package-panel__north-arrow-shaft" />
            <polygon points="-100,520 100,520 0,750" className="permit-package-panel__north-arrow-head" />
            <text x={0} y={-40} textAnchor="middle" className="permit-package-panel__north-arrow-label">
              N
            </text>
          </g>
        </svg>
        <p>{pkg.sitePlan.northArrowNote}</p>
        <p>{pkg.sitePlan.propertyLineNote}</p>
      </fieldset>

      <section aria-label="Dimensioned plan and elevations">
        <h3>Dimensioned plan and elevations</h3>
        {drawingSheet && <BlueprintSheetSvg sheet={drawingSheet} />}
      </section>

      <fieldset aria-label="Post and footing layout">
        <legend>Post and footing layout</legend>
        <svg role="img" aria-label="Footing layout" viewBox="-6000 -6000 12000 12000" width={280} height={280}>
          {pkg.footingLayout.callouts.map((callout) => (
            <g key={callout.postId} data-testid={`permit-footing-${callout.postId}`}>
              <circle cx={callout.positionMm.x} cy={callout.positionMm.y} r={150} />
              <text x={callout.positionMm.x + 160} y={callout.positionMm.y}>
                {callout.postId}
              </text>
            </g>
          ))}
        </svg>
        <p>{pkg.footingLayout.note}</p>
      </fieldset>

      <section aria-label="Member schedule">
        <h3>Member schedule</h3>
        {pkg.memberSchedule.rows.length === 0 ? (
          <p>No members to schedule yet.</p>
        ) : (
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
                <tr key={row.key} data-testid={`permit-schedule-row-${row.key}`}>
                  <td>{sectionsById.get(row.sectionId)?.name ?? row.sectionId}</td>
                  <td>{row.materialId ? (materialsById.get(row.materialId)?.name ?? row.materialId) : "-"}</td>
                  <td>{row.quantity}</td>
                  <td>{formatLengthMm(row.finishedLengthMm, document.displayUnits)}</td>
                  <td>
                    {row.memberIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        data-testid={`permit-member-${id}`}
                        onClick={() => onSelectObject?.(id)}
                      >
                        {id}
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Structural summary">
        <h3>Structural summary</h3>
        <p role="note">{pkg.structuralSummary.saddleEngineerReviewBanner}</p>
        <table>
          <caption>Members</caption>
          <thead>
            <tr>
              <th>Member</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {pkg.structuralSummary.members.map((entry) => (
              <tr key={entry.memberId} data-testid={`permit-structural-member-${entry.memberId}`}>
                <td>{entry.memberId}</td>
                <td>{entry.status}</td>
                <td>{entry.reason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <caption>Posts</caption>
          <thead>
            <tr>
              <th>Post</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {pkg.structuralSummary.posts.map((entry) => (
              <tr key={entry.postId} data-testid={`permit-structural-post-${entry.postId}`}>
                <td>{entry.postId}</td>
                <td>{entry.status}</td>
                <td>{entry.reason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pkg.unresolvedItems.length > 0 && (
          <ul data-testid="permit-unresolved-items">
            {pkg.unresolvedItems.map((issue, index) => (
              <li key={index}>
                {issue.kind}: {issue.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <fieldset aria-label="Assumptions">
        <legend>Assumptions</legend>
        <p>{pkg.assumptions.unitsNote}</p>
        <p>{pkg.assumptions.toleranceNote}</p>
        <p>
          Model source: {pkg.assumptions.modelSource.projectName} (revision {pkg.assumptions.modelSource.revision},
          generated {pkg.assumptions.modelSource.generatedAt})
        </p>
        <fieldset>
          <legend>Jurisdiction / provider metadata (optional, descriptive only - never looked up)</legend>
          <label>
            Provider/authority
            <input value={provider} onChange={(event) => setProvider(event.target.value)} />
          </label>
          <label>
            Edition
            <input value={edition} onChange={(event) => setEdition(event.target.value)} />
          </label>
          <label>
            Effective date
            <input value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
          </label>
        </fieldset>
        <p data-testid="permit-jurisdiction-provenance">
          Jurisdiction: {pkg.assumptions.jurisdiction.provenance === "user-entered" ? "user-entered" : "not provided"}
        </p>
        <ul>
          {pkg.assumptions.limitations.map((limitation, index) => (
            <li key={index}>{limitation}</li>
          ))}
        </ul>
      </fieldset>
      </div>

      <PermitPrintPackage pkg={pkg} document={document} />
    </section>
  );
}
