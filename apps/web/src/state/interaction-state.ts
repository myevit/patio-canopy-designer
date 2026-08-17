/**
 * Interaction states scoped for Milestone 0. Authoring tools (House, Post,
 * Beam, Fan, Joint) surface as `placing` or `drawing` so the toolbar and
 * status area can reflect a live mode, even though no authoring commands are
 * implemented yet.
 */
export type InteractionState =
  | { status: "idle" }
  | { status: "selecting" }
  | { status: "drawing" }
  | { status: "placing" }
  | { status: "dragging"; objectId: string }
  | { status: "invalid"; reason: string };
