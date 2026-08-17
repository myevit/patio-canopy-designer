import { useEffect, useMemo, useReducer, useRef } from "react";
import { buildCutFabrication, buildMemberSchedule, buildScene, toBomCsv, type SceneJointCandidate } from "@canopy/geometry";
import {
  DEFAULT_BEAM_SECTION_ID,
  DEFAULT_POST_SECTION_ID,
  SAMPLE_PROJECT,
  createEmptyProjectDocument,
  deriveFanFieldGeometry,
  exportProjectDocument,
  findTopologyIssues,
  importProjectDocument,
  type CrossingBehavior,
  type DocumentCommand,
  type EngineeringStatus,
  type FanTarget,
  type Section,
  type Vector3Mm,
} from "@canopy/shared";
import { BomPanel } from "./components/BomPanel.js";
import { BottomDrawer } from "./components/BottomDrawer.js";
import { CutsPanel } from "./components/CutsPanel.js";
import {
  Inspector,
  type BeamPatch,
  type CommandOutcome,
  type FanFieldPatch,
  type GutterPatch,
  type JointPatch,
  type PostPatch,
  type RoofPlanePatch,
} from "./components/Inspector.js";
import { PlanView } from "./components/PlanView.js";
import { ProjectMenu } from "./components/ProjectMenu.js";
import { StatusBar } from "./components/StatusBar.js";
import { ThreeView } from "./components/ThreeView.js";
import { TopologyDiagnosticsPanel } from "./components/TopologyDiagnosticsPanel.js";
import { Toolbar } from "./components/Toolbar.js";
import { ViewModeSwitcher } from "./components/ViewModeSwitcher.js";
import { createDexiePersistenceAdapter } from "./persistence/dexie-persistence-adapter.js";
import type { PersistenceAdapter } from "./persistence/persistence-adapter.js";
import { useProjectPersistence } from "./persistence/use-project-persistence.js";
import { distance2D } from "./scene/geometry-helpers.js";
import { findSceneObject } from "./scene/scene-selectors.js";
import { createFanDraft, fanDraftDistribution, fanDraftElevationRule, type FanDraft } from "./state/fan-draft.js";
import type { SelectedVertex } from "./state/selected-vertex.js";
import { initialStudioState, studioReducer } from "./state/studio-store.js";
import { useDocumentController } from "./state/use-document-controller.js";

function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

const DEFAULT_PITCH_RAD = (5 * Math.PI) / 180;
const DEFAULT_GUTTER_WIDTH_MM = 100;
const DEFAULT_GUTTER_DROP_MM = 50;
const DEFAULT_POST_HEIGHT_MM = 2400;
const HOUSE_ANCHOR_REUSE_TOLERANCE_MM = 100;

function resolveDefaultSectionId(sections: Section[], preferredId: string): string {
  return sections.find((s) => s.id === preferredId)?.id ?? sections[0]?.id ?? preferredId;
}

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
  const topologyIssues = useMemo(
    () => findTopologyIssues(documentController.document),
    [documentController.document],
  );
  const memberSchedule = useMemo(
    () => buildMemberSchedule(documentController.document),
    [documentController.document],
  );
  const cutCards = useMemo(() => buildCutFabrication(documentController.document), [documentController.document]);

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

  const latestRef = useRef({ state, dispatch, closeDrawing, handleDeleteVertex, handleDeleteSelectedObject });
  latestRef.current = { state, dispatch, closeDrawing, handleDeleteVertex, handleDeleteSelectedObject };

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
        return;
      }
      if (current.state.selectedObjectId && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        current.handleDeleteSelectedObject(current.state.selectedObjectId);
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

  const fanFieldForSelected = useMemo(() => {
    if (!state.selectedObjectId) return null;
    return (
      documentController.document.fanFields.find((f) => f.memberIds.includes(state.selectedObjectId!)) ?? null
    );
  }, [documentController.document, state.selectedObjectId]);

  const selectedCandidate = useMemo(() => {
    if (!state.selectedCandidateId) return null;
    return scene.jointCandidates.find((c) => c.id === state.selectedCandidateId) ?? null;
  }, [scene, state.selectedCandidateId]);

  const fanDraft = state.interaction.status === "previewing-fan" ? state.interaction.draft : null;

  const fanPreview = useMemo(() => {
    if (!fanDraft) return null;
    const anchorsById = new Map(documentController.document.anchors.map((a) => [a.id, a]));
    const membersById = new Map(documentController.document.members.map((m) => [m.id, m]));
    const source = anchorsById.get(fanDraft.sourceAnchorId);
    if (!source) return null;
    const geometry = deriveFanFieldGeometry(
      {
        sourceAnchorId: fanDraft.sourceAnchorId,
        target: fanDraft.target,
        distribution: fanDraftDistribution(fanDraft),
        reversed: fanDraft.reversed,
        elevationRule: fanDraftElevationRule(fanDraft),
      },
      anchorsById,
      membersById,
    );
    if (!geometry.ok) return null;
    return { source: source.positionMm, points: geometry.points };
  }, [fanDraft, documentController.document]);

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

  function handlePlacePost(position: Vector3Mm) {
    const sectionId = resolveDefaultSectionId(documentController.document.sections, DEFAULT_POST_SECTION_ID);
    const result = dispatchGatedCommand({
      type: "add-post",
      postId: nextId("post"),
      baseAnchorId: nextId("anchor-base"),
      topAnchorId: nextId("anchor-top"),
      sectionId,
      heightMm: DEFAULT_POST_HEIGHT_MM,
      position,
    });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function handleMovePost(postId: string, position: Vector3Mm): CommandOutcome {
    const post = scene.posts.find((p) => p.id === postId);
    const result = dispatchGatedCommand({
      type: "move-post",
      postId,
      position: { ...position, z: post?.base.z ?? position.z },
    });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
    return result;
  }

  function handleUpdatePost(postId: string, patch: PostPatch): CommandOutcome {
    const result = dispatchGatedCommand({ type: "update-post", postId, patch });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
    return result;
  }

  function handleDuplicatePost(postId: string) {
    const source = documentController.document.posts.find((p) => p.id === postId);
    const baseAnchor = documentController.document.anchors.find((a) => a.id === source?.baseAnchorId);
    if (!source || !baseAnchor) return;
    const result = dispatchGatedCommand({
      type: "add-post",
      postId: nextId("post"),
      baseAnchorId: nextId("anchor-base"),
      topAnchorId: nextId("anchor-top"),
      sectionId: source.sectionId,
      heightMm: source.heightMm,
      position: { ...baseAnchor.positionMm, x: baseAnchor.positionMm.x + 300, y: baseAnchor.positionMm.y + 300 },
    });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function handleDeletePost(postId: string) {
    const result = dispatchGatedCommand({ type: "delete-post", postId });
    if (result.ok) {
      if (state.selectedObjectId === postId) {
        dispatch({ type: "select-object", objectId: null });
      }
    } else {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function handleChooseBeamAnchor(anchorId: string) {
    if (state.interaction.status !== "drawing-beam") return;
    const startAnchorId = state.interaction.startAnchorId;
    if (startAnchorId === null) {
      dispatch({ type: "set-beam-start-anchor", anchorId });
      return;
    }
    if (anchorId === startAnchorId) return;
    const sectionId = resolveDefaultSectionId(documentController.document.sections, DEFAULT_BEAM_SECTION_ID);
    const result = dispatchGatedCommand({
      type: "add-beam",
      memberId: nextId("member"),
      startAnchorId,
      endAnchorId: anchorId,
      sectionId,
    });
    if (result.ok) {
      dispatch({ type: "set-beam-start-anchor", anchorId: null });
    } else {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function handleCreateHouseAnchorOnGutter(gutterId: string, position: Vector3Mm) {
    const existing = scene.houseAnchors.find(
      (anchor) => distance2D(anchor.position, position) <= HOUSE_ANCHOR_REUSE_TOLERANCE_MM,
    );
    if (existing) {
      handleChooseBeamAnchor(existing.id);
      return;
    }
    const anchorId = nextId("anchor-house");
    const result = dispatchGatedCommand({ type: "add-house-anchor", anchorId, position, sourceRef: gutterId });
    if (result.ok) {
      handleChooseBeamAnchor(anchorId);
    } else {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function handleUpdateBeam(memberId: string, patch: BeamPatch): CommandOutcome {
    const result = dispatchGatedCommand({ type: "update-beam", memberId, patch });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
    return result;
  }

  function handleDeleteBeam(memberId: string) {
    const result = dispatchGatedCommand({ type: "delete-beam", memberId });
    if (result.ok) {
      if (state.selectedObjectId === memberId) {
        dispatch({ type: "select-object", objectId: null });
      }
    } else {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function buildDefaultFanDraft(sourceAnchorId: string, target: FanTarget): FanDraft {
    const sectionId = resolveDefaultSectionId(documentController.document.sections, DEFAULT_BEAM_SECTION_ID);
    return createFanDraft(sourceAnchorId, target, sectionId);
  }

  function handleChooseFanAnchor(anchorId: string) {
    if (state.interaction.status !== "drawing-fan") return;
    const { sourceAnchorId, pendingEdgeStartAnchorId } = state.interaction;
    if (sourceAnchorId === null) {
      dispatch({ type: "set-fan-source-anchor", anchorId });
      return;
    }
    if (pendingEdgeStartAnchorId === null) {
      if (anchorId === sourceAnchorId) return;
      dispatch({ type: "set-fan-edge-pending-anchor", anchorId });
      return;
    }
    if (anchorId === pendingEdgeStartAnchorId) return;
    const draft = buildDefaultFanDraft(sourceAnchorId, {
      kind: "edge",
      startAnchorId: pendingEdgeStartAnchorId,
      endAnchorId: anchorId,
    });
    dispatch({ type: "start-fan-preview", draft });
  }

  function handleChooseFanTargetMember(memberId: string) {
    if (state.interaction.status !== "drawing-fan" || state.interaction.sourceAnchorId === null) return;
    const draft = buildDefaultFanDraft(state.interaction.sourceAnchorId, { kind: "member", memberId });
    dispatch({ type: "start-fan-preview", draft });
  }

  function handleUpdateFanDraft(patch: Partial<FanDraft>) {
    dispatch({ type: "update-fan-draft", patch });
  }

  function handleCancelFanPreview() {
    dispatch({ type: "cancel-fan-preview" });
  }

  function handleCommitFanField() {
    if (state.interaction.status !== "previewing-fan") return;
    const draft = state.interaction.draft;
    const result = dispatchGatedCommand({
      type: "add-fan-field",
      fanFieldId: nextId("fan-field"),
      sourceAnchorId: draft.sourceAnchorId,
      target: draft.target,
      distribution: fanDraftDistribution(draft),
      reversed: draft.reversed,
      elevationRule: fanDraftElevationRule(draft),
      memberTemplate: { sectionId: draft.sectionId },
    });
    if (result.ok) {
      dispatch({ type: "select-tool", tool: "select" });
    } else {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function handleUpdateFanField(fanFieldId: string, patch: FanFieldPatch): CommandOutcome {
    const result = dispatchGatedCommand({ type: "update-fan-field", fanFieldId, patch });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
    return result;
  }

  function handleDeleteFanField(fanFieldId: string) {
    const fanField = documentController.document.fanFields.find((f) => f.id === fanFieldId);
    const result = dispatchGatedCommand({ type: "delete-fan-field", fanFieldId });
    if (result.ok) {
      if (fanField && state.selectedObjectId && fanField.memberIds.includes(state.selectedObjectId)) {
        dispatch({ type: "select-object", objectId: null });
      }
    } else {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function handleDeleteJoint(jointId: string) {
    const result = dispatchGatedCommand({ type: "delete-joint", jointId });
    if (result.ok) {
      if (state.selectedObjectId === jointId) {
        dispatch({ type: "select-object", objectId: null });
      }
    } else {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
  }

  function handleSelectCandidate(candidateId: string) {
    dispatch({ type: "select-candidate", candidateId });
  }

  function handleCancelCandidateSelection() {
    dispatch({ type: "select-candidate", candidateId: null });
  }

  function handleConfirmCandidate(
    candidate: SceneJointCandidate,
    crossingBehavior: CrossingBehavior,
    engineeringStatus: EngineeringStatus,
  ): CommandOutcome {
    const jointId = nextId("joint");
    const result = dispatchGatedCommand({
      type: "confirm-joint",
      jointId,
      connectedMemberIds: candidate.memberIds,
      positionMm: candidate.position,
      crossingBehavior,
      engineeringStatus,
    });
    if (result.ok) {
      dispatch({ type: "select-tool", tool: "select" });
      dispatch({ type: "select-object", objectId: jointId });
    } else {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
    return result;
  }

  function handleUpdateJoint(jointId: string, patch: JointPatch): CommandOutcome {
    const result = dispatchGatedCommand({ type: "update-joint", jointId, patch });
    if (!result.ok) {
      dispatch({ type: "set-interaction", interaction: { status: "invalid", reason: result.error } });
    }
    return result;
  }

  function handleFocusJoint(jointId: string) {
    dispatch({ type: "focus-joint", jointId });
    dispatch({ type: "set-view-mode", viewMode: "3d" });
  }

  function handleDeleteSelectedObject(objectId: string) {
    const object = findSceneObject(scene, objectId);
    if (object?.kind === "post") {
      handleDeletePost(objectId);
    } else if (object?.kind === "member") {
      handleDeleteBeam(objectId);
    } else if (object?.kind === "joint") {
      handleDeleteJoint(objectId);
    }
  }

  function handleNewProject() {
    documentController.resetTo(
      createEmptyProjectDocument({ name: "Untitled project", createdAt: new Date().toISOString() }),
    );
    dispatch({ type: "select-tool", tool: "select" });
    dispatch({ type: "select-object", objectId: null });
  }

  function handleExport() {
    if (topologyIssues.length > 0) {
      dispatch({
        type: "set-interaction",
        interaction: { status: "invalid", reason: "Resolve topology issues before exporting." },
      });
      return;
    }
    const json = exportProjectDocument(documentController.document);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${documentController.document.metadata.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadBomCsv() {
    const csv = toBomCsv(memberSchedule.rows, documentController.document.sections, documentController.document.materials);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${documentController.document.metadata.name.replace(/\s+/g, "-").toLowerCase()}-bom.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handlePrintBom() {
    window.print();
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
          canExport={topologyIssues.length === 0}
          exportBlockedReason="Resolve topology issues before exporting."
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
        {state.focusedJointId && (
          <button type="button" onClick={() => dispatch({ type: "clear-joint-focus" })}>
            Exit focus
          </button>
        )}
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
              onPlacePost={handlePlacePost}
              onMovePost={handleMovePost}
              beamStartAnchorId={state.interaction.status === "drawing-beam" ? state.interaction.startAnchorId : null}
              onChooseBeamAnchor={handleChooseBeamAnchor}
              onCreateHouseAnchorOnGutter={handleCreateHouseAnchorOnGutter}
              onChooseFanAnchor={handleChooseFanAnchor}
              onChooseFanTargetMember={handleChooseFanTargetMember}
              fanPreview={fanPreview}
              onSelectCandidate={handleSelectCandidate}
            />
          )}
          {showThree && (
            <ThreeView
              scene={scene}
              selectedObjectId={state.selectedObjectId}
              onSelect={(objectId) => dispatch({ type: "select-object", objectId })}
              tool={state.tool}
              onChooseBeamAnchor={handleChooseBeamAnchor}
              onChooseFanAnchor={handleChooseFanAnchor}
              onChooseFanTargetMember={handleChooseFanTargetMember}
              onSelectCandidate={handleSelectCandidate}
              focusedJointId={state.focusedJointId}
            />
          )}
        </main>
        <div className="studio-shell__sidebar">
          <TopologyDiagnosticsPanel issues={topologyIssues} />
          <Inspector
            selected={selected}
            selectedVertex={state.selectedVertex}
            vertexOutline={vertexOutline}
            roofPlane={roofPlaneForSelected}
            gutter={gutterForSelectedRoofPlane}
            drawingPoints={drawingPoints}
            sections={documentController.document.sections}
            tool={state.tool}
            onMoveVertex={handleMoveVertex}
            onDeleteVertex={handleDeleteVertex}
            onAddRoofPlane={handleAddRoofPlane}
            onUpdateRoofPlane={handleUpdateRoofPlane}
            onUpdateGutter={handleUpdateGutter}
            onAddDrawingPoint={(point) => dispatch({ type: "add-outline-point", point })}
            onRemoveLastDrawingPoint={() => dispatch({ type: "remove-last-outline-point" })}
            onCloseDrawing={closeDrawing}
            onPlacePost={handlePlacePost}
            onMovePost={handleMovePost}
            onUpdatePost={handleUpdatePost}
            onDuplicatePost={handleDuplicatePost}
            onDeletePost={handleDeletePost}
            onUpdateBeam={handleUpdateBeam}
            onDeleteBeam={handleDeleteBeam}
            fanDraft={fanDraft}
            onUpdateFanDraft={handleUpdateFanDraft}
            onCommitFanField={handleCommitFanField}
            onCancelFanPreview={handleCancelFanPreview}
            fanFieldForSelected={fanFieldForSelected}
            onUpdateFanField={handleUpdateFanField}
            onDeleteFanField={handleDeleteFanField}
            onDeleteJoint={handleDeleteJoint}
            unresolvedCandidates={scene.jointCandidates}
            selectedCandidate={selectedCandidate}
            onSelectCandidate={handleSelectCandidate}
            onCancelCandidateSelection={handleCancelCandidateSelection}
            onConfirmCandidate={handleConfirmCandidate}
            onUpdateJoint={handleUpdateJoint}
            onFocusJoint={handleFocusJoint}
          />
        </div>
      </div>

      <StatusBar tool={state.tool} interaction={state.interaction} persistenceError={persistence.error} />

      <BottomDrawer
        open={state.drawerOpen}
        tab={state.drawerTab}
        onSelectTab={(tab) => dispatch({ type: "set-drawer-tab", tab })}
        onToggleOpen={() => dispatch({ type: "toggle-drawer" })}
        bomContent={
          <BomPanel
            schedule={memberSchedule}
            sections={documentController.document.sections}
            materials={documentController.document.materials}
            displayUnits={documentController.document.displayUnits}
            onDownloadCsv={handleDownloadBomCsv}
            onPrint={handlePrintBom}
            onSelectObject={(objectId) => dispatch({ type: "select-object", objectId })}
          />
        }
        cutsContent={<CutsPanel cards={cutCards} />}
      />
    </div>
  );
}
