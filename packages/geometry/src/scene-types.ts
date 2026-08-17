import type { MemberRole, Vector3Mm } from "@canopy/shared";

export interface SceneHouseOutline {
  id: string;
  kind: "house-outline";
  points: Vector3Mm[];
}

export interface SceneRoofPlane {
  id: string;
  kind: "roof-plane";
  houseOutlineId: string;
  referenceElevationMm: number;
  pitchRad: number;
  directionRad: number;
  outline: Vector3Mm[];
}

export interface SceneGutter {
  id: string;
  kind: "gutter";
  roofPlaneId: string;
  start: Vector3Mm;
  end: Vector3Mm;
  widthMm: number;
  dropMm: number;
}

export interface SceneWall {
  id: string;
  kind: "wall";
  start: Vector3Mm;
  end: Vector3Mm;
  heightMm: number;
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
  baseAnchorId: string;
  topAnchorId: string;
  widthMm: number;
  depthMm: number;
}

export interface SceneHouseAnchor {
  id: string;
  kind: "house-anchor";
  position: Vector3Mm;
}

export interface SceneMember {
  id: string;
  kind: "member";
  role: MemberRole;
  start: Vector3Mm;
  end: Vector3Mm;
  widthMm: number;
  heightMm: number;
  rollRad: number;
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
  gutters: SceneGutter[];
  walls: SceneWall[];
  patioOutlines: ScenePatioOutline[];
  posts: ScenePost[];
  members: SceneMember[];
  joints: SceneJoint[];
  houseAnchors: SceneHouseAnchor[];
}

export type SceneObject = ScenePost | SceneMember | SceneJoint | SceneHouseOutline;
