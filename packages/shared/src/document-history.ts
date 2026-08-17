import { applyCommand } from "./commands/apply-command.js";
import type { DocumentCommand } from "./commands/types.js";
import type { ProjectDocument } from "./design-schema.js";

export interface DocumentHistory {
  past: ProjectDocument[];
  present: ProjectDocument;
  future: ProjectDocument[];
}

export function createHistory(initial: ProjectDocument): DocumentHistory {
  return { past: [], present: initial, future: [] };
}

export type PushCommandResult =
  | { ok: true; history: DocumentHistory }
  | { ok: false; error: string; history: DocumentHistory };

export function pushCommand(history: DocumentHistory, command: DocumentCommand): PushCommandResult {
  const result = applyCommand(history.present, command);
  if (!result.ok) {
    return { ok: false, error: result.error, history };
  }
  return {
    ok: true,
    history: { past: [...history.past, history.present], present: result.document, future: [] },
  };
}

export function undo(history: DocumentHistory): DocumentHistory {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1]!;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: DocumentHistory): DocumentHistory {
  if (history.future.length === 0) return history;
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next!,
    future: rest,
  };
}

export function canUndo(history: DocumentHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: DocumentHistory): boolean {
  return history.future.length > 0;
}
