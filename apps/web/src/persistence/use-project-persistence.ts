import { useEffect, useRef, useState } from "react";
import type { ProjectDocument } from "@canopy/shared";
import type { DocumentController } from "../state/use-document-controller.js";
import type { PersistenceAdapter } from "./persistence-adapter.js";

export interface ProjectPersistence {
  loaded: boolean;
  error: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useProjectPersistence(
  controller: DocumentController,
  adapter: PersistenceAdapter,
): ProjectPersistence {
  const resetToRef = useRef(controller.resetTo);
  resetToRef.current = controller.resetTo;
  const skipNextSaveOfRef = useRef<ProjectDocument | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adapter
      .load()
      .then((document) => {
        if (cancelled) return;
        if (document) {
          skipNextSaveOfRef.current = document;
          resetToRef.current(document);
        }
        setLoaded(true);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(errorMessage(loadError));
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  // Saves are coalesced into a serialized queue: at most one adapter.save()
  // call is ever in flight, and it always ends up saving whatever document
  // was current once earlier in-flight saves finish, so a slow save can
  // never overwrite a newer one (latest-document-wins).
  const savingRef = useRef(false);
  const pendingDocumentRef = useRef<ProjectDocument | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextSaveOfRef.current === controller.document) {
      skipNextSaveOfRef.current = null;
      return;
    }

    pendingDocumentRef.current = controller.document;
    if (savingRef.current) return;

    savingRef.current = true;
    void (async () => {
      while (pendingDocumentRef.current) {
        const toSave = pendingDocumentRef.current;
        pendingDocumentRef.current = null;
        try {
          await adapter.save(toSave);
        } catch (saveError: unknown) {
          setError(errorMessage(saveError));
        }
      }
      savingRef.current = false;
    })();
  }, [loaded, adapter, controller.document]);

  return { loaded, error };
}
