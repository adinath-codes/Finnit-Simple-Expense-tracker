import type {
  CaptureInput,
  Catalog,
  Extraction,
  ReceiptAttachment,
  ReceiptCorrectionInput,
  ReceiptLine,
  ManualReceiptInput,
  ReceiptScanRequest,
  ReceiptScanStatus,
  SavedEntry,
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
    | "sync-settings"
    | "sync-preset"
    | "delete-preset";
  payload:
    | CaptureInput
    | CorrectionInput
    | ReceiptCorrectionInput
    | ManualReceiptInput
    | DeleteInput
    | SettingsSyncInput
    | PresetSyncInput
    | PresetDeleteInput
    | ReceiptScanRequest;
  state: "pending" | "running" | "blocked";
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
  deleted?: boolean;
  error?: string;
};
export type JournalCache = {
  version: 2;
  entries: Record<string, CachedEntry>;
  receipts: Record<string, CachedReceipt>;
  jobs: SyncJob[];
  catalog?: Catalog;
  local: {
    settings: Preferences;
    presets: Preset[];
    goals: Goal[];
    settingsInitialized: boolean;
    legacyPreferencesImported: boolean;
  };
};
