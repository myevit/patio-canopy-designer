import type { Anchor, HouseOutline, ProjectDocument, Section, Vector3Mm } from "@canopy/shared";
import { deriveGutter, deriveRoofOutline } from "./derive-roof.js";
import type { SceneWall, ScenePrimitives } from "./scene-types.js";

/** Wall height used for a house outline that has no roof plane yet. */
const DEFAULT_WALL_HEIGHT_MM = 2400;

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function resolve<T>(map: Map<string, T>, id: string, kind: string): T {
  const value = map.get(id);
  if (!value) {
    throw new Error(`Cannot build scene: unresolved ${kind} id "${id}"`);
  }
  return value;
}

function anchorPosition(anchors: Map<string, Anchor>, id: string): Vector3Mm {
  return resolve(anchors, id, "anchor").positionMm;
}

function sectionDimensions(sections: Map<string, Section>, id: string): { widthMm: number; heightMm: number } {
  const section = resolve(sections, id, "section");
  return { widthMm: section.widthMm, heightMm: section.heightMm };
}

function buildWalls(houseOutline: HouseOutline, heightMm: number): SceneWall[] {
  const { points } = houseOutline;
  return points.map((point, index) => ({
    id: `${houseOutline.id}-wall-${index}`,
    kind: "wall" as const,
    start: point,
    end: points[(index + 1) % points.length]!,
    heightMm,
  }));
}

export function buildScene(document: ProjectDocument): ScenePrimitives {
  const anchors = indexById(document.anchors);
  const sections = indexById(document.sections);
  const houseOutlines = indexById(document.site.houseOutlines);
  const roofPlanesByHouseOutline = new Map(
    document.site.roofPlanes.map((roofPlane) => [roofPlane.houseOutlineId, roofPlane]),
  );

  // Exactly one set of walls per house outline, independent of whether (or
  // how many) roof planes reference it.
  const walls: SceneWall[] = document.site.houseOutlines.flatMap((houseOutline) => {
    const roofPlane = roofPlanesByHouseOutline.get(houseOutline.id);
    const heightMm = roofPlane ? roofPlane.referenceElevationMm : DEFAULT_WALL_HEIGHT_MM;
    return buildWalls(houseOutline, heightMm);
  });

  const roofPlanes = document.site.roofPlanes.map((roofPlane) => {
    const houseOutline = resolve(houseOutlines, roofPlane.houseOutlineId, "house outline");
    return {
      id: roofPlane.id,
      kind: "roof-plane" as const,
      houseOutlineId: roofPlane.houseOutlineId,
      referenceElevationMm: roofPlane.referenceElevationMm,
      pitchRad: roofPlane.pitchRad,
      directionRad: roofPlane.directionRad,
      outline: deriveRoofOutline(houseOutline.points, roofPlane),
    };
  });

  const roofPlanesById = indexById(document.site.roofPlanes);
  const gutters = document.site.gutters.map((gutter) => {
    const houseOutline = resolve(houseOutlines, gutter.houseOutlineId, "house outline");
    const roofPlane = resolve(roofPlanesById, gutter.roofPlaneId, "roof plane");
    return {
      kind: "gutter" as const,
      ...deriveGutter(houseOutline.points, gutter, roofPlane.referenceElevationMm),
    };
  });

  return {
    houseOutlines: document.site.houseOutlines.map((outline) => ({
      id: outline.id,
      kind: "house-outline" as const,
      points: outline.points,
    })),
    roofPlanes,
    gutters,
    walls,
    patioOutlines: document.site.patioOutlines.map((outline) => ({
      id: outline.id,
      kind: "patio-outline" as const,
      points: outline.points,
    })),
    posts: document.posts.map((post) => {
      const { widthMm, heightMm } = sectionDimensions(sections, post.sectionId);
      return {
        id: post.id,
        kind: "post" as const,
        base: anchorPosition(anchors, post.baseAnchorId),
        top: anchorPosition(anchors, post.topAnchorId),
        baseAnchorId: post.baseAnchorId,
        topAnchorId: post.topAnchorId,
        sectionId: post.sectionId,
        widthMm,
        depthMm: heightMm,
      };
    }),
    members: document.members.map((member) => {
      const { widthMm, heightMm } = sectionDimensions(sections, member.sectionId);
      return {
        id: member.id,
        kind: "member" as const,
        role: member.role,
        start: anchorPosition(anchors, member.startAnchorId),
        end: anchorPosition(anchors, member.endAnchorId),
        sectionId: member.sectionId,
        widthMm,
        heightMm,
        rollRad: member.rollRad,
      };
    }),
    joints: document.joints.map((joint) => ({
      id: joint.id,
      kind: "joint" as const,
      position: joint.positionMm,
      connectedMemberIds: joint.connectedMemberIds,
    })),
    houseAnchors: document.anchors
      .filter((anchor) => anchor.kind === "house")
      .map((anchor) => ({
        id: anchor.id,
        kind: "house-anchor" as const,
        position: anchor.positionMm,
      })),
  };
}
