import type {
  CaptureInput,
  Catalog,
  EntryAmountPreview,
  Extraction,
  ReceiptAttachment,
  ReceiptCorrectionInput,
  ReceiptLine,
  ManualReceiptInput,
  ReceiptScanRequest,
  ReceiptScanStatus,
  SavedEntry,
  PresetCaptureInput,
} from "@/lib/supabase/database.types";
import type { Goal, Preferences, Preset } from "@/types/domain";
export type CorrectionInput = {
  action: "correct";
  operation_id: string;
  expected_revision: number;
  input: CaptureInput;
  extraction: Extraction;
  remember_rule?: { merchant_key: string; category_id: string };
};
export type ReparseInput = {
  action: "reparse";
  operation_id: string;
  expected_revision: number;
  id: string;
  input: CaptureInput;
};
export type AIEntryCorrectionInput = {
  action: "ai_correct";
  operation_id: string;
  id: string;
  expected_revision: number;
  instruction: string;
};
export type DeleteInput = {
  action: "delete";
  operation_id: string;
  id: string;
  expected_revision: number;
};
export type SettingsSyncInput = { settings: Preferences };
export type PresetSyncInput = { preset: Preset };
export type PresetDeleteInput = { presetId: string };
export type SyncJob = {
  id: string;
  userId: string;
  entryId: string;
  endpoint:
    | "parse-entry"
    | "correct-entry"
    | "scan-receipt"
    | "apply-preset"
    | "sync-settings"
    | "sync-preset"
    | "delete-preset";
  payload:
    | CaptureInput
    | CorrectionInput
    | ReparseInput
    | AIEntryCorrectionInput
    | ReceiptCorrectionInput
    | ManualReceiptInput
    | DeleteInput
    | SettingsSyncInput
    | PresetSyncInput
    | PresetDeleteInput
    | PresetCaptureInput
    | ReceiptScanRequest;
  state: "pending" | "running" | "blocked";
  attempts: number;
  nextAttemptAt: number;
  error?: string;
};
export type CachedEntry = {
  input: CaptureInput;
  extraction: Extraction;
  /** Server-validated Gemini amount, kept outside authoritative transactions. */
  amountPreview?: EntryAmountPreview;
  remote?: SavedEntry;
  /** Latest server document retained while an optimistic local job is pending. */
  remoteShadow?: SavedEntry;
  sync: "pending" | "synced" | "blocked";
  deleted?: boolean;
};
export type CachedReceipt = {
  request: ReceiptScanRequest;
  localUri?: string;
  width: number;
  height: number;
  prepared: boolean;
  status: ReceiptScanStatus;
  lines: ReceiptLine[];
  attachment?: ReceiptAttachment;
  remote?: SavedEntry;
  /** Latest server document retained while an optimistic local job is pending. */
  remoteShadow?: SavedEntry;
  deleted?: boolean;
  error?: string;
};
export type CacheMetadata = {
  lastServerRevision: string | null;
  contentVersion: number;
  sqliteMigrationVersion: number;
  validatedAt: {
    journal: number;
    settings: number;
    presets: number;
    contexts: number;
  };
};
export type JournalCache = {
  version: 3;
  entries: Record<string, CachedEntry>;
  receipts: Record<string, CachedReceipt>;
  jobs: SyncJob[];
  metadata: CacheMetadata;
  catalog?: Catalog;
  local: {
    settings: Preferences;
    presets: Preset[];
    goals: Goal[];
    settingsInitialized: boolean;
    legacyPreferencesImported: boolean;
  };
};
