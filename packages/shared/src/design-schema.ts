import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 1 as const;

const finiteNumber = z.number().finite();

const Vector3MmSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
});

const AnchorKindSchema = z.enum(["post-base", "post-top", "house", "free"]);

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

const FanFieldSchema = z.object({
  id: z.string().min(1),
  sourceAnchorId: z.string().min(1),
  targetAnchorIds: z.array(z.string().min(1)).min(1),
  elevationRule: z.string().min(1),
  memberTemplate: z.object({
    sectionId: z.string().min(1),
    materialId: z.string().min(1).optional(),
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
  pointMm: Vector3MmSchema,
  normal: Vector3MmSchema,
  outline: z.array(Vector3MmSchema).min(3),
  pitchLabel: z.string().min(1).optional(),
});

const PatioOutlineSchema = z.object({
  id: z.string().min(1),
  points: z.array(Vector3MmSchema).min(3),
});

const SiteSchema = z.object({
  houseOutlines: z.array(HouseOutlineSchema),
  roofPlanes: z.array(RoofPlaneSchema),
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
    requireUniqueIds(doc.site.patioOutlines, ["site", "patioOutlines"], "patio outline");
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

    const anchorIds = new Set(doc.anchors.map((a) => a.id));
    const sectionIds = new Set(doc.sections.map((s) => s.id));
    const materialIds = new Set(doc.materials.map((m) => m.id));
    const memberIds = new Set(doc.members.map((m) => m.id));

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
      fanField.targetAnchorIds.forEach((id, targetIndex) => {
        requireAnchor(id, ["fanFields", index, "targetAnchorIds", targetIndex]);
      });
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
export type Joint = z.infer<typeof JointSchema>;
export type HouseOutline = z.infer<typeof HouseOutlineSchema>;
export type RoofPlane = z.infer<typeof RoofPlaneSchema>;
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
