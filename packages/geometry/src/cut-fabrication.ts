import type { ProjectDocument } from "@canopy/shared";
import type { EndCutPlane } from "./end-cuts.js";
import { derivePhysicalMembers, type PhysicalMember } from "./resolve-physical-members.js";
import { DEFAULT_STOCK_ALLOWANCE_MM, deriveStockLength } from "./stock-allowance.js";

export interface CutCardEnd {
  plane: EndCutPlane;
  miterRad: number;
  bevelRad: number;
  roofPlaneId: string | null;
}

export interface CutFabricationCard {
  memberId: string;
  kind: "post" | "beam";
  sectionId: string;
  materialId: string | undefined;
  sectionWidthMm: number;
  sectionHeightMm: number;
  /** Exact (unrounded) physical reference length between the two end-cut planes. */
  finishedLengthMm: number;
  longPointMm: number;
  shortPointMm: number;
  stockAllowanceMm: number;
  stockLengthMm: number;
  fitsStandardStock: boolean;
  isNearZeroLength: boolean;
  endA: CutCardEnd;
  endB: CutCardEnd;
}

function buildCard(
  member: PhysicalMember,
  sectionWidthMm: number,
  sectionHeightMm: number,
  stockAllowanceMm: number,
): CutFabricationCard {
  const { trimmed } = member;
  const stock = deriveStockLength(trimmed.finishedLengthMm, stockAllowanceMm);
  return {
    memberId: member.id,
    kind: member.kind,
    sectionId: member.sectionId,
    materialId: member.materialId,
    sectionWidthMm,
    sectionHeightMm,
    finishedLengthMm: trimmed.finishedLengthMm,
    longPointMm: trimmed.longPointMm,
    shortPointMm: trimmed.shortPointMm,
    stockAllowanceMm,
    stockLengthMm: stock.stockLengthMm,
    fitsStandardStock: stock.fitsStandardStock,
    isNearZeroLength: trimmed.isNearZeroLength,
    endA: { plane: member.endA.cut, miterRad: trimmed.endA.miterRad, bevelRad: trimmed.endA.bevelRad, roofPlaneId: member.endA.roofPlaneId },
    endB: { plane: member.endB.cut, miterRad: trimmed.endB.miterRad, bevelRad: trimmed.endB.bevelRad, roofPlaneId: member.endB.roofPlaneId },
  };
}

/**
 * One fabrication card per physical member/post - including near-zero-length
 * ones, flagged rather than dropped, so the Cuts tab always surfaces geometry
 * that needs the user's attention before it reaches a shop.
 */
export function buildCutFabrication(
  document: ProjectDocument,
  stockAllowanceMm: number = DEFAULT_STOCK_ALLOWANCE_MM,
): CutFabricationCard[] {
  const sectionsById = new Map(document.sections.map((s) => [s.id, s]));
  return derivePhysicalMembers(document).flatMap((member) => {
    const section = sectionsById.get(member.sectionId);
    if (!section) return [];
    return [buildCard(member, section.widthMm, section.heightMm, stockAllowanceMm)];
  });
}
