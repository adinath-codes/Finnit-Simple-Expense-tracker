export const JOURNAL_REMINDER_COUNT = 7;

export type JournalReminderCopy = {
  title: string;
  body: string;
};

export type TrialReminderEntitlement = {
  isActive: boolean;
  periodType: string;
  expirationDateMillis: number | null;
};

const TRIAL_REMINDER_LEAD_TIME_MS = 24 * 60 * 60 * 1_000;
const MINIMUM_SCHEDULE_DELAY_MS = 1_000;

const JOURNAL_REMINDER_COPY: readonly JournalReminderCopy[] = [
  {
    title: "Have you logged it, honey? ;)",
    body: "Tell me what happened with your money today — I’ll sort the rest.",
  },
  {
    title: "I’m curious — how much money, honey? ;)",
    body: "Drop today’s spending here before it slips your mind.",
  },
  {
    title: "I kept the page open, bro",
    body: "Add today’s expenses before forgetting them. Messy notes are welcome.",
  },
  {
    title: "I’m guarding your money story",
    body: "A quick note now keeps tomorrow’s blind spots away.",
  },
  {
    title: "I can’t journal what you don’t tell me ;)",
    body: "Give me today’s money update — I’ll keep it organized.",
  },
  {
    title: "I noticed a quiet page",
    body: "What happened with your money today, bro?",
  },
  {
    title: "I’ve got the memory. You’ve got the story.",
    body: "Log today before the little details wander off.",
  },
] as const;

export function journalReminderCopy(index: number): JournalReminderCopy {
  const normalized = ((index % JOURNAL_REMINDER_COPY.length) + JOURNAL_REMINDER_COPY.length) %
    JOURNAL_REMINDER_COPY.length;
  return JOURNAL_REMINDER_COPY[normalized];
}

export function parseReminderTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hour: 21, minute: 0 };
  const rawHour = Number(match[1]);
  const minute = Number(match[2]);
  if (rawHour < 1 || rawHour > 12 || minute < 0 || minute > 59) {
    return { hour: 21, minute: 0 };
  }
  const period = match[3].toUpperCase();
  return {
    hour: (rawHour % 12) + (period === "PM" ? 12 : 0),
    minute,
  };
}

export function nextJournalReminderDates(
  reminderTime: string,
  now = new Date(),
  loggedToday = false,
  count = JOURNAL_REMINDER_COUNT,
) {
  const { hour, minute } = parseReminderTime(reminderTime);
  const first = new Date(now);
  first.setHours(hour, minute, 0, 0);
  if (loggedToday || first.getTime() <= now.getTime()) first.setDate(first.getDate() + 1);

  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
}

/**
 * Schedule at the start of the trial's final 24 hours. Accelerated store
 * sandboxes and late app opens fall back to the midpoint of the time remaining
 * so the reminder still arrives before expiry.
 */
export function trialExpiryReminderDate(
  entitlement: TrialReminderEntitlement | null,
  now = new Date(),
) {
  const expiresAt = entitlement?.expirationDateMillis;
  if (
    !entitlement?.isActive ||
    entitlement.periodType.toUpperCase() !== "TRIAL" ||
    !expiresAt ||
    expiresAt <= now.getTime() + MINIMUM_SCHEDULE_DELAY_MS
  ) {
    return null;
  }

  const preferredTime = expiresAt - TRIAL_REMINDER_LEAD_TIME_MS;
  if (preferredTime > now.getTime() + MINIMUM_SCHEDULE_DELAY_MS) {
    return new Date(preferredTime);
  }

  return new Date(now.getTime() + Math.floor((expiresAt - now.getTime()) / 2));
}
