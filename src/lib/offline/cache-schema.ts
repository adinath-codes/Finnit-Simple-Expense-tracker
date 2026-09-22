import type { CachedReceipt, JournalCache } from "../../types/sync.ts";
import type { ReceiptScanRequest } from "../../lib/supabase/database.types.ts";
import type { Preferences } from "../../types/domain.ts";

export const defaultPreferences = (): Preferences => ({
  currency: "INR",
  location: false,
  reminders: false,
  reminderFrequency: "Every evening",
  reminderTime: "9:00 PM",
  backTapQuickAdd: false,
});

/** Retired opt-ins must stay off even in legacy caches and queued writes. */
export function currentPreferences(settings: Partial<Preferences> = {}): Preferences {
  return {
    ...defaultPreferences(),
    ...settings,
    location: false,
    backTapQuickAdd: false,
  };
}

export const journalCacheKey = (userId: string) => `finn.journal.v3.${userId}`;
export const previousJournalCacheKey = (userId: string) => `finn.journal.v2.${userId}`;
export const legacyJournalCacheKey = (userId: string) => `finn.journal.v1.${userId}`;

function receiptRequest(value: unknown): ReceiptScanRequest {
  const raw = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  return {
    entry_id: String(raw.entry_id ?? ""),
    attachment_id: String(raw.attachment_id ?? ""),
    captured_at: String(raw.captured_at ?? ""),
    timezone: String(raw.timezone ?? "UTC"),
    selected_date: String(raw.selected_date ?? ""),
    default_currency: String(raw.default_currency ?? "INR"),
  };
}

function normalizeReceipts(value: unknown): JournalCache["receipts"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([id, candidate]) => {
    const receipt = candidate as Omit<Partial<CachedReceipt>, "request" | "status"> & {
      request?: Record<string, unknown>;
      uploaded?: boolean;
      status?: CachedReceipt["status"] | "uploading";
    };
    return [id, {
      ...receipt,
      request: receiptRequest(receipt.request),
      width: receipt.width ?? Number(receipt.request?.width ?? 0),
      height: receipt.height ?? Number(receipt.request?.height ?? 0),
      prepared: receipt.prepared ?? (!!receipt.request?.sha256 || !!receipt.uploaded),
      status: receipt.status === "uploading" ? "queued" : receipt.status,
    } as CachedReceipt];
  }));
}

export function emptyJournalCache(): JournalCache {
  return {
    version: 3,
    entries: {},
    receipts: {},
    jobs: [],
    metadata: {
      lastServerRevision: null,
      contentVersion: 0,
      sqliteMigrationVersion: 0,
      validatedAt: { journal: 0, settings: 0, presets: 0, contexts: 0 },
    },
    local: {
      settings: defaultPreferences(),
      presets: [],
      goals: [],
      settingsInitialized: false,
      legacyPreferencesImported: false,
    },
  };
}

/** Normalize old cache documents without discarding entries or their outbox. */
export function normalizeJournalCache(value: unknown): JournalCache {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Journal cache requires recovery.");
  }
  const raw = value as Record<string, unknown>;
  if (
    (raw.version !== 1 && raw.version !== 2 && raw.version !== 3) ||
    !raw.entries ||
    !Array.isArray(raw.jobs)
  ) {
    throw new Error("Journal cache requires recovery.");
  }
  const local = raw.local && typeof raw.local === "object"
    ? raw.local as Partial<JournalCache["local"]>
    : {};
  return {
    version: 3,
    entries: raw.entries as JournalCache["entries"],
    receipts: normalizeReceipts(raw.receipts),
    jobs: (raw.jobs as JournalCache["jobs"]).filter(
      (job) => (job.endpoint as string) !== "delete-receipt-image",
    ).map((job) => job.endpoint === "scan-receipt"
      ? { ...job, payload: receiptRequest(job.payload) }
      : job),
    metadata: (() => {
      const value = raw.metadata && typeof raw.metadata === "object"
        ? raw.metadata as Partial<JournalCache["metadata"]>
        : {};
      const validated = value.validatedAt ?? {} as JournalCache["metadata"]["validatedAt"];
      return {
        lastServerRevision: typeof value.lastServerRevision === "string"
          ? value.lastServerRevision
          : null,
        contentVersion: Number.isSafeInteger(value.contentVersion)
          ? Number(value.contentVersion)
          : 0,
        sqliteMigrationVersion: Number.isSafeInteger(value.sqliteMigrationVersion)
          ? Number(value.sqliteMigrationVersion)
          : 0,
        validatedAt: {
          journal: Number(validated.journal) || 0,
          settings: Number(validated.settings) || 0,
          presets: Number(validated.presets) || 0,
          contexts: Number(validated.contexts) || 0,
        },
      };
    })(),
    ...(raw.catalog ? { catalog: raw.catalog as JournalCache["catalog"] } : {}),
    local: {
      settings: currentPreferences(local.settings),
      presets: Array.isArray(local.presets) ? local.presets : [],
      goals: Array.isArray(local.goals) ? local.goals : [],
      settingsInitialized: local.settingsInitialized ?? false,
      legacyPreferencesImported: local.legacyPreferencesImported ?? false,
    },
  };
}
