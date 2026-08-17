import type { ScenePrimitives } from "@canopy/geometry";
import type { Vector3Mm } from "@canopy/shared";
import type { KeyboardEvent } from "react";

const VIEW_BOX = "-600 -400 8400 5200";

function toPoints(points: Vector3Mm[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function handleSelectionKey(event: KeyboardEvent<SVGElement>, id: string, onSelect: (id: string) => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect(id);
  }
}

export interface PlanViewProps {
  scene: ScenePrimitives;
  selectedObjectId: string | null;
  onSelect: (id: string) => void;
}

export function PlanView({ scene, selectedObjectId, onSelect }: PlanViewProps) {
  return (
    <svg
      data-testid="plan-view-svg"
      className="plan-view"
      viewBox={VIEW_BOX}
      role="group"
      aria-label="Plan view"
    >
      {scene.houseOutlines.map((outline) => (
        <polygon
          key={outline.id}
          data-testid={`house-outline-${outline.id}`}
          className="plan-view__house"
          points={toPoints(outline.points)}
        />
      ))}
      {scene.patioOutlines.map((outline) => (
        <polygon
          key={outline.id}
          data-testid={`patio-outline-${outline.id}`}
          className="plan-view__patio"
          points={toPoints(outline.points)}
        />
      ))}
      {scene.roofPlanes.map((roofPlane) => (
        <polygon
          key={roofPlane.id}
          data-testid={`roof-plane-${roofPlane.id}`}
          className="plan-view__roof"
          points={toPoints(roofPlane.outline)}
        />
      ))}
      {scene.members.map((member) => (
        <line
          key={member.id}
          data-testid={`scene-object-${member.id}`}
          data-selected={member.id === selectedObjectId}
          className={
            member.id === selectedObjectId ? "plan-view__member plan-view__member--selected" : "plan-view__member"
          }
          x1={member.start.x}
          y1={member.start.y}
          x2={member.end.x}
          y2={member.end.y}
          tabIndex={0}
          role="button"
          aria-label={`Member ${member.id}`}
          onClick={() => onSelect(member.id)}
          onKeyDown={(event) => handleSelectionKey(event, member.id, onSelect)}
        />
      ))}
      {scene.posts.map((post) => (
        <circle
          key={post.id}
          data-testid={`scene-object-${post.id}`}
          data-selected={post.id === selectedObjectId}
          className={post.id === selectedObjectId ? "plan-view__post plan-view__post--selected" : "plan-view__post"}
          cx={post.base.x}
          cy={post.base.y}
          r={Math.max(post.widthMm, post.depthMm) / 2}
          tabIndex={0}
          role="button"
          aria-label={`Post ${post.id}`}
          onClick={() => onSelect(post.id)}
          onKeyDown={(event) => handleSelectionKey(event, post.id, onSelect)}
        />
      ))}
      {scene.joints.map((joint) => (
        <rect
          key={joint.id}
          data-testid={`scene-object-${joint.id}`}
          data-selected={joint.id === selectedObjectId}
          className={
            joint.id === selectedObjectId ? "plan-view__joint plan-view__joint--selected" : "plan-view__joint"
          }
          x={joint.position.x - 40}
          y={joint.position.y - 40}
          width={80}
          height={80}
          tabIndex={0}
          role="button"
          aria-label={`Joint ${joint.id}`}
          onClick={() => onSelect(joint.id)}
          onKeyDown={(event) => handleSelectionKey(event, joint.id, onSelect)}
        />
      ))}
    </svg>
  );
}
