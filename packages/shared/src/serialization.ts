import { parseProjectDocument, type ProjectDocument } from "./design-schema.js";
import { formatZodError } from "./zod-error.js";

export function exportProjectDocument(document: ProjectDocument): string {
  return JSON.stringify(document, null, 2);
}

export type ImportProjectDocumentResult =
  | { success: true; document: ProjectDocument }
  | { success: false; error: string };

export function importProjectDocument(text: string): ImportProjectDocumentResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { success: false, error: "The file is not valid JSON." };
  }

  const result = parseProjectDocument(parsed);
  if (!result.success) {
    return { success: false, error: formatZodError(result.error) };
  }
  return { success: true, document: result.data };
}
