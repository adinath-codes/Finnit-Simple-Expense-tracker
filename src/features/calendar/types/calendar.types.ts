import type { Category } from "@/types/domain";

export type CalendarDay = {
  date: string;
  dayNumber: number;
  totalMinor: number;
  isToday: boolean;
  isSelected: boolean;
  isFuture: boolean;
};

export type CalendarMonth = {
  label: string;
  leadingBlankCount: number;
  totalMinor: number;
  categoryTotals: Record<Category, number>;
  days: CalendarDay[];
};

export type CalendarCategoryItem = {
  id: string;
  entryId: string;
  date: string;
  message: string;
  amountMinor: number;
  amountNeedsReview: boolean;
};
