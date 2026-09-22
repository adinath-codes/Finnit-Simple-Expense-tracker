/** UI-facing records. Monetary values are integer minor units (paise for INR). */
export type Category = "food" | "transport" | "shopping" | "other";
export type EntryItem = {
  id: string;
  name: string;
  quantity: number;
  /** Total line amount in minor units, matching the backend's `amount_minor`. */
  amountMinor: number;
  /** Optional per-unit price supplied by the backend; never used for totals. */
  unitPriceMinor?: number | null;
  amountMissing?: boolean;
  category: Category;
  /** Preserves backend categories that the four-category journal UI collapses. */
  categoryId?: string;
  kind?: "item" | "tax" | "tip" | "fee" | "discount";
  confidence?: number;
  needsReview?: boolean;
  provisional?: boolean;
};
export type EntrySource = {
  title: string;
  detail: string;
  icon: "note" | "location";
};
export type ReceiptPhoto = {
  uri?: string;
  width: number;
  height: number;
  status?:
    | "preparing"
    | "queued"
    | "scanning"
    | "needs_review"
    | "complete"
    | "failed";
  error?: string;
  itemCount?: number;
  printedTotalMinor?: number | null;
  purchaseDateText?: string | null;
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
  accountingTotalMinor?: number;
  syncState?: "pending" | "synced" | "blocked";
  syncError?: string;
  syncIssue?: "failed" | "conflict";
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
