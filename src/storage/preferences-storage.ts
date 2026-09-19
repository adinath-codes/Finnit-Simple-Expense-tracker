import type { Preferences } from "@/types/domain";

/**
 * Android keeps the preview's existing session-only preference behavior.
 * The Back Tap feature is iOS-only, and isolating its native persistence keeps
 * older Android development builds from requiring an unrelated native rebuild.
 */
export async function loadPreferences(): Promise<Partial<Preferences> | null> {
  return null;
}

export async function savePreferences(_preferences: Preferences): Promise<void> {}
