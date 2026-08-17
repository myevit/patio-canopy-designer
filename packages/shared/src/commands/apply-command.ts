import { parseProjectDocument, type ProjectDocument } from "../design-schema.js";
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
      return finalize(draft);
    }

    case "add-roof-plane": {
      const houseOutlineExists = draft.site.houseOutlines.some((o) => o.id === command.houseOutlineId);
      if (!houseOutlineExists) {
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
        pitchDeg: command.pitchDeg,
        directionRad: command.directionRad,
        gutter: command.gutter,
      });
      return finalize(draft);
    }

    case "update-roof-plane": {
      const roofPlane = draft.site.roofPlanes.find((r) => r.id === command.roofPlaneId);
      if (!roofPlane) {
        return { ok: false, error: `Unknown roof plane id: ${command.roofPlaneId}` };
      }
      Object.assign(roofPlane, command.patch);
      return finalize(draft);
    }
  }
}
