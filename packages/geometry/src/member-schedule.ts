import type { ProjectDocument } from "@canopy/shared";
import { derivePhysicalMembers } from "./resolve-physical-members.js";
import { DEFAULT_STOCK_ALLOWANCE_MM, deriveStockLength } from "./stock-allowance.js";

export interface MemberScheduleRow {
  key: string;
  sectionId: string;
  materialId: string | undefined;
  /** Physical, trimmed reference length, rounded to the nearest millimetre for grouping and display. */
  finishedLengthMm: number;
  stockAllowanceMm: number;
  stockLengthMm: number;
  fitsStandardStock: boolean;
  quantity: number;
  /** Every physical member/post id aggregated into this row, sorted for stable output. */
  memberIds: string[];
}

export interface MemberSchedule {
  rows: MemberScheduleRow[];
  /** Members too short to fabricate; excluded from rows so they can't be silently procured, but never dropped from the output. */
  nearZeroMemberIds: string[];
}

/**
 * Groups every physical member/post by section, material, and finished
 * length into procurement rows, each still tracing back to the exact model
 * ids it aggregates. Stock length is derived from the finished length plus
 * an explicit allowance, kept as a separate field so the two are never
 * confused.
 */
export function buildMemberSchedule(
  document: ProjectDocument,
  stockAllowanceMm: number = DEFAULT_STOCK_ALLOWANCE_MM,
): MemberSchedule {
  const physicalMembers = derivePhysicalMembers(document);

  const nearZeroMemberIds = physicalMembers.filter((m) => m.trimmed.isNearZeroLength).map((m) => m.id);
  const groups = new Map<string, MemberScheduleRow>();

  physicalMembers
    .filter((m) => !m.trimmed.isNearZeroLength)
    .forEach((member) => {
      const finishedLengthMm = Math.round(member.trimmed.finishedLengthMm);
      const key = `${member.sectionId}::${member.materialId ?? ""}::${finishedLengthMm}`;
      const existing = groups.get(key);
      if (existing) {
        existing.quantity += 1;
        existing.memberIds.push(member.id);
        return;
      }
      const stock = deriveStockLength(finishedLengthMm, stockAllowanceMm);
      groups.set(key, {
        key,
        sectionId: member.sectionId,
        materialId: member.materialId,
        finishedLengthMm,
        stockAllowanceMm,
        stockLengthMm: stock.stockLengthMm,
        fitsStandardStock: stock.fitsStandardStock,
        quantity: 1,
        memberIds: [member.id],
      });
    });

  const rows = [...groups.values()]
    .map((row) => ({ ...row, memberIds: [...row.memberIds].sort() }))
    .sort((a, b) => a.sectionId.localeCompare(b.sectionId) || a.finishedLengthMm - b.finishedLengthMm);

  return { rows, nearZeroMemberIds: [...nearZeroMemberIds].sort() };
}
