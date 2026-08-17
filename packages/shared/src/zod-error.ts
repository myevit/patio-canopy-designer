import type { z } from "zod";

export function formatZodError<T>(error: z.ZodError<T>): string {
  const [issue] = error.issues;
  if (!issue) return "The change produced an invalid document.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
