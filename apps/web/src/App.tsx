import { useEffect, useMemo, useReducer, useRef } from "react";
import { buildScene } from "@canopy/geometry";
import {
  SAMPLE_PROJECT,
  createEmptyProjectDocument,
  exportProjectDocument,
  importProjectDocument,
  type DocumentCommand,
} from "@canopy/shared";
import { BottomDrawer } from "./components/BottomDrawer.js";
import { Inspector, type CommandOutcome, type GutterPatch, type RoofPlanePatch } from "./components/Inspector.js";
import { PlanView } from "./components/PlanView.js";
import { ProjectMenu } from "./components/ProjectMenu.js";
import { StatusBar } from "./components/StatusBar.js";
import { ThreeView } from "./components/ThreeView.js";
import { Toolbar } from "./components/Toolbar.js";
import { ViewModeSwitcher } from "./components/ViewModeSwitcher.js";
import { createDexiePersistenceAdapter } from "./persistence/dexie-persistence-adapter.js";
import type { PersistenceAdapter } from "./persistence/persistence-adapter.js";
import { useProjectPersistence } from "./persistence/use-project-persistence.js";
import { findSceneObject } from "./scene/scene-selectors.js";
import type { SelectedVertex } from "./state/selected-vertex.js";
import { initialStudioState, studioReducer } from "./state/studio-store.js";
import { useDocumentController } from "./state/use-document-controller.js";

function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

const DEFAULT_PITCH_RAD = (5 * Math.PI) / 180;
const DEFAULT_GUTTER_WIDTH_MM = 100;
const DEFAULT_GUTTER_DROP_MM = 50;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export interface AppProps {
  persistenceAdapter?: PersistenceAdapter;
}

export function App({ persistenceAdapter: providedAdapter }: AppProps = {}) {
  const persistenceAdapter = useMemo(
    () => providedAdapter ?? createDexiePersistenceAdapter(),
    [providedAdapter],
  );

  const [state, dispatch] = useReducer(studioReducer, initialStudioState);
  const documentController = useDocumentController(SAMPLE_PROJECT);
  const persistence = useProjectPersistence(documentController, persistenceAdapter);

  const scene = useMemo(() => buildScene(documentController.document), [documentController.document]);

  function dispatchGatedCommand(command: DocumentCommand): { ok: true } | { ok: false; error: string } {
    if (!persistence.loaded) {
      return { ok: false, error: "The project is still loading. Try again in a moment." };
    }
    return documentController.dispatchCommand(command);
  }

  const drawingPoints = state.interaction.status === "drawing-house-outline" ? state.interaction.points : null;

  function closeDrawing() {
    if (state.interaction.status !== "drawing-house-outline") return;
    const result = dispatchGatedCommand({
      type: "create-house-outline",
      outlineId: nextId("house-outline"),
      points: state.interaction.points,
    });
    if (result.ok) {
      dispatch({ type: "select-tool", tool: "select" });
    } else {
      dispatch({ type: "set-outline-error", error: result.error });
    }
  }

  function handleDeleteVertex(vertex: SelectedVertex) {
    const result = dispatchGatedCommand({
      type: "delete-house-outline-vertex",
      outlineId: vertex.outlineId,
      vertexIndex: vertex.index,
    });
    if (result.ok) {
      dispatch({ type: "select-vertex", vertex: null });
    } else {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  const latestRef = useRef({ state, dispatch, closeDrawing, handleDeleteVertex });
  latestRef.current = { state, dispatch, closeDrawing, handleDeleteVertex };

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      const current = latestRef.current;

      if (event.key === "Escape") {
        current.dispatch({ type: "escape" });
        return;
      }
      if (current.state.interaction.status === "drawing-house-outline") {
        if (event.key === "Enter" && current.state.interaction.points.length >= 3) {
          event.preventDefault();
          current.closeDrawing();
        } else if (event.key === "Backspace") {
          event.preventDefault();
          current.dispatch({ type: "remove-last-outline-point" });
        }
        return;
      }
      if (current.state.selectedVertex && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        current.handleDeleteVertex(current.state.selectedVertex);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selected = useMemo(
    () => findSceneObject(scene, state.selectedObjectId),
    [scene, state.selectedObjectId],
  );

  const vertexOutline = useMemo(() => {
    if (!state.selectedVertex) return undefined;
    return scene.houseOutlines.find((outline) => outline.id === state.selectedVertex!.outlineId);
  }, [scene, state.selectedVertex]);

  const roofPlaneForSelected = useMemo(() => {
    if (selected?.kind !== "house-outline") return null;
    return scene.roofPlanes.find((roofPlane) => roofPlane.houseOutlineId === selected.id) ?? null;
  }, [scene, selected]);

  const gutterForSelectedRoofPlane = useMemo(() => {
    if (!roofPlaneForSelected) return null;
    return scene.gutters.find((gutter) => gutter.roofPlaneId === roofPlaneForSelected.id) ?? null;
  }, [scene, roofPlaneForSelected]);

  function handleMoveVertex(vertex: SelectedVertex, position: { x: number; y: number; z: number }): CommandOutcome {
    const result = dispatchGatedCommand({
      type: "move-house-outline-vertex",
      outlineId: vertex.outlineId,
      vertexIndex: vertex.index,
      position,
    });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
    return result;
  }

  function handleInsertVertex(outlineId: string, afterIndex: number, position: { x: number; y: number; z: number }) {
    const result = dispatchGatedCommand({
      type: "insert-house-outline-vertex",
      outlineId,
      afterIndex,
      position,
    });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function handleAddRoofPlane(houseOutlineId: string) {
    const result = dispatchGatedCommand({
      type: "add-roof-plane",
      roofPlaneId: nextId("roof-plane"),
      houseOutlineId,
      referenceElevationMm: 2400,
      pitchRad: DEFAULT_PITCH_RAD,
      directionRad: 0,
      gutterId: nextId("gutter"),
      gutterWidthMm: DEFAULT_GUTTER_WIDTH_MM,
      gutterDropMm: DEFAULT_GUTTER_DROP_MM,
    });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function handleUpdateRoofPlane(roofPlaneId: string, patch: RoofPlanePatch): CommandOutcome {
    const result = dispatchGatedCommand({ type: "update-roof-plane", roofPlaneId, patch });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
    return result;
  }

  function handleUpdateGutter(gutterId: string, patch: GutterPatch): CommandOutcome {
    const result = dispatchGatedCommand({ type: "update-gutter", gutterId, patch });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
    return result;
  }

  function handleNewProject() {
    documentController.resetTo(
      createEmptyProjectDocument({ name: "Untitled project", createdAt: new Date().toISOString() }),
    );
    dispatch({ type: "select-tool", tool: "select" });
    dispatch({ type: "select-object", objectId: null });
  }

  function handleExport() {
    const json = exportProjectDocument(documentController.document);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${documentController.document.metadata.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(file: File) {
    void file.text().then((text) => {
      const result = importProjectDocument(text);
      if (result.success) {
        documentController.resetTo(result.document);
        dispatch({ type: "select-tool", tool: "select" });
        dispatch({ type: "select-object", objectId: null });
      } else {
        dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
      }
    });
  }

  const showPlan = state.viewMode === "plan" || state.viewMode === "split";
  const showThree = state.viewMode === "3d" || state.viewMode === "split";

  return (
    <div className="studio-shell">
      <header className="studio-shell__top-bar">
        <Toolbar activeTool={state.tool} onSelectTool={(tool) => dispatch({ type: "select-tool", tool })} />
        <ProjectMenu
          canUndo={documentController.canUndo}
          canRedo={documentController.canRedo}
          onNew={handleNewProject}
          onExport={handleExport}
          onImport={handleImport}
          onUndo={documentController.undo}
          onRedo={documentController.redo}
        />
        <ViewModeSwitcher
          viewMode={state.viewMode}
          onSelectViewMode={(viewMode) => dispatch({ type: "set-view-mode", viewMode })}
        />
      </header>

      <div className="studio-shell__body">
        <main className={state.viewMode === "split" ? "studio-shell__views studio-shell__views--split" : "studio-shell__views"}>
          {showPlan && (
            <PlanView
              scene={scene}
              selectedObjectId={state.selectedObjectId}
              onSelect={(objectId) => dispatch({ type: "select-object", objectId })}
              selectedVertex={state.selectedVertex}
              tool={state.tool}
              drawingPoints={drawingPoints}
              onSelectVertex={(vertex) => dispatch({ type: "select-vertex", vertex })}
              onAddDrawingPoint={(point) => dispatch({ type: "add-outline-point", point })}
              onCloseDrawing={closeDrawing}
              onMoveVertex={handleMoveVertex}
              onInsertVertex={handleInsertVertex}
            />
          )}
          {showThree && (
            <ThreeView
              scene={scene}
              selectedObjectId={state.selectedObjectId}
              onSelect={(objectId) => dispatch({ type: "select-object", objectId })}
            />
          )}
        </main>
        <Inspector
          selected={selected}
          selectedVertex={state.selectedVertex}
          vertexOutline={vertexOutline}
          roofPlane={roofPlaneForSelected}
          gutter={gutterForSelectedRoofPlane}
          drawingPoints={drawingPoints}
          onMoveVertex={handleMoveVertex}
          onDeleteVertex={handleDeleteVertex}
          onAddRoofPlane={handleAddRoofPlane}
          onUpdateRoofPlane={handleUpdateRoofPlane}
          onUpdateGutter={handleUpdateGutter}
          onAddDrawingPoint={(point) => dispatch({ type: "add-outline-point", point })}
          onRemoveLastDrawingPoint={() => dispatch({ type: "remove-last-outline-point" })}
          onCloseDrawing={closeDrawing}
        />
      </div>

      <StatusBar tool={state.tool} interaction={state.interaction} persistenceError={persistence.error} />

      <BottomDrawer
        open={state.drawerOpen}
        tab={state.drawerTab}
        onSelectTab={(tab) => dispatch({ type: "set-drawer-tab", tab })}
        onToggleOpen={() => dispatch({ type: "toggle-drawer" })}
      />
    </div>
  );
}
