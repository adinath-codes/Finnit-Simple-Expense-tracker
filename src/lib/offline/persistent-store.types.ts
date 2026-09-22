import type { JournalCache } from "@/types/sync";

export type PersistentCacheStore = {
  read(userId: string): Promise<JournalCache>;
  write(
    userId: string,
    previous: JournalCache | null,
    next: JournalCache,
  ): Promise<void>;
  delete(userId: string): Promise<void>;
};
