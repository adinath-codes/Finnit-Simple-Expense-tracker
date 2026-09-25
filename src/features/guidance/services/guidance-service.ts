import AsyncStorage from "@react-native-async-storage/async-storage";

export type GuidanceMessageId = "first-note-v1" | "saved-entries-v1";

const key = (userId: string) => `finn:guidance:${userId}`;

export async function loadSeenGuidance(userId: string) {
  try {
    const value = await AsyncStorage.getItem(key(userId));
    if (!value) return new Set<GuidanceMessageId>();
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return new Set<GuidanceMessageId>();
    return new Set(
      parsed.filter((id): id is GuidanceMessageId =>
        id === "first-note-v1" || id === "saved-entries-v1"),
    );
  } catch {
    return new Set<GuidanceMessageId>();
  }
}

export async function markGuidanceSeen(
  userId: string,
  messageId: GuidanceMessageId,
) {
  const seen = await loadSeenGuidance(userId);
  if (seen.has(messageId)) return;
  seen.add(messageId);
  await AsyncStorage.setItem(key(userId), JSON.stringify([...seen]));
}

export async function clearSeenGuidance(userId: string) {
  await AsyncStorage.removeItem(key(userId));
}
