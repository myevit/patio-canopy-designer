import { describe, expect, it } from "vitest";
import { computeMemberFrame } from "./member-frame.js";
import { convexHull, projectMemberOutline, projectPoint } from "./blueprint-projection.js";

describe("projectPoint", () => {
  it("drops z for the plan view", () => {
    expect(projectPoint({ x: 100, y: 200, z: 300 }, "plan")).toEqual({ x: 100, y: 200 });
  });

  it("projects x/-z for the front elevation", () => {
    expect(projectPoint({ x: 100, y: 200, z: 300 }, "front")).toEqual({ x: 100, y: -300 });
  });

  it("projects y/-z for the side elevation", () => {
    expect(projectPoint({ x: 100, y: 200, z: 300 }, "side")).toEqual({ x: 200, y: -300 });
  });

  it("is a pure deterministic function of its inputs", () => {
    const a = projectPoint({ x: 12, y: 34, z: 56 }, "plan");
    const b = projectPoint({ x: 12, y: 34, z: 56 }, "plan");
    expect(a).toEqual(b);
  });
});

describe("convexHull", () => {
  it("returns the outer boundary of a point set, dropping interior/collinear points", () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 0 }, // collinear along the bottom edge
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 }, // interior point
    ]);

    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual({ x: 5, y: 0 });
    expect(hull).not.toContainEqual({ x: 5, y: 5 });
  });

  it("is deterministic for the same input set regardless of call count", () => {
    const points = [
      { x: 3, y: 1 },
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { x: 1, y: 3 },
    ];
    expect(convexHull(points)).toEqual(convexHull([...points]));
  });
});

describe("projectMemberOutline", () => {
  it("projects a horizontal member's plan outline as a length x width rectangle", () => {
    const frame = computeMemberFrame({ start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 }, rollRad: 0 });
    const outline = projectMemberOutline(frame, "plan", 100, 200);

    const xs = outline.map((p) => p.x);
    const ys = outline.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(0, 6);
    expect(Math.max(...xs)).toBeCloseTo(1000, 6);
    expect(Math.min(...ys)).toBeCloseTo(-50, 6);
    expect(Math.max(...ys)).toBeCloseTo(50, 6);
  });

  it("collapses the width axis in front elevation, showing length x height", () => {
    const frame = computeMemberFrame({ start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 }, rollRad: 0 });
    const outline = projectMemberOutline(frame, "front", 100, 200);

    const xs = outline.map((p) => p.x);
    const ys = outline.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(0, 6);
    expect(Math.max(...xs)).toBeCloseTo(1000, 6);
    expect(Math.min(...ys)).toBeCloseTo(-100, 6);
    expect(Math.max(...ys)).toBeCloseTo(100, 6);
  });

  it("is deterministic across repeated calls with the same frame", () => {
    const frame = computeMemberFrame({ start: { x: 0, y: 0, z: 0 }, end: { x: 500, y: 300, z: 700 }, rollRad: 0.4 });
    expect(projectMemberOutline(frame, "side", 90, 140)).toEqual(projectMemberOutline(frame, "side", 90, 140));
  });
});
