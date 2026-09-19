import type {
  CaptureInput,
  Catalog,
  Extraction,
  SavedEntry,
} from "@/lib/supabase/database.types";
export type CorrectionInput = {
  action: "correct";
  operation_id: string;
  expected_revision: number;
  input: CaptureInput;
  extraction: Extraction;
  remember_rule?: { merchant_key: string; category_id: string };
};
export type DeleteInput = {
  action: "delete";
  operation_id: string;
  id: string;
  expected_revision: number;
};
export type SyncJob = {
  id: string;
  userId: string;
  entryId: string;
  endpoint: "parse-entry" | "correct-entry";
  payload: CaptureInput | CorrectionInput | DeleteInput;
  state: "pending" | "blocked";
  attempts: number;
  nextAttemptAt: number;
  error?: string;
};
export type CachedEntry = {
  input: CaptureInput;
  extraction: Extraction;
  remote?: SavedEntry;
  sync: "pending" | "synced" | "blocked";
  deleted?: boolean;
};
export type JournalCache = {
  version: 1;
  entries: Record<string, CachedEntry>;
  jobs: SyncJob[];
  catalog?: Catalog;
};
