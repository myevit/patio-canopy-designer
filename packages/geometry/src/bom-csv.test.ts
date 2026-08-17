import { describe, expect, it } from "vitest";
import { toBomCsv } from "./bom-csv.js";
import type { MemberScheduleRow } from "./member-schedule.js";

const SECTIONS = [{ id: "sec-rafter", name: "89x38 Rafter", widthMm: 89, heightMm: 38 }];
const MATERIALS = [{ id: "mat-cedar", name: "Cedar" }];

function row(overrides: Partial<MemberScheduleRow> = {}): MemberScheduleRow {
  return {
    key: "k",
    sectionId: "sec-rafter",
    materialId: "mat-cedar",
    finishedLengthMm: 3000,
    stockAllowanceMm: 50,
    stockLengthMm: 3600,
    fitsStandardStock: true,
    quantity: 2,
    memberIds: ["m-1", "m-2"],
    ...overrides,
  };
}

describe("toBomCsv", () => {
  it("emits a header row followed by one row per schedule entry with human-readable names", () => {
    const csv = toBomCsv([row()], SECTIONS, MATERIALS);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "Section,Material,Quantity,Finished Length (mm),Stock Length (mm),Stock Allowance (mm),Fits Standard Stock,Member IDs",
    );
    expect(lines[1]).toBe("89x38 Rafter,Cedar,2,3000,3600,50,Yes,m-1;m-2");
  });

  it("falls back to the raw id when a section or material can't be resolved", () => {
    const csv = toBomCsv([row({ sectionId: "unknown-section", materialId: undefined })], [], MATERIALS);
    const lines = csv.trim().split("\n");
    expect(lines[1]).toBe("unknown-section,-,2,3000,3600,50,Yes,m-1;m-2");
  });

  it("quotes fields that contain a comma", () => {
    const csv = toBomCsv(
      [row()],
      [{ id: "sec-rafter", name: "89x38, Rafter", widthMm: 89, heightMm: 38 }],
      MATERIALS,
    );
    const lines = csv.trim().split("\n");
    expect(lines[1]).toBe('"89x38, Rafter",Cedar,2,3000,3600,50,Yes,m-1;m-2');
  });

  it("reports 'No' for rows that don't fit standard stock", () => {
    const csv = toBomCsv([row({ fitsStandardStock: false })], SECTIONS, MATERIALS);
    expect(csv).toContain(",No,");
  });

  it("neutralizes formula-leading section names before CSV output", () => {
    const cases: Array<[string, string]> = [
      // Value with commas+quotes -> guarded then quoted.
      ['=HYPERLINK("a","b")', "\"'=HYPERLINK(\"\"a\"\",\"\"b\"\")\""],
      // Value with commas, no quotes -> guarded then quoted.
      ["+SUM(1,2)", "\"'+SUM(1,2)\""],
      // Plain leading dash/minus expression -> guarded, unquoted.
      ["-2+2", "'-2+2"],
      // At-sign function -> guarded, unquoted.
      ["@SUM(A1:A2)", "'@SUM(A1:A2)"],
    ];
    for (const [name, expectedCell] of cases) {
      const csv = toBomCsv(
        [row({ sectionId: "sec-rogue" })],
        [{ id: "sec-rogue", name, widthMm: 89, heightMm: 38 }],
        MATERIALS,
      );
      const body = csv.trim().split("\n")[1]!;
      expect(body.startsWith(expectedCell)).toBe(true);
      // No cell anywhere may begin raw with a formula trigger.
      expect(csv).not.toMatch(/(^|,|\n)[=+\-@]/);
    }
  });

  it("leaves a lone '-' material placeholder unguarded", () => {
    const csv = toBomCsv([row({ materialId: undefined })], SECTIONS, MATERIALS);
    expect(csv).toContain(",-,");
  });
});
