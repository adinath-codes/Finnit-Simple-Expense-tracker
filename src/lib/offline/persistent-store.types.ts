import type { JournalCache } from "@/types/sync";

export type CacheMutationTargets = {
  entryIds?: readonly string[];
  receiptIds?: readonly string[];
  jobs?: boolean;
  metadata?: boolean;
  catalog?: boolean;
  settings?: boolean;
  presets?: boolean;
  goals?: boolean;
  affectsContent?: boolean;
};

export type PersistentCacheStore = {
  read(userId: string): Promise<JournalCache>;
  write(
    userId: string,
    previous: JournalCache | null,
    next: JournalCache,
    targets?: CacheMutationTargets,
  ): Promise<void>;
  delete(userId: string): Promise<void>;
};
