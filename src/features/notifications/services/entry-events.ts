type FirstEntryListener = (userId: string) => void;

const listeners = new Set<FirstEntryListener>();

export function notifyFirstJournalEntryLogged(userId: string) {
  for (const listener of listeners) listener(userId);
}

export function subscribeToFirstJournalEntry(listener: FirstEntryListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
