import { useCallback, useMemo, useRef, useState } from "react";
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  createHistory,
  pushCommand,
  redo as historyRedo,
  undo as historyUndo,
  type DocumentCommand,
  type DocumentHistory,
  type ProjectDocument,
} from "@canopy/shared";

export type DispatchCommandResult = { ok: true } | { ok: false; error: string };

export interface DocumentController {
  document: ProjectDocument;
  dispatchCommand: (command: DocumentCommand) => DispatchCommandResult;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  resetTo: (document: ProjectDocument) => void;
}

export function useDocumentController(initialDocument: ProjectDocument): DocumentController {
  const [history, setHistory] = useState<DocumentHistory>(() => createHistory(initialDocument));

  // React only re-renders (and updates `history`) between event handlers, so
  // two dispatchCommand calls in the same synchronous handler - e.g.
  // creating an anchor, then immediately drawing a beam to it - would both
  // read the same pre-update `history` via closure. This ref is updated
  // synchronously inside dispatchCommand/undo/redo/resetTo so a later call in
  // the same handler always sees the prior call's effect.
  const historyRef = useRef(history);
  historyRef.current = history;

  const dispatchCommand = useCallback((command: DocumentCommand): DispatchCommandResult => {
    const result = pushCommand(historyRef.current, command);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    historyRef.current = result.history;
    setHistory(result.history);
    return { ok: true };
  }, []);

  const undo = useCallback(() => {
    historyRef.current = historyUndo(historyRef.current);
    setHistory(historyRef.current);
  }, []);
  const redo = useCallback(() => {
    historyRef.current = historyRedo(historyRef.current);
    setHistory(historyRef.current);
  }, []);
  const resetTo = useCallback((document: ProjectDocument) => {
    historyRef.current = createHistory(document);
    setHistory(historyRef.current);
  }, []);

  return useMemo(
    () => ({
      document: history.present,
      dispatchCommand,
      undo,
      redo,
      canUndo: historyCanUndo(history),
      canRedo: historyCanRedo(history),
      resetTo,
    }),
    [history, dispatchCommand, undo, redo, resetTo],
  );
}
