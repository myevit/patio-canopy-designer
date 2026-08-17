import { useEffect, useId, useRef, useState } from "react";
import type { SceneGutter, SceneObject, SceneRoofPlane } from "@canopy/geometry";
import type { FanDistribution, FanElevationRule, FanField, Section, Vector3Mm } from "@canopy/shared";
import type { FanDraft } from "../state/fan-draft.js";
import type { SelectedVertex } from "../state/selected-vertex.js";
import type { ToolId } from "../state/tool.js";

const MEMBER_ROLE_LABELS: Record<string, string> = {
  ledger: "Ledger",
  "perimeter-beam": "Perimeter beam",
  "fan-rafter": "Fan rafter",
};

function formatPoint(point: Vector3Mm): string {
  return `x ${point.x} mm, y ${point.y} mm, z ${point.z} mm`;
}

export interface RoofPlanePatch {
  referenceElevationMm?: number;
  pitchRad?: number;
  directionRad?: number;
}

export interface GutterPatch {
  widthMm?: number;
  dropMm?: number;
}

export type CommandOutcome = { ok: boolean; error?: string } | void;

interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => CommandOutcome;
}

function NumberField({ label, value, onCommit }: NumberFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(String(value));
    setError(null);
  }, [value]);

  function commit() {
    // Read valueAsNumber (not the raw text) so an empty or otherwise
    // browser-sanitized field reliably reports NaN instead of being
    // silently parsed as 0.
    const parsed = inputRef.current?.valueAsNumber ?? Number.NaN;
    if (!Number.isFinite(parsed)) {
      setError("Enter a finite number.");
      setText(String(value));
      return;
    }
    const outcome = onCommit(parsed);
    if (outcome && !outcome.ok) {
      setError(outcome.error ?? "That value was rejected.");
      setText(String(value));
      return;
    }
    setError(null);
  }

  return (
    <p className="inspector__field">
      <label htmlFor={id}>{label}</label>
      <input
        ref={inputRef}
        id={id}
        type="number"
        value={text}
        aria-invalid={error ? true : undefined}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
      {error && <span role="alert">{error}</span>}
    </p>
  );
}

interface SectionFieldProps {
  sections: Section[];
  sectionId: string;
  onCommit: (sectionId: string) => void;
}

function SectionField({ sections, sectionId, onCommit }: SectionFieldProps) {
  const id = useId();
  const hasSection = sections.some((section) => section.id === sectionId);

  if (!hasSection) {
    return (
      <p className="inspector__field">
        <label htmlFor={id}>Section</label>
        <select id={id} value={sectionId} disabled aria-invalid={true}>
          <option value={sectionId}>Unknown section</option>
        </select>
        <span role="alert">
          Section &quot;{sectionId}&quot; is not in this document. Fix the reference before changing it.
        </span>
      </p>
    );
  }

  return (
    <p className="inspector__field">
      <label htmlFor={id}>Section</label>
      <select id={id} value={sectionId} onChange={(event) => onCommit(event.target.value)}>
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.name}
          </option>
        ))}
      </select>
    </p>
  );
}

interface HouseDrawingPanelProps {
  points: Vector3Mm[];
  onAddPoint: (point: Vector3Mm) => void;
  onRemoveLastPoint: () => void;
  onCloseOutline: () => void;
}

function HouseDrawingPanel({ points, onAddPoint, onRemoveLastPoint, onCloseOutline }: HouseDrawingPanelProps) {
  const xId = useId();
  const yId = useId();
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");

  function handleAddPoint() {
    const parsedX = Number(x);
    const parsedY = Number(y);
    if (!Number.isFinite(parsedX) || !Number.isFinite(parsedY)) return;
    onAddPoint({ x: parsedX, y: parsedY, z: 0 });
  }

  return (
    <div className="inspector__drawing-panel">
      <h3>Draw house outline</h3>
      <p className="inspector__field">
        <label htmlFor={xId}>X (mm)</label>
        <input id={xId} type="number" value={x} onChange={(event) => setX(event.target.value)} />
      </p>
      <p className="inspector__field">
        <label htmlFor={yId}>Y (mm)</label>
        <input id={yId} type="number" value={y} onChange={(event) => setY(event.target.value)} />
      </p>
      <button type="button" onClick={handleAddPoint}>
        Add point
      </button>
      <button type="button" onClick={onRemoveLastPoint} disabled={points.length === 0}>
        Remove last point
      </button>
      <button type="button" onClick={onCloseOutline} disabled={points.length < 3}>
        Close outline
      </button>
      <ul>
        {points.map((point, index) => (
          <li key={index}>
            Point {index + 1}: ({point.x}, {point.y})
          </li>
        ))}
      </ul>
    </div>
  );
}

interface PostPlacementPanelProps {
  onPlacePost: (position: Vector3Mm) => void;
}

function PostPlacementPanel({ onPlacePost }: PostPlacementPanelProps) {
  const xId = useId();
  const yId = useId();
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");

  function handleAddPost() {
    const parsedX = Number(x);
    const parsedY = Number(y);
    if (!Number.isFinite(parsedX) || !Number.isFinite(parsedY)) return;
    onPlacePost({ x: parsedX, y: parsedY, z: 0 });
  }

  function handleClear() {
    setX("0");
    setY("0");
  }

  return (
    <div className="inspector__drawing-panel">
      <h3>Place post</h3>
      <p className="inspector__field">
        <label htmlFor={xId}>X (mm)</label>
        <input id={xId} type="number" value={x} onChange={(event) => setX(event.target.value)} />
      </p>
      <p className="inspector__field">
        <label htmlFor={yId}>Y (mm)</label>
        <input id={yId} type="number" value={y} onChange={(event) => setY(event.target.value)} />
      </p>
      <button type="button" onClick={handleAddPost}>
        Add post
      </button>
      <button type="button" onClick={handleClear}>
        Clear
      </button>
    </div>
  );
}

export interface FanFieldMemberTemplatePatch {
  sectionId?: string;
}

export interface FanFieldPatch {
  distribution?: FanDistribution;
  reversed?: boolean;
  elevationRule?: FanElevationRule;
  memberTemplate?: FanFieldMemberTemplatePatch;
}

interface FanDistributionFieldsProps {
  distributionMode: "count" | "spacing";
  count: number;
  spacingMm: number;
  onChangeMode: (mode: "count" | "spacing") => void;
  onChangeCount: (count: number) => void;
  onChangeSpacing: (spacingMm: number) => void;
}

function FanDistributionFields({
  distributionMode,
  count,
  spacingMm,
  onChangeMode,
  onChangeCount,
  onChangeSpacing,
}: FanDistributionFieldsProps) {
  const modeId = useId();
  return (
    <>
      <p className="inspector__field">
        <label htmlFor={modeId}>Distribution</label>
        <select
          id={modeId}
          value={distributionMode}
          onChange={(event) => onChangeMode(event.target.value as "count" | "spacing")}
        >
          <option value="count">Member count</option>
          <option value="spacing">Spacing</option>
        </select>
      </p>
      {distributionMode === "count" ? (
        <NumberField label="Count" value={count} onCommit={(value) => onChangeCount(Math.round(value))} />
      ) : (
        <NumberField label="Spacing (mm)" value={spacingMm} onCommit={onChangeSpacing} />
      )}
    </>
  );
}

interface FanElevationFieldsProps {
  elevationMode: "linear" | "parabolic";
  sagMm: number;
  onChangeMode: (mode: "linear" | "parabolic") => void;
  onChangeSag: (sagMm: number) => void;
}

function FanElevationFields({ elevationMode, sagMm, onChangeMode, onChangeSag }: FanElevationFieldsProps) {
  const modeId = useId();
  return (
    <>
      <p className="inspector__field">
        <label htmlFor={modeId}>Elevation rule</label>
        <select
          id={modeId}
          value={elevationMode}
          onChange={(event) => onChangeMode(event.target.value as "linear" | "parabolic")}
        >
          <option value="linear">Linear (ruled)</option>
          <option value="parabolic">Parabolic sag (saddle)</option>
        </select>
      </p>
      {elevationMode === "parabolic" && <NumberField label="Sag (mm)" value={sagMm} onCommit={onChangeSag} />}
    </>
  );
}

interface FanPreviewPanelProps {
  draft: FanDraft;
  sections: Section[];
  onUpdateDraft: (patch: Partial<FanDraft>) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function FanPreviewPanel({ draft, sections, onUpdateDraft, onCommit, onCancel }: FanPreviewPanelProps) {
  return (
    <div className="inspector__drawing-panel">
      <h3>Fan field preview</h3>
      <FanDistributionFields
        distributionMode={draft.distributionMode}
        count={draft.count}
        spacingMm={draft.spacingMm}
        onChangeMode={(distributionMode) => onUpdateDraft({ distributionMode })}
        onChangeCount={(count) => onUpdateDraft({ count })}
        onChangeSpacing={(spacingMm) => onUpdateDraft({ spacingMm })}
      />
      <p className="inspector__field">
        <label>
          <input
            type="checkbox"
            checked={draft.reversed}
            onChange={(event) => onUpdateDraft({ reversed: event.target.checked })}
          />
          Reverse direction
        </label>
      </p>
      <FanElevationFields
        elevationMode={draft.elevationMode}
        sagMm={draft.sagMm}
        onChangeMode={(elevationMode) => onUpdateDraft({ elevationMode })}
        onChangeSag={(sagMm) => onUpdateDraft({ sagMm })}
      />
      {sections.length > 0 && (
        <SectionField
          sections={sections}
          sectionId={draft.sectionId}
          onCommit={(sectionId) => onUpdateDraft({ sectionId })}
        />
      )}
      <button type="button" onClick={onCommit}>
        Commit fan field
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

interface FanFieldEditPanelProps {
  fanField: FanField;
  sections: Section[];
  onUpdate: (patch: FanFieldPatch) => CommandOutcome;
  onDelete: () => void;
}

function FanFieldEditPanel({ fanField, sections, onUpdate, onDelete }: FanFieldEditPanelProps) {
  const distributionMode = fanField.distribution.mode;
  const count = fanField.distribution.mode === "count" ? fanField.distribution.count : 5;
  const spacingMm = fanField.distribution.mode === "spacing" ? fanField.distribution.spacingMm : 600;
  const elevationMode = fanField.elevationRule.kind;
  const sagMm = fanField.elevationRule.kind === "parabolic" ? fanField.elevationRule.sagMm : 150;

  return (
    <div className="inspector__drawing-panel">
      <h3>Fan field</h3>
      <dl>
        <dt>ID</dt>
        <dd>{fanField.id}</dd>
        <dt>Members</dt>
        <dd>{fanField.memberIds.length}</dd>
      </dl>
      <FanDistributionFields
        distributionMode={distributionMode}
        count={count}
        spacingMm={spacingMm}
        onChangeMode={(mode) =>
          onUpdate({ distribution: mode === "count" ? { mode: "count", count } : { mode: "spacing", spacingMm } })
        }
        onChangeCount={(nextCount) => onUpdate({ distribution: { mode: "count", count: nextCount } })}
        onChangeSpacing={(nextSpacingMm) => onUpdate({ distribution: { mode: "spacing", spacingMm: nextSpacingMm } })}
      />
      <p className="inspector__field">
        <label>
          <input
            type="checkbox"
            checked={fanField.reversed}
            onChange={(event) => onUpdate({ reversed: event.target.checked })}
          />
          Reverse direction
        </label>
      </p>
      <FanElevationFields
        elevationMode={elevationMode}
        sagMm={sagMm}
        onChangeMode={(mode) =>
          onUpdate({ elevationRule: mode === "linear" ? { kind: "linear" } : { kind: "parabolic", sagMm } })
        }
        onChangeSag={(nextSagMm) => onUpdate({ elevationRule: { kind: "parabolic", sagMm: nextSagMm } })}
      />
      {sections.length > 0 && (
        <SectionField
          sections={sections}
          sectionId={fanField.memberTemplate.sectionId}
          onCommit={(sectionId) => onUpdate({ memberTemplate: { sectionId } })}
        />
      )}
      <button type="button" onClick={onDelete}>
        Delete fan field
      </button>
    </div>
  );
}

function formatDegrees(radians: number): number {
  return Number(((radians * 180) / Math.PI).toFixed(4));
}

export interface PostPatch {
  heightMm?: number;
  sectionId?: string;
}

export interface BeamPatch {
  sectionId?: string;
  rollRad?: number;
}

export interface InspectorProps {
  selected: SceneObject | undefined;
  selectedVertex?: SelectedVertex | null;
  vertexOutline?: Extract<SceneObject, { kind: "house-outline" }>;
  roofPlane?: SceneRoofPlane | null;
  gutter?: SceneGutter | null;
  drawingPoints?: Vector3Mm[] | null;
  sections?: Section[];
  tool?: ToolId;
  onMoveVertex?: (vertex: SelectedVertex, position: Vector3Mm) => CommandOutcome;
  onDeleteVertex?: (vertex: SelectedVertex) => void;
  onAddRoofPlane?: (houseOutlineId: string) => void;
  onUpdateRoofPlane?: (roofPlaneId: string, patch: RoofPlanePatch) => CommandOutcome;
  onUpdateGutter?: (gutterId: string, patch: GutterPatch) => CommandOutcome;
  onAddDrawingPoint?: (point: Vector3Mm) => void;
  onRemoveLastDrawingPoint?: () => void;
  onCloseDrawing?: () => void;
  onPlacePost?: (position: Vector3Mm) => void;
  onMovePost?: (postId: string, position: Vector3Mm) => CommandOutcome;
  onUpdatePost?: (postId: string, patch: PostPatch) => CommandOutcome;
  onDuplicatePost?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  onUpdateBeam?: (memberId: string, patch: BeamPatch) => CommandOutcome;
  onDeleteBeam?: (memberId: string) => void;
  fanDraft?: FanDraft | null;
  onUpdateFanDraft?: (patch: Partial<FanDraft>) => void;
  onCommitFanField?: () => void;
  onCancelFanPreview?: () => void;
  fanFieldForSelected?: FanField | null;
  onUpdateFanField?: (fanFieldId: string, patch: FanFieldPatch) => CommandOutcome;
  onDeleteFanField?: (fanFieldId: string) => void;
  onDeleteJoint?: (jointId: string) => void;
}

export function Inspector({
  selected,
  selectedVertex = null,
  vertexOutline,
  roofPlane = null,
  gutter = null,
  drawingPoints = null,
  sections = [],
  tool = "select",
  onMoveVertex = () => {},
  onDeleteVertex = () => {},
  onAddRoofPlane = () => {},
  onUpdateRoofPlane = () => {},
  onUpdateGutter = () => {},
  onAddDrawingPoint = () => {},
  onRemoveLastDrawingPoint = () => {},
  onCloseDrawing = () => {},
  onPlacePost = () => {},
  onMovePost = () => {},
  onUpdatePost = () => {},
  onDuplicatePost = () => {},
  onDeletePost = () => {},
  onUpdateBeam = () => {},
  onDeleteBeam = () => {},
  fanDraft = null,
  onUpdateFanDraft = () => {},
  onCommitFanField = () => {},
  onCancelFanPreview = () => {},
  fanFieldForSelected = null,
  onUpdateFanField = () => ({ ok: true }),
  onDeleteFanField = () => {},
  onDeleteJoint = () => {},
}: InspectorProps) {
  if (selectedVertex && vertexOutline) {
    const point = vertexOutline.points[selectedVertex.index];
    if (point) {
      return (
        <aside aria-label="Inspector" className="inspector">
          <h2>Inspector</h2>
          <dl>
            <dt>Object</dt>
            <dd>Vertex {selectedVertex.index + 1} of house outline {selectedVertex.outlineId}</dd>
          </dl>
          <NumberField
            label="Vertex X (mm)"
            value={point.x}
            onCommit={(x) => onMoveVertex(selectedVertex, { ...point, x })}
          />
          <NumberField
            label="Vertex Y (mm)"
            value={point.y}
            onCommit={(y) => onMoveVertex(selectedVertex, { ...point, y })}
          />
          <button type="button" onClick={() => onDeleteVertex(selectedVertex)}>
            Delete vertex
          </button>
        </aside>
      );
    }
  }

  return (
    <aside aria-label="Inspector" className="inspector">
      <h2>Inspector</h2>
      {drawingPoints !== null ? (
        <HouseDrawingPanel
          points={drawingPoints}
          onAddPoint={onAddDrawingPoint}
          onRemoveLastPoint={onRemoveLastDrawingPoint}
          onCloseOutline={onCloseDrawing}
        />
      ) : fanDraft ? (
        <FanPreviewPanel
          draft={fanDraft}
          sections={sections}
          onUpdateDraft={onUpdateFanDraft}
          onCommit={onCommitFanField}
          onCancel={onCancelFanPreview}
        />
      ) : tool === "post" ? (
        <PostPlacementPanel onPlacePost={onPlacePost} />
      ) : (
        !selected && <p>No selection. Choose a post, member, or joint to inspect it.</p>
      )}
      {selected?.kind === "house-outline" && (
        <>
          <dl>
            <dt>Object</dt>
            <dd>House outline</dd>
            <dt>ID</dt>
            <dd>{selected.id}</dd>
            <dt>Vertices</dt>
            <dd>{selected.points.length}</dd>
          </dl>
          {!roofPlane && (
            <button type="button" onClick={() => onAddRoofPlane(selected.id)}>
              Add roof plane
            </button>
          )}
          {roofPlane && (
            <>
              <h3>Roof plane</h3>
              <NumberField
                label="Reference elevation (eave, mm)"
                value={roofPlane.referenceElevationMm}
                onCommit={(referenceElevationMm) =>
                  onUpdateRoofPlane(roofPlane.id, { referenceElevationMm })
                }
              />
              <NumberField
                label="Pitch (degrees)"
                value={formatDegrees(roofPlane.pitchRad)}
                onCommit={(pitchDeg) => onUpdateRoofPlane(roofPlane.id, { pitchRad: (pitchDeg * Math.PI) / 180 })}
              />
              <NumberField
                label="Direction (degrees)"
                value={formatDegrees(roofPlane.directionRad)}
                onCommit={(directionDeg) =>
                  onUpdateRoofPlane(roofPlane.id, { directionRad: (directionDeg * Math.PI) / 180 })
                }
              />
              {gutter && (
                <>
                  <NumberField
                    label="Gutter width (mm)"
                    value={gutter.widthMm}
                    onCommit={(widthMm) => onUpdateGutter(gutter.id, { widthMm })}
                  />
                  <NumberField
                    label="Gutter drop (mm)"
                    value={gutter.dropMm}
                    onCommit={(dropMm) => onUpdateGutter(gutter.id, { dropMm })}
                  />
                </>
              )}
            </>
          )}
        </>
      )}
      {selected?.kind === "post" && (
        <>
          <dl>
            <dt>Object</dt>
            <dd>Post</dd>
            <dt>ID</dt>
            <dd>{selected.id}</dd>
            <dt>Top</dt>
            <dd>{formatPoint(selected.top)}</dd>
            <dt>Section</dt>
            <dd>
              {selected.widthMm} mm x {selected.depthMm} mm
            </dd>
          </dl>
          <NumberField
            label="Base X (mm)"
            value={selected.base.x}
            onCommit={(x) => onMovePost(selected.id, { ...selected.base, x })}
          />
          <NumberField
            label="Base Y (mm)"
            value={selected.base.y}
            onCommit={(y) => onMovePost(selected.id, { ...selected.base, y })}
          />
          <NumberField
            label="Height (mm)"
            value={selected.top.z - selected.base.z}
            onCommit={(heightMm) => onUpdatePost(selected.id, { heightMm })}
          />
          {sections.length > 0 && (
            <SectionField
              sections={sections}
              sectionId={selected.sectionId}
              onCommit={(sectionId) => onUpdatePost(selected.id, { sectionId })}
            />
          )}
          <button type="button" onClick={() => onDuplicatePost(selected.id)}>
            Duplicate post
          </button>
          <button type="button" onClick={() => onDeletePost(selected.id)}>
            Delete post
          </button>
        </>
      )}
      {selected?.kind === "member" && (
        <>
          <dl>
            <dt>Object</dt>
            <dd>{MEMBER_ROLE_LABELS[selected.role] ?? "Member"}</dd>
            <dt>ID</dt>
            <dd>{selected.id}</dd>
            <dt>Start</dt>
            <dd>{formatPoint(selected.start)}</dd>
            <dt>End</dt>
            <dd>{formatPoint(selected.end)}</dd>
          </dl>
          {!fanFieldForSelected && (
            <>
              {sections.length > 0 && (
                <SectionField
                  sections={sections}
                  sectionId={selected.sectionId}
                  onCommit={(sectionId) => onUpdateBeam(selected.id, { sectionId })}
                />
              )}
              <NumberField
                label="Orientation (degrees)"
                value={formatDegrees(selected.rollRad)}
                onCommit={(rollDeg) => onUpdateBeam(selected.id, { rollRad: (rollDeg * Math.PI) / 180 })}
              />
              <button type="button" onClick={() => onDeleteBeam(selected.id)}>
                Delete beam
              </button>
            </>
          )}
          {fanFieldForSelected && (
            <FanFieldEditPanel
              fanField={fanFieldForSelected}
              sections={sections}
              onUpdate={(patch) => onUpdateFanField(fanFieldForSelected.id, patch)}
              onDelete={() => onDeleteFanField(fanFieldForSelected.id)}
            />
          )}
        </>
      )}
      {selected?.kind === "joint" && (
        <>
          <dl>
            <dt>Object</dt>
            <dd>Joint</dd>
            <dt>ID</dt>
            <dd>{selected.id}</dd>
            <dt>Position</dt>
            <dd>{formatPoint(selected.position)}</dd>
            <dt>Connected members</dt>
            <dd>{selected.connectedMemberIds.join(", ")}</dd>
          </dl>
          <button type="button" onClick={() => onDeleteJoint(selected.id)}>
            Delete joint
          </button>
        </>
      )}
    </aside>
  );
}
