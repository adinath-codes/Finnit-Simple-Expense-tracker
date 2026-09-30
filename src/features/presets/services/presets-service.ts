import { randomUUID } from "expo-crypto";
import { changeJournalCache } from "@/lib/offline/database";
import { getSupabase } from "@/lib/supabase/client";
import type { Preset } from "@/types/domain";
import type { JournalCache } from "@/types/sync";

type PresetRow = {
  id: string;
  name: string;
  note: string;
  amount_minor: number | string;
  category_id: Preset["category"];
};

function toPreset(row: PresetRow): Preset {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    amountMinor: Number(row.amount_minor),
    category: row.category_id === "food" || row.category_id === "transport" ||
      row.category_id === "shopping" ? row.category_id : "other",
  };
}

function presetEntryId(id: string) {
  return `preset:${id}`;
}

function enqueuePresetSync(cache: JournalCache, userId: string, preset: Preset) {
  const existing = cache.jobs.find(
    (job) => job.entryId === presetEntryId(preset.id) && job.state !== "running",
  );
  if (existing) {
    existing.endpoint = "sync-preset";
    existing.payload = { preset };
    existing.error = undefined;
    existing.attempts = 0;
    existing.nextAttemptAt = 0;
    return;
  }
  cache.jobs.push({
    id: randomUUID(), userId, entryId: presetEntryId(preset.id),
    endpoint: "sync-preset", payload: { preset }, state: "pending",
    attempts: 0, nextAttemptAt: 0,
  });
}

function enqueuePresetDelete(cache: JournalCache, userId: string, id: string) {
  const existing = cache.jobs.find(
    (job) => job.entryId === presetEntryId(id) && job.state !== "running",
  );
  if (existing) {
    existing.endpoint = "delete-preset";
    existing.payload = { presetId: id };
    existing.error = undefined;
    existing.attempts = 0;
    existing.nextAttemptAt = 0;
    return;
  }
  cache.jobs.push({
    id: randomUUID(), userId, entryId: presetEntryId(id),
    endpoint: "delete-preset", payload: { presetId: id }, state: "pending",
    attempts: 0, nextAttemptAt: 0,
  });
}

export async function savePresetForAccount(userId: string, preset: Preset) {
  await changeJournalCache(userId, (cache) => {
    const index = cache.local.presets.findIndex((item) => item.id === preset.id);
    if (index >= 0) cache.local.presets[index] = preset;
    else cache.local.presets.push(preset);
    enqueuePresetSync(cache, userId, preset);
  });
}

export async function deletePresetForAccount(userId: string, id: string) {
  await changeJournalCache(userId, (cache) => {
    cache.local.presets = cache.local.presets.filter((item) => item.id !== id);
    enqueuePresetDelete(cache, userId, id);
  });
}

/** Reconcile remote presets while preserving queued creates, edits, and deletes. */
export async function refreshPresetsForAccount(userId: string) {
  const { data, error } = await getSupabase()
    .from("user_presets")
    .select("id,name,note,amount_minor,category_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  const remote = ((data as PresetRow[] | null) ?? []).map(toPreset);
  const remoteById = new Map(remote.map((preset) => [preset.id, preset]));

  await changeJournalCache(userId, (cache) => {
    const local = new Map(cache.local.presets.map((preset) => [preset.id, preset]));
    const pendingIds = new Set(
      cache.jobs
        .filter((job) =>
          (job.endpoint === "sync-preset" || job.endpoint === "delete-preset") &&
          job.entryId.startsWith("preset:"),
        )
        .map((job) => job.entryId.slice("preset:".length)),
    );
    for (const preset of local.values()) {
      if (!remoteById.has(preset.id) && !pendingIds.has(preset.id)) {
        enqueuePresetSync(cache, userId, preset);
        pendingIds.add(preset.id);
      }
    }

    const merged = new Map(remoteById);
    for (const id of pendingIds) {
      const localPreset = local.get(id);
      if (localPreset) merged.set(id, localPreset);
      else merged.delete(id);
    }
    cache.local.presets = [...merged.values()];
  });
}

export async function syncPresetForAccount(userId: string, preset: Preset) {
  const { error } = await getSupabase().from("user_presets").upsert({
    user_id: userId, id: preset.id, name: preset.name, note: preset.note,
    amount_minor: preset.amountMinor, category_id: preset.category,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,id" });
  if (error) throw error;
}

export async function deletePresetForAccountRemote(userId: string, id: string) {
  const { error } = await getSupabase()
    .from("user_presets").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}
