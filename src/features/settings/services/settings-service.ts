import { randomUUID } from "expo-crypto";
import { changeJournalCache } from "@/lib/offline/database";
import { getSupabase } from "@/lib/supabase/client";
import type { Goal, Preferences } from "@/types/domain";
import type { JournalCache } from "@/types/sync";
import { currentPreferences } from "@/lib/offline/cache-schema";

type SettingsRow = {
  currency: string;
  location_enabled: boolean;
  reminders_enabled: boolean;
  reminder_frequency: string;
  reminder_time: string;
  back_tap_quick_add: boolean;
};

function fromRow(row: SettingsRow): Preferences {
  return currentPreferences({
    currency: row.currency,
    location: row.location_enabled,
    reminders: row.reminders_enabled,
    reminderFrequency: row.reminder_frequency,
    reminderTime: row.reminder_time,
    backTapQuickAdd: row.back_tap_quick_add,
  });
}

function toRow(userId: string, settings: Preferences) {
  const current = currentPreferences(settings);
  return {
    user_id: userId,
    currency: current.currency,
    location_enabled: current.location,
    reminders_enabled: current.reminders,
    reminder_frequency: current.reminderFrequency,
    reminder_time: current.reminderTime,
    back_tap_quick_add: current.backTapQuickAdd,
    updated_at: new Date().toISOString(),
  };
}

function enqueueSettingsSync(cache: JournalCache, userId: string) {
  const existing = cache.jobs.find(
    (job) => job.endpoint === "sync-settings" && job.state !== "running",
  );
  if (existing) {
    existing.payload = { settings: cache.local.settings };
    existing.state = "pending";
    existing.error = undefined;
    existing.attempts = 0;
    existing.nextAttemptAt = 0;
    return;
  }
  cache.jobs.push({
    id: randomUUID(),
    userId,
    entryId: `settings:${userId}`,
    endpoint: "sync-settings",
    payload: { settings: cache.local.settings },
    state: "pending",
    attempts: 0,
    nextAttemptAt: 0,
  });
}

export async function initializeAccountSettings(
  userId: string,
  legacy: Partial<Preferences> | null,
  onboardingCurrency?: string,
) {
  await changeJournalCache(userId, (cache) => {
    if (!cache.local.settingsInitialized) {
      cache.local.settings = currentPreferences({
        ...cache.local.settings,
        ...(onboardingCurrency ? { currency: onboardingCurrency } : {}),
        ...legacy,
      });
      cache.local.settingsInitialized = true;
    }
    cache.local.legacyPreferencesImported = true;
  });
}

export async function saveSettingsForAccount(
  userId: string,
  settings: Preferences,
) {
  await changeJournalCache(userId, (cache) => {
    cache.local.settings = currentPreferences(settings);
    cache.local.settingsInitialized = true;
    enqueueSettingsSync(cache, userId);
  });
}

/** Fetch remote settings without replacing a durable local write in flight. */
export async function refreshSettingsForAccount(userId: string) {
  const { data, error } = await getSupabase()
    .from("user_settings")
    .select("currency,location_enabled,reminders_enabled,reminder_frequency,reminder_time,back_tap_quick_add")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  await changeJournalCache(userId, (cache) => {
    if (cache.jobs.some((job) => job.endpoint === "sync-settings")) return;
    if (data) {
      cache.local.settings = fromRow(data as SettingsRow);
      cache.local.settingsInitialized = true;
      if ((data as SettingsRow).location_enabled || (data as SettingsRow).back_tap_quick_add) {
        enqueueSettingsSync(cache, userId);
      }
    } else {
      // Device-only settings migrate when the user first signs in; a new
      // account receives the same explicit defaults.
      enqueueSettingsSync(cache, userId);
    }
  });
}

export async function syncSettingsForAccount(userId: string, settings: Preferences) {
  const { error } = await getSupabase()
    .from("user_settings")
    .upsert(toRow(userId, settings), { onConflict: "user_id" });
  if (error) throw error;
}

export async function updateGoalForAccount(
  userId: string,
  id: string,
  limit: number,
) {
  await changeJournalCache(userId, (cache) => {
    cache.local.goals = cache.local.goals.map((goal: Goal) =>
      goal.id === id ? { ...goal, limit } : goal,
    );
  });
}
