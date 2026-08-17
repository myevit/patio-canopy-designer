import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createEmptyProjectDocument, type ProjectDocument } from "@canopy/shared";
import { useDocumentController } from "../state/use-document-controller.js";
import type { PersistenceAdapter } from "./persistence-adapter.js";
import { useProjectPersistence } from "./use-project-persistence.js";

function emptyDoc(name: string): ProjectDocument {
  return createEmptyProjectDocument({ name, createdAt: "2026-08-16T00:00:00.000Z" });
}

function createFakeAdapter(initial: ProjectDocument | undefined) {
  let stored = initial;
  const saves: ProjectDocument[] = [];
  const adapter: PersistenceAdapter = {
    async load() {
      return stored;
    },
    async save(document) {
      stored = document;
      saves.push(document);
    },
    async clear() {
      stored = undefined;
    },
  };
  return { adapter, saves, get stored() { return stored; } };
}

function setup(adapter: PersistenceAdapter) {
  return renderHook(() => {
    const controller = useDocumentController(emptyDoc("Untitled project"));
    const persistence = useProjectPersistence(controller, adapter);
    return { controller, persistence };
  });
}

describe("useProjectPersistence", () => {
  it("loads a previously saved project on mount and replaces the initial document", async () => {
    const saved = emptyDoc("Saved project");
    const { adapter } = createFakeAdapter(saved);
    const { result } = setup(adapter);

    await waitFor(() => expect(result.current.persistence.loaded).toBe(true));
    expect(result.current.controller.document.metadata.name).toBe("Saved project");
  });

  it("does not overwrite the saved project with the initial document before load completes", async () => {
    const saved = emptyDoc("Saved project");
    const { adapter, saves } = createFakeAdapter(saved);
    const { result } = setup(adapter);

    await waitFor(() => expect(result.current.persistence.loaded).toBe(true));
    expect(saves).toEqual([]);
  });

  it("autosaves after each successful command once loaded", async () => {
    const { adapter, saves } = createFakeAdapter(undefined);
    const { result } = setup(adapter);

    await waitFor(() => expect(result.current.persistence.loaded).toBe(true));

    act(() => {
      result.current.controller.dispatchCommand({
        type: "create-house-outline",
        outlineId: "house-1",
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 4000, y: 0, z: 0 },
          { x: 4000, y: 3000, z: 0 },
          { x: 0, y: 3000, z: 0 },
        ],
      });
    });

    await waitFor(() => expect(saves.length).toBeGreaterThan(0));
    expect(saves.at(-1)?.site.houseOutlines).toHaveLength(1);
  });

  it("stays not-loaded while the load is delayed, then loads once it resolves", async () => {
    let resolveLoad!: (document: ProjectDocument | undefined) => void;
    const saved = emptyDoc("Delayed project");
    const adapter: PersistenceAdapter = {
      load: () => new Promise((resolve) => { resolveLoad = resolve; }),
      save: async () => {},
      clear: async () => {},
    };
    const { result } = setup(adapter);

    expect(result.current.persistence.loaded).toBe(false);
    expect(result.current.controller.document.metadata.name).toBe("Untitled project");

    await act(async () => {
      resolveLoad(saved);
    });

    await waitFor(() => expect(result.current.persistence.loaded).toBe(true));
    expect(result.current.controller.document.metadata.name).toBe("Delayed project");
  });

  it("recovers gracefully when load resolves to undefined (corrupt data already filtered upstream)", async () => {
    const { adapter } = createFakeAdapter(undefined);
    const { result } = setup(adapter);

    await waitFor(() => expect(result.current.persistence.loaded).toBe(true));
    expect(result.current.controller.document.metadata.name).toBe("Untitled project");
    expect(result.current.persistence.error).toBeNull();
  });

  it("exposes an error and still unblocks editing when load rejects", async () => {
    const adapter: PersistenceAdapter = {
      load: () => Promise.reject(new Error("IndexedDB unavailable")),
      save: async () => {},
      clear: async () => {},
    };
    const { result } = setup(adapter);

    await waitFor(() => expect(result.current.persistence.loaded).toBe(true));
    expect(result.current.persistence.error).toMatch(/IndexedDB unavailable/);
  });

  it("exposes an error when save rejects, without crashing or blocking later saves", async () => {
    const { saves } = createFakeAdapter(undefined);
    let failNext = true;
    const adapter: PersistenceAdapter = {
      load: async () => undefined,
      save: async (document) => {
        if (failNext) {
          failNext = false;
          throw new Error("disk full");
        }
        saves.push(document);
      },
      clear: async () => {},
    };
    const { result } = setup(adapter);
    await waitFor(() => expect(result.current.persistence.loaded).toBe(true));

    act(() => {
      result.current.controller.dispatchCommand({
        type: "create-house-outline",
        outlineId: "house-1",
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 4000, y: 0, z: 0 },
          { x: 4000, y: 3000, z: 0 },
          { x: 0, y: 3000, z: 0 },
        ],
      });
    });
    await waitFor(() => expect(result.current.persistence.error).toMatch(/disk full/));

    act(() => {
      result.current.controller.dispatchCommand({
        type: "move-house-outline-vertex",
        outlineId: "house-1",
        vertexIndex: 0,
        position: { x: -100, y: -100, z: 0 },
      });
    });
    await waitFor(() => expect(saves.length).toBeGreaterThan(0));
  });

  it("serializes rapid consecutive saves and persists only the latest document (no reordering)", async () => {
    const pending: Array<{ document: ProjectDocument; resolve: () => void }> = [];
    const committed: ProjectDocument[] = [];
    const adapter: PersistenceAdapter = {
      load: async () => undefined,
      save: (document) =>
        new Promise((resolve) => {
          pending.push({
            document,
            resolve: () => {
              committed.push(document);
              resolve();
            },
          });
        }),
      clear: async () => {},
    };
    const { result } = setup(adapter);
    await waitFor(() => expect(result.current.persistence.loaded).toBe(true));

    act(() => {
      result.current.controller.dispatchCommand({
        type: "create-house-outline",
        outlineId: "house-1",
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 4000, y: 0, z: 0 },
          { x: 4000, y: 3000, z: 0 },
          { x: 0, y: 3000, z: 0 },
        ],
      });
    });
    await waitFor(() => expect(pending.length).toBeGreaterThan(0));

    // A second command lands while the first save is still in-flight.
    act(() => {
      result.current.controller.dispatchCommand({
        type: "move-house-outline-vertex",
        outlineId: "house-1",
        vertexIndex: 0,
        position: { x: -500, y: -500, z: 0 },
      });
    });
    const finalDocument = result.current.controller.document;

    // At most one save is in-flight at a time (serialized), even though a
    // second document change happened before the first save resolved.
    expect(pending.length).toBe(1);

    await act(async () => {
      pending[0]!.resolve();
    });

    // The coalescing loop picks up the latest pending document next.
    await waitFor(() => expect(pending.length).toBeGreaterThan(1));
    await act(async () => {
      pending.at(-1)!.resolve();
    });

    await waitFor(() => expect(committed.length).toBeGreaterThanOrEqual(1));
    expect(committed.at(-1)).toEqual(finalDocument);
  });
});
