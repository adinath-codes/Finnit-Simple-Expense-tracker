import fixture from "@/data/mock-journal.json";
import type { JournalSeed } from "@/types/domain";

/** The fixture boundary: replace this adapter when persistence is introduced.
 * No screen imports JSON or calls a remote client. Changes currently live only in memory.
 */
export function loadJournalFixture(): JournalSeed {
  return JSON.parse(JSON.stringify(fixture)) as JournalSeed;
}
