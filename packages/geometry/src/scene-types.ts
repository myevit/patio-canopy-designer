import type { MemberRole, Vector3Mm } from "@canopy/shared";

export interface SceneHouseOutline {
  id: string;
  kind: "house-outline";
  points: Vector3Mm[];
}

export interface SceneRoofPlane {
  id: string;
  kind: "roof-plane";
  outline: Vector3Mm[];
}

export interface ScenePatioOutline {
  id: string;
  kind: "patio-outline";
  points: Vector3Mm[];
}

export interface ScenePost {
  id: string;
  kind: "post";
  base: Vector3Mm;
  top: Vector3Mm;
  widthMm: number;
  depthMm: number;
}

export interface SceneMember {
  id: string;
  kind: "member";
  role: MemberRole;
  start: Vector3Mm;
  end: Vector3Mm;
  widthMm: number;
  heightMm: number;
}

export interface SceneJoint {
  id: string;
  kind: "joint";
  position: Vector3Mm;
  connectedMemberIds: string[];
}

export interface ScenePrimitives {
  houseOutlines: SceneHouseOutline[];
  roofPlanes: SceneRoofPlane[];
  patioOutlines: ScenePatioOutline[];
  posts: ScenePost[];
  members: SceneMember[];
  joints: SceneJoint[];
}

export type SceneObject = ScenePost | SceneMember | SceneJoint;
