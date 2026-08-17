import { parseProjectDocument, type Anchor, type Joint, type Member, type ProjectDocument } from "../design-schema.js";
import { selectEaveEdgeIndex } from "../eave-edge.js";
import {
  deriveFanFieldGeometry,
  deriveFanFieldMemberId,
  deriveFanFieldTargetAnchorId,
} from "../fan-field-geometry.js";
import { regenerateJointPosition } from "../joint-candidates.js";
import { validateOutline } from "../outline-validation.js";
import type { Vector3Mm } from "../units.js";
import { formatZodError } from "../zod-error.js";
import type { CommandResult, DocumentCommand } from "./types.js";

/** How far (mm) a joint's recorded position may drift from its derived crossing before it needs review. */
const POSITION_DRIFT_TOLERANCE_MM = 5;

const AUTO_FLAGGED_CROSSING_BEHAVIOR = "unresolved";
const AUTO_FLAGGED_ENGINEERING_STATUS = "input-requires-verification";

function distanceMm(a: Vector3Mm, b: Vector3Mm): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/**
 * Called after any command that can move a member's endpoint (post move/
 * resize, fan-field regeneration) so joints never silently go stale: each
 * joint's position is recomputed from its connected members' current
 * geometry, or the joint is flagged as needing resolution if they no longer
 * meet within tolerance. If a previously auto-flagged joint's members meet
 * again, it is returned to a resolved state rather than staying unresolved
 * forever.
 */
function regenerateOrFlagJoints(draft: ProjectDocument): void {
  draft.joints.forEach((joint) => {
    const regenerated = regenerateJointPosition(draft, joint);
    if (regenerated) {
      joint.positionMm = regenerated;
      if (
        joint.crossingBehavior === AUTO_FLAGGED_CROSSING_BEHAVIOR &&
        joint.engineeringStatus === AUTO_FLAGGED_ENGINEERING_STATUS
      ) {
        joint.crossingBehavior = "structural-joint";
        joint.engineeringStatus = "engineer-review-required";
      }
    } else {
      joint.crossingBehavior = AUTO_FLAGGED_CROSSING_BEHAVIOR;
      joint.engineeringStatus = AUTO_FLAGGED_ENGINEERING_STATUS;
    }
  });
}

/**
 * Revalidates a joint's recorded position against where its connected
 * members currently meet, after a manual edit to that position. Never
 * silently accepts a drifted position: it either stays within tolerance, or
 * the joint is flagged for review. Skipped for single-member joints, whose
 * "derived crossing" is a degenerate anchor lookup rather than a real
 * geometric check.
 */
function revalidateJointPosition(draft: ProjectDocument, joint: Joint): void {
  if (joint.connectedMemberIds.length < 2) return;
  const regenerated = regenerateJointPosition(draft, joint);
  if (regenerated === null) {
    joint.crossingBehavior = AUTO_FLAGGED_CROSSING_BEHAVIOR;
    joint.engineeringStatus = AUTO_FLAGGED_ENGINEERING_STATUS;
    return;
  }
  if (distanceMm(joint.positionMm, regenerated) > POSITION_DRIFT_TOLERANCE_MM) {
    joint.engineeringStatus = "input-requires-verification";
  }
}

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
      regenerateOrFlagJoints(draft);
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
      regenerateOrFlagJoints(draft);
      return finalize(draft);
    }

    case "delete-post": {
      const post = draft.posts.find((p) => p.id === command.postId);
      if (!post) {
        return { ok: false, error: `Unknown post id: ${command.postId}` };
      }
      const removingMemberIds = draft.members
        .filter(
          (m) => m.startAnchorId === post.baseAnchorId || m.endAnchorId === post.baseAnchorId ||
            m.startAnchorId === post.topAnchorId || m.endAnchorId === post.topAnchorId,
        )
        .map((m) => m.id);
      const blockingJoint = draft.joints.find((joint) =>
        joint.connectedMemberIds.some((id) => removingMemberIds.includes(id)),
      );
      if (blockingJoint) {
        return {
          ok: false,
          error: `Cannot delete post "${command.postId}": joint "${blockingJoint.id}" still connects one of its beams. Delete that joint first.`,
        };
      }
      draft.posts = draft.posts.filter((p) => p.id !== command.postId);
      draft.members = draft.members.filter((m) => !removingMemberIds.includes(m.id));
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
      const parentFanField = draft.fanFields.find((f) => f.memberIds.includes(command.memberId));
      if (parentFanField) {
        return {
          ok: false,
          error: `"${command.memberId}" is a rafter generated by fan field "${parentFanField.id}". Edit the fan field instead of the individual rafter.`,
        };
      }
      Object.assign(member, command.patch);
      return finalize(draft);
    }

    case "delete-beam": {
      const member = draft.members.find((m) => m.id === command.memberId);
      if (!member) {
        return { ok: false, error: `Unknown member id: ${command.memberId}` };
      }
      const parentFanField = draft.fanFields.find((f) => f.memberIds.includes(command.memberId));
      if (parentFanField) {
        return {
          ok: false,
          error: `"${command.memberId}" is a rafter generated by fan field "${parentFanField.id}". Delete the fan field instead of the individual rafter.`,
        };
      }
      const blockingJoint = draft.joints.find((joint) => joint.connectedMemberIds.includes(command.memberId));
      if (blockingJoint) {
        return {
          ok: false,
          error: `Cannot delete beam "${command.memberId}": joint "${blockingJoint.id}" still connects it. Delete that joint first.`,
        };
      }
      draft.members = draft.members.filter((m) => m.id !== command.memberId);
      return finalize(draft);
    }

    case "add-fan-field": {
      const anchorsById = new Map(draft.anchors.map((a) => [a.id, a]));
      const membersById = new Map(draft.members.map((m) => [m.id, m]));
      const geometry = deriveFanFieldGeometry(
        {
          sourceAnchorId: command.sourceAnchorId,
          target: command.target,
          distribution: command.distribution,
          reversed: command.reversed,
          elevationRule: command.elevationRule,
        },
        anchorsById,
        membersById,
      );
      if (!geometry.ok) {
        return { ok: false, error: geometry.error };
      }
      const memberIds = generateFanFieldEntities(draft, command.fanFieldId, command.sourceAnchorId, command.memberTemplate, geometry.points);
      draft.fanFields.push({
        id: command.fanFieldId,
        sourceAnchorId: command.sourceAnchorId,
        target: command.target,
        distribution: command.distribution,
        reversed: command.reversed,
        elevationRule: command.elevationRule,
        memberTemplate: {
          sectionId: command.memberTemplate.sectionId,
          rollRad: command.memberTemplate.rollRad ?? 0,
          ...(command.memberTemplate.materialId !== undefined ? { materialId: command.memberTemplate.materialId } : {}),
        },
        memberIds,
      });
      return finalize(draft);
    }

    case "update-fan-field": {
      const fanField = draft.fanFields.find((f) => f.id === command.fanFieldId);
      if (!fanField) {
        return { ok: false, error: `Unknown fan field id: ${command.fanFieldId}` };
      }

      const sourceAnchorId = command.patch.sourceAnchorId ?? fanField.sourceAnchorId;
      const target = command.patch.target ?? fanField.target;
      const distribution = command.patch.distribution ?? fanField.distribution;
      const reversed = command.patch.reversed ?? fanField.reversed;
      const elevationRule = command.patch.elevationRule ?? fanField.elevationRule;
      const memberTemplate = { ...fanField.memberTemplate, ...command.patch.memberTemplate };

      const oldMemberIds = fanField.memberIds;
      const survivingMembers = draft.members.filter((m) => !oldMemberIds.includes(m.id));
      const survivingAnchors = draft.anchors.filter(
        (a) => !(a.kind === "fan-target" && a.sourceRef === command.fanFieldId),
      );

      const anchorsById = new Map(survivingAnchors.map((a) => [a.id, a]));
      const membersById = new Map(survivingMembers.map((m) => [m.id, m]));
      const geometry = deriveFanFieldGeometry(
        { sourceAnchorId, target, distribution, reversed, elevationRule },
        anchorsById,
        membersById,
      );
      if (!geometry.ok) {
        return { ok: false, error: geometry.error };
      }

      const nextMemberIds = new Set(
        geometry.points.map((_, pointIndex) => deriveFanFieldMemberId(command.fanFieldId, pointIndex)),
      );
      const droppedMemberIds = oldMemberIds.filter((id) => !nextMemberIds.has(id));
      if (droppedMemberIds.length > 0) {
        const blockingJoint = draft.joints.find((joint) =>
          joint.connectedMemberIds.some((id) => droppedMemberIds.includes(id)),
        );
        if (blockingJoint) {
          const orphanedId = blockingJoint.connectedMemberIds.find((id) => droppedMemberIds.includes(id));
          return {
            ok: false,
            error: `Cannot shrink fan field "${command.fanFieldId}": joint "${blockingJoint.id}" still connects rafter "${orphanedId}", which this change would remove. Delete or reassign that joint first.`,
          };
        }
      }

      draft.members = survivingMembers;
      draft.anchors = survivingAnchors;
      const memberIds = generateFanFieldEntities(draft, command.fanFieldId, sourceAnchorId, memberTemplate, geometry.points);
      fanField.sourceAnchorId = sourceAnchorId;
      fanField.target = target;
      fanField.distribution = distribution;
      fanField.reversed = reversed;
      fanField.elevationRule = elevationRule;
      fanField.memberTemplate = memberTemplate;
      fanField.memberIds = memberIds;
      regenerateOrFlagJoints(draft);
      return finalize(draft);
    }

    case "delete-fan-field": {
      const fanField = draft.fanFields.find((f) => f.id === command.fanFieldId);
      if (!fanField) {
        return { ok: false, error: `Unknown fan field id: ${command.fanFieldId}` };
      }
      const memberIds = new Set(fanField.memberIds);
      const blockingJoint = draft.joints.find((joint) =>
        joint.connectedMemberIds.some((id) => memberIds.has(id)),
      );
      if (blockingJoint) {
        return {
          ok: false,
          error: `Cannot delete fan field "${command.fanFieldId}": joint "${blockingJoint.id}" still connects one of its rafters. Delete that joint first.`,
        };
      }
      draft.fanFields = draft.fanFields.filter((f) => f.id !== command.fanFieldId);
      draft.members = draft.members.filter((m) => !memberIds.has(m.id));
      draft.anchors = draft.anchors.filter(
        (a) => !(a.kind === "fan-target" && a.sourceRef === command.fanFieldId),
      );
      return finalize(draft);
    }

    case "confirm-joint": {
      if (command.connectedMemberIds.length < 2) {
        return { ok: false, error: "A joint needs at least two connected members." };
      }
      const unknownMemberId = command.connectedMemberIds.find(
        (id) => !draft.members.some((m) => m.id === id),
      );
      if (unknownMemberId) {
        return { ok: false, error: `Unknown member id: ${unknownMemberId}` };
      }
      const regenerated = regenerateJointPosition(draft, { connectedMemberIds: command.connectedMemberIds });
      if (regenerated === null) {
        return {
          ok: false,
          error: `Members ${command.connectedMemberIds.map((id) => `"${id}"`).join(" and ")} do not meet; cannot create a joint.`,
        };
      }
      const joint: Joint = {
        id: command.jointId,
        connectedMemberIds: command.connectedMemberIds,
        positionMm: command.positionMm,
        crossingBehavior: command.crossingBehavior,
        engineeringStatus: command.engineeringStatus,
      };
      if (distanceMm(command.positionMm, regenerated) > POSITION_DRIFT_TOLERANCE_MM) {
        joint.engineeringStatus = "input-requires-verification";
      }
      draft.joints.push(joint);
      return finalize(draft);
    }

    case "update-joint": {
      const joint = draft.joints.find((j) => j.id === command.jointId);
      if (!joint) {
        return { ok: false, error: `Unknown joint id: ${command.jointId}` };
      }
      Object.assign(joint, command.patch);
      if (command.patch.positionMm !== undefined) {
        revalidateJointPosition(draft, joint);
      }
      return finalize(draft);
    }

    case "delete-joint": {
      const joint = draft.joints.find((j) => j.id === command.jointId);
      if (!joint) {
        return { ok: false, error: `Unknown joint id: ${command.jointId}` };
      }
      const membersById = new Map(draft.members.map((m) => [m.id, m]));
      const connectsFanRafter = joint.connectedMemberIds.some(
        (id) => membersById.get(id)?.role === "fan-rafter",
      );
      if (connectsFanRafter) {
        return {
          ok: false,
          error: `Joint "${command.jointId}" connects a fan field's derived rafter and is protected. Edit or delete the fan field instead.`,
        };
      }
      draft.joints = draft.joints.filter((j) => j.id !== command.jointId);
      return finalize(draft);
    }

    case "set-display-units": {
      draft.displayUnits = command.displayUnits;
      return finalize(draft);
    }
  }
}

function generateFanFieldEntities(
  draft: ProjectDocument,
  fanFieldId: string,
  sourceAnchorId: string,
  memberTemplate: { sectionId: string; materialId?: string; rollRad?: number },
  targetPoints: ProjectDocument["anchors"][number]["positionMm"][],
): string[] {
  const memberIds: string[] = [];
  targetPoints.forEach((point, index) => {
    const targetAnchorId = deriveFanFieldTargetAnchorId(fanFieldId, index);
    const targetAnchor: Anchor = { id: targetAnchorId, kind: "fan-target", positionMm: point, sourceRef: fanFieldId };
    draft.anchors.push(targetAnchor);

    const memberId = deriveFanFieldMemberId(fanFieldId, index);
    const member: Member = {
      id: memberId,
      role: "fan-rafter",
      startAnchorId: sourceAnchorId,
      endAnchorId: targetAnchorId,
      sectionId: memberTemplate.sectionId,
      rollRad: memberTemplate.rollRad ?? 0,
      ...(memberTemplate.materialId !== undefined ? { materialId: memberTemplate.materialId } : {}),
    };
    draft.members.push(member);
    memberIds.push(memberId);
  });
  return memberIds;
}
