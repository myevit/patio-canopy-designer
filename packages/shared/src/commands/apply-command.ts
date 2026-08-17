import { parseProjectDocument, type ProjectDocument } from "../design-schema.js";
import { selectEaveEdgeIndex } from "../eave-edge.js";
import { validateOutline } from "../outline-validation.js";
import { formatZodError } from "../zod-error.js";
import type { CommandResult, DocumentCommand } from "./types.js";

function cloneDocument(document: ProjectDocument): ProjectDocument {
  return JSON.parse(JSON.stringify(document)) as ProjectDocument;
}

function finalize(draft: ProjectDocument): CommandResult {
  const result = parseProjectDocument(draft);
  if (!result.success) {
    return { ok: false, error: formatZodError(result.error) };
  }
  return { ok: true, document: result.data };
}

export function applyCommand(document: ProjectDocument, command: DocumentCommand): CommandResult {
  const draft = cloneDocument(document);
  draft.revision += 1;

  switch (command.type) {
    case "create-house-outline": {
      const validation = validateOutline(command.points);
      if (!validation.valid) {
        return { ok: false, error: validation.reason };
      }
      draft.site.houseOutlines.push({ id: command.outlineId, points: command.points });
      return finalize(draft);
    }

    case "move-house-outline-vertex": {
      const outline = draft.site.houseOutlines.find((o) => o.id === command.outlineId);
      if (!outline) {
        return { ok: false, error: `Unknown house outline id: ${command.outlineId}` };
      }
      if (command.vertexIndex < 0 || command.vertexIndex >= outline.points.length) {
        return { ok: false, error: `Vertex index out of range: ${command.vertexIndex}` };
      }
      const nextPoints = outline.points.slice();
      nextPoints[command.vertexIndex] = command.position;
      const validation = validateOutline(nextPoints);
      if (!validation.valid) {
        return { ok: false, error: validation.reason };
      }
      outline.points = nextPoints;
      return finalize(draft);
    }

    case "insert-house-outline-vertex": {
      const outline = draft.site.houseOutlines.find((o) => o.id === command.outlineId);
      if (!outline) {
        return { ok: false, error: `Unknown house outline id: ${command.outlineId}` };
      }
      if (command.afterIndex < 0 || command.afterIndex >= outline.points.length) {
        return { ok: false, error: `Vertex index out of range: ${command.afterIndex}` };
      }
      const nextPoints = outline.points.slice();
      nextPoints.splice(command.afterIndex + 1, 0, command.position);
      const validation = validateOutline(nextPoints);
      if (!validation.valid) {
        return { ok: false, error: validation.reason };
      }
      outline.points = nextPoints;
      draft.site.gutters.forEach((gutter) => {
        if (gutter.houseOutlineId === command.outlineId && gutter.edgeIndex > command.afterIndex) {
          gutter.edgeIndex += 1;
        }
      });
      return finalize(draft);
    }

    case "delete-house-outline-vertex": {
      const outline = draft.site.houseOutlines.find((o) => o.id === command.outlineId);
      if (!outline) {
        return { ok: false, error: `Unknown house outline id: ${command.outlineId}` };
      }
      if (command.vertexIndex < 0 || command.vertexIndex >= outline.points.length) {
        return { ok: false, error: `Vertex index out of range: ${command.vertexIndex}` };
      }
      if (outline.points.length <= 3) {
        return { ok: false, error: "A house outline needs at least 3 points." };
      }
      const nextPoints = outline.points.slice();
      nextPoints.splice(command.vertexIndex, 1);
      const validation = validateOutline(nextPoints);
      if (!validation.valid) {
        return { ok: false, error: validation.reason };
      }
      outline.points = nextPoints;
      draft.site.gutters.forEach((gutter) => {
        if (gutter.houseOutlineId !== command.outlineId) return;
        if (gutter.edgeIndex > command.vertexIndex) {
          gutter.edgeIndex -= 1;
        }
        gutter.edgeIndex %= nextPoints.length;
      });
      return finalize(draft);
    }

    case "add-roof-plane": {
      const houseOutline = draft.site.houseOutlines.find((o) => o.id === command.houseOutlineId);
      if (!houseOutline) {
        return { ok: false, error: `Unknown house outline id: ${command.houseOutlineId}` };
      }
      const alreadyRoofed = draft.site.roofPlanes.some((r) => r.houseOutlineId === command.houseOutlineId);
      if (alreadyRoofed) {
        return { ok: false, error: `House outline ${command.houseOutlineId} already has a roof plane.` };
      }
      draft.site.roofPlanes.push({
        id: command.roofPlaneId,
        houseOutlineId: command.houseOutlineId,
        referenceElevationMm: command.referenceElevationMm,
        pitchRad: command.pitchRad,
        directionRad: command.directionRad,
      });
      draft.site.gutters.push({
        id: command.gutterId,
        roofPlaneId: command.roofPlaneId,
        houseOutlineId: command.houseOutlineId,
        edgeIndex: selectEaveEdgeIndex(houseOutline.points, command.directionRad),
        widthMm: command.gutterWidthMm,
        dropMm: command.gutterDropMm,
      });
      return finalize(draft);
    }

    case "update-roof-plane": {
      const roofPlane = draft.site.roofPlanes.find((r) => r.id === command.roofPlaneId);
      if (!roofPlane) {
        return { ok: false, error: `Unknown roof plane id: ${command.roofPlaneId}` };
      }
      Object.assign(roofPlane, command.patch);
      if (command.patch.directionRad !== undefined) {
        const houseOutline = draft.site.houseOutlines.find((o) => o.id === roofPlane.houseOutlineId);
        const gutter = draft.site.gutters.find((g) => g.roofPlaneId === roofPlane.id);
        if (houseOutline && gutter) {
          gutter.edgeIndex = selectEaveEdgeIndex(houseOutline.points, roofPlane.directionRad);
        }
      }
      return finalize(draft);
    }

    case "update-gutter": {
      const gutter = draft.site.gutters.find((g) => g.id === command.gutterId);
      if (!gutter) {
        return { ok: false, error: `Unknown gutter id: ${command.gutterId}` };
      }
      Object.assign(gutter, command.patch);
      return finalize(draft);
    }

    case "add-post": {
      draft.anchors.push(
        { id: command.baseAnchorId, kind: "post-base", positionMm: command.position },
        {
          id: command.topAnchorId,
          kind: "post-top",
          positionMm: { ...command.position, z: command.position.z + command.heightMm },
        },
      );
      draft.posts.push({
        id: command.postId,
        baseAnchorId: command.baseAnchorId,
        topAnchorId: command.topAnchorId,
        sectionId: command.sectionId,
        heightMm: command.heightMm,
      });
      return finalize(draft);
    }

    case "move-post": {
      const post = draft.posts.find((p) => p.id === command.postId);
      if (!post) {
        return { ok: false, error: `Unknown post id: ${command.postId}` };
      }
      const base = draft.anchors.find((a) => a.id === post.baseAnchorId);
      const top = draft.anchors.find((a) => a.id === post.topAnchorId);
      if (!base || !top) {
        return { ok: false, error: `Post ${command.postId} is missing its anchors.` };
      }
      base.positionMm = command.position;
      top.positionMm = { ...command.position, z: command.position.z + post.heightMm };
      return finalize(draft);
    }

    case "update-post": {
      const post = draft.posts.find((p) => p.id === command.postId);
      if (!post) {
        return { ok: false, error: `Unknown post id: ${command.postId}` };
      }
      Object.assign(post, command.patch);
      if (command.patch.heightMm !== undefined) {
        const base = draft.anchors.find((a) => a.id === post.baseAnchorId);
        const top = draft.anchors.find((a) => a.id === post.topAnchorId);
        if (base && top) {
          top.positionMm = { ...base.positionMm, z: base.positionMm.z + post.heightMm };
        }
      }
      return finalize(draft);
    }

    case "delete-post": {
      const post = draft.posts.find((p) => p.id === command.postId);
      if (!post) {
        return { ok: false, error: `Unknown post id: ${command.postId}` };
      }
      draft.posts = draft.posts.filter((p) => p.id !== command.postId);
      draft.members = draft.members.filter(
        (m) => m.startAnchorId !== post.baseAnchorId && m.endAnchorId !== post.baseAnchorId &&
          m.startAnchorId !== post.topAnchorId && m.endAnchorId !== post.topAnchorId,
      );
      draft.anchors = draft.anchors.filter((a) => a.id !== post.baseAnchorId && a.id !== post.topAnchorId);
      return finalize(draft);
    }

    case "add-house-anchor": {
      draft.anchors.push({
        id: command.anchorId,
        kind: "house",
        positionMm: command.position,
        ...(command.sourceRef !== undefined ? { sourceRef: command.sourceRef } : {}),
      });
      return finalize(draft);
    }

    case "add-beam": {
      if (command.startAnchorId === command.endAnchorId) {
        return { ok: false, error: "A beam needs two different anchors." };
      }
      draft.members.push({
        id: command.memberId,
        role: "perimeter-beam",
        startAnchorId: command.startAnchorId,
        endAnchorId: command.endAnchorId,
        sectionId: command.sectionId,
        rollRad: command.rollRad ?? 0,
        ...(command.materialId !== undefined ? { materialId: command.materialId } : {}),
      });
      return finalize(draft);
    }

    case "update-beam": {
      const member = draft.members.find((m) => m.id === command.memberId);
      if (!member) {
        return { ok: false, error: `Unknown member id: ${command.memberId}` };
      }
      Object.assign(member, command.patch);
      return finalize(draft);
    }

    case "delete-beam": {
      const member = draft.members.find((m) => m.id === command.memberId);
      if (!member) {
        return { ok: false, error: `Unknown member id: ${command.memberId}` };
      }
      draft.members = draft.members.filter((m) => m.id !== command.memberId);
      return finalize(draft);
    }
  }
}
