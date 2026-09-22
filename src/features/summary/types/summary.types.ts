import type { Category } from "@/types/domain";

export type SummaryPeriod = "week" | "month";

export type PeriodSummary = {
  period: SummaryPeriod;
  startDate: string;
  endDate: string;
  label: string;
  totalMinor: number;
  categoryTotals: Record<Category, number>;
};
