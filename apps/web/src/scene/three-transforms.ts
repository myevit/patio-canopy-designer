import * as THREE from "three";
import type { Vector3Mm } from "@canopy/shared";

/** Maps canonical Z-up millimetre coordinates to a Y-up three.js-friendly triple. */
export function toThreeVector(p: Vector3Mm): [number, number, number] {
  return [p.x, p.z, p.y];
}

export interface MemberTransform {
  center: [number, number, number];
  quaternion: [number, number, number, number];
  length: number;
}

const UP = new THREE.Vector3(0, 1, 0);

export function memberTransform(start: Vector3Mm, end: Vector3Mm): MemberTransform {
  const startVec = new THREE.Vector3(...toThreeVector(start));
  const endVec = new THREE.Vector3(...toThreeVector(end));
  const direction = endVec.clone().sub(startVec);
  const length = direction.length();
  const center = startVec.clone().add(endVec).multiplyScalar(0.5);
  const quaternion =
    length > 0
      ? new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize())
      : new THREE.Quaternion();

  return {
    center: [center.x, center.y, center.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    length,
  };
}
