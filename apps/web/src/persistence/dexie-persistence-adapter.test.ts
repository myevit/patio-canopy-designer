import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProjectDocument } from "@canopy/shared";
import { createDexiePersistenceAdapter } from "./dexie-persistence-adapter.js";

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
});
