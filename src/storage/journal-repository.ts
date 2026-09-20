import type { JournalSeed, Preferences } from "@/types/domain";

export function createDefaultPreferences(): Preferences {
  return {
    currency: "INR",
    location: false,
    reminders: false,
    reminderFrequency: "Every evening",
    reminderTime: "9:00 PM",
    backTapQuickAdd: false,
  };
}

/**
 * Provides the first-run, empty local view. Personal entries are never bundled
 * with the app; the live capture/cache integration owns durable journal data.
 */
export function createEmptyJournal(): JournalSeed {
  return {
    today: new Date().toISOString().slice(0, 10),
    profile: { name: "", streak: 0 },
    settings: createDefaultPreferences(),
    goals: [],
    entries: [],
    presets: [],
  };
}
