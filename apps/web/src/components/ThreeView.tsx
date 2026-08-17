import { useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import type { SceneGutter, SceneRoofPlane, ScenePrimitives } from "@canopy/geometry";
import { memberTransform, toThreeVector, wallTransform } from "../scene/three-transforms.js";
import { triangulateFootprint } from "../scene/triangulate-polygon.js";
import type { ToolId } from "../state/tool.js";

function RoofPlaneMesh({ roofPlane }: { roofPlane: SceneRoofPlane }) {
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(roofPlane.outline.length * 3);
    roofPlane.outline.forEach((point, index) => {
      const [x, y, z] = toThreeVector(point);
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = z;
    });
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const triangles = triangulateFootprint(roofPlane.outline);
    geom.setIndex(triangles.flat());
    geom.computeVertexNormals();
    return geom;
  }, [roofPlane]);

  return (
    <mesh data-testid={`scene-roof-plane-${roofPlane.id}`} geometry={geometry}>
      <meshStandardMaterial color="#a5553a" side={THREE.DoubleSide} />
    </mesh>
  );
}

function GutterMesh({ gutter }: { gutter: SceneGutter }) {
  const transform = memberTransform(gutter.start, gutter.end);
  return (
    <mesh
      data-testid={`scene-gutter-${gutter.id}`}
      position={transform.center}
      quaternion={transform.quaternion}
    >
      <boxGeometry args={[gutter.widthMm, transform.length, gutter.widthMm]} />
      <meshStandardMaterial color="#6b6b6b" />
    </mesh>
  );
}

export interface ThreeViewProps {
  scene: ScenePrimitives;
  selectedObjectId: string | null;
  onSelect: (id: string) => void;
  tool?: ToolId;
  onChooseBeamAnchor?: (anchorId: string) => void;
  onChooseFanAnchor?: (anchorId: string) => void;
  onChooseFanTargetMember?: (memberId: string) => void;
}

function handleClick(event: ThreeEvent<MouseEvent>, id: string, onSelect: (id: string) => void) {
  event.stopPropagation();
  onSelect(id);
}

export function ThreeView({
  scene,
  selectedObjectId,
  onSelect,
  tool = "select",
  onChooseBeamAnchor = () => {},
  onChooseFanAnchor = () => {},
  onChooseFanTargetMember = () => {},
}: ThreeViewProps) {
  const selectableObjects = [...scene.posts, ...scene.members, ...scene.joints];
  const accessibleObjects = [...selectableObjects, ...scene.houseAnchors];
  function handlePostClick(event: ThreeEvent<MouseEvent>, postId: string, topAnchorId: string) {
    event.stopPropagation();
    if (tool === "beam") {
      onChooseBeamAnchor(topAnchorId);
    } else if (tool === "fan") {
      onChooseFanAnchor(topAnchorId);
    } else {
      onSelect(postId);
    }
  }
  function handleMemberClick(event: ThreeEvent<MouseEvent>, memberId: string) {
    event.stopPropagation();
    if (tool === "fan") {
      onChooseFanTargetMember(memberId);
    } else {
      onSelect(memberId);
    }
  }

  return (
    <>
      <Canvas className="three-view" camera={{ position: [9000, 9000, 14000], fov: 45, near: 10, far: 60000 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5000, 8000, 4000]} intensity={0.8} />
      <OrbitControls target={[3500, 1200, 2200]} />
      <gridHelper args={[10000, 20]} />

      {scene.walls.map((wall) => {
        const transform = wallTransform(wall.start, wall.end, wall.heightMm);
        return (
          <mesh
            key={wall.id}
            data-testid={`scene-wall-${wall.id}`}
            position={transform.center}
            rotation={[0, transform.rotationY, 0]}
          >
            <boxGeometry args={[40, wall.heightMm, transform.length]} />
            <meshStandardMaterial color="#d8cfc0" />
          </mesh>
        );
      })}

      {scene.roofPlanes.map((roofPlane) => (
        <RoofPlaneMesh key={roofPlane.id} roofPlane={roofPlane} />
      ))}

      {scene.gutters.map((gutter) => (
        <GutterMesh key={gutter.id} gutter={gutter} />
      ))}

      {scene.posts.map((post) => {
        const transform = memberTransform(post.base, post.top);
        const selected = post.id === selectedObjectId;
        return (
          <mesh
            key={post.id}
            data-testid={`scene-object-${post.id}`}
            name={post.id}
            userData={{ sourceObjectId: post.id, selected }}
            position={transform.center}
            quaternion={transform.quaternion}
            onClick={(event) => handlePostClick(event, post.id, post.topAnchorId)}
          >
            <boxGeometry args={[post.widthMm, transform.length, post.depthMm]} />
            <meshStandardMaterial color={selected ? "#f2a600" : "#8a6d3b"} />
          </mesh>
        );
      })}

      {scene.houseAnchors.map((anchor) => (
        <mesh
          key={anchor.id}
          data-testid={`scene-object-${anchor.id}`}
          name={anchor.id}
          position={toThreeVector(anchor.position)}
          onClick={(event) => {
            event.stopPropagation();
            if (tool === "beam") {
              onChooseBeamAnchor(anchor.id);
            } else if (tool === "fan") {
              onChooseFanAnchor(anchor.id);
            }
          }}
        >
          <boxGeometry args={[60, 60, 60]} />
          <meshStandardMaterial color="#3f7fc3" />
        </mesh>
      ))}

      {scene.members.map((member) => {
        const transform = memberTransform(member.start, member.end);
        const selected = member.id === selectedObjectId;
        return (
          <mesh
            key={member.id}
            data-testid={`scene-object-${member.id}`}
            name={member.id}
            userData={{ sourceObjectId: member.id, selected }}
            position={transform.center}
            quaternion={transform.quaternion}
            onClick={(event) => handleMemberClick(event, member.id)}
          >
            <boxGeometry args={[member.widthMm, transform.length, member.heightMm]} />
            <meshStandardMaterial color={selected ? "#f2a600" : "#5b7c99"} />
          </mesh>
        );
      })}

      {scene.joints.map((joint) => {
        const selected = joint.id === selectedObjectId;
        return (
          <mesh
            key={joint.id}
            data-testid={`scene-object-${joint.id}`}
            name={joint.id}
            userData={{ sourceObjectId: joint.id, selected }}
            position={toThreeVector(joint.position)}
            onClick={(event) => handleClick(event, joint.id, onSelect)}
          >
            <sphereGeometry args={[60, 16, 16]} />
            <meshStandardMaterial color={selected ? "#f2a600" : "#c33f3f"} />
          </mesh>
        );
      })}
      </Canvas>
      <div className="sr-only" role="group" aria-label="3D scene objects">
        {accessibleObjects.map((object) => (
          <button
            key={object.id}
            type="button"
            aria-label={`Select ${object.id} in 3D scene`}
            aria-pressed={object.id === selectedObjectId}
            onClick={() => {
              if (tool === "beam" && object.kind === "post") {
                onChooseBeamAnchor(object.topAnchorId);
              } else if (tool === "beam" && object.kind === "house-anchor") {
                onChooseBeamAnchor(object.id);
              } else if (tool === "fan" && object.kind === "post") {
                onChooseFanAnchor(object.topAnchorId);
              } else if (tool === "fan" && object.kind === "house-anchor") {
                onChooseFanAnchor(object.id);
              } else if (tool === "fan" && object.kind === "member") {
                onChooseFanTargetMember(object.id);
              } else if (object.kind !== "house-anchor") {
                onSelect(object.id);
              }
            }}
          >
            {object.id}
          </button>
        ))}
      </div>
    </>
  );
}
