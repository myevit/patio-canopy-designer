import { describe, expect, it } from "vitest";
import type { Anchor, Member } from "./design-schema.js";
import {
  deriveFanFieldGeometry,
  deriveFanFieldMemberId,
  deriveFanFieldTargetAnchorId,
  deriveFanFieldTargetPositions,
} from "./fan-field-geometry.js";

function anchorMap(anchors: Anchor[]): Map<string, Anchor> {
  return new Map(anchors.map((a) => [a.id, a]));
}

function memberMap(members: Member[]): Map<string, Member> {
  return new Map(members.map((m) => [m.id, m]));
}

describe("deriveFanFieldTargetPositions", () => {
  it("distributes count-based positions evenly along the target edge, linear elevation", () => {
    const result = deriveFanFieldTargetPositions({
      sourcePosition: { x: 0, y: 0, z: 2700 },
      targetStart: { x: 0, y: 4000, z: 2300 },
      targetEnd: { x: 4000, y: 4000, z: 2400 },
      distribution: { mode: "count", count: 3 },
      reversed: false,
      elevationRule: { kind: "linear" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.points).toHaveLength(3);
      expect(result.points[0]).toEqual({ x: 0, y: 4000, z: 2300 });
      expect(result.points[1]).toEqual({ x: 2000, y: 4000, z: 2350 });
      expect(result.points[2]).toEqual({ x: 4000, y: 4000, z: 2400 });
    }
  });

  it("is deterministic: identical inputs always produce identical outputs", () => {
    const input = {
      sourcePosition: { x: 0, y: 0, z: 2700 },
      targetStart: { x: 0, y: 4000, z: 2300 },
      targetEnd: { x: 4000, y: 4000, z: 2400 },
      distribution: { mode: "count" as const, count: 5 },
      reversed: false,
      elevationRule: { kind: "linear" as const },
    };
    const a = deriveFanFieldTargetPositions(input);
    const b = deriveFanFieldTargetPositions(input);
    expect(a).toEqual(b);
  });

  it("reverses the order of target points when reversed is true", () => {
    const forward = deriveFanFieldTargetPositions({
      sourcePosition: { x: 0, y: 0, z: 2700 },
      targetStart: { x: 0, y: 4000, z: 2300 },
      targetEnd: { x: 4000, y: 4000, z: 2400 },
      distribution: { mode: "count", count: 3 },
      reversed: false,
      elevationRule: { kind: "linear" },
    });
    const reversed = deriveFanFieldTargetPositions({
      sourcePosition: { x: 0, y: 0, z: 2700 },
      targetStart: { x: 0, y: 4000, z: 2300 },
      targetEnd: { x: 4000, y: 4000, z: 2400 },
      distribution: { mode: "count", count: 3 },
      reversed: true,
      elevationRule: { kind: "linear" },
    });
    expect(forward.ok && reversed.ok).toBe(true);
    if (forward.ok && reversed.ok) {
      expect(reversed.points).toEqual([...forward.points].reverse());
    }
  });

  it("applies a parabolic sag that is zero at the endpoints and maximal at the midpoint", () => {
    const result = deriveFanFieldTargetPositions({
      sourcePosition: { x: 0, y: 0, z: 2700 },
      targetStart: { x: 0, y: 4000, z: 2400 },
      targetEnd: { x: 4000, y: 4000, z: 2400 },
      distribution: { mode: "count", count: 5 },
      reversed: false,
      elevationRule: { kind: "parabolic", sagMm: 200 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.points[0]!.z).toBeCloseTo(2400, 6);
      expect(result.points[4]!.z).toBeCloseTo(2400, 6);
      expect(result.points[2]!.z).toBeCloseTo(2600, 6);
    }
  });

  it("computes a spacing-based count from the target edge length", () => {
    const result = deriveFanFieldTargetPositions({
      sourcePosition: { x: 0, y: 0, z: 2700 },
      targetStart: { x: 0, y: 0, z: 2400 },
      targetEnd: { x: 1000, y: 0, z: 2400 },
      distribution: { mode: "spacing", spacingMm: 300 },
      reversed: false,
      elevationRule: { kind: "linear" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // floor(1000/300)+1 = 4 members
      expect(result.points).toHaveLength(4);
    }
  });

  it("rejects a zero-length target edge", () => {
    const result = deriveFanFieldTargetPositions({
      sourcePosition: { x: 0, y: 0, z: 2700 },
      targetStart: { x: 1000, y: 1000, z: 2400 },
      targetEnd: { x: 1000, y: 1000, z: 2400 },
      distribution: { mode: "count", count: 3 },
      reversed: false,
      elevationRule: { kind: "linear" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/zero-length|degenerate/i);
    }
  });

  it("rejects a fan where the source anchor coincides with a target point (zero-length rafter)", () => {
    const result = deriveFanFieldTargetPositions({
      sourcePosition: { x: 0, y: 4000, z: 2300 },
      targetStart: { x: 0, y: 4000, z: 2300 },
      targetEnd: { x: 4000, y: 4000, z: 2400 },
      distribution: { mode: "count", count: 3 },
      reversed: false,
      elevationRule: { kind: "linear" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/zero-length/i);
    }
  });
});

describe("deriveFanFieldGeometry", () => {
  const anchors = anchorMap([
    { id: "source-1", kind: "house", positionMm: { x: 0, y: 0, z: 2700 } },
    { id: "edge-start", kind: "post-top", positionMm: { x: 0, y: 4000, z: 2300 } },
    { id: "edge-end", kind: "post-top", positionMm: { x: 4000, y: 4000, z: 2400 } },
  ]);
  const members = memberMap([
    {
      id: "member-target",
      role: "perimeter-beam",
      startAnchorId: "edge-start",
      endAnchorId: "edge-end",
      sectionId: "sec-beam",
      rollRad: 0,
    },
  ]);

  it("resolves an edge target from two anchors", () => {
    const result = deriveFanFieldGeometry(
      {
        sourceAnchorId: "source-1",
        target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-end" },
        distribution: { mode: "count", count: 3 },
        reversed: false,
        elevationRule: { kind: "linear" },
      },
      anchors,
      members,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.points).toHaveLength(3);
    }
  });

  it("resolves a member target from its own start/end anchors", () => {
    const result = deriveFanFieldGeometry(
      {
        sourceAnchorId: "source-1",
        target: { kind: "member", memberId: "member-target" },
        distribution: { mode: "count", count: 3 },
        reversed: false,
        elevationRule: { kind: "linear" },
      },
      anchors,
      members,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.points[0]).toEqual({ x: 0, y: 4000, z: 2300 });
    }
  });

  it("rejects an unreachable (unknown) source anchor", () => {
    const result = deriveFanFieldGeometry(
      {
        sourceAnchorId: "missing",
        target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-end" },
        distribution: { mode: "count", count: 3 },
        reversed: false,
        elevationRule: { kind: "linear" },
      },
      anchors,
      members,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an unreachable (unknown) target member", () => {
    const result = deriveFanFieldGeometry(
      {
        sourceAnchorId: "source-1",
        target: { kind: "member", memberId: "missing" },
        distribution: { mode: "count", count: 3 },
        reversed: false,
        elevationRule: { kind: "linear" },
      },
      anchors,
      members,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an inverted/degenerate edge target whose two anchors are the same", () => {
    const result = deriveFanFieldGeometry(
      {
        sourceAnchorId: "source-1",
        target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-start" },
        distribution: { mode: "count", count: 3 },
        reversed: false,
        elevationRule: { kind: "linear" },
      },
      anchors,
      members,
    );
    expect(result.ok).toBe(false);
  });
});

describe("deterministic derived ids", () => {
  it("derives stable member and target-anchor ids from the fan field id and index alone", () => {
    expect(deriveFanFieldMemberId("fan-1", 0)).toBe(deriveFanFieldMemberId("fan-1", 0));
    expect(deriveFanFieldMemberId("fan-1", 0)).not.toBe(deriveFanFieldMemberId("fan-1", 1));
    expect(deriveFanFieldTargetAnchorId("fan-1", 0)).not.toBe(deriveFanFieldMemberId("fan-1", 0));
  });
});

describe("two overlapping fan fields forming a saddle", () => {
  it("produces crossing, non-orthogonal rafters with opposite-signed sag at their shared midpoint", () => {
    const saddleAnchors = anchorMap([
      { id: "source-a", kind: "house", positionMm: { x: 0, y: 0, z: 2700 } },
      { id: "source-b", kind: "house", positionMm: { x: 4000, y: 0, z: 2700 } },
      { id: "target-start", kind: "post-top", positionMm: { x: 0, y: 4000, z: 2300 } },
      { id: "target-end", kind: "post-top", positionMm: { x: 4000, y: 4000, z: 2300 } },
    ]);

    const fieldA = deriveFanFieldGeometry(
      {
        sourceAnchorId: "source-a",
        target: { kind: "edge", startAnchorId: "target-start", endAnchorId: "target-end" },
        distribution: { mode: "count", count: 5 },
        reversed: false,
        elevationRule: { kind: "parabolic", sagMm: 150 },
      },
      saddleAnchors,
      new Map(),
    );
    const fieldB = deriveFanFieldGeometry(
      {
        sourceAnchorId: "source-b",
        target: { kind: "edge", startAnchorId: "target-start", endAnchorId: "target-end" },
        distribution: { mode: "count", count: 5 },
        reversed: false,
        elevationRule: { kind: "parabolic", sagMm: -150 },
      },
      saddleAnchors,
      new Map(),
    );

    expect(fieldA.ok && fieldB.ok).toBe(true);
    if (fieldA.ok && fieldB.ok) {
      // Rafters from source-a and source-b run at different angles (non-orthogonal
      // fan spread) and their shared target-edge midpoint elevation diverges in
      // sign, which is exactly the ruled-surface saddle intent.
      expect(fieldA.points[2]!.z).toBeGreaterThan(2300);
      expect(fieldB.points[2]!.z).toBeLessThan(2300);
      expect(fieldA.points[2]!.x).toBe(fieldB.points[2]!.x);
      expect(fieldA.points[2]!.y).toBe(fieldB.points[2]!.y);
    }
  });
});
