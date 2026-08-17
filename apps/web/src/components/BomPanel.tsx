import type { MemberSchedule } from "@canopy/geometry";
import { formatLengthMm, formatSectionLabel, type DisplayLengthUnit, type Material, type Section } from "@canopy/shared";

function sectionLabel(section: Section | undefined, sectionId: string): string {
  return section ? formatSectionLabel(section.name, section.widthMm, section.heightMm) : sectionId;
}

export interface BomPanelProps {
  schedule: MemberSchedule;
  sections: Section[];
  materials: Material[];
  displayUnits: DisplayLengthUnit;
  onDownloadCsv: () => void;
  onPrint: () => void;
  onSelectObject?: (objectId: string) => void;
}

export function BomPanel({
  schedule,
  sections,
  materials,
  displayUnits,
  onDownloadCsv,
  onPrint,
  onSelectObject,
}: BomPanelProps) {
  const sectionsById = new Map(sections.map((s) => [s.id, s]));
  const materialsById = new Map(materials.map((m) => [m.id, m]));

  return (
    <section aria-label="Bill of materials" className="bom-panel">
      <div className="bom-panel__toolbar">
        <button type="button" onClick={onDownloadCsv}>
          Download CSV
        </button>
        <button type="button" onClick={onPrint}>
          Print
        </button>
      </div>

      {schedule.nearZeroMemberIds.length > 0 && (
        <p role="alert">
          {schedule.nearZeroMemberIds.length} near-zero-length member
          {schedule.nearZeroMemberIds.length === 1 ? "" : "s"} excluded from the schedule and need review:{" "}
          {schedule.nearZeroMemberIds.join(", ")}
        </p>
      )}

      {schedule.rows.length === 0 ? (
        <p>No members to schedule yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Section</th>
              <th>Material</th>
              <th>Qty</th>
              <th>Finished length</th>
              <th>Stock length</th>
              <th>Fits standard stock</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            {schedule.rows.map((row) => (
              <tr key={row.key} data-testid={`bom-row-${row.key}`}>
                <td>{sectionLabel(sectionsById.get(row.sectionId), row.sectionId)}</td>
                <td>{row.materialId ? materialsById.get(row.materialId)?.name ?? row.materialId : "-"}</td>
                <td>{row.quantity}</td>
                <td>{formatLengthMm(row.finishedLengthMm, displayUnits)}</td>
                <td>{formatLengthMm(row.stockLengthMm, displayUnits)}</td>
                <td>{row.fitsStandardStock ? "Yes" : "No"}</td>
                <td>
                  {row.memberIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      data-testid={`bom-member-${id}`}
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
  );
}
