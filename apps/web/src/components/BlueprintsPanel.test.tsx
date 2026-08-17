import type { BlueprintSheet, BlueprintSheetSet } from "@canopy/geometry";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BlueprintsPanel } from "./BlueprintsPanel.js";

function sheet(sheetNumber: number, overrides: Partial<BlueprintSheet> = {}): BlueprintSheet {
  return {
    titleBlock: {
      projectName: "Fixture Canopy",
      revision: 1,
      date: "2026-08-17T09:00:00.000Z",
      scale: "1:20",
      sheetNumber,
      sheetCount: 2,
    },
    views: [],
    unresolvedItems: [],
    ...overrides,
  };
}

function sheetSet(): BlueprintSheetSet {
  return {
    sheets: [
      sheet(1, {
        views: [
          {
            key: "plan",
            title: "Plan",
            viewport: { key: "plan", xMm: 10, yMm: 10, widthMm: 400, heightMm: 150 },
            members: [],
            joints: [],
            dimensions: [],
          },
        ],
      }),
      sheet(2, { unresolvedItems: [{ kind: "unresolved-connection", memberIds: ["beam-1"], message: "beam-1 needs a joint." }] }),
    ],
  };
}

describe("BlueprintsPanel", () => {
  it("shows the first sheet initially", () => {
    render(<BlueprintsPanel sheetSet={sheetSet()} onPrint={vi.fn()} />);
    const activeSheet = within(screen.getByTestId("blueprint-active-sheet"));
    expect(activeSheet.getByTestId("blueprint-view-plan")).toBeInTheDocument();
    expect(activeSheet.getByText(/sheet\s*1\s*(of|\/)\s*2/i)).toBeInTheDocument();
  });

  it("navigates to the next sheet and shows its content", async () => {
    const user = userEvent.setup();
    render(<BlueprintsPanel sheetSet={sheetSet()} onPrint={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    const activeSheet = within(screen.getByTestId("blueprint-active-sheet"));
    expect(activeSheet.getByText(/beam-1 needs a joint/)).toBeInTheDocument();
  });

  it("disables Previous on the first sheet and Next on the last sheet", async () => {
    const user = userEvent.setup();
    render(<BlueprintsPanel sheetSet={sheetSet()} onPrint={vi.fn()} />);
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("calls onPrint when the Print button is clicked", async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    render(<BlueprintsPanel sheetSet={sheetSet()} onPrint={onPrint} />);
    await user.click(screen.getByRole("button", { name: /print/i }));
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it("always keeps the full print package (every sheet) in the DOM, even while sheet 1 is the active preview", () => {
    render(<BlueprintsPanel sheetSet={sheetSet()} onPrint={vi.fn()} />);
    // The visible preview only shows sheet 1...
    expect(within(screen.getByTestId("blueprint-active-sheet")).getByText(/sheet\s*1\s*(of|\/)\s*2/i)).toBeInTheDocument();
    // ...but the hidden print package carries both sheets, so Print emits the full package.
    expect(screen.getByTestId("blueprint-print-page-1")).toBeInTheDocument();
    expect(screen.getByTestId("blueprint-print-page-2")).toBeInTheDocument();
  });
});
