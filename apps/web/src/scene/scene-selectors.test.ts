import { describe, expect, it } from "vitest";
import type { ScenePrimitives } from "@canopy/geometry";
import { findSceneObject, listSelectableObjects } from "./scene-selectors.js";

function scene(): ScenePrimitives {
  return {
    houseOutlines: [],
    roofPlanes: [],
    patioOutlines: [],
    posts: [
      { id: "post-1", kind: "post", base: { x: 0, y: 0, z: 0 }, top: { x: 0, y: 0, z: 2400 }, widthMm: 140, depthMm: 140 },
    ],
    members: [
      {
        id: "member-1",
        kind: "member",
        role: "fan-rafter",
        start: { x: 0, y: 0, z: 2700 },
        end: { x: 0, y: 0, z: 2400 },
        widthMm: 89,
        heightMm: 38,
      },
    ],
    joints: [
      { id: "joint-1", kind: "joint", position: { x: 0, y: 0, z: 2500 }, connectedMemberIds: ["member-1"] },
    ],
  };
}

describe("listSelectableObjects", () => {
  it("lists posts, members, and joints with stable ids and readable labels", () => {
    const items = listSelectableObjects(scene());
    expect(items).toEqual([
      { id: "post-1", kind: "post", label: "Post post-1" },
      { id: "member-1", kind: "member", label: "Fan rafter member-1" },
      { id: "joint-1", kind: "joint", label: "Joint joint-1" },
    ]);
  });
});

describe("findSceneObject", () => {
  it("finds a post by id", () => {
    expect(findSceneObject(scene(), "post-1")?.kind).toBe("post");
  });

  it("finds a member by id", () => {
    expect(findSceneObject(scene(), "member-1")?.kind).toBe("member");
  });

  it("finds a joint by id", () => {
    expect(findSceneObject(scene(), "joint-1")?.kind).toBe("joint");
  });

  it("returns undefined for an unknown id", () => {
    expect(findSceneObject(scene(), "does-not-exist")).toBeUndefined();
  });

  it("returns undefined for a null id", () => {
    expect(findSceneObject(scene(), null)).toBeUndefined();
  });
});
