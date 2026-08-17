import Dexie, { type Table } from "dexie";
import { parseProjectDocument, type ProjectDocument } from "@canopy/shared";
import type { PersistenceAdapter } from "./persistence-adapter.js";

interface ProjectRecord {
  id: string;
  document: ProjectDocument;
}

const AUTOSAVE_KEY = "autosave";

class StudioDatabase extends Dexie {
  projects!: Table<ProjectRecord, string>;

  constructor() {
    super("canopy-studio");
    this.version(1).stores({ projects: "id" });
  }
}

export function createDexiePersistenceAdapter(): PersistenceAdapter {
  const db = new StudioDatabase();

  return {
    async save(document: ProjectDocument) {
      await db.projects.put({ id: AUTOSAVE_KEY, document });
    },
    async load() {
      const record = await db.projects.get(AUTOSAVE_KEY);
      if (!record) return undefined;
      // A stored record may be corrupt, obsolete, or otherwise semantically
      // invalid (e.g. from a schema change); recover to "no saved project"
      // rather than handing invalid data to the rest of the app.
      const result = parseProjectDocument(record.document);
      return result.success ? result.data : undefined;
    },
    async clear() {
      await db.projects.delete(AUTOSAVE_KEY);
    },
  };
}
