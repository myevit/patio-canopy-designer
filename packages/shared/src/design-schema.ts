import { z } from "zod";
import { deriveFanFieldTargetPositions } from "./fan-field-geometry.js";
import { validateOutline } from "./outline-validation.js";
import type { Vector3Mm } from "./units.js";

/**
 * Fan-rafter endpoints are recomputed with plain double-precision arithmetic
 * on every regeneration; a round-trip through JSON preserves full precision,
 * so any drift beyond float noise means the document is stale or hand-edited.
 */
const FAN_FIELD_POSITION_TOLERANCE_MM = 1e-6;

function positionsWithinTolerance(a: Vector3Mm, b: Vector3Mm, toleranceMm: number): boolean {
  return (
    Math.abs(a.x - b.x) <= toleranceMm &&
    Math.abs(a.y - b.y) <= toleranceMm &&
    Math.abs(a.z - b.z) <= toleranceMm
  );
}

export const CURRENT_SCHEMA_VERSION = 1 as const;

const MAX_PITCH_RAD = (89 * Math.PI) / 180;

const finiteNumber = z.number().finite();

const Vector3MmSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
});

const AnchorKindSchema = z.enum(["post-base", "post-top", "house", "fan-target", "free"]);

const AnchorSchema = z.object({
  id: z.string().min(1),
  kind: AnchorKindSchema,
  positionMm: Vector3MmSchema,
  sourceRef: z.string().optional(),
});

const SectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  widthMm: finiteNumber.positive(),
  heightMm: finiteNumber.positive(),
});

const MaterialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const PostSchema = z.object({
  id: z.string().min(1),
  baseAnchorId: z.string().min(1),
  topAnchorId: z.string().min(1),
  sectionId: z.string().min(1),
  heightMm: finiteNumber.positive(),
});

const MemberRoleSchema = z.enum(["ledger", "perimeter-beam", "fan-rafter"]);

const MemberSchema = z.object({
  id: z.string().min(1),
  role: MemberRoleSchema,
  startAnchorId: z.string().min(1),
  endAnchorId: z.string().min(1),
  sectionId: z.string().min(1),
  materialId: z.string().min(1).optional(),
  rollRad: finiteNumber,
});

const FanTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("member"), memberId: z.string().min(1) }),
  z.object({
    kind: z.literal("edge"),
    startAnchorId: z.string().min(1),
    endAnchorId: z.string().min(1),
  }),
]);

const FanDistributionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("count"), count: z.number().int().min(2) }),
  z.object({ mode: z.literal("spacing"), spacingMm: finiteNumber.positive() }),
]);

const FanElevationRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("linear") }),
  z.object({ kind: z.literal("parabolic"), sagMm: finiteNumber }),
]);

const FanFieldSchema = z.object({
  id: z.string().min(1),
  sourceAnchorId: z.string().min(1),
  target: FanTargetSchema,
  distribution: FanDistributionSchema,
  reversed: z.boolean(),
  elevationRule: FanElevationRuleSchema,
  memberTemplate: z.object({
    sectionId: z.string().min(1),
    materialId: z.string().min(1).optional(),
    rollRad: finiteNumber,
  }),
  memberIds: z.array(z.string().min(1)),
});

const CrossingBehaviorSchema = z.enum([
  "a-over-b",
  "b-over-a",
  "structural-joint",
  "half-lap",
  "no-contact",
  "unresolved",
]);

const EngineeringStatusSchema = z.enum([
  "engineer-review-required",
  "input-requires-verification",
  "check-not-implemented",
]);

const JointSchema = z.object({
  id: z.string().min(1),
  connectedMemberIds: z.array(z.string().min(1)).min(1),
  positionMm: Vector3MmSchema,
  crossingBehavior: CrossingBehaviorSchema,
  engineeringStatus: EngineeringStatusSchema,
});

const HouseOutlineSchema = z.object({
  id: z.string().min(1),
  points: z.array(Vector3MmSchema).min(3),
});

const RoofPlaneSchema = z.object({
  id: z.string().min(1),
  houseOutlineId: z.string().min(1),
  referenceElevationMm: finiteNumber,
  pitchRad: finiteNumber.min(0).max(MAX_PITCH_RAD),
  directionRad: finiteNumber,
});

const GutterSchema = z.object({
  id: z.string().min(1),
  roofPlaneId: z.string().min(1),
  houseOutlineId: z.string().min(1),
  edgeIndex: z.number().int().nonnegative(),
  widthMm: finiteNumber.positive(),
  dropMm: finiteNumber.nonnegative(),
});

const PatioOutlineSchema = z.object({
  id: z.string().min(1),
  points: z.array(Vector3MmSchema).min(3),
});

const SiteSchema = z.object({
  houseOutlines: z.array(HouseOutlineSchema),
  roofPlanes: z.array(RoofPlaneSchema),
  gutters: z.array(GutterSchema),
  patioOutlines: z.array(PatioOutlineSchema),
});

const ProjectMetadataSchema = z.object({
  name: z.string().min(1),
  createdAt: z.string().min(1),
  notes: z.string().optional(),
});

const DisplayUnitsSchema = z.enum(["mm", "m", "ft-in"]);

export const ProjectDocumentSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    revision: z.number().int().nonnegative(),
    metadata: ProjectMetadataSchema,
    displayUnits: DisplayUnitsSchema,
    site: SiteSchema,
    anchors: z.array(AnchorSchema),
    sections: z.array(SectionSchema),
    materials: z.array(MaterialSchema),
    posts: z.array(PostSchema),
    members: z.array(MemberSchema),
    fanFields: z.array(FanFieldSchema),
    joints: z.array(JointSchema),
  })
  .superRefine((doc, ctx) => {
    const requireUniqueIds = (items: readonly { id: string }[], path: (string | number)[], label: string) => {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        if (seen.has(item.id)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate ${label} id: ${item.id}`,
            path: [...path, index, "id"],
          });
        }
        seen.add(item.id);
      });
    };

    requireUniqueIds(doc.site.houseOutlines, ["site", "houseOutlines"], "house outline");
    requireUniqueIds(doc.site.roofPlanes, ["site", "roofPlanes"], "roof plane");
    requireUniqueIds(doc.site.gutters, ["site", "gutters"], "gutter");
    requireUniqueIds(doc.site.patioOutlines, ["site", "patioOutlines"], "patio outline");

    doc.site.houseOutlines.forEach((houseOutline, index) => {
      const validation = validateOutline(houseOutline.points);
      if (!validation.valid) {
        ctx.addIssue({
          code: "custom",
          message: validation.reason,
          path: ["site", "houseOutlines", index, "points"],
        });
      }
    });
    requireUniqueIds(doc.anchors, ["anchors"], "anchor");
    requireUniqueIds(doc.sections, ["sections"], "section");
    requireUniqueIds(doc.materials, ["materials"], "material");
    requireUniqueIds(doc.posts, ["posts"], "post");
    requireUniqueIds(doc.members, ["members"], "member");
    requireUniqueIds(doc.fanFields, ["fanFields"], "fan field");
    requireUniqueIds(doc.joints, ["joints"], "joint");

    const selectableIds = new Map<string, string>();
    const requireGloballyUniqueSelectableIds = (
      items: readonly { id: string }[],
      path: "posts" | "members" | "joints",
    ) => {
      items.forEach((item, index) => {
        const previousPath = selectableIds.get(item.id);
        if (previousPath !== undefined) {
          ctx.addIssue({
            code: "custom",
            message: `Selectable id ${item.id} is already used by ${previousPath}`,
            path: [path, index, "id"],
          });
        } else {
          selectableIds.set(item.id, path);
        }
      });
    };
    requireGloballyUniqueSelectableIds(doc.posts, "posts");
    requireGloballyUniqueSelectableIds(doc.members, "members");
    requireGloballyUniqueSelectableIds(doc.joints, "joints");

    const houseOutlinesById = new Map(doc.site.houseOutlines.map((h) => [h.id, h]));
    const roofedHouseOutlineIds = new Set<string>();
    doc.site.roofPlanes.forEach((roofPlane, index) => {
      if (!houseOutlinesById.has(roofPlane.houseOutlineId)) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown house outline id: ${roofPlane.houseOutlineId}`,
          path: ["site", "roofPlanes", index, "houseOutlineId"],
        });
      } else if (roofedHouseOutlineIds.has(roofPlane.houseOutlineId)) {
        ctx.addIssue({
          code: "custom",
          message: `House outline ${roofPlane.houseOutlineId} already has a roof plane.`,
          path: ["site", "roofPlanes", index, "houseOutlineId"],
        });
      } else {
        roofedHouseOutlineIds.add(roofPlane.houseOutlineId);
      }
    });

    const roofPlanesById = new Map(doc.site.roofPlanes.map((r) => [r.id, r]));
    doc.site.gutters.forEach((gutter, index) => {
      const roofPlane = roofPlanesById.get(gutter.roofPlaneId);
      if (!roofPlane) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown roof plane id: ${gutter.roofPlaneId}`,
          path: ["site", "gutters", index, "roofPlaneId"],
        });
      } else if (roofPlane.houseOutlineId !== gutter.houseOutlineId) {
        ctx.addIssue({
          code: "custom",
          message: `Gutter house outline id does not match roof plane ${gutter.roofPlaneId}`,
          path: ["site", "gutters", index, "houseOutlineId"],
        });
      }
      const houseOutline = houseOutlinesById.get(gutter.houseOutlineId);
      if (!houseOutline) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown house outline id: ${gutter.houseOutlineId}`,
          path: ["site", "gutters", index, "houseOutlineId"],
        });
      } else if (gutter.edgeIndex >= houseOutline.points.length) {
        ctx.addIssue({
          code: "custom",
          message: `Gutter edge index ${gutter.edgeIndex} is out of range for house outline ${gutter.houseOutlineId}`,
          path: ["site", "gutters", index, "edgeIndex"],
        });
      }
    });

    const anchorIds = new Set(doc.anchors.map((a) => a.id));
    const sectionIds = new Set(doc.sections.map((s) => s.id));
    const materialIds = new Set(doc.materials.map((m) => m.id));
    const memberIds = new Set(doc.members.map((m) => m.id));
    const anchorsById = new Map(doc.anchors.map((a) => [a.id, a]));
    const membersById = new Map(doc.members.map((m) => [m.id, m]));

    const requireAnchor = (id: string, path: (string | number)[]) => {
      if (!anchorIds.has(id)) {
        ctx.addIssue({ code: "custom", message: `Unknown anchor id: ${id}`, path });
      }
    };
    const requireSection = (id: string, path: (string | number)[]) => {
      if (!sectionIds.has(id)) {
        ctx.addIssue({ code: "custom", message: `Unknown section id: ${id}`, path });
      }
    };
    const requireMaterial = (id: string | undefined, path: (string | number)[]) => {
      if (id !== undefined && !materialIds.has(id)) {
        ctx.addIssue({ code: "custom", message: `Unknown material id: ${id}`, path });
      }
    };
    const requireMember = (id: string, path: (string | number)[]) => {
      if (!memberIds.has(id)) {
        ctx.addIssue({ code: "custom", message: `Unknown member id: ${id}`, path });
      }
    };

    doc.posts.forEach((post, index) => {
      requireAnchor(post.baseAnchorId, ["posts", index, "baseAnchorId"]);
      requireAnchor(post.topAnchorId, ["posts", index, "topAnchorId"]);
      requireSection(post.sectionId, ["posts", index, "sectionId"]);
    });

    doc.members.forEach((member, index) => {
      requireAnchor(member.startAnchorId, ["members", index, "startAnchorId"]);
      requireAnchor(member.endAnchorId, ["members", index, "endAnchorId"]);
      requireSection(member.sectionId, ["members", index, "sectionId"]);
      requireMaterial(member.materialId, ["members", index, "materialId"]);
    });

    doc.fanFields.forEach((fanField, index) => {
      requireAnchor(fanField.sourceAnchorId, ["fanFields", index, "sourceAnchorId"]);
      if (fanField.target.kind === "member") {
        requireMember(fanField.target.memberId, ["fanFields", index, "target", "memberId"]);
      } else {
        requireAnchor(fanField.target.startAnchorId, ["fanFields", index, "target", "startAnchorId"]);
        requireAnchor(fanField.target.endAnchorId, ["fanFields", index, "target", "endAnchorId"]);
      }
      requireSection(fanField.memberTemplate.sectionId, [
        "fanFields",
        index,
        "memberTemplate",
        "sectionId",
      ]);
      requireMaterial(fanField.memberTemplate.materialId, [
        "fanFields",
        index,
        "memberTemplate",
        "materialId",
      ]);
      fanField.memberIds.forEach((id, memberIndex) => {
        requireMember(id, ["fanFields", index, "memberIds", memberIndex]);
      });

      // Cross-check derived state: each listed member must actually be the
      // fan-rafter this field's current params would produce, so imported or
      // hand-edited documents can't carry stale/inconsistent geometry.
      const sourceAnchor = anchorsById.get(fanField.sourceAnchorId);
      let targetStart: Vector3Mm | undefined;
      let targetEnd: Vector3Mm | undefined;
      if (fanField.target.kind === "member") {
        const targetMember = membersById.get(fanField.target.memberId);
        targetStart = targetMember ? anchorsById.get(targetMember.startAnchorId)?.positionMm : undefined;
        targetEnd = targetMember ? anchorsById.get(targetMember.endAnchorId)?.positionMm : undefined;
      } else {
        targetStart = anchorsById.get(fanField.target.startAnchorId)?.positionMm;
        targetEnd = anchorsById.get(fanField.target.endAnchorId)?.positionMm;
      }

      if (sourceAnchor && targetStart && targetEnd) {
        const derived = deriveFanFieldTargetPositions({
          sourcePosition: sourceAnchor.positionMm,
          targetStart,
          targetEnd,
          distribution: fanField.distribution,
          reversed: fanField.reversed,
          elevationRule: fanField.elevationRule,
        });
        if (derived.ok) {
          fanField.memberIds.forEach((id, memberIndex) => {
            const member = membersById.get(id);
            if (!member) return; // already reported by requireMember above
            const expectedEnd = derived.points[memberIndex];
            if (!expectedEnd) {
              ctx.addIssue({
                code: "custom",
                message: `Fan field ${fanField.id} member ${id} has no corresponding derived position for index ${memberIndex}.`,
                path: ["fanFields", index, "memberIds", memberIndex],
              });
              return;
            }
            if (member.role !== "fan-rafter") {
              ctx.addIssue({
                code: "custom",
                message: `Fan field ${fanField.id} member ${id} must have role "fan-rafter".`,
                path: ["fanFields", index, "memberIds", memberIndex],
              });
            }
            if (member.startAnchorId !== fanField.sourceAnchorId) {
              ctx.addIssue({
                code: "custom",
                message: `Fan field ${fanField.id} member ${id} does not start at the field's source anchor.`,
                path: ["fanFields", index, "memberIds", memberIndex],
              });
            }
            const actualEnd = anchorsById.get(member.endAnchorId)?.positionMm;
            if (!actualEnd || !positionsWithinTolerance(actualEnd, expectedEnd, FAN_FIELD_POSITION_TOLERANCE_MM)) {
              ctx.addIssue({
                code: "custom",
                message: `Fan field ${fanField.id} member ${id} endpoint does not match its derived target position.`,
                path: ["fanFields", index, "memberIds", memberIndex],
              });
            }
          });
        }
      }
    });

    doc.joints.forEach((joint, index) => {
      joint.connectedMemberIds.forEach((id, memberIndex) => {
        requireMember(id, ["joints", index, "connectedMemberIds", memberIndex]);
      });
    });
  });

export type ProjectDocument = z.infer<typeof ProjectDocumentSchema>;
export type Anchor = z.infer<typeof AnchorSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type Material = z.infer<typeof MaterialSchema>;
export type Post = z.infer<typeof PostSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type MemberRole = z.infer<typeof MemberRoleSchema>;
export type FanField = z.infer<typeof FanFieldSchema>;
export type FanTarget = z.infer<typeof FanTargetSchema>;
export type FanDistribution = z.infer<typeof FanDistributionSchema>;
export type FanElevationRule = z.infer<typeof FanElevationRuleSchema>;
export type Joint = z.infer<typeof JointSchema>;
export type CrossingBehavior = z.infer<typeof CrossingBehaviorSchema>;
export type EngineeringStatus = z.infer<typeof EngineeringStatusSchema>;
export type HouseOutline = z.infer<typeof HouseOutlineSchema>;
export type RoofPlane = z.infer<typeof RoofPlaneSchema>;
export type Gutter = z.infer<typeof GutterSchema>;
export type PatioOutline = z.infer<typeof PatioOutlineSchema>;

export type ParseProjectDocumentResult =
  | { success: true; data: ProjectDocument }
  | { success: false; error: z.ZodError<ProjectDocument> };

export function parseProjectDocument(input: unknown): ParseProjectDocumentResult {
  const result = ProjectDocumentSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
