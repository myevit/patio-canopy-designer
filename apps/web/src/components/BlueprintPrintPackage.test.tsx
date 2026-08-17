import type { BlueprintSheet, BlueprintSheetSet } from "@canopy/geometry";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlueprintPrintPackage } from "./BlueprintPrintPackage.js";

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
  return { sheets: [sheet(1), sheet(2)] };
}

describe("BlueprintPrintPackage", () => {
  it("renders every sheet in the set, not just the currently-active one", () => {
    render(<BlueprintPrintPackage sheetSet={sheetSet()} />);
    expect(screen.getByTestId("blueprint-print-page-1")).toBeInTheDocument();
    expect(screen.getByTestId("blueprint-print-page-2")).toBeInTheDocument();
  });

  it("labels every printed sheet's scale as indicative, never asserting an exact fit", () => {
    render(<BlueprintPrintPackage sheetSet={sheetSet()} />);
    for (const pageNumber of [1, 2]) {
      const page = screen.getByTestId(`blueprint-print-page-${pageNumber}`);
      expect(within(page).getByTestId("blueprint-title-block-scale")).toHaveTextContent(/indicative/i);
      expect(within(page).getByTestId("blueprint-print-scale-footnote")).toBeInTheDocument();
    }
  });

  it("marks only the first page as the page-break start and every later page as page-break-before, so print has no leading or trailing blank page", () => {
    render(<BlueprintPrintPackage sheetSet={sheetSet()} />);
    expect(screen.getByTestId("blueprint-print-page-1")).toHaveAttribute("data-page-break", "start");
    expect(screen.getByTestId("blueprint-print-page-2")).toHaveAttribute("data-page-break", "before");
  });

  it("is hidden from assistive tech, since it duplicates the on-screen preview purely for print", () => {
    render(<BlueprintPrintPackage sheetSet={sheetSet()} />);
    expect(screen.getByTestId("blueprint-print-package")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders no permit disclaimer footer by default, since a plain blueprint print is not a permit document", () => {
    render(<BlueprintPrintPackage sheetSet={sheetSet()} />);
    expect(screen.queryByTestId("blueprint-sheet-permit-disclaimer")).not.toBeInTheDocument();
  });

  it("renders the permit disclaimer footer on every sheet page when supplied", () => {
    render(<BlueprintPrintPackage sheetSet={sheetSet()} permitDisclaimer="Not a permit approval - no code-compliance claim." />);
    for (const pageNumber of [1, 2]) {
      const page = screen.getByTestId(`blueprint-print-page-${pageNumber}`);
      expect(within(page).getByTestId("blueprint-sheet-permit-disclaimer")).toHaveTextContent(/not a permit approval/i);
    }
  });
});
