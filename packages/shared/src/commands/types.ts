import type { ProjectDocument } from "../design-schema.js";
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
      pitchRad: number;
      directionRad: number;
      gutterId: string;
      gutterWidthMm: number;
      gutterDropMm: number;
    }
  | {
      type: "update-roof-plane";
      roofPlaneId: string;
      patch: Partial<{
        referenceElevationMm: number;
        pitchRad: number;
        directionRad: number;
      }>;
    }
  | {
      type: "update-gutter";
      gutterId: string;
      patch: Partial<{
        widthMm: number;
        dropMm: number;
      }>;
    }
  | {
      type: "add-post";
      postId: string;
      baseAnchorId: string;
      topAnchorId: string;
      sectionId: string;
      heightMm: number;
      position: Vector3Mm;
    }
  | { type: "move-post"; postId: string; position: Vector3Mm }
  | {
      type: "update-post";
      postId: string;
      patch: Partial<{ heightMm: number; sectionId: string }>;
    }
  | { type: "delete-post"; postId: string }
  | { type: "add-house-anchor"; anchorId: string; position: Vector3Mm; sourceRef?: string }
  | {
      type: "add-beam";
      memberId: string;
      startAnchorId: string;
      endAnchorId: string;
      sectionId: string;
      materialId?: string;
      rollRad?: number;
    }
  | {
      type: "update-beam";
      memberId: string;
      patch: Partial<{ sectionId: string; materialId: string; rollRad: number }>;
    }
  | { type: "delete-beam"; memberId: string };

export type CommandResult =
  | { ok: true; document: ProjectDocument }
  | { ok: false; error: string };
