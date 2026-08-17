import { CURRENT_SCHEMA_VERSION, type ProjectDocument } from "@canopy/shared";

export const POST_SECTION_ID = "section-post";
export const BEAM_SECTION_ID = "section-beam";
export const MATERIAL_ID = "material-1";

/** A minimal two-post, one-beam frame: the canonical explicitly supported case. */
export function twoPostFrame(): ProjectDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
    metadata: { name: "fixture", createdAt: "2026-01-01T00:00:00.000Z" },
    displayUnits: "mm",
    site: { houseOutlines: [], roofPlanes: [], gutters: [], patioOutlines: [] },
    anchors: [
      { id: "anchor-post-a-base", kind: "post-base", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "anchor-post-a-top", kind: "post-top", positionMm: { x: 0, y: 0, z: 2400 } },
      { id: "anchor-post-b-base", kind: "post-base", positionMm: { x: 4000, y: 0, z: 0 } },
      { id: "anchor-post-b-top", kind: "post-top", positionMm: { x: 4000, y: 0, z: 2400 } },
    ],
    sections: [
      { id: POST_SECTION_ID, name: "140x140 post", widthMm: 140, heightMm: 140 },
      { id: BEAM_SECTION_ID, name: "184x38 beam", widthMm: 184, heightMm: 38 },
    ],
    materials: [{ id: MATERIAL_ID, name: "SPF #2" }],
    posts: [
      {
        id: "post-a",
        baseAnchorId: "anchor-post-a-base",
        topAnchorId: "anchor-post-a-top",
        sectionId: POST_SECTION_ID,
        heightMm: 2400,
      },
      {
        id: "post-b",
        baseAnchorId: "anchor-post-b-base",
        topAnchorId: "anchor-post-b-top",
        sectionId: POST_SECTION_ID,
        heightMm: 2400,
      },
    ],
    members: [
      {
        id: "beam-1",
        role: "perimeter-beam",
        startAnchorId: "anchor-post-a-top",
        endAnchorId: "anchor-post-b-top",
        sectionId: BEAM_SECTION_ID,
        materialId: MATERIAL_ID,
        rollRad: 0,
      },
    ],
    fanFields: [],
    joints: [],
  };
}
