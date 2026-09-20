import { randomUUID } from "expo-crypto";
import {
  currentUserId,
  getSupabase,
  isBackendConfigured,
} from "@/lib/supabase/client";
import {
  changeJournalCache,
  readJournalCache,
  subscribeJournalCache,
} from "@/lib/offline/database";
import { syncJournal } from "@/lib/offline/sync-queue";
import { parseNote } from "@/features/entries/services/entry-parser";
import type {
  CaptureInput,
  Catalog,
  SavedEntry,
} from "@/lib/supabase/database.types";
import { capture } from "../../../../supabase/functions/_shared/validation";

const offlineCatalog: Catalog = {
  categories: [
    "food",
    "transport",
    "shopping",
    "bills",
    "entertainment",
    "health",
    "education",
    "travel",
    "software",
    "subscriptions",
    "work",
    "income",
    "transfer",
    "debt",
    "other",
  ].map((id) => ({ id, name: id })),
  merchants: [],
  aliases: [],
  rules: [],
  people: [],
  contexts: [],
};

export function createCaptureInput(
  rawText: string,
  currency = "INR",
  selectedDate?: string,
  approximatePlace?: string | null,
): CaptureInput {
  return capture({
    id: randomUUID(),
    raw_text: rawText,
    captured_at: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    currency,
    selected_date: selectedDate,
    ...(approximatePlace ? { approximate_place: approximatePlace } : {}),
  });
}
/** Keep this input/id when retrying. Resolve ONLY after note and queue are durable. */
export async function captureJournalNote(value: CaptureInput) {
  const input = capture(value);
  const userId = await currentUserId();
  const saved = await changeJournalCache(userId, (cache) => {
    const existing = cache.entries[input.id];
    if (existing) {
      if (JSON.stringify(existing.input) !== JSON.stringify(input))
        throw new Error("Capture ID already belongs to a different note.");
      return existing;
    }
    const local = {
      input,
      extraction: parseNote(input, cache.catalog ?? offlineCatalog),
      sync: "pending" as const,
    };
    cache.entries[input.id] = local;
    cache.jobs.push({
      id: input.id,
      userId,
      entryId: input.id,
      endpoint: "parse-entry",
      payload: input,
      state: "pending",
      attempts: 0,
      nextAttemptAt: 0,
    });
    return local;
  });
  void syncJournal(userId).catch(() => undefined);
  return saved;
}
export async function listLocalJournal() {
  const cache = await readJournalCache(await currentUserId());
  return Object.values(cache.entries)
    .filter((entry) => !entry.deleted)
    .sort((a, b) => b.input.captured_at.localeCompare(a.input.captured_at));
}
export async function listPendingJournalChanges() {
  return (await readJournalCache(await currentUserId())).jobs;
}

export function subscribePendingJournalChangeCount(
  listener: (count: number) => void,
) {
  if (!isBackendConfigured()) {
    listener(0);
    return () => undefined;
  }

  let active = true;
  const refresh = () => {
    void listPendingJournalChanges()
      .then((jobs) => {
        if (active) {
          listener(jobs.filter((job) => job.state !== "blocked").length);
        }
      })
      .catch(() => {
        if (active) listener(0);
      });
  };

  refresh();
  const unsubscribe = subscribeJournalCache(refresh);
  return () => {
    active = false;
    unsubscribe();
  };
}

/** Fetch remote rows without mixing fixture data or overwriting unsynced edits. */
export async function refreshJournal() {
  const userId = await currentUserId();
  const db = getSupabase();
  let after: string | undefined;
  while (true) {
    let query = db
      .from("journal_entries")
      .select(
        "id,source_type,raw_text,original_text,captured_at,occurred_on,timezone,currency,revision,extraction,deleted_at,capture_request",
      )
      .eq("user_id", userId)
      .order("id")
      .limit(200);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw error;
    await changeJournalCache(userId, (cache) => {
      for (const row of data) {
        if (row.source_type === "receipt") continue;
        if (cache.jobs.some((j) => j.entryId === row.id)) continue;
        const entry = row as unknown as SavedEntry;
        if ((cache.entries[row.id]?.remote?.revision ?? 0) > entry.revision)
          continue;
        const input = capture({
          ...row.capture_request,
          raw_text: entry.raw_text,
        });
        cache.entries[row.id] = {
          input,
          extraction: entry.extraction,
          remote: entry,
          sync: "synced",
          deleted: !!entry.deleted_at,
        };
      }
    });
    if (data.length < 200) break;
    after = data[data.length - 1].id;
  }
  return listLocalJournal();
}

/** Cache RLS-filtered rules and entity names for deterministic offline capture. */
export async function refreshJournalCatalog() {
  const userId = await currentUserId();
  const db = getSupabase();
  const results = await Promise.all([
    db.from("categories").select("id,name").limit(100),
    db
      .from("merchants")
      .select("id,canonical_name,default_category_id,user_id")
      .order("id")
      .limit(1000),
    db
      .from("merchant_aliases")
      .select("alias,merchant_id,user_id")
      .order("id")
      .limit(1000),
    db
      .from("category_rules")
      .select("merchant_key,category_id")
      .order("merchant_key")
      .limit(1000),
    db.from("people").select("name").order("name").limit(1000),
    db.from("contexts").select("name").order("name").limit(1000),
  ]);
  if (results.some((r) => r.error))
    throw new Error("Could not refresh journal categories.");
  const catalog: Catalog = {
    categories: results[0].data!,
    merchants: results[1].data!,
    aliases: results[2].data!,
    rules: results[3].data!,
    people: results[4].data!,
    contexts: results[5].data!,
  };
  await changeJournalCache(userId, (cache) => {
    cache.catalog = catalog;
  });
  return catalog;
}
