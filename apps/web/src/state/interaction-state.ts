import type { Vector3Mm } from "@canopy/shared";

/**
 * Interaction states scoped for Milestone 0/1. Authoring tools (House, Post,
 * Beam, Fan, Joint) surface as `placing`/`drawing` (or, for House, the
 * dedicated `drawing-house-outline` state that carries the in-progress
 * points) so the toolbar and status area can reflect a live mode.
 */
export type InteractionState =
  | { status: "idle" }
  | { status: "selecting" }
  | { status: "drawing" }
  | { status: "drawing-house-outline"; points: Vector3Mm[]; error?: string }
  | { status: "drawing-beam"; startAnchorId: string | null }
  | { status: "placing" }
  | { status: "dragging"; objectId: string }
  | { status: "invalid"; reason: string };
