import { describe, expect, it } from "vitest";
import { parseProjectDocument } from "./design-schema.js";
import { SAMPLE_PROJECT } from "./sample-project.js";

describe("SAMPLE_PROJECT", () => {
  it("is a schema-valid project document", () => {
    const result = parseProjectDocument(SAMPLE_PROJECT);
    if (!result.success) {
      throw new Error(JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  it("has a house outline and a roof plane attaching to it", () => {
    expect(SAMPLE_PROJECT.site.houseOutlines.length).toBeGreaterThanOrEqual(1);
    expect(SAMPLE_PROJECT.site.roofPlanes.length).toBeGreaterThanOrEqual(1);
  });

  it("has an irregular, curved patio outline with more than 8 boundary points", () => {
    const [patio] = SAMPLE_PROJECT.site.patioOutlines;
    expect(patio).toBeDefined();
    expect(patio!.points.length).toBeGreaterThan(8);
  });

  it("places posts outside the patio outline with non-uniform spacing", () => {
    expect(SAMPLE_PROJECT.posts.length).toBeGreaterThanOrEqual(4);
    const topAnchorsById = new Map(SAMPLE_PROJECT.anchors.map((a) => [a.id, a]));
    const postTopXs = SAMPLE_PROJECT.posts.map(
      (post) => topAnchorsById.get(post.topAnchorId)!.positionMm.x,
    );
    const spacings = postTopXs.slice(1).map((x, i) => x - postTopXs[i]!);
    const uniqueSpacings = new Set(spacings.map((s) => Math.round(s)));
    expect(uniqueSpacings.size).toBeGreaterThan(1);
  });

  it("contains at least two fan fields whose rafters are non-orthogonal and cross each other", () => {
    expect(SAMPLE_PROJECT.fanFields.length).toBeGreaterThanOrEqual(2);
    const fanRafters = SAMPLE_PROJECT.members.filter((m) => m.role === "fan-rafter");
    expect(fanRafters.length).toBeGreaterThanOrEqual(4);
  });

  it("records at least one joint marking a crossing between two fan rafters", () => {
    expect(SAMPLE_PROJECT.joints.length).toBeGreaterThanOrEqual(1);
    for (const joint of SAMPLE_PROJECT.joints) {
      expect(joint.connectedMemberIds.length).toBeGreaterThanOrEqual(2);
      expect(joint.engineeringStatus).toBe("engineer-review-required");
    }
  });

  it("is immutable (frozen) so it cannot be mutated by consumers", () => {
    expect(Object.isFrozen(SAMPLE_PROJECT)).toBe(true);
  });
});
