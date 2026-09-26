import type { JournalCache } from "@/types/sync";
import type { CacheMutationTargets } from "./persistent-store.types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Clone only the entities a mutation is allowed to change. */
export function targetedCacheCopy(
  current: JournalCache,
  targets: CacheMutationTargets,
): JournalCache {
  const entries = targets.entryIds ? { ...current.entries } : current.entries;
  for (const id of targets.entryIds ?? []) {
    if (entries[id]) entries[id] = clone(entries[id]);
  }

  const receipts = targets.receiptIds ? { ...current.receipts } : current.receipts;
  for (const id of targets.receiptIds ?? []) {
    if (receipts[id]) receipts[id] = clone(receipts[id]);
  }

  const changesLocal = targets.settings || targets.presets || targets.goals;
  const local = changesLocal ? { ...current.local } : current.local;
  if (targets.settings) local.settings = { ...current.local.settings };
  if (targets.presets) local.presets = current.local.presets.map((item) => ({ ...item }));
  if (targets.goals) local.goals = current.local.goals.map((item) => ({ ...item }));

  return {
    ...current,
    entries,
    receipts,
    jobs: targets.jobs ? current.jobs.map((job) => ({ ...job })) : current.jobs,
    metadata: targets.metadata || targets.affectsContent
      ? { ...current.metadata, validatedAt: { ...current.metadata.validatedAt } }
      : current.metadata,
    ...(targets.catalog
      ? { catalog: current.catalog ? clone(current.catalog) : undefined }
      : {}),
    local,
  };
}
