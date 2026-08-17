import { OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import type { ScenePrimitives } from "@canopy/geometry";
import { memberTransform, toThreeVector } from "../scene/three-transforms.js";

export interface ThreeViewProps {
  scene: ScenePrimitives;
  selectedObjectId: string | null;
  onSelect: (id: string) => void;
}

function handleClick(event: ThreeEvent<MouseEvent>, id: string, onSelect: (id: string) => void) {
  event.stopPropagation();
  onSelect(id);
}

export function ThreeView({ scene, selectedObjectId, onSelect }: ThreeViewProps) {
  const selectableObjects = [...scene.posts, ...scene.members, ...scene.joints];

  return (
    <>
      <Canvas className="three-view" camera={{ position: [9000, 9000, 14000], fov: 45, near: 10, far: 60000 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5000, 8000, 4000]} intensity={0.8} />
      <OrbitControls target={[3500, 1200, 2200]} />
      <gridHelper args={[10000, 20]} />

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
            onClick={(event) => handleClick(event, post.id, onSelect)}
          >
            <boxGeometry args={[post.widthMm, transform.length, post.depthMm]} />
            <meshStandardMaterial color={selected ? "#f2a600" : "#8a6d3b"} />
          </mesh>
        );
      })}

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
            onClick={(event) => handleClick(event, member.id, onSelect)}
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
        {selectableObjects.map((object) => (
          <button
            key={object.id}
            type="button"
            aria-label={`Select ${object.id} in 3D scene`}
            aria-pressed={object.id === selectedObjectId}
            onClick={() => onSelect(object.id)}
          >
            {object.id}
          </button>
        ))}
      </div>
    </>
  );
}
