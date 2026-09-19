/** UI-facing records. Monetary values are integer minor units (paise for INR). */
export type Category = "food" | "transport" | "shopping" | "other";
export type EntryItem = {
  id: string;
  name: string;
  quantity: number;
  amountMinor: number;
  category: Category;
};
export type EntrySource = {
  title: string;
  detail: string;
  icon: "note" | "location";
};
export type ReceiptPhoto = {
  uri: string;
  width: number;
  height: number;
};
export type JournalEntry = {
  id: string;
  date: string;
  note: string;
  merchant: string;
  category: Category;
  status: "ready" | "review";
  time: string;
  items: EntryItem[];
  thought: string;
  sources: EntrySource[];
  receipt?: ReceiptPhoto;
};
export type Preset = {
  id: string;
  name: string;
  amountMinor: number;
  category: Category;
  note: string;
};
export type Preferences = {
  currency: string;
  location: boolean;
  reminders: boolean;
  reminderFrequency: string;
  reminderTime: string;
  backTapQuickAdd: boolean;
};
export type Goal = {
  id: string;
  label: string;
  limit: number;
  color: string;
  icon: string;
};
export type JournalSeed = {
  today: string;
  profile: { name: string; streak: number };
  settings: Preferences;
  goals: Goal[];
  entries: JournalEntry[];
  presets: Preset[];
};
