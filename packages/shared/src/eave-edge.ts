import type { Vector3Mm } from "./units.js";

/**
 * Picks the footprint edge whose two vertices project furthest along the
 * given roof-slope direction. That edge is the low (eave) side of the roof
 * plane regardless of whether the direction is perpendicular to any edge, so
 * both of its endpoints share the same elevation by construction.
 */
export function selectEaveEdgeIndex(points: Vector3Mm[], directionRad: number): number {
  const dirX = Math.cos(directionRad);
  const dirY = Math.sin(directionRad);
  const projections = points.map((p) => p.x * dirX + p.y * dirY);

  const n = points.length;
  let bestEdge = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < n; i += 1) {
    const next = (i + 1) % n;
    const score = projections[i]! + projections[next]!;
    if (score > bestScore) {
      bestScore = score;
      bestEdge = i;
    }
  }
  return bestEdge;
}
