/** Canonical length unit. All geometry is stored in millimetres. */
export type Millimetres = number;

/** Canonical angle unit. All geometry is stored in radians. */
export type Radians = number;

/** A point/vector in canonical millimetre space. */
export interface Vector3Mm {
  x: Millimetres;
  y: Millimetres;
  z: Millimetres;
}
