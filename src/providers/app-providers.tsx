import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import { loadJournalFixture } from "@/storage/journal-repository";
import type { JournalEntry, Preferences, Preset } from "@/types/domain";

function useMockJournal() {
  const [seed] = useState(loadJournalFixture);
  const [goals, setGoals] = useState(seed.goals);
  const [entries, setEntries] = useState(seed.entries);
  const [presets, setPresets] = useState(seed.presets);
  const [settings, setSettings] = useState(seed.settings);
  const [selectedDate, setSelectedDate] = useState(seed.today);
  return {
    ...seed,
    entries,
    presets,
    settings,
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
    updateSettings: (patch: Partial<Preferences>) =>
      setSettings((current) => ({ ...current, ...patch })),
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
