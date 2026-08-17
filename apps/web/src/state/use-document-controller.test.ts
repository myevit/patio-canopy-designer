import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createEmptyProjectDocument } from "@canopy/shared";
import { useDocumentController } from "./use-document-controller.js";

function rectanglePoints() {
  return [
    { x: 0, y: 0, z: 0 },
    { x: 4000, y: 0, z: 0 },
    { x: 4000, y: 3000, z: 0 },
    { x: 0, y: 3000, z: 0 },
  ];
}

function setup() {
  const initial = createEmptyProjectDocument({ name: "Untitled project", createdAt: "2026-08-16T00:00:00.000Z" });
  return renderHook(() => useDocumentController(initial));
}

describe("useDocumentController", () => {
  it("starts with the initial document and no undo/redo available", () => {
    const { result } = setup();
    expect(result.current.document.site.houseOutlines).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("applies a successful command and updates the document", () => {
    const { result } = setup();
    act(() => {
      const outcome = result.current.dispatchCommand({
        type: "create-house-outline",
        outlineId: "house-1",
        points: rectanglePoints(),
      });
      expect(outcome.ok).toBe(true);
    });
    expect(result.current.document.site.houseOutlines).toHaveLength(1);
    expect(result.current.canUndo).toBe(true);
  });

  it("returns a recoverable error and leaves the document unchanged when a command is rejected", () => {
    const { result } = setup();
    let outcome: { ok: true } | { ok: false; error: string } | undefined;
    act(() => {
      outcome = result.current.dispatchCommand({
        type: "move-house-outline-vertex",
        outlineId: "missing",
        vertexIndex: 0,
        position: { x: 0, y: 0, z: 0 },
      });
    });
    expect(outcome?.ok).toBe(false);
    expect(result.current.document.site.houseOutlines).toEqual([]);
  });

  it("undo and redo move through history", () => {
    const { result } = setup();
    act(() => {
      result.current.dispatchCommand({ type: "create-house-outline", outlineId: "house-1", points: rectanglePoints() });
    });
    expect(result.current.document.site.houseOutlines).toHaveLength(1);

    act(() => {
      result.current.undo();
    });
    expect(result.current.document.site.houseOutlines).toHaveLength(0);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });
    expect(result.current.document.site.houseOutlines).toHaveLength(1);
  });

  it("resetTo replaces the document and clears history", () => {
    const { result } = setup();
    act(() => {
      result.current.dispatchCommand({ type: "create-house-outline", outlineId: "house-1", points: rectanglePoints() });
    });
    const fresh = createEmptyProjectDocument({ name: "Another project", createdAt: "2026-08-16T00:00:00.000Z" });
    act(() => {
      result.current.resetTo(fresh);
    });
    expect(result.current.document).toEqual(fresh);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
