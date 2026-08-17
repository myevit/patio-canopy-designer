import { useEffect, useMemo, useReducer } from "react";
import { buildScene } from "@canopy/geometry";
import {
  SAMPLE_PROJECT,
  createEmptyProjectDocument,
  exportProjectDocument,
  importProjectDocument,
  type Gutter,
} from "@canopy/shared";
import { BottomDrawer } from "./components/BottomDrawer.js";
import { Inspector, type RoofPlanePatch } from "./components/Inspector.js";
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

const DEFAULT_GUTTER: Gutter = { widthMm: 100, dropMm: 50 };

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
  useProjectPersistence(documentController, persistenceAdapter);

  const scene = useMemo(() => buildScene(documentController.document), [documentController.document]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dispatch({ type: "escape" });
        return;
      }
      if (state.interaction.status === "drawing-house-outline") {
        if (event.key === "Enter" && state.interaction.points.length >= 3) {
          event.preventDefault();
          closeDrawing();
        } else if (event.key === "Backspace") {
          event.preventDefault();
          dispatch({ type: "remove-last-outline-point" });
        }
        return;
      }
      if (state.selectedVertex && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        handleDeleteVertex(state.selectedVertex);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.interaction, state.selectedVertex]);

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

  const drawingPoints = state.interaction.status === "drawing-house-outline" ? state.interaction.points : null;

  function closeDrawing() {
    if (state.interaction.status !== "drawing-house-outline") return;
    const result = documentController.dispatchCommand({
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

  function handleMoveVertex(vertex: SelectedVertex, position: { x: number; y: number; z: number }) {
    const result = documentController.dispatchCommand({
      type: "move-house-outline-vertex",
      outlineId: vertex.outlineId,
      vertexIndex: vertex.index,
      position,
    });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function handleInsertVertex(outlineId: string, afterIndex: number, position: { x: number; y: number; z: number }) {
    const result = documentController.dispatchCommand({
      type: "insert-house-outline-vertex",
      outlineId,
      afterIndex,
      position,
    });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function handleDeleteVertex(vertex: SelectedVertex) {
    const result = documentController.dispatchCommand({
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

  function handleAddRoofPlane(houseOutlineId: string) {
    documentController.dispatchCommand({
      type: "add-roof-plane",
      roofPlaneId: nextId("roof-plane"),
      houseOutlineId,
      referenceElevationMm: 2400,
      pitchDeg: 5,
      directionRad: 0,
      gutter: DEFAULT_GUTTER,
    });
  }

  function handleUpdateRoofPlane(roofPlaneId: string, patch: RoofPlanePatch) {
    documentController.dispatchCommand({ type: "update-roof-plane", roofPlaneId, patch });
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
          onMoveVertex={handleMoveVertex}
          onDeleteVertex={handleDeleteVertex}
          onAddRoofPlane={handleAddRoofPlane}
          onUpdateRoofPlane={handleUpdateRoofPlane}
        />
      </div>

      <StatusBar tool={state.tool} interaction={state.interaction} />

      <BottomDrawer
        open={state.drawerOpen}
        tab={state.drawerTab}
        onSelectTab={(tab) => dispatch({ type: "set-drawer-tab", tab })}
        onToggleOpen={() => dispatch({ type: "toggle-drawer" })}
      />
    </div>
  );
}
