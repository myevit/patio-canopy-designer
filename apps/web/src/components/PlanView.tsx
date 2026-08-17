import { useRef, useState } from "react";
import type { ScenePrimitives } from "@canopy/geometry";
import type { Vector3Mm } from "@canopy/shared";
import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { clientPointToWorld } from "../scene/plan-coordinates.js";
import type { SelectedVertex } from "../state/selected-vertex.js";
import type { ToolId } from "../state/tool.js";

const VIEW_BOX = "-600 -400 8400 5200";
const VERTEX_RADIUS = 40;
const CLOSE_AFFORDANCE_RADIUS = 70;
const MIDPOINT_RADIUS = 25;

function toPoints(points: Vector3Mm[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function midpoint(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 0 };
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
  selectedVertex?: SelectedVertex | null;
  tool?: ToolId;
  drawingPoints?: Vector3Mm[] | null;
  onSelectVertex?: (vertex: SelectedVertex | null) => void;
  onAddDrawingPoint?: (point: Vector3Mm) => void;
  onCloseDrawing?: () => void;
  onMoveVertex?: (vertex: SelectedVertex, position: Vector3Mm) => void;
  onInsertVertex?: (outlineId: string, afterIndex: number, position: Vector3Mm) => void;
}

export function PlanView({
  scene,
  selectedObjectId,
  onSelect,
  selectedVertex = null,
  tool = "select",
  drawingPoints = null,
  onSelectVertex = () => {},
  onAddDrawingPoint = () => {},
  onCloseDrawing = () => {},
  onMoveVertex = () => {},
  onInsertVertex = () => {},
}: PlanViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragPreview, setDragPreview] = useState<{ vertex: SelectedVertex; position: Vector3Mm } | null>(null);

  function worldPointFromEvent(event: { clientX: number; clientY: number }): Vector3Mm {
    const rect = svgRef.current!.getBoundingClientRect();
    return clientPointToWorld(VIEW_BOX, rect, event.clientX, event.clientY);
  }

  function handleBackgroundClick(event: MouseEvent<SVGSVGElement>) {
    if (tool !== "house" || drawingPoints === null) return;
    if (event.target !== event.currentTarget) return;
    onAddDrawingPoint(worldPointFromEvent(event));
  }

  function handleVertexPointerDown(event: ReactPointerEvent<SVGCircleElement>, vertex: SelectedVertex) {
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a progressive enhancement; some test/DOM environments don't implement it.
    }
    setDragPreview({ vertex, position: worldPointFromEvent(event) });
  }

  function handleVertexPointerMove(event: ReactPointerEvent<SVGCircleElement>) {
    if (!dragPreview) return;
    setDragPreview({ vertex: dragPreview.vertex, position: worldPointFromEvent(event) });
  }

  function handleVertexPointerUp(event: ReactPointerEvent<SVGCircleElement>) {
    if (!dragPreview) return;
    const position = worldPointFromEvent(event);
    onMoveVertex(dragPreview.vertex, position);
    setDragPreview(null);
  }

  function displayedPoints(outlineId: string, points: Vector3Mm[]): Vector3Mm[] {
    if (!dragPreview || dragPreview.vertex.outlineId !== outlineId) return points;
    return points.map((p, i) => (i === dragPreview.vertex.index ? dragPreview.position : p));
  }

  return (
    <svg
      ref={svgRef}
      data-testid="plan-view-svg"
      className="plan-view"
      viewBox={VIEW_BOX}
      role="group"
      aria-label="Plan view"
      onClick={handleBackgroundClick}
    >
      {scene.houseOutlines.map((outline) => {
        const points = displayedPoints(outline.id, outline.points);
        const outlineSelected = outline.id === selectedObjectId;
        return (
          <g key={outline.id}>
            <polygon
              data-testid={`house-outline-${outline.id}`}
              data-selected={outlineSelected}
              className={
                outlineSelected ? "plan-view__house plan-view__house--selected" : "plan-view__house"
              }
              points={toPoints(points)}
              tabIndex={0}
              role="button"
              aria-label={`House outline ${outline.id}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(outline.id);
              }}
              onKeyDown={(event) => handleSelectionKey(event, outline.id, onSelect)}
            />
            {points.map((point, index) => {
              const vertex: SelectedVertex = { outlineId: outline.id, index };
              const isSelected = selectedVertex?.outlineId === outline.id && selectedVertex.index === index;
              return (
                <circle
                  key={index}
                  data-testid={`house-vertex-${outline.id}-${index}`}
                  data-selected={isSelected}
                  className={
                    isSelected ? "plan-view__vertex plan-view__vertex--selected" : "plan-view__vertex"
                  }
                  cx={point.x}
                  cy={point.y}
                  r={VERTEX_RADIUS}
                  tabIndex={0}
                  role="button"
                  aria-label={`Vertex ${index + 1} of house outline ${outline.id}`}
                  onPointerDown={(event) => handleVertexPointerDown(event, vertex)}
                  onPointerMove={handleVertexPointerMove}
                  onPointerUp={handleVertexPointerUp}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectVertex(vertex);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectVertex(vertex);
                    }
                  }}
                />
              );
            })}
            {outlineSelected &&
              points.map((point, index) => {
                const next = points[(index + 1) % points.length]!;
                const mid = midpoint(point, next);
                return (
                  <circle
                    key={`midpoint-${index}`}
                    data-testid={`house-midpoint-${outline.id}-${index}`}
                    className="plan-view__midpoint"
                    cx={mid.x}
                    cy={mid.y}
                    r={MIDPOINT_RADIUS}
                    tabIndex={0}
                    role="button"
                    aria-label={`Insert vertex on edge ${index + 1} of house outline ${outline.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onInsertVertex(outline.id, index, mid);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onInsertVertex(outline.id, index, mid);
                      }
                    }}
                  />
                );
              })}
          </g>
        );
      })}
      {tool === "house" && drawingPoints !== null && (
        <g className="plan-view__drawing">
          {drawingPoints.length > 1 && (
            <polyline className="plan-view__drawing-line" points={toPoints(drawingPoints)} />
          )}
          {drawingPoints.map((point, index) => {
            const isCloseAffordance = index === 0 && drawingPoints.length >= 3;
            if (isCloseAffordance) {
              return (
                <circle
                  key={index}
                  data-testid="house-outline-close-affordance"
                  className="plan-view__drawing-close"
                  cx={point.x}
                  cy={point.y}
                  r={CLOSE_AFFORDANCE_RADIUS}
                  tabIndex={0}
                  role="button"
                  aria-label="Close house outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseDrawing();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onCloseDrawing();
                    }
                  }}
                />
              );
            }
            return (
              <circle
                key={index}
                data-testid={`house-drawing-point-${index}`}
                className="plan-view__drawing-point"
                cx={point.x}
                cy={point.y}
                r={VERTEX_RADIUS}
              />
            );
          })}
        </g>
      )}
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
          style={{ pointerEvents: "none" }}
        />
      ))}
      {scene.gutters.map((gutter) => (
        <line
          key={gutter.id}
          data-testid={`gutter-${gutter.id}`}
          className="plan-view__gutter"
          x1={gutter.start.x}
          y1={gutter.start.y}
          x2={gutter.end.x}
          y2={gutter.end.y}
          style={{ pointerEvents: "none" }}
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
          onClick={(event) => {
            event.stopPropagation();
            onSelect(member.id);
          }}
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
          onClick={(event) => {
            event.stopPropagation();
            onSelect(post.id);
          }}
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
          onClick={(event) => {
            event.stopPropagation();
            onSelect(joint.id);
          }}
          onKeyDown={(event) => handleSelectionKey(event, joint.id, onSelect)}
        />
      ))}
    </svg>
  );
}
