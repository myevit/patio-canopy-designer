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
});
