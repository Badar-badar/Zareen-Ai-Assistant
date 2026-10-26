import type { PendingView } from "../services/pendingAction.service.js";

export type WorkerName = "documents" | "tools" | "browser";

export interface WorkerResult {
  worker: WorkerName;
  ok: boolean;
  facts: string[]; // short results only, never raw pages or documents
  sources: string[];
  error?: string;
  pending?: PendingView[];
}