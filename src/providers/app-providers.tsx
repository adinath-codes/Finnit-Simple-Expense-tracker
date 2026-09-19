import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { loadJournalFixture } from "@/storage/journal-repository";
import {
  loadPreferences,
  savePreferences,
} from "@/storage/preferences-storage";
import { loadOnboardingSnapshot } from "@/storage/onboarding-repository";
import type { JournalEntry, Preferences, Preset } from "@/types/domain";

function useMockJournal() {
  const [seed] = useState(loadJournalFixture);
  const [goals, setGoals] = useState(seed.goals);
  const [entries, setEntries] = useState(seed.entries);
  const [presets, setPresets] = useState(seed.presets);
  const [settings, setSettings] = useState(seed.settings);
  const [settingsReady, setSettingsReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(seed.today);

  useEffect(() => {
    let active = true;
    void Promise.all([loadPreferences(), loadOnboardingSnapshot()])
      .then(([preferences, onboarding]) => {
        if (!active) return;
        setSettings((current) => ({
          ...current,
          ...preferences,
          ...(onboarding.completedAt && onboarding.answers.currency
            ? { currency: onboarding.answers.currency }
            : {}),
        }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setSettingsReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<Preferences>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void savePreferences(next).catch(() => undefined);
      return next;
    });
  }, []);

  return {
    ...seed,
    entries,
    presets,
    settings,
    settingsReady,
    goals,
    selectedDate,
    setSelectedDate,
    updateGoal: (id: string, limit: number) =>
      setGoals((current) =>
        current.map((goal) => (goal.id === id ? { ...goal, limit } : goal)),
      ),
    addEntry: (entry: JournalEntry) =>
      setEntries((current) => [...current, entry]),
    updateEntry: (entry: JournalEntry) =>
      setEntries((current) =>
        current.map((item) => (item.id === entry.id ? entry : item)),
      ),
    deleteEntry: (id: string) =>
      setEntries((current) => current.filter((item) => item.id !== id)),
    savePreset: (preset: Preset) =>
      setPresets((current) =>
        current.some((item) => item.id === preset.id)
          ? current.map((item) => (item.id === preset.id ? preset : item))
          : [...current, preset],
      ),
    deletePreset: (id: string) =>
      setPresets((current) => current.filter((item) => item.id !== id)),
    updateSettings,
  };
}
const JournalContext = createContext<ReturnType<typeof useMockJournal> | null>(
  null,
);
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <JournalContext.Provider value={useMockJournal()}>
      {children}
    </JournalContext.Provider>
  );
}
export function useJournal() {
  const context = useContext(JournalContext);
  if (!context) throw new Error("useJournal must be used within AppProviders");
  return context;
}
