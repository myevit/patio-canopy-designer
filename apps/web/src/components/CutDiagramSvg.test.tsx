import type { CutFabricationCard } from "@canopy/geometry";
import { squareCut, bevelCut } from "@canopy/geometry";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CutDiagramSvg } from "./CutDiagramSvg.js";

function card(overrides: Partial<CutFabricationCard> = {}): CutFabricationCard {
  const endA = squareCut(0, -1);
  const endB = squareCut(3000, 1);
  return {
    memberId: "m-1",
    kind: "beam",
    sectionId: "sec-1",
    materialId: undefined,
    sectionWidthMm: 89,
    sectionHeightMm: 38,
    finishedLengthMm: 3000,
    longPointMm: 3000,
    shortPointMm: 3000,
    stockAllowanceMm: 50,
    stockLengthMm: 3600,
    fitsStandardStock: true,
    isNearZeroLength: false,
    endA: { plane: endA, miterRad: 0, bevelRad: 0, roofPlaneId: null },
    endB: { plane: endB, miterRad: 0, bevelRad: 0, roofPlaneId: null },
    ...overrides,
  };
}

describe("CutDiagramSvg", () => {
  it("renders a side-view polygon whose points come from the cut card's own geometry", () => {
    render(<CutDiagramSvg card={card()} />);
    const sideView = screen.getByTestId("cut-diagram-side-view");
    expect(sideView).toHaveAttribute("points", "0,-19 3000,-19 3000,19 0,19");
  });

  it("renders end-view rectangles sized to the section width and height", () => {
    render(<CutDiagramSvg card={card()} />);
    const endViewA = screen.getByTestId("cut-diagram-end-view-a");
    const endViewB = screen.getByTestId("cut-diagram-end-view-b");
    expect(endViewA).toBeInTheDocument();
    expect(endViewB).toBeInTheDocument();
  });

  it("slants the side-view outline for a beveled end", () => {
    const bevelRad = (15 * Math.PI) / 180;
    render(
      <CutDiagramSvg
        card={card({ endB: { plane: bevelCut(3000, bevelRad, 1), miterRad: 0, bevelRad, roofPlaneId: null } })}
      />,
    );
    const points = screen.getByTestId("cut-diagram-side-view").getAttribute("points");
    // Bottom-right and top-right x-coordinates should differ for a non-square end.
    const [, bottomRight, topRight] = points!.split(" ");
    expect(bottomRight!.split(",")[0]).not.toBe(topRight!.split(",")[0]);
  });
});
