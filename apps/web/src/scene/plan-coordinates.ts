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

/**
 * Inverts the browser's default SVG `preserveAspectRatio="xMidYMid meet"`
 * scaling: the viewBox is scaled uniformly to fit inside the element rect
 * and centered, leaving letterbox bars on whichever axis has slack, rather
 * than stretching independently per axis.
 */
export function clientPointToWorld(
  viewBox: string,
  rect: ClientRectLike,
  clientX: number,
  clientY: number,
): Vector3Mm {
  const box = parseViewBox(viewBox);
  if (rect.width === 0 || rect.height === 0 || box.width === 0 || box.height === 0) {
    return { x: box.minX, y: box.minY, z: 0 };
  }
  const scale = Math.min(rect.width / box.width, rect.height / box.height);
  const renderedWidth = box.width * scale;
  const renderedHeight = box.height * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  return {
    x: box.minX + (clientX - rect.left - offsetX) / scale,
    y: box.minY + (clientY - rect.top - offsetY) / scale,
    z: 0,
  };
}
