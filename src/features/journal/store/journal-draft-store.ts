import AsyncStorage from "@react-native-async-storage/async-storage";

export type JournalDrafts = {
  composer: string;
  edits: Record<string, string>;
};

const key = (userId: string) => `finn:journal-drafts:${userId}`;
const writes = new Map<string, Promise<unknown>>();

export async function loadJournalDrafts(userId: string): Promise<JournalDrafts> {
  await writes.get(userId)?.catch(() => undefined);
  const value = await AsyncStorage.getItem(key(userId));
  if (!value) return { composer: "", edits: {} };
  try {
    const parsed = JSON.parse(value) as Partial<JournalDrafts>;
    return {
      composer: typeof parsed.composer === "string" ? parsed.composer : "",
      edits: parsed.edits && typeof parsed.edits === "object" && !Array.isArray(parsed.edits)
        ? Object.fromEntries(Object.entries(parsed.edits).filter(([, draft]) =>
            typeof draft === "string")) as Record<string, string>
        : {},
    };
  } catch {
    return { composer: "", edits: {} };
  }
}

/** Serialize writes so a slow earlier keystroke cannot restore an older draft. */
export function saveJournalDrafts(userId: string, drafts: JournalDrafts) {
  const previous = writes.get(userId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() =>
    AsyncStorage.setItem(key(userId), JSON.stringify(drafts)));
  writes.set(userId, next);
  return next;
}

export async function deleteJournalDrafts(userId: string) {
  await writes.get(userId)?.catch(() => undefined);
  await AsyncStorage.removeItem(key(userId));
  writes.delete(userId);
}
