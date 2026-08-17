import type { Anchor, ProjectDocument, Section, Vector3Mm } from "@canopy/shared";
import type { ScenePrimitives } from "./scene-types.js";

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

export function buildScene(document: ProjectDocument): ScenePrimitives {
  const anchors = indexById(document.anchors);
  const sections = indexById(document.sections);

  return {
    houseOutlines: document.site.houseOutlines.map((outline) => ({
      id: outline.id,
      kind: "house-outline" as const,
      points: outline.points,
    })),
    roofPlanes: document.site.roofPlanes.map((roofPlane) => ({
      id: roofPlane.id,
      kind: "roof-plane" as const,
      outline: roofPlane.outline,
    })),
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
        widthMm,
        heightMm,
      };
    }),
    joints: document.joints.map((joint) => ({
      id: joint.id,
      kind: "joint" as const,
      position: joint.positionMm,
      connectedMemberIds: joint.connectedMemberIds,
    })),
  };
}
