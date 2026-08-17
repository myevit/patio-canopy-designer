import { useEffect, useId, useState } from "react";
import type { SceneObject, SceneRoofPlane } from "@canopy/geometry";
import type { Vector3Mm } from "@canopy/shared";
import type { SelectedVertex } from "../state/selected-vertex.js";

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
  pitchDeg?: number;
  directionRad?: number;
  gutter?: { widthMm: number; dropMm: number };
}

interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}

function NumberField({ label, value, onCommit }: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  function commit() {
    const parsed = Number(text);
    if (!Number.isNaN(parsed)) {
      onCommit(parsed);
    }
  }

  return (
    <p className="inspector__field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
    </p>
  );
}

export interface InspectorProps {
  selected: SceneObject | undefined;
  selectedVertex?: SelectedVertex | null;
  vertexOutline?: Extract<SceneObject, { kind: "house-outline" }>;
  roofPlane?: SceneRoofPlane | null;
  onMoveVertex?: (vertex: SelectedVertex, position: Vector3Mm) => void;
  onDeleteVertex?: (vertex: SelectedVertex) => void;
  onAddRoofPlane?: (houseOutlineId: string) => void;
  onUpdateRoofPlane?: (roofPlaneId: string, patch: RoofPlanePatch) => void;
}

export function Inspector({
  selected,
  selectedVertex = null,
  vertexOutline,
  roofPlane = null,
  onMoveVertex = () => {},
  onDeleteVertex = () => {},
  onAddRoofPlane = () => {},
  onUpdateRoofPlane = () => {},
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
      {!selected && <p>No selection. Choose a post, member, or joint to inspect it.</p>}
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
                value={roofPlane.pitchDeg}
                onCommit={(pitchDeg) => onUpdateRoofPlane(roofPlane.id, { pitchDeg })}
              />
              <NumberField
                label="Direction (degrees)"
                value={(roofPlane.directionRad * 180) / Math.PI}
                onCommit={(directionDeg) =>
                  onUpdateRoofPlane(roofPlane.id, { directionRad: (directionDeg * Math.PI) / 180 })
                }
              />
              <NumberField
                label="Gutter width (mm)"
                value={roofPlane.gutter.widthMm}
                onCommit={(widthMm) =>
                  onUpdateRoofPlane(roofPlane.id, {
                    gutter: { widthMm, dropMm: roofPlane.gutter.dropMm },
                  })
                }
              />
              <NumberField
                label="Gutter drop (mm)"
                value={roofPlane.gutter.dropMm}
                onCommit={(dropMm) =>
                  onUpdateRoofPlane(roofPlane.id, {
                    gutter: { widthMm: roofPlane.gutter.widthMm, dropMm },
                  })
                }
              />
            </>
          )}
        </>
      )}
      {selected?.kind === "post" && (
        <dl>
          <dt>Object</dt>
          <dd>Post</dd>
          <dt>ID</dt>
          <dd>{selected.id}</dd>
          <dt>Base</dt>
          <dd>{formatPoint(selected.base)}</dd>
          <dt>Top</dt>
          <dd>{formatPoint(selected.top)}</dd>
          <dt>Section</dt>
          <dd>
            {selected.widthMm} mm x {selected.depthMm} mm
          </dd>
        </dl>
      )}
      {selected?.kind === "member" && (
        <dl>
          <dt>Object</dt>
          <dd>{MEMBER_ROLE_LABELS[selected.role] ?? "Member"}</dd>
          <dt>ID</dt>
          <dd>{selected.id}</dd>
          <dt>Start</dt>
          <dd>{formatPoint(selected.start)}</dd>
          <dt>End</dt>
          <dd>{formatPoint(selected.end)}</dd>
          <dt>Section</dt>
          <dd>
            {selected.widthMm} mm x {selected.heightMm} mm
          </dd>
        </dl>
      )}
      {selected?.kind === "joint" && (
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
      )}
    </aside>
  );
}
