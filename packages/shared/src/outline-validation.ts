import type { Vector3Mm } from "./units.js";

export type OutlineValidationResult = { valid: true } | { valid: false; reason: string };

const EPSILON_MM = 1e-6;

function distanceSquared(a: Vector3Mm, b: Vector3Mm): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function shoelaceAreaMm2(points: Vector3Mm[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function orientation(a: Vector3Mm, b: Vector3Mm, c: Vector3Mm): number {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(value) < EPSILON_MM) return 0;
  return value > 0 ? 1 : -1;
}

function onSegment(a: Vector3Mm, b: Vector3Mm, p: Vector3Mm): boolean {
  return (
    Math.min(a.x, b.x) - EPSILON_MM <= p.x &&
    p.x <= Math.max(a.x, b.x) + EPSILON_MM &&
    Math.min(a.y, b.y) - EPSILON_MM <= p.y &&
    p.y <= Math.max(a.y, b.y) + EPSILON_MM
  );
}

function segmentsIntersect(p1: Vector3Mm, p2: Vector3Mm, p3: Vector3Mm, p4: Vector3Mm): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  if (o1 === 0 && onSegment(p1, p2, p3)) return true;
  if (o2 === 0 && onSegment(p1, p2, p4)) return true;
  if (o3 === 0 && onSegment(p3, p4, p1)) return true;
  if (o4 === 0 && onSegment(p3, p4, p2)) return true;

  return false;
}

export function validateOutline(points: Vector3Mm[]): OutlineValidationResult {
  if (points.length < 3) {
    return { valid: false, reason: "A house outline needs at least 3 points." };
  }

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    if (distanceSquared(current, next) < EPSILON_MM) {
      return {
        valid: false,
        reason: "Two consecutive vertices are in the same place. Move or remove one of them.",
      };
    }
  }

  const edgeCount = points.length;
  for (let i = 0; i < edgeCount; i += 1) {
    const a1 = points[i]!;
    const a2 = points[(i + 1) % edgeCount]!;
    for (let j = i + 1; j < edgeCount; j += 1) {
      const isAdjacent = j === i || j === (i + 1) % edgeCount || (j + 1) % edgeCount === i;
      if (isAdjacent) continue;
      const b1 = points[j]!;
      const b2 = points[(j + 1) % edgeCount]!;
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return {
          valid: false,
          reason: "The outline edges cross each other. Uncross the edges before closing the outline.",
        };
      }
    }
  }

  if (Math.abs(shoelaceAreaMm2(points)) < EPSILON_MM) {
    return { valid: false, reason: "The outline encloses zero area." };
  }

  return { valid: true };
}
