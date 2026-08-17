import type { Vector3Mm } from "@canopy/shared";
import { distance2D, projectPointOntoSegment } from "./geometry-helpers.js";

export interface SnapTargets {
  /** Closed polygons (house/patio outlines) to snap post placement against. */
  outlines: Vector3Mm[][];
}

export interface SnapOptions {
  gridSizeMm?: number;
  vertexSnapMm?: number;
  edgeSnapMm?: number;
  /** Bypasses all snapping for free placement (e.g. while a modifier key is held). */
  disabled?: boolean;
}

export type SnapKind = "vertex" | "edge" | "grid" | "free";

export interface SnapResult {
  position: Vector3Mm;
  snappedTo: SnapKind;
}

const DEFAULT_GRID_SIZE_MM = 100;
const DEFAULT_VERTEX_SNAP_MM = 200;
const DEFAULT_EDGE_SNAP_MM = 150;

function roundToGrid(value: number, gridSizeMm: number): number {
  return Math.round(value / gridSizeMm) * gridSizeMm;
}

export function snapPostPosition(raw: Vector3Mm, targets: SnapTargets, options: SnapOptions = {}): SnapResult {
  if (options.disabled) {
    return { position: raw, snappedTo: "free" };
  }

  const vertexSnapMm = options.vertexSnapMm ?? DEFAULT_VERTEX_SNAP_MM;
  const edgeSnapMm = options.edgeSnapMm ?? DEFAULT_EDGE_SNAP_MM;
  const gridSizeMm = options.gridSizeMm ?? DEFAULT_GRID_SIZE_MM;

  let nearestVertexPosition: Vector3Mm | undefined;
  let nearestVertexDistance = Infinity;
  let nearestEdgePosition: Vector3Mm | undefined;
  let nearestEdgeDistance = Infinity;

  for (const outline of targets.outlines) {
    for (let index = 0; index < outline.length; index += 1) {
      const vertex = outline[index]!;
      const distance = distance2D(raw, vertex);
      if (distance < nearestVertexDistance) {
        nearestVertexDistance = distance;
        nearestVertexPosition = vertex;
      }

      const next = outline[(index + 1) % outline.length]!;
      const projected = projectPointOntoSegment(raw, vertex, next);
      const edgeDistance = distance2D(raw, projected);
      if (edgeDistance < nearestEdgeDistance) {
        nearestEdgeDistance = edgeDistance;
        nearestEdgePosition = projected;
      }
    }
  }

  if (nearestVertexPosition && nearestVertexDistance <= vertexSnapMm) {
    return { position: nearestVertexPosition, snappedTo: "vertex" };
  }
  if (nearestEdgePosition && nearestEdgeDistance <= edgeSnapMm) {
    return { position: nearestEdgePosition, snappedTo: "edge" };
  }

  return {
    position: { x: roundToGrid(raw.x, gridSizeMm), y: roundToGrid(raw.y, gridSizeMm), z: raw.z },
    snappedTo: "grid",
  };
}
