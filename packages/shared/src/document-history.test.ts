import { describe, expect, it } from "vitest";
import { createEmptyProjectDocument } from "./empty-project.js";
import { canRedo, canUndo, createHistory, pushCommand, redo, undo } from "./document-history.js";

function baseDoc() {
  return createEmptyProjectDocument({ name: "Untitled project", createdAt: "2026-08-16T00:00:00.000Z" });
}

function rectanglePoints() {
  return [
    { x: 0, y: 0, z: 0 },
    { x: 4000, y: 0, z: 0 },
    { x: 4000, y: 3000, z: 0 },
    { x: 0, y: 3000, z: 0 },
  ];
}

describe("document history", () => {
  it("starts with no undo/redo available", () => {
    const history = createHistory(baseDoc());
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it("pushes a successful command onto history and clears future", () => {
    const history = createHistory(baseDoc());
    const result = pushCommand(history, { type: "create-house-outline", outlineId: "house-1", points: rectanglePoints() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.history.present.site.houseOutlines).toHaveLength(1);
      expect(canUndo(result.history)).toBe(true);
      expect(canRedo(result.history)).toBe(false);
    }
  });

  it("leaves history unchanged when a command is rejected", () => {
    const history = createHistory(baseDoc());
    const result = pushCommand(history, {
      type: "move-house-outline-vertex",
      outlineId: "missing",
      vertexIndex: 0,
      position: { x: 0, y: 0, z: 0 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.history).toBe(history);
      expect(result.error).toContain("Unknown house outline id");
    }
  });

  it("undo restores the exact previous document and enables redo", () => {
    const history = createHistory(baseDoc());
    const afterCreate = pushCommand(history, { type: "create-house-outline", outlineId: "house-1", points: rectanglePoints() });
    if (!afterCreate.ok) throw new Error("setup failed");
    const undone = undo(afterCreate.history);
    expect(undone.present).toEqual(history.present);
    expect(canUndo(undone)).toBe(false);
    expect(canRedo(undone)).toBe(true);
  });

  it("redo reapplies the exact document that was undone", () => {
    const history = createHistory(baseDoc());
    const afterCreate = pushCommand(history, { type: "create-house-outline", outlineId: "house-1", points: rectanglePoints() });
    if (!afterCreate.ok) throw new Error("setup failed");
    const undone = undo(afterCreate.history);
    const redone = redo(undone);
    expect(redone.present).toEqual(afterCreate.history.present);
    expect(canUndo(redone)).toBe(true);
    expect(canRedo(redone)).toBe(false);
  });

  it("undo is a no-op at the start of history", () => {
    const history = createHistory(baseDoc());
    expect(undo(history)).toBe(history);
  });

  it("redo is a no-op with no future", () => {
    const history = createHistory(baseDoc());
    expect(redo(history)).toBe(history);
  });

  it("a new command after undo discards the redo branch", () => {
    const history = createHistory(baseDoc());
    const afterCreate = pushCommand(history, { type: "create-house-outline", outlineId: "house-1", points: rectanglePoints() });
    if (!afterCreate.ok) throw new Error("setup failed");
    const undone = undo(afterCreate.history);
    const afterOtherCreate = pushCommand(undone, {
      type: "create-house-outline",
      outlineId: "house-2",
      points: rectanglePoints().map((p) => ({ ...p, x: p.x + 10000 })),
    });
    if (!afterOtherCreate.ok) throw new Error("setup failed");
    expect(canRedo(afterOtherCreate.history)).toBe(false);
    expect(afterOtherCreate.history.present.site.houseOutlines[0]!.id).toBe("house-2");
  });
});
