import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import { createEmptyJournal } from "@/storage/journal-repository";
import {
  clearLegacyPreferences,
  loadPreferences,
  savePreferences,
} from "@/storage/preferences-storage";
import { loadOnboardingSnapshot } from "@/storage/onboarding-repository";
import type { JournalEntry, Preferences, Preset } from "@/types/domain";
import type { JournalCache } from "@/types/sync";
import { useSession } from "@/features/auth/providers/session-provider";
import {
  captureJournalNote,
  createCaptureInput,
  refreshJournal,
} from "@/features/journal/services/journal-service";
import {
  correctedTextExtraction,
  journalEntriesFromCache,
} from "@/features/journal/services/journal-adapter";
import {
  deleteJournalEntry,
  correctJournalEntry,
  correctJournalEntryWithFinn,
  reparseJournalEntry,
} from "@/features/entries/services/entries-service";
import {
  deleteReceipt,
  correctReceiptEntry,
  recoverPreparingReceipts,
} from "@/features/camera/services/receipt-service";
import {
  deletePresetForAccount,
  refreshPresetsForAccount,
  savePresetForAccount,
} from "@/features/presets/services/presets-service";
import { capturePreset as capturePresetEntry } from "@/features/presets/services/preset-capture-service";
import {
  initializeAccountSettings,
  refreshSettingsForAccount,
  saveSettingsForAccount,
  updateGoalForAccount,
} from "@/features/settings/services/settings-service";
import { readJournalCache, subscribeJournalCache } from "@/lib/offline/database";
import { currentPreferences } from "@/lib/offline/cache-schema";
import { startJournalSync } from "@/lib/offline/sync-queue";
import { refreshWithPolicy } from "@/lib/offline/refresh-coordinator";
import { getSupabase } from "@/lib/supabase/client";
import {
  acceptRemoteEntryVersion,
  keepLocalEntryVersion,
  retryEntrySync,
} from "@/features/journal/services/sync-recovery-service";
import { clearCalendarCache } from "@/features/calendar/services/calendar-service";
import { clearSummaryCaches } from "@/features/summary/services/summary-service";

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Couldn’t save that change on this device.";
  return error.message
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function useJournalState() {
  const { session } = useSession();
  const [seed] = useState(createEmptyJournal);
  const [cache, setCache] = useState<JournalCache | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [preAuthSettings, setPreAuthSettings] = useState(seed.settings);
  const [settingsBootstrapReady, setSettingsBootstrapReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(seed.today);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [recentPresetEntryId, setRecentPresetEntryId] = useState<string | null>(null);
  const clearRecentPresetEntry = useCallback(() => setRecentPresetEntryId(null), []);

  useEffect(() => {
    let active = true;
    void Promise.all([loadPreferences(), loadOnboardingSnapshot()])
      .then(([preferences, onboarding]) => {
        if (!active) return;
        setPreAuthSettings(currentPreferences({
          ...seed.settings,
          ...(onboarding.completedAt && onboarding.answers.currency
            ? { currency: onboarding.answers.currency }
            : {}),
          ...preferences,
        }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setSettingsBootstrapReady(true);
      });
    return () => { active = false; };
  }, [seed.settings]);

  useEffect(() => {
    const userId = session?.user.id;
    clearCalendarCache();
    clearSummaryCaches();
    if (!userId) {
      setCache(null);
      setOwnerId(null);
      setMutationError(null);
      setRecentPresetEntryId(null);
      return;
    }

    let active = true;
    let unsubscribeCache: () => void = () => undefined;
    let stopSync: () => void = () => undefined;
    let revisionChannel: ReturnType<ReturnType<typeof getSupabase>["channel"]> | null = null;
    let connected: boolean | undefined;
    let revisionTimer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      const next = await readJournalCache(userId);
      if (active) {
        setCache(next);
        setOwnerId(userId);
      }
    };
    const refreshAll = (force = false) => {
      void Promise.allSettled([
        refreshWithPolicy(userId, "journal", 15_000, () => refreshJournal(userId), force),
        recoverPreparingReceipts(),
        refreshWithPolicy(
          userId, "settings", 5 * 60_000,
          () => refreshSettingsForAccount(userId), force,
        ),
        refreshWithPolicy(
          userId, "presets", 5 * 60_000,
          () => refreshPresetsForAccount(userId), force,
        ),
      ]);
    };

    setCache(null);
    setOwnerId(null);
    void Promise.all([loadPreferences(), loadOnboardingSnapshot()])
      .then(([legacy, onboarding]) =>
        initializeAccountSettings(
          userId,
          legacy,
          onboarding.completedAt ? onboarding.answers.currency : undefined,
        ).then(() => legacy ? clearLegacyPreferences() : undefined),
      )
      .then(load)
      .then(() => {
        if (!active) return;
        unsubscribeCache = subscribeJournalCache(() => { void load(); }, userId);
        stopSync = startJournalSync();
        revisionChannel = getSupabase()
          .channel(`journal-revision:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "journal_search_revisions",
              filter: `user_id=eq.${userId}`,
            },
            (event) => {
              const incoming = (event.new as { revision?: number | string } | null)
                ?.revision;
              if (incoming == null) return;
              void readJournalCache(userId).then((snapshot) => {
                if (!active) return;
                const known = snapshot.metadata.lastServerRevision;
                if (known && BigInt(String(incoming)) <= BigInt(known)) return;
                if (revisionTimer) clearTimeout(revisionTimer);
                revisionTimer = setTimeout(() => {
                  revisionTimer = null;
                  void refreshWithPolicy(
                    userId, "journal", 15_000, () => refreshJournal(userId), true,
                  ).catch(() => undefined);
                }, 250);
              }).catch(() => undefined);
            },
          )
          .subscribe();
        refreshAll(true);
      })
      .catch((error) => {
        if (active) setMutationError(errorMessage(error));
      });

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshAll(true);
    });
    const network = Network.addNetworkStateListener((state) => {
      const next = state.isConnected === true && state.isInternetReachable !== false;
      if (next && connected === false) refreshAll(true);
      connected = next;
    });
    return () => {
      active = false;
      unsubscribeCache();
      stopSync();
      appState.remove();
      network.remove();
      if (revisionTimer) clearTimeout(revisionTimer);
      if (revisionChannel) void getSupabase().removeChannel(revisionChannel);
    };
  }, [session?.user.id]);

  const ownedCache = ownerId === session?.user.id ? cache : null;
  const entries = useMemo(
    () => ownedCache ? journalEntriesFromCache(ownedCache) : [],
    [ownedCache],
  );
  const settings = ownedCache?.local.settings ?? preAuthSettings;
  const presets = ownedCache?.local.presets ?? [];
  const goals = ownedCache?.local.goals ?? [];
  const settingsReady = settingsBootstrapReady && (!session || !!ownedCache);
  const cacheAccountId = ownerId ?? "signed-out";
  const contentVersion = ownedCache?.metadata.contentVersion ?? 0;

  const runMutation = useCallback(async <T,>(operation: () => Promise<T>) => {
    setMutationError(null);
    try {
      return await operation();
    } catch (error) {
      setMutationError(errorMessage(error));
      throw error;
    }
  }, []);

  const captureNote = useCallback((note: string, date: string) =>
    runMutation(async () => {
      if (!session) throw new Error("Sign in before saving this note.");
      const input = createCaptureInput(
        note.trim(),
        settings.currency,
        date,
      );
      await captureJournalNote(input);
      return input.id;
    }), [runMutation, session, settings.currency]);

  const capturePreset = useCallback((preset: Preset, date: string) =>
    runMutation(async () => {
      if (!session) throw new Error("Sign in before using a saved entry.");
      const id = await capturePresetEntry(preset, date, settings.currency);
      setRecentPresetEntryId(id);
      return id;
    }), [runMutation, session, settings.currency]);

  const updateEntry = useCallback((entry: JournalEntry) =>
    runMutation(async () => {
      if (!session) throw new Error("Sign in before changing this entry.");
      if (entry.receipt) return correctReceiptEntry(entry);
      const currentCache = await readJournalCache(session.user.id);
      const current = currentCache.entries[entry.id];
      if (!current) throw new Error("This journal entry is no longer available.");
      if (!current.remote) {
        throw new Error("This note is saved. Let its first sync finish before editing it.");
      }
      const input = { ...current.input, raw_text: entry.note.trim() };
      if (input.raw_text !== current.input.raw_text) {
        await reparseJournalEntry(input);
      } else {
        await correctJournalEntry(input, correctedTextExtraction(current, entry));
      }
    }), [runMutation, session]);

  const deleteEntry = useCallback((id: string) =>
    runMutation(async () => {
      if (!session) throw new Error("Sign in before removing this entry.");
      const currentCache = await readJournalCache(session.user.id);
      if (currentCache.receipts[id]) return deleteReceipt(id);
      if (!currentCache.entries[id]?.remote) {
        throw new Error("This note is saved. Let its first sync finish before removing it.");
      }
      await deleteJournalEntry(id);
  }), [runMutation, session]);

  const askFinnToCorrectEntry = useCallback((id: string, instruction: string) =>
    runMutation(async () => {
      if (!session) throw new Error("Sign in before asking Finn to revise this entry.");
      await correctJournalEntryWithFinn(id, instruction);
    }), [runMutation, session]);

  const savePreset = useCallback((preset: Preset) =>
    runMutation(async () => {
      if (!session) throw new Error("Sign in before saving this shortcut.");
      await savePresetForAccount(session.user.id, preset);
    }), [runMutation, session]);

  const deletePreset = useCallback((id: string) =>
    runMutation(async () => {
      if (!session) throw new Error("Sign in before removing this shortcut.");
      await deletePresetForAccount(session.user.id, id);
    }), [runMutation, session]);

  const updateSettings = useCallback((patch: Partial<Preferences>) =>
    runMutation(async () => {
      const next = currentPreferences({ ...settings, ...patch });
      if (session) await saveSettingsForAccount(session.user.id, next);
      else {
        await savePreferences(next);
        setPreAuthSettings(next);
      }
    }), [runMutation, session, settings]);

  const updateGoal = useCallback((id: string, limit: number) =>
    runMutation(async () => {
      if (!session) throw new Error("Sign in before changing a goal.");
      await updateGoalForAccount(session.user.id, id, limit);
    }), [runMutation, session]);

  const retrySync = useCallback((entryId: string) =>
    runMutation(async () => {
      if (!session) throw new Error("Sign in before retrying this sync.");
      await retryEntrySync(entryId);
    }), [runMutation, session]);

  const keepLocalVersion = useCallback((entryId: string) =>
    runMutation(async () => {
      if (!session) throw new Error("Sign in before resolving this conflict.");
      await keepLocalEntryVersion(entryId);
    }), [runMutation, session]);

  const acceptRemoteVersion = useCallback((entryId: string) =>
    runMutation(async () => {
      if (!session) throw new Error("Sign in before resolving this conflict.");
      await acceptRemoteEntryVersion(entryId);
    }), [runMutation, session]);

  const syncStatus = useMemo(() => {
    const journalJobs = ownedCache?.jobs.filter((job) =>
      job.endpoint === "parse-entry" ||
      job.endpoint === "correct-entry" ||
      job.endpoint === "scan-receipt" ||
      job.endpoint === "apply-preset",
    ) ?? [];
    const conflicts = journalJobs.filter((job) =>
      job.state === "blocked" && job.endpoint === "correct-entry" &&
      job.error === "revision_or_idempotency_conflict",
    ).length;
    const failedJobs = journalJobs.filter((job) =>
      job.state === "blocked" && !(job.endpoint === "correct-entry" &&
        job.error === "revision_or_idempotency_conflict"),
    ).length;
    const failedReceipts =
      (ownedCache
        ? Object.values(ownedCache.receipts).filter(
            (receipt) =>
              !receipt.deleted &&
              receipt.status === "failed" &&
              !ownedCache.jobs.some((job) => job.entryId === receipt.request.entry_id),
          ).length
        : 0);
    return {
      pending: journalJobs.filter((job) => job.state !== "blocked").length,
      failed: failedJobs + failedReceipts,
      conflicts,
      blocked: failedJobs + failedReceipts + conflicts,
    };
  }, [ownedCache]);

  return {
    ...seed,
    entries,
    presets,
    settings,
    settingsReady,
    goals,
    cacheAccountId,
    contentVersion,
    selectedDate,
    syncStatus,
    mutationError,
    clearMutationError: () => setMutationError(null),
    setSelectedDate,
    updateGoal,
    captureNote,
    capturePreset,
    recentPresetEntryId,
    clearRecentPresetEntry,
    updateEntry,
    askFinnToCorrectEntry,
    deleteEntry,
    savePreset,
    deletePreset,
    updateSettings,
    retrySync,
    keepLocalVersion,
    acceptRemoteVersion,
  };
}

const JournalContext = createContext<ReturnType<typeof useJournalState> | null>(null);

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <JournalContext.Provider value={useJournalState()}>
      {children}
    </JournalContext.Provider>
  );
}

export function useJournal() {
  const context = useContext(JournalContext);
  if (!context) throw new Error("useJournal must be used within AppProviders");
  return context;
}
