import { CURRENT_SCHEMA_VERSION, type ProjectDocument } from "./design-schema.js";

export interface CreateEmptyProjectDocumentOptions {
  name: string;
  createdAt: string;
}

/** Stable section id the Post tool uses by default for newly placed posts. */
export const DEFAULT_POST_SECTION_ID = "section-post-default";
/** Stable section id the Beam tool uses by default for newly drawn beams. */
export const DEFAULT_BEAM_SECTION_ID = "section-beam-default";

export function createEmptyProjectDocument({
  name,
  createdAt,
}: CreateEmptyProjectDocumentOptions): ProjectDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
    metadata: { name, createdAt },
    displayUnits: "mm",
    site: { houseOutlines: [], roofPlanes: [], gutters: [], patioOutlines: [] },
    anchors: [],
    sections: [
      { id: DEFAULT_POST_SECTION_ID, name: "140x140 post", widthMm: 140, heightMm: 140 },
      { id: DEFAULT_BEAM_SECTION_ID, name: "184x38 beam", widthMm: 184, heightMm: 38 },
    ],
    materials: [],
    posts: [],
    members: [],
    fanFields: [],
    joints: [],
  };
}
