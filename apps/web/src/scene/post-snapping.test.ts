import { describe, expect, it } from "vitest";
import type { Vector3Mm } from "@canopy/shared";
import { snapPostPosition } from "./post-snapping.js";

const square: Vector3Mm[] = [
  { x: 0, y: 0, z: 0 },
  { x: 4000, y: 0, z: 0 },
  { x: 4000, y: 3000, z: 0 },
  { x: 0, y: 3000, z: 0 },
];

describe("snapPostPosition", () => {
  it("snaps to the nearest outline vertex within tolerance", () => {
    const result = snapPostPosition({ x: 60, y: -40, z: 0 }, { outlines: [square] });
    expect(result).toEqual({ position: { x: 0, y: 0, z: 0 }, snappedTo: "vertex" });
  });

  it("snaps to the nearest point on an outline edge when no vertex is close enough", () => {
    const result = snapPostPosition({ x: 2000, y: 40, z: 0 }, { outlines: [square] });
    expect(result).toEqual({ position: { x: 2000, y: 0, z: 0 }, snappedTo: "edge" });
  });

  it("falls back to grid snapping far from any outline", () => {
    const result = snapPostPosition({ x: 8040, y: 8070, z: 0 }, { outlines: [square] });
    expect(result).toEqual({ position: { x: 8000, y: 8100, z: 0 }, snappedTo: "grid" });
  });

  it("prefers vertex snapping over edge snapping when both are in range", () => {
    const result = snapPostPosition({ x: 40, y: 20, z: 0 }, { outlines: [square] });
    expect(result.snappedTo).toBe("vertex");
    expect(result.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("disables all snapping for free placement", () => {
    const result = snapPostPosition({ x: 12, y: 34, z: 0 }, { outlines: [square] }, { disabled: true });
    expect(result).toEqual({ position: { x: 12, y: 34, z: 0 }, snappedTo: "free" });
  });

  it("respects custom tolerances and grid size", () => {
    const result = snapPostPosition(
      { x: 2000, y: 500, z: 0 },
      { outlines: [square] },
      { gridSizeMm: 250, edgeSnapMm: 10, vertexSnapMm: 10 },
    );
    expect(result).toEqual({ position: { x: 2000, y: 500, z: 0 }, snappedTo: "grid" });
  });
});
