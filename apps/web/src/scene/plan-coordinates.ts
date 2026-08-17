import type { Vector3Mm } from "@canopy/shared";

export interface ViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export function parseViewBox(viewBox: string): ViewBox {
  const [minX, minY, width, height] = viewBox.trim().split(/\s+/).map(Number);
  return { minX: minX!, minY: minY!, width: width!, height: height! };
}

export interface ClientRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function clientPointToWorld(
  viewBox: string,
  rect: ClientRectLike,
  clientX: number,
  clientY: number,
): Vector3Mm {
  const box = parseViewBox(viewBox);
  const fracX = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
  const fracY = rect.height === 0 ? 0 : (clientY - rect.top) / rect.height;
  return {
    x: box.minX + fracX * box.width,
    y: box.minY + fracY * box.height,
    z: 0,
  };
}
