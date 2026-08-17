import { useRef, useState } from "react";
import type { ScenePrimitives } from "@canopy/geometry";
import type { Vector3Mm } from "@canopy/shared";
import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { projectPointOntoSegment } from "../scene/geometry-helpers.js";
import { clientPointToWorld } from "../scene/plan-coordinates.js";
import { snapPostPosition } from "../scene/post-snapping.js";
import { resolveAnchorPosition } from "../scene/scene-selectors.js";
import type { SelectedVertex } from "../state/selected-vertex.js";
import type { ToolId } from "../state/tool.js";

const VIEW_BOX = "-600 -400 8400 5200";
const VERTEX_RADIUS = 40;
const CLOSE_AFFORDANCE_RADIUS = 70;
const MIDPOINT_RADIUS = 25;
const POST_PREVIEW_RADIUS = 70;
const HOUSE_ANCHOR_HALF_SIZE = 30;

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
  onPlacePost?: (position: Vector3Mm) => void;
  onMovePost?: (postId: string, position: Vector3Mm) => void;
  beamStartAnchorId?: string | null;
  onChooseBeamAnchor?: (anchorId: string) => void;
  onCreateHouseAnchorOnGutter?: (gutterId: string, position: Vector3Mm) => void;
  onChooseFanAnchor?: (anchorId: string) => void;
  onChooseFanTargetMember?: (memberId: string) => void;
  fanPreview?: { source: Vector3Mm; points: Vector3Mm[] } | null;
  onSelectCandidate?: (candidateId: string) => void;
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
  onPlacePost = () => {},
  onMovePost = () => {},
  beamStartAnchorId = null,
  onChooseBeamAnchor = () => {},
  onCreateHouseAnchorOnGutter = () => {},
  onChooseFanAnchor = () => {},
  onChooseFanTargetMember = () => {},
  fanPreview = null,
  onSelectCandidate = () => {},
}: PlanViewProps) {
  const selectedJoint = scene.joints.find((joint) => joint.id === selectedObjectId) ?? null;
  const connectedMemberIds = new Set(selectedJoint?.connectedMemberIds ?? []);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragPreview, setDragPreview] = useState<{ vertex: SelectedVertex; position: Vector3Mm } | null>(null);
  const [postDragPreview, setPostDragPreview] = useState<{ postId: string; position: Vector3Mm } | null>(null);
  const [postPlacementPreview, setPostPlacementPreview] = useState<Vector3Mm | null>(null);
  const [hoveredBeamAnchorId, setHoveredBeamAnchorId] = useState<string | null>(null);

  function worldPointFromEvent(event: { clientX: number; clientY: number }): Vector3Mm {
    const rect = svgRef.current!.getBoundingClientRect();
    return clientPointToWorld(VIEW_BOX, rect, event.clientX, event.clientY);
  }

  function snapTargets() {
    return { outlines: [...scene.houseOutlines.map((o) => o.points), ...scene.patioOutlines.map((o) => o.points)] };
  }

  function handleBackgroundClick(event: MouseEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget) return;
    if (tool === "house" && drawingPoints !== null) {
      onAddDrawingPoint(worldPointFromEvent(event));
      return;
    }
    if (tool === "post") {
      const raw = worldPointFromEvent(event);
      const snapped = snapPostPosition(raw, snapTargets(), { disabled: event.shiftKey });
      onPlacePost(snapped.position);
    }
  }

  function handleSvgPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (tool !== "post") return;
    const raw = worldPointFromEvent(event);
    const snapped = snapPostPosition(raw, snapTargets(), { disabled: event.shiftKey });
    setPostPlacementPreview(snapped.position);
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

  function handlePostPointerDown(event: ReactPointerEvent<SVGCircleElement>, postId: string, base: Vector3Mm) {
    if (tool !== "select") return;
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a progressive enhancement; some test/DOM environments don't implement it.
    }
    setPostDragPreview({ postId, position: base });
  }

  function handlePostPointerMove(event: ReactPointerEvent<SVGCircleElement>, postId: string) {
    if (!postDragPreview || postDragPreview.postId !== postId) return;
    setPostDragPreview({ postId, position: worldPointFromEvent(event) });
  }

  function handlePostPointerUp(event: ReactPointerEvent<SVGCircleElement>, postId: string) {
    if (!postDragPreview || postDragPreview.postId !== postId) return;
    onMovePost(postId, worldPointFromEvent(event));
    setPostDragPreview(null);
  }

  function clearHoveredBeamAnchor(anchorId: string) {
    setHoveredBeamAnchorId((current) => (current === anchorId ? null : current));
  }

  const beamPreview = (() => {
    if (tool !== "beam" || !beamStartAnchorId || !hoveredBeamAnchorId) return null;
    const start = resolveAnchorPosition(scene, beamStartAnchorId);
    const end = resolveAnchorPosition(scene, hoveredBeamAnchorId);
    if (!start || !end) return null;
    return { start, end, valid: hoveredBeamAnchorId !== beamStartAnchorId };
  })();

  return (
    <svg
      ref={svgRef}
      data-testid="plan-view-svg"
      className="plan-view"
      viewBox={VIEW_BOX}
      role="group"
      aria-label="Plan view"
      onClick={handleBackgroundClick}
      onPointerMove={handleSvgPointerMove}
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
          pointerEvents="none"
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
          className={tool === "beam" ? "plan-view__gutter plan-view__gutter--beam" : "plan-view__gutter"}
          x1={gutter.start.x}
          y1={gutter.start.y}
          x2={gutter.end.x}
          y2={gutter.end.y}
          style={{ pointerEvents: tool === "beam" ? "auto" : "none" }}
          tabIndex={tool === "beam" ? 0 : undefined}
          role={tool === "beam" ? "button" : undefined}
          aria-label={tool === "beam" ? `Choose anchor on gutter ${gutter.id}` : undefined}
          onClick={
            tool === "beam"
              ? (event) => {
                  event.stopPropagation();
                  const raw = worldPointFromEvent(event);
                  const projected = projectPointOntoSegment(raw, gutter.start, gutter.end);
                  onCreateHouseAnchorOnGutter(gutter.id, projected);
                }
              : undefined
          }
          onKeyDown={
            tool === "beam"
              ? (event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  const projected = projectPointOntoSegment(
                    midpoint(gutter.start, gutter.end),
                    gutter.start,
                    gutter.end,
                  );
                  onCreateHouseAnchorOnGutter(gutter.id, projected);
                }
              : undefined
          }
        />
      ))}
      {scene.members.map((member) => (
        <line
          key={member.id}
          data-testid={`scene-object-${member.id}`}
          data-selected={member.id === selectedObjectId}
          data-connected={connectedMemberIds.has(member.id)}
          className={
            member.id === selectedObjectId
              ? "plan-view__member plan-view__member--selected"
              : connectedMemberIds.has(member.id)
                ? "plan-view__member plan-view__member--connected"
                : "plan-view__member"
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
            if (tool === "fan") {
              onChooseFanTargetMember(member.id);
            } else {
              onSelect(member.id);
            }
          }}
          onKeyDown={(event) =>
            handleSelectionKey(event, member.id, tool === "fan" ? onChooseFanTargetMember : onSelect)
          }
        />
      ))}
      {scene.posts.map((post) => {
        const displayedBase =
          postDragPreview?.postId === post.id ? postDragPreview.position : post.base;
        return (
          <circle
            key={post.id}
            data-testid={`scene-object-${post.id}`}
            data-selected={post.id === selectedObjectId}
            className={post.id === selectedObjectId ? "plan-view__post plan-view__post--selected" : "plan-view__post"}
            cx={displayedBase.x}
            cy={displayedBase.y}
            r={Math.max(post.widthMm, post.depthMm) / 2}
            tabIndex={0}
            role="button"
            aria-label={`Post ${post.id}`}
            onPointerDown={(event) => handlePostPointerDown(event, post.id, post.base)}
            onPointerMove={(event) => handlePostPointerMove(event, post.id)}
            onPointerUp={(event) => handlePostPointerUp(event, post.id)}
            onPointerEnter={() => tool === "beam" && setHoveredBeamAnchorId(post.topAnchorId)}
            onPointerLeave={() => clearHoveredBeamAnchor(post.topAnchorId)}
            onClick={(event) => {
              event.stopPropagation();
              if (tool === "beam") {
                onChooseBeamAnchor(post.topAnchorId);
              } else if (tool === "fan") {
                onChooseFanAnchor(post.topAnchorId);
              } else {
                onSelect(post.id);
              }
            }}
            onKeyDown={(event) => {
              if (tool === "beam") {
                handleSelectionKey(event, post.topAnchorId, onChooseBeamAnchor);
              } else if (tool === "fan") {
                handleSelectionKey(event, post.topAnchorId, onChooseFanAnchor);
              } else {
                handleSelectionKey(event, post.id, onSelect);
              }
            }}
          />
        );
      })}
      {scene.houseAnchors.map((anchor) => (
        <rect
          key={anchor.id}
          data-testid={`scene-object-${anchor.id}`}
          className="plan-view__house-anchor"
          x={anchor.position.x - HOUSE_ANCHOR_HALF_SIZE}
          y={anchor.position.y - HOUSE_ANCHOR_HALF_SIZE}
          width={HOUSE_ANCHOR_HALF_SIZE * 2}
          height={HOUSE_ANCHOR_HALF_SIZE * 2}
          tabIndex={0}
          role="button"
          aria-label={`House anchor ${anchor.id}`}
          onPointerEnter={() => tool === "beam" && setHoveredBeamAnchorId(anchor.id)}
          onPointerLeave={() => clearHoveredBeamAnchor(anchor.id)}
          onClick={(event) => {
            event.stopPropagation();
            if (tool === "beam") {
              onChooseBeamAnchor(anchor.id);
            } else if (tool === "fan") {
              onChooseFanAnchor(anchor.id);
            }
          }}
          onKeyDown={(event) => {
            if (tool === "beam") handleSelectionKey(event, anchor.id, onChooseBeamAnchor);
            else if (tool === "fan") handleSelectionKey(event, anchor.id, onChooseFanAnchor);
          }}
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
      {tool === "joint" &&
        scene.jointCandidates.map((candidate) => (
          <rect
            key={candidate.id}
            data-testid={`scene-object-${candidate.id}`}
            className="plan-view__joint-candidate"
            x={candidate.position.x - 30}
            y={candidate.position.y - 30}
            width={60}
            height={60}
            transform={`rotate(45 ${candidate.position.x} ${candidate.position.y})`}
            tabIndex={0}
            role="button"
            aria-label={`Detected connection ${candidate.memberIds.join(", ")}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelectCandidate(candidate.id);
            }}
            onKeyDown={(event) => handleSelectionKey(event, candidate.id, onSelectCandidate)}
          />
        ))}
      {beamPreview && (
        <line
          data-testid="beam-preview"
          data-valid={beamPreview.valid}
          className={
            beamPreview.valid
              ? "plan-view__beam-preview plan-view__beam-preview--valid"
              : "plan-view__beam-preview plan-view__beam-preview--invalid"
          }
          x1={beamPreview.start.x}
          y1={beamPreview.start.y}
          x2={beamPreview.end.x}
          y2={beamPreview.end.y}
          pointerEvents="none"
        />
      )}
      {fanPreview && (
        <g className="plan-view__fan-preview" pointerEvents="none">
          {fanPreview.points.map((point, index) => (
            <line
              key={index}
              data-testid={`fan-preview-line-${index}`}
              className="plan-view__fan-preview-line"
              x1={fanPreview.source.x}
              y1={fanPreview.source.y}
              x2={point.x}
              y2={point.y}
            />
          ))}
        </g>
      )}
      {tool === "post" && postPlacementPreview && (
        <circle
          data-testid="post-placement-preview"
          className="plan-view__post-preview"
          cx={postPlacementPreview.x}
          cy={postPlacementPreview.y}
          r={POST_PREVIEW_RADIUS}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
