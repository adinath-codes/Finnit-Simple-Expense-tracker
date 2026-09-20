import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Preferences } from "@/types/domain";

const SETTINGS_STORAGE_KEY = "finn.preferences.v1";

export async function loadPreferences(): Promise<Partial<Preferences> | null> {
  const saved = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
  return saved ? (JSON.parse(saved) as Partial<Preferences>) : null;
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(preferences));
}

export async function clearLegacyPreferences(): Promise<void> {
  await AsyncStorage.removeItem(SETTINGS_STORAGE_KEY);
}
