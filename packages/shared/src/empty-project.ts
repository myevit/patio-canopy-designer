import { CURRENT_SCHEMA_VERSION, type ProjectDocument } from "./design-schema.js";

export interface CreateEmptyProjectDocumentOptions {
  name: string;
  createdAt: string;
}

export function createEmptyProjectDocument({
  name,
  createdAt,
}: CreateEmptyProjectDocumentOptions): ProjectDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
    metadata: { name, createdAt },
    displayUnits: "mm",
    site: { houseOutlines: [], roofPlanes: [], patioOutlines: [] },
    anchors: [],
    sections: [],
    materials: [],
    posts: [],
    members: [],
    fanFields: [],
    joints: [],
  };
}
