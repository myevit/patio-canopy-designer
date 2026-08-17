import * as THREE from "three";
import type { Vector3Mm } from "@canopy/shared";

export type Triangle = [number, number, number];

/**
 * Triangulates a simple (possibly concave) polygon given as ordered
 * footprint points, returning vertex-index triples into that same array.
 * Uses three.js's Earcut-backed ShapeUtils rather than a fan from vertex 0,
 * which only produces valid triangles for convex polygons.
 */
export function triangulateFootprint(points: Vector3Mm[]): Triangle[] {
  const shapePoints = points.map((p) => new THREE.Vector2(p.x, p.y));
  const faces = THREE.ShapeUtils.triangulateShape(shapePoints, []);
  return faces.map(([a, b, c]) => [a!, b!, c!]);
}
