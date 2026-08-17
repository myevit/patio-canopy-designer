import Dexie, { type Table } from "dexie";
import type { ProjectDocument } from "@canopy/shared";
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
      return record?.document;
    },
    async clear() {
      await db.projects.delete(AUTOSAVE_KEY);
    },
  };
}
