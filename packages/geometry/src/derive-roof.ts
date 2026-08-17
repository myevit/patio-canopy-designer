import type { RoofPlane, Vector3Mm } from "@canopy/shared";

type RoofPlaneSlope = Pick<RoofPlane, "referenceElevationMm" | "pitchDeg" | "directionRad">;

function projectionsAlong(points: Vector3Mm[], dirX: number, dirY: number): number[] {
  return points.map((p) => p.x * dirX + p.y * dirY);
}

export function deriveRoofOutline(footprint: Vector3Mm[], roofPlane: RoofPlaneSlope): Vector3Mm[] {
  const pitchRad = (roofPlane.pitchDeg * Math.PI) / 180;
  const dirX = Math.cos(roofPlane.directionRad);
  const dirY = Math.sin(roofPlane.directionRad);
  const projections = projectionsAlong(footprint, dirX, dirY);
  const dMax = Math.max(...projections);
  const rise = Math.tan(pitchRad);

  return footprint.map((point, index) => ({
    x: point.x,
    y: point.y,
    z: roofPlane.referenceElevationMm + (dMax - projections[index]!) * rise,
  }));
}

export interface DerivedGutter {
  start: Vector3Mm;
  end: Vector3Mm;
  widthMm: number;
  dropMm: number;
}

export function deriveGutter(footprint: Vector3Mm[], roofPlane: RoofPlane): DerivedGutter {
  const dirX = Math.cos(roofPlane.directionRad);
  const dirY = Math.sin(roofPlane.directionRad);
  const projections = projectionsAlong(footprint, dirX, dirY);

  let maxIndex = 0;
  for (let i = 1; i < projections.length; i += 1) {
    if (projections[i]! > projections[maxIndex]!) maxIndex = i;
  }
  const n = footprint.length;
  const prevIndex = (maxIndex - 1 + n) % n;
  const nextIndex = (maxIndex + 1) % n;
  const neighborIndex = projections[prevIndex]! >= projections[nextIndex]! ? prevIndex : nextIndex;

  const outline = deriveRoofOutline(footprint, roofPlane);
  return {
    start: outline[maxIndex]!,
    end: outline[neighborIndex]!,
    widthMm: roofPlane.gutter.widthMm,
    dropMm: roofPlane.gutter.dropMm,
  };
}
