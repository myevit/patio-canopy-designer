import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { memberTransform, toThreeVector } from "./three-transforms.js";

describe("toThreeVector", () => {
  it("maps canonical mm (x,y,z) to a Y-up three.js vector (x,z,y)", () => {
    const v = toThreeVector({ x: 10, y: 20, z: 30 });
    expect(v).toEqual([10, 30, 20]);
  });
});

describe("memberTransform", () => {
  it("computes the correct length between start and end", () => {
    const transform = memberTransform({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2400 });
    expect(transform.length).toBeCloseTo(2400);
  });

  it("computes a center point at the midpoint of start and end", () => {
    const transform = memberTransform({ x: 0, y: 0, z: 0 }, { x: 1000, y: 2000, z: 400 });
    expect(transform.center).toEqual(toThreeVector({ x: 500, y: 1000, z: 200 }));
  });

  it("computes a quaternion that rotates the Y-up axis onto the member's direction", () => {
    const start = { x: 0, y: 0, z: 2700 };
    const end = { x: 1000, y: 500, z: 2300 };
    const transform = memberTransform(start, end);
    const quaternion = new THREE.Quaternion(...transform.quaternion);
    const rotatedUp = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);

    const [sx, sy, sz] = toThreeVector(start);
    const [ex, ey, ez] = toThreeVector(end);
    const expectedDirection = new THREE.Vector3(ex - sx, ey - sy, ez - sz).normalize();

    expect(rotatedUp.x).toBeCloseTo(expectedDirection.x);
    expect(rotatedUp.y).toBeCloseTo(expectedDirection.y);
    expect(rotatedUp.z).toBeCloseTo(expectedDirection.z);
  });
});
