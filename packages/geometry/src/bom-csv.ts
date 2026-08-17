import type { Material, Section } from "@canopy/shared";
import type { MemberScheduleRow } from "./member-schedule.js";

const HEADER = [
  "Section",
  "Material",
  "Quantity",
  "Finished Length (mm)",
  "Stock Length (mm)",
  "Stock Allowance (mm)",
  "Fits Standard Stock",
  "Member IDs",
];

function csvField(value: string): string {
  // Neutralize spreadsheet formula injection: a leading =, +, or @ (or a
  // leading '-' followed by more characters) can be interpreted as a formula
  // by Excel/LibreOffice when the CSV is opened. Prefixing with a single quote
  // marks the cell as literal text. A lone '-' is our literal "no material"
  // placeholder and is not a formula, so it is left untouched.
  const isFormulaLeading = /^[=+@]/.test(value) || (/^-/.test(value) && value.length > 1);
  const guarded = isFormulaLeading ? `'${value}` : value;
  if (/[\",\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

export function toBomCsv(rows: MemberScheduleRow[], sections: Section[], materials: Material[]): string {
  const sectionsById = new Map(sections.map((s) => [s.id, s]));
  const materialsById = new Map(materials.map((m) => [m.id, m]));

  const lines = rows.map((row) => {
    const sectionName = sectionsById.get(row.sectionId)?.name ?? row.sectionId;
    const materialName = row.materialId ? materialsById.get(row.materialId)?.name ?? row.materialId : "-";
    return [
      sectionName,
      materialName,
      String(row.quantity),
      String(row.finishedLengthMm),
      String(row.stockLengthMm),
      String(row.stockAllowanceMm),
      row.fitsStandardStock ? "Yes" : "No",
      row.memberIds.join(";"),
    ]
      .map(csvField)
      .join(",");
  });

  return [HEADER.join(","), ...lines].join("\n") + "\n";
}
