import type { BlueprintSheet } from "@canopy/geometry";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlueprintSheetSvg } from "./BlueprintSheetSvg.js";

function drawingSheet(overrides: Partial<BlueprintSheet> = {}): BlueprintSheet {
  return {
    titleBlock: {
      projectName: "Fixture Canopy",
      revision: 3,
      date: "2026-08-17T09:00:00.000Z",
      scale: "1:20",
      sheetNumber: 1,
      sheetCount: 2,
    },
    views: [
      {
        key: "plan",
        title: "Plan",
        viewport: { key: "plan", xMm: 10, yMm: 10, widthMm: 400, heightMm: 150 },
        members: [{ memberId: "beam-1", mark: "B1", outline: [{ x: 20, y: 20 }, { x: 380, y: 20 }, { x: 380, y: 140 }, { x: 20, y: 140 }] }],
        joints: [{ jointId: "joint-1", mark: "J1", position: { x: 200, y: 80 } }],
        dimensions: [
          { memberId: "beam-1", a: { x: 20, y: 20 }, b: { x: 380, y: 20 }, valueMm: 3000, label: "3000 mm" },
        ],
      },
    ],
    unresolvedItems: [],
    ...overrides,
  };
}

describe("BlueprintSheetSvg", () => {
  it("renders the title block with project name, revision, date, scale, and sheet number", () => {
    render(<BlueprintSheetSvg sheet={drawingSheet()} />);
    const titleBlock = screen.getByTestId("blueprint-title-block");
    expect(within(titleBlock).getByText("Fixture Canopy")).toBeInTheDocument();
    expect(within(titleBlock).getByText(/rev(ision)?\s*3/i)).toBeInTheDocument();
    expect(within(titleBlock).getByText(/2026-08-17/)).toBeInTheDocument();
    expect(within(titleBlock).getByText("1:20")).toBeInTheDocument();
    expect(within(titleBlock).getByText(/sheet\s*1\s*(of|\/)\s*2/i)).toBeInTheDocument();
  });

  it("renders one polygon per member outline with its mark label", () => {
    render(<BlueprintSheetSvg sheet={drawingSheet()} />);
    expect(screen.getByTestId("blueprint-member-beam-1")).toBeInTheDocument();
    expect(screen.getByText("B1")).toBeInTheDocument();
  });

  it("renders a joint marker with its mark label", () => {
    render(<BlueprintSheetSvg sheet={drawingSheet()} />);
    expect(screen.getByTestId("blueprint-joint-joint-1")).toBeInTheDocument();
    expect(screen.getByText("J1")).toBeInTheDocument();
  });

  it("renders a dimension label sourced from the model, not the raw coordinates", () => {
    render(<BlueprintSheetSvg sheet={drawingSheet()} />);
    expect(screen.getByText("3000 mm")).toBeInTheDocument();
  });

  it("renders an unresolved-item schedule table when the sheet carries no views", () => {
    render(
      <BlueprintSheetSvg
        sheet={drawingSheet({
          views: [],
          unresolvedItems: [{ kind: "unresolved-connection", memberIds: ["beam-1", "beam-2"], message: "beam-1 and beam-2 meet but have no confirmed joint yet." }],
        })}
      />,
    );
    const schedule = screen.getByTestId("blueprint-unresolved-schedule");
    expect(within(schedule).getByText(/beam-1 and beam-2 meet/)).toBeInTheDocument();
  });

  it("shows a clear empty state when there are no unresolved items", () => {
    render(<BlueprintSheetSvg sheet={drawingSheet({ views: [], unresolvedItems: [] })} />);
    expect(screen.getByTestId("blueprint-unresolved-schedule")).toHaveTextContent(/no unresolved items/i);
  });
});
