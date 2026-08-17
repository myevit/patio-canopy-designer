import type { ProjectDocument } from "@canopy/shared";

export interface PersistenceAdapter {
  save(document: ProjectDocument): Promise<void>;
  load(): Promise<ProjectDocument | undefined>;
  clear(): Promise<void>;
}
