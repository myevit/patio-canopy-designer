import type { SceneObject } from "@canopy/geometry";
import type { Vector3Mm } from "@canopy/shared";

const MEMBER_ROLE_LABELS: Record<string, string> = {
  ledger: "Ledger",
  "perimeter-beam": "Perimeter beam",
  "fan-rafter": "Fan rafter",
};

function formatPoint(point: Vector3Mm): string {
  return `x ${point.x} mm, y ${point.y} mm, z ${point.z} mm`;
}

export interface InspectorProps {
  selected: SceneObject | undefined;
}

export function Inspector({ selected }: InspectorProps) {
  return (
    <aside aria-label="Inspector" className="inspector">
      <h2>Inspector</h2>
      {!selected && <p>No selection. Choose a post, member, or joint to inspect it.</p>}
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
