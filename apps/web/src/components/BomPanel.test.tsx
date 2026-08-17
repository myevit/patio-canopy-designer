import type { MemberSchedule } from "@canopy/geometry";
import type { Material, Section } from "@canopy/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BomPanel } from "./BomPanel.js";

const SECTIONS: Section[] = [{ id: "sec-rafter", name: "89x38 Rafter", widthMm: 89, heightMm: 38 }];
const MATERIALS: Material[] = [{ id: "mat-cedar", name: "Cedar" }];

function schedule(overrides: Partial<MemberSchedule> = {}): MemberSchedule {
  return {
    rows: [
      {
        key: "k1",
        sectionId: "sec-rafter",
        materialId: "mat-cedar",
        finishedLengthMm: 3000,
        stockAllowanceMm: 50,
        stockLengthMm: 3600,
        fitsStandardStock: true,
        quantity: 2,
        memberIds: ["member-1", "member-2"],
      },
    ],
    nearZeroMemberIds: [],
    ...overrides,
  };
}

describe("BomPanel", () => {
  it("renders one row per schedule group with resolved section/material names", () => {
    render(
      <BomPanel
        schedule={schedule()}
        sections={SECTIONS}
        materials={MATERIALS}
        displayUnits="mm"
        onDownloadCsv={() => {}}
        onPrint={() => {}}
      />,
    );
    expect(screen.getByText("89x38 Rafter")).toBeInTheDocument();
    expect(screen.getByText("Cedar")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders every member id in a row as a traceable, selectable control", async () => {
    const user = userEvent.setup();
    const onSelectObject = vi.fn();
    render(
      <BomPanel
        schedule={schedule()}
        sections={SECTIONS}
        materials={MATERIALS}
        displayUnits="mm"
        onDownloadCsv={() => {}}
        onPrint={() => {}}
        onSelectObject={onSelectObject}
      />,
    );
    await user.click(screen.getByRole("button", { name: "member-1" }));
    expect(onSelectObject).toHaveBeenCalledWith("member-1");
    expect(screen.getByRole("button", { name: "member-2" })).toBeInTheDocument();
  });

  it("formats lengths according to the given display unit", () => {
    render(
      <BomPanel
        schedule={schedule()}
        sections={SECTIONS}
        materials={MATERIALS}
        displayUnits="m"
        onDownloadCsv={() => {}}
        onPrint={() => {}}
      />,
    );
    expect(screen.getByText("3.000 m")).toBeInTheDocument();
  });

  it("surfaces near-zero-length members as a visible warning instead of silently dropping them", () => {
    render(
      <BomPanel
        schedule={schedule({ nearZeroMemberIds: ["tiny-1"] })}
        sections={SECTIONS}
        materials={MATERIALS}
        displayUnits="mm"
        onDownloadCsv={() => {}}
        onPrint={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/tiny-1/);
  });

  it("calls onDownloadCsv and onPrint from their respective buttons", async () => {
    const user = userEvent.setup();
    const onDownloadCsv = vi.fn();
    const onPrint = vi.fn();
    render(
      <BomPanel
        schedule={schedule()}
        sections={SECTIONS}
        materials={MATERIALS}
        displayUnits="mm"
        onDownloadCsv={onDownloadCsv}
        onPrint={onPrint}
      />,
    );
    await user.click(screen.getByRole("button", { name: /download csv/i }));
    expect(onDownloadCsv).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /print/i }));
    expect(onPrint).toHaveBeenCalled();
  });

  it("shows an empty-state message when there are no rows", () => {
    render(
      <BomPanel
        schedule={schedule({ rows: [] })}
        sections={SECTIONS}
        materials={MATERIALS}
        displayUnits="mm"
        onDownloadCsv={() => {}}
        onPrint={() => {}}
      />,
    );
    expect(screen.getByText(/no members to schedule/i)).toBeInTheDocument();
  });
});
