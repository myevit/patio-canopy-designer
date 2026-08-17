import type { Gutter, ProjectDocument } from "../design-schema.js";
import type { Vector3Mm } from "../units.js";

export type DocumentCommand =
  | { type: "create-house-outline"; outlineId: string; points: Vector3Mm[] }
  | { type: "move-house-outline-vertex"; outlineId: string; vertexIndex: number; position: Vector3Mm }
  | { type: "insert-house-outline-vertex"; outlineId: string; afterIndex: number; position: Vector3Mm }
  | { type: "delete-house-outline-vertex"; outlineId: string; vertexIndex: number }
  | {
      type: "add-roof-plane";
      roofPlaneId: string;
      houseOutlineId: string;
      referenceElevationMm: number;
      pitchDeg: number;
      directionRad: number;
      gutter: Gutter;
    }
  | {
      type: "update-roof-plane";
      roofPlaneId: string;
      patch: Partial<{
        referenceElevationMm: number;
        pitchDeg: number;
        directionRad: number;
        gutter: Gutter;
      }>;
    };

export type CommandResult =
  | { ok: true; document: ProjectDocument }
  | { ok: false; error: string };
