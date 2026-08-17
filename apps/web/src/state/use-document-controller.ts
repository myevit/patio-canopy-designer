import { useCallback, useMemo, useState } from "react";
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

  const dispatchCommand = useCallback(
    (command: DocumentCommand): DispatchCommandResult => {
      const result = pushCommand(history, command);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      setHistory(result.history);
      return { ok: true };
    },
    [history],
  );

  const undo = useCallback(() => setHistory((current) => historyUndo(current)), []);
  const redo = useCallback(() => setHistory((current) => historyRedo(current)), []);
  const resetTo = useCallback((document: ProjectDocument) => setHistory(createHistory(document)), []);

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
