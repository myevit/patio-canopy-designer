import { describe, expect, it } from "vitest";
import { buildCutDiagramLayout } from "./cut-diagram-layout.js";
import { bevelCut, squareCut } from "./end-cuts.js";
import type { CutFabricationCard } from "./cut-fabrication.js";

const SECTION_WIDTH_MM = 89;
const SECTION_HEIGHT_MM = 38;

function card(overrides: Partial<CutFabricationCard> = {}): CutFabricationCard {
  const endA = squareCut(0, -1);
  const endB = squareCut(3000, 1);
  return {
    memberId: "m-1",
    kind: "beam",
    sectionId: "sec-1",
    materialId: undefined,
    sectionWidthMm: SECTION_WIDTH_MM,
    sectionHeightMm: SECTION_HEIGHT_MM,
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

describe("buildCutDiagramLayout", () => {
  it("draws a rectangular side-view outline for two square cuts", () => {
    const layout = buildCutDiagramLayout(card());
    const halfHeight = SECTION_HEIGHT_MM / 2;
    expect(layout.sideView.outline).toEqual([
      { x: 0, y: -halfHeight },
      { x: 3000, y: -halfHeight },
      { x: 3000, y: halfHeight },
      { x: 0, y: halfHeight },
    ]);
  });

  it("draws a full-width, full-height rectangle for each end view regardless of cut angle", () => {
    const layout = buildCutDiagramLayout(card());
    const halfWidth = SECTION_WIDTH_MM / 2;
    const halfHeight = SECTION_HEIGHT_MM / 2;
    expect(layout.endViewA.outline).toHaveLength(4);
    layout.endViewA.outline.forEach((point) => {
      expect(Math.abs(point.x)).toBeCloseTo(halfWidth, 9);
      expect(Math.abs(point.y)).toBeCloseTo(halfHeight, 9);
    });
  });

  it("slants the side-view profile for a bevel cut, spreading the top and bottom corners", () => {
    const bevelRad = (15 * Math.PI) / 180;
    const endB = bevelCut(3000, bevelRad, 1);
    const layout = buildCutDiagramLayout(
      card({ endB: { plane: endB, miterRad: 0, bevelRad, roofPlaneId: null } }),
    );
    const [, bottomRight, topRight] = layout.sideView.outline;
    expect(bottomRight!.x).not.toBeCloseTo(topRight!.x, 3);
  });

  it("marks the long and short corners on the end view whose cut produced the spread", () => {
    const bevelRad = (15 * Math.PI) / 180;
    const endB = bevelCut(3000, bevelRad, 1);
    const layout = buildCutDiagramLayout(
      card({ endB: { plane: endB, miterRad: 0, bevelRad, roofPlaneId: null } }),
    );
    expect(layout.endViewB.longCorner).not.toEqual(layout.endViewB.shortCorner);
  });
});
