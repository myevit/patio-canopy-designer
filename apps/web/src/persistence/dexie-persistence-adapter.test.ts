import "fake-indexeddb/auto";
import Dexie, { type Table } from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProjectDocument } from "@canopy/shared";
import { createDexiePersistenceAdapter } from "./dexie-persistence-adapter.js";

interface RawProjectRecord {
  id: string;
  document: unknown;
}

async function putRawRecord(document: unknown): Promise<void> {
  class RawStudioDatabase extends Dexie {
    projects!: Table<RawProjectRecord, string>;
    constructor() {
      super("canopy-studio");
      this.version(1).stores({ projects: "id" });
    }
  }
  const db = new RawStudioDatabase();
  await db.projects.put({ id: "autosave", document });
  db.close();
}

function doc() {
  return createEmptyProjectDocument({ name: "Persisted project", createdAt: "2026-08-16T00:00:00.000Z" });
}

describe("createDexiePersistenceAdapter", () => {
  beforeEach(async () => {
    const adapter = createDexiePersistenceAdapter();
    await adapter.clear();
  });

  it("returns undefined when nothing has been saved", async () => {
    const adapter = createDexiePersistenceAdapter();
    const loaded = await adapter.load();
    expect(loaded).toBeUndefined();
  });

  it("saves and loads a project document", async () => {
    const adapter = createDexiePersistenceAdapter();
    await adapter.save(doc());
    const loaded = await adapter.load();
    expect(loaded).toEqual(doc());
  });

  it("persists across separate adapter instances, simulating a page reload", async () => {
    const first = createDexiePersistenceAdapter();
    await first.save(doc());

    const second = createDexiePersistenceAdapter();
    const loaded = await second.load();
    expect(loaded).toEqual(doc());
  });

  it("overwrites the previous save with the latest document", async () => {
    const adapter = createDexiePersistenceAdapter();
    await adapter.save(doc());
    const updated = { ...doc(), revision: 5 };
    await adapter.save(updated);
    const loaded = await adapter.load();
    expect(loaded?.revision).toBe(5);
  });

  it("clear removes the saved project", async () => {
    const adapter = createDexiePersistenceAdapter();
    await adapter.save(doc());
    await adapter.clear();
    const loaded = await adapter.load();
    expect(loaded).toBeUndefined();
  });

  it("recovers to undefined instead of throwing when the stored record is not a valid project document", async () => {
    await putRawRecord({ hello: "world" });
    const adapter = createDexiePersistenceAdapter();
    await expect(adapter.load()).resolves.toBeUndefined();
  });

  it("recovers to undefined instead of throwing when the stored house outline is semantically invalid", async () => {
    const corrupt = doc();
    corrupt.site.houseOutlines.push({
      id: "house-1",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 4000, y: 3000, z: 0 },
        { x: 4000, y: 0, z: 0 },
        { x: 0, y: 3000, z: 0 },
      ],
    });
    await putRawRecord(corrupt);
    const adapter = createDexiePersistenceAdapter();
    await expect(adapter.load()).resolves.toBeUndefined();
  });
});
