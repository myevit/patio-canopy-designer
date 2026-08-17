import { useEffect, useRef, useState } from "react";
import type { ProjectDocument } from "@canopy/shared";
import type { DocumentController } from "../state/use-document-controller.js";
import type { PersistenceAdapter } from "./persistence-adapter.js";

export interface ProjectPersistence {
  loaded: boolean;
}

export function useProjectPersistence(
  controller: DocumentController,
  adapter: PersistenceAdapter,
): ProjectPersistence {
  const resetToRef = useRef(controller.resetTo);
  resetToRef.current = controller.resetTo;
  const skipNextSaveOfRef = useRef<ProjectDocument | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void adapter.load().then((document) => {
      if (cancelled) return;
      if (document) {
        skipNextSaveOfRef.current = document;
        resetToRef.current(document);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextSaveOfRef.current === controller.document) {
      skipNextSaveOfRef.current = null;
      return;
    }
    void adapter.save(controller.document);
  }, [loaded, adapter, controller.document]);

  return { loaded };
}
