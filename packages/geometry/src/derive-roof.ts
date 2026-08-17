import type { Gutter, RoofPlane, Vector3Mm } from "@canopy/shared";

type RoofPlaneSlope = Pick<RoofPlane, "referenceElevationMm" | "pitchRad" | "directionRad">;

function projectionsAlong(points: Vector3Mm[], dirX: number, dirY: number): number[] {
  return points.map((p) => p.x * dirX + p.y * dirY);
}

export function deriveRoofOutline(footprint: Vector3Mm[], roofPlane: RoofPlaneSlope): Vector3Mm[] {
  const dirX = Math.cos(roofPlane.directionRad);
  const dirY = Math.sin(roofPlane.directionRad);
  const projections = projectionsAlong(footprint, dirX, dirY);
  const dMax = Math.max(...projections);
  const rise = Math.tan(roofPlane.pitchRad);

  return footprint.map((point, index) => ({
    x: point.x,
    y: point.y,
    z: roofPlane.referenceElevationMm + (dMax - projections[index]!) * rise,
  }));
}

export interface DerivedGutter {
  id: string;
  roofPlaneId: string;
  start: Vector3Mm;
  end: Vector3Mm;
  widthMm: number;
  dropMm: number;
}

/**
 * A gutter's endpoints are the two vertices of its referenced house-outline
 * edge, both held at the roof plane's reference elevation. Because the
 * elevation is fixed rather than re-derived from the sloped roof surface,
 * both endpoints share the same elevation regardless of how the roof
 * direction relates to that edge.
 */
export function deriveGutter(
  houseOutlinePoints: Vector3Mm[],
  gutter: Gutter,
  referenceElevationMm: number,
): DerivedGutter {
  const n = houseOutlinePoints.length;
  const edgeIndex = ((gutter.edgeIndex % n) + n) % n;
  const a = houseOutlinePoints[edgeIndex]!;
  const b = houseOutlinePoints[(edgeIndex + 1) % n]!;

  return {
    id: gutter.id,
    roofPlaneId: gutter.roofPlaneId,
    start: { x: a.x, y: a.y, z: referenceElevationMm },
    end: { x: b.x, y: b.y, z: referenceElevationMm },
    widthMm: gutter.widthMm,
    dropMm: gutter.dropMm,
  };
}
