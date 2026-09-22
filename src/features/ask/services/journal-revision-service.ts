import { getSupabase } from "@/lib/supabase/client";

const running = new Map<string, Promise<string>>();

/** Read the authoritative revision before accepting a persisted financial answer. */
export function currentJournalRevision(userId: string) {
  const active = running.get(userId);
  if (active) return active;
  const request = Promise.resolve(getSupabase()
    .from("journal_search_revisions")
    .select("revision")
    .eq("user_id", userId)
    .maybeSingle())
    .then(({ data, error }) => {
      if (error) throw error;
      const revision = data?.revision == null ? "0" : String(data.revision);
      if (!/^\d{1,19}$/.test(revision)) throw new Error("Invalid journal revision.");
      return revision;
    })
    .finally(() => running.delete(userId));
  running.set(userId, request);
  return request;
}
