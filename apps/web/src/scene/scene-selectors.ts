import type { SceneObject, ScenePrimitives } from "@canopy/geometry";

export interface SelectableSceneObject {
  id: string;
  kind: SceneObject["kind"];
  label: string;
}

const MEMBER_ROLE_LABELS: Record<string, string> = {
  ledger: "Ledger",
  "perimeter-beam": "Perimeter beam",
  "fan-rafter": "Fan rafter",
};

function labelFor(object: SceneObject): string {
  switch (object.kind) {
    case "post":
      return `Post ${object.id}`;
    case "member":
      return `${MEMBER_ROLE_LABELS[object.role] ?? "Member"} ${object.id}`;
    case "joint":
      return `Joint ${object.id}`;
    case "house-outline":
      return `House outline ${object.id}`;
  }
}

export function listSelectableObjects(scene: ScenePrimitives): SelectableSceneObject[] {
  const objects: SceneObject[] = [...scene.posts, ...scene.members, ...scene.joints];
  return objects.map((object) => ({ id: object.id, kind: object.kind, label: labelFor(object) }));
}

export function findSceneObject(
  scene: ScenePrimitives,
  id: string | null | undefined,
): SceneObject | undefined {
  if (!id) {
    return undefined;
  }
  return (
    scene.posts.find((post) => post.id === id) ??
    scene.members.find((member) => member.id === id) ??
    scene.joints.find((joint) => joint.id === id) ??
    scene.houseOutlines.find((outline) => outline.id === id)
  );
}
