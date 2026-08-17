import type { CutFabricationCard } from "./cut-fabrication.js";
import { cornerAxisU } from "./end-cuts.js";

export interface Point2D {
  x: number;
  y: number;
}

export interface SideViewLayout {
  /** Closed polygon in (axial mm, height mm) space: bottom-A, bottom-B, top-B, top-A. */
  outline: Point2D[];
}

export interface EndViewLayout {
  /** The section's (width mm, height mm) rectangle, unaffected by either end's cut angle. */
  outline: Point2D[];
  longCorner: Point2D;
  shortCorner: Point2D;
}

export interface CutDiagramLayout {
  sideView: SideViewLayout;
  endViewA: EndViewLayout;
  endViewB: EndViewLayout;
}

/**
 * Builds a schematic side elevation (looking along the section's width axis)
 * and two end views from a cut card's own validated geometry - no numbers
 * are re-entered by hand. The side view is drawn through the v=0 centre
 * slice: for a compound cut this is a simplified, schematic profile rather
 * than a true silhouette, which is sufficient for a shop-floor cut card.
 */
export function buildCutDiagramLayout(card: CutFabricationCard): CutDiagramLayout {
  const halfWidth = card.sectionWidthMm / 2;
  const halfHeight = card.sectionHeightMm / 2;

  const sideView: SideViewLayout = {
    outline: [
      { x: cornerAxisU(card.endA.plane, 0, -halfHeight), y: -halfHeight },
      { x: cornerAxisU(card.endB.plane, 0, -halfHeight), y: -halfHeight },
      { x: cornerAxisU(card.endB.plane, 0, halfHeight), y: halfHeight },
      { x: cornerAxisU(card.endA.plane, 0, halfHeight), y: halfHeight },
    ],
  };

  const corners: Array<[number, number]> = [
    [halfWidth, halfHeight],
    [halfWidth, -halfHeight],
    [-halfWidth, -halfHeight],
    [-halfWidth, halfHeight],
  ];
  const outline = corners.map(([v, w]) => ({ x: v, y: w }));
  const lengths = corners.map(
    ([v, w]) => cornerAxisU(card.endB.plane, v, w) - cornerAxisU(card.endA.plane, v, w),
  );
  let longIndex = 0;
  let shortIndex = 0;
  lengths.forEach((len, i) => {
    if (len > lengths[longIndex]!) longIndex = i;
    if (len < lengths[shortIndex]!) shortIndex = i;
  });
  const endView: EndViewLayout = { outline, longCorner: outline[longIndex]!, shortCorner: outline[shortIndex]! };

  return { sideView, endViewA: endView, endViewB: endView };
}
