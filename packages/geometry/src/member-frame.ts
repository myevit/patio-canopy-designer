import type { Vector3Mm } from "@canopy/shared";

/** A point/vector expressed in a member's own local frame: u runs along the member axis (start to end), v/w span its cross-section. */
export interface LocalVector {
  u: number;
  v: number;
  w: number;
}

/**
 * Analytic, section-orientation frame for one member: xAxis runs from start
 * to end along the centreline, yAxis/zAxis span the cross-section and are
 * rotated about xAxis by the member's rollRad. Built purely from world
 * positions, so it is unaffected by rendering, undo/redo, or persistence.
 */
export interface MemberFrame {
  originMm: Vector3Mm;
  xAxis: Vector3Mm;
  yAxis: Vector3Mm;
  zAxis: Vector3Mm;
  lengthMm: number;
}

function subtract(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vector3Mm, b: Vector3Mm): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function length(a: Vector3Mm): number {
  return Math.sqrt(dot(a, a));
}

function normalize(a: Vector3Mm): Vector3Mm {
  const len = length(a);
  if (len <= 0) return { x: 0, y: 0, z: 0 };
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

const WORLD_Z: Vector3Mm = { x: 0, y: 0, z: 1 };
const WORLD_Y: Vector3Mm = { x: 0, y: 1, z: 0 };

/** Members whose axis is nearly parallel to world-Z fall back to a world-Y reference so cross(worldUp, xAxis) never degenerates. */
const NEAR_VERTICAL_COSINE = 0.999;

export interface ComputeMemberFrameInput {
  start: Vector3Mm;
  end: Vector3Mm;
  rollRad: number;
}

export function computeMemberFrame({ start, end, rollRad }: ComputeMemberFrameInput): MemberFrame {
  const delta = subtract(end, start);
  const lengthMm = length(delta);
  if (lengthMm <= 0) {
    return { originMm: start, xAxis: { x: 0, y: 0, z: 0 }, yAxis: { x: 0, y: 0, z: 0 }, zAxis: { x: 0, y: 0, z: 0 }, lengthMm: 0 };
  }

  const xAxis = normalize(delta);
  const worldUp = Math.abs(xAxis.z) > NEAR_VERTICAL_COSINE ? WORLD_Y : WORLD_Z;
  const refY = normalize(cross(worldUp, xAxis));
  const refZ = cross(xAxis, refY);

  const cosRoll = Math.cos(rollRad);
  const sinRoll = Math.sin(rollRad);
  const yAxis: Vector3Mm = {
    x: refY.x * cosRoll + refZ.x * sinRoll,
    y: refY.y * cosRoll + refZ.y * sinRoll,
    z: refY.z * cosRoll + refZ.z * sinRoll,
  };
  const zAxis = cross(xAxis, yAxis);

  return { originMm: start, xAxis, yAxis, zAxis, lengthMm };
}

export function worldToLocal(frame: MemberFrame, point: Vector3Mm): LocalVector {
  const relative = subtract(point, frame.originMm);
  return {
    u: dot(relative, frame.xAxis),
    v: dot(relative, frame.yAxis),
    w: dot(relative, frame.zAxis),
  };
}

export function localToWorld(frame: MemberFrame, local: LocalVector): Vector3Mm {
  return {
    x: frame.originMm.x + frame.xAxis.x * local.u + frame.yAxis.x * local.v + frame.zAxis.x * local.w,
    y: frame.originMm.y + frame.xAxis.y * local.u + frame.yAxis.y * local.v + frame.zAxis.y * local.w,
    z: frame.originMm.z + frame.xAxis.z * local.u + frame.yAxis.z * local.v + frame.zAxis.z * local.w,
  };
}

/** Local-frame direction vector (no translation component) for a world-space direction, e.g. a plane normal. */
export function worldDirectionToLocal(frame: MemberFrame, direction: Vector3Mm): LocalVector {
  return {
    u: dot(direction, frame.xAxis),
    v: dot(direction, frame.yAxis),
    w: dot(direction, frame.zAxis),
  };
}
