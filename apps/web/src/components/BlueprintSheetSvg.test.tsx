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

  it("keeps the SVG viewBox within the page bounds, reserving a band for the title block so it is never clipped", () => {
    render(<BlueprintSheetSvg sheet={drawingSheet()} />);
    const svg = screen.getByRole("img", { name: "Blueprint sheet" });
    // A3 landscape is 420x297mm; 30mm is reserved below the drawing for the title block.
    expect(svg.getAttribute("viewBox")).toBe("0 0 420 267");
  });

  it("in screen mode (the default), shows the sheet's computed scale for reference", () => {
    render(<BlueprintSheetSvg sheet={drawingSheet()} mode="screen" />);
    expect(screen.getByTestId("blueprint-title-block-scale")).toHaveTextContent("1:20");
    expect(screen.queryByTestId("blueprint-print-scale-footnote")).not.toBeInTheDocument();
  });

  it("in print mode, replaces the computed scale with an honest, paper-independent label and a footnote", () => {
    render(<BlueprintSheetSvg sheet={drawingSheet()} mode="print" />);
    const scale = screen.getByTestId("blueprint-title-block-scale");
    expect(scale).toHaveTextContent(/indicative/i);
    expect(scale).not.toHaveTextContent("1:20");
    expect(screen.getByTestId("blueprint-print-scale-footnote")).toHaveTextContent(/not guaranteed/i);
  });

  it("renders no permit disclaimer footer by default, since a plain blueprint sheet is not a permit document", () => {
    render(<BlueprintSheetSvg sheet={drawingSheet()} mode="print" />);
    expect(screen.queryByTestId("blueprint-sheet-permit-disclaimer")).not.toBeInTheDocument();
  });

  it("renders a compact permit disclaimer footer alongside the print footnote when one is supplied", () => {
    render(<BlueprintSheetSvg sheet={drawingSheet()} mode="print" permitDisclaimer="Not a permit approval - no code-compliance claim." />);
    expect(screen.getByTestId("blueprint-sheet-permit-disclaimer")).toHaveTextContent(/not a permit approval/i);
    expect(screen.getByTestId("blueprint-print-scale-footnote")).toBeInTheDocument();
  });
});
