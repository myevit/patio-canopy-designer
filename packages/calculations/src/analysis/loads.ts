import type { AnalysisStatus } from "./status.js";
import type { LoadProvenance } from "./provenance.js";
import { rectSectionAreaMm2 } from "./section-properties.js";

export type AppliedLoadKind = "self-weight" | "snow" | "wind" | "vine" | "user-defined";

export interface AppliedLoad {
  kind: AppliedLoadKind;
  distributionNPerMm: number;
  provenance: LoadProvenance;
}

export interface MaterialUnitWeightInput {
  materialId: string;
  /** Explicit user-entered specific weight; never a bundled species/grade table. */
  specificWeightNPerMm3: number;
  provenance: LoadProvenance;
}

export interface SelfWeightResult {
  status: AnalysisStatus;
  load?: AppliedLoad;
  reason?: string;
}

/**
 * Self-weight is geometry (section area, already in the canonical model)
 * times a specific weight the user must explicitly enter. There is no
 * built-in species/grade density table, so a missing entry fails closed.
 */
export function computeSelfWeightLoad(
  section: { widthMm: number; heightMm: number },
  materialId: string | undefined,
  unitWeights: MaterialUnitWeightInput[],
): SelfWeightResult {
  if (!materialId) {
    return {
      status: "input-requires-verification",
      reason: "Member has no assigned material; enter a unit weight to include self-weight.",
    };
  }
  const entry = unitWeights.find((w) => w.materialId === materialId);
  if (!entry) {
    return {
      status: "input-requires-verification",
      reason: `No user-entered unit weight for material ${materialId}.`,
    };
  }
  const areaMm2 = rectSectionAreaMm2(section.widthMm, section.heightMm);
  return {
    status: "calculated-within-stated-assumptions",
    load: {
      kind: "self-weight",
      distributionNPerMm: areaMm2 * entry.specificWeightNPerMm3,
      provenance: {
        source: "computed-self-weight",
        label: "Computed from section geometry and user-entered specific weight",
      },
    },
  };
}

export interface RectangularPanel {
  /** Panel width in the tributary (load-sharing) direction. */
  widthMm: number;
  /** Number of evenly spaced members sharing this panel's width. */
  memberCount: number;
  /** True when the member sits at the panel edge and only carries half the interior share. */
  edgeMember: boolean;
}

/**
 * Tributary width for one member of an explicit, user-declared rectangular
 * panel with evenly spaced members. This never derives tributary geometry
 * from an arbitrary saddle/fan lattice - only from a panel the user has
 * explicitly bounded and declared as rectangular.
 */
export function computeTributaryWidthMm(panel: RectangularPanel): number {
  const share = panel.widthMm / panel.memberCount;
  return panel.edgeMember ? share / 2 : share;
}

/** Converts a user-entered surface pressure (kPa) and tributary width (mm) into a distributed line load (N/mm). */
export function computeSurfaceLoad(
  pressureKPa: number,
  tributaryWidthMm: number,
  kind: Extract<AppliedLoadKind, "snow" | "wind" | "vine">,
  provenance: LoadProvenance,
): AppliedLoad {
  const pressureNPerMm2 = pressureKPa * 1e-3;
  return {
    kind,
    distributionNPerMm: pressureNPerMm2 * tributaryWidthMm,
    provenance,
  };
}
