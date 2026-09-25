import type { Category } from "../../../types/domain.ts";

export const SPENDING_COIN_TOTAL = 10;

export const SPENDING_COIN_CATEGORY_ORDER = [
     "food",
     "transport",
     "shopping",
     "other",
] as const satisfies readonly Category[];

export type SpendingCoinAllocation = {
     category: Category;
     count: number;
     value: number;
};

/**
 * Converts positive category totals into a fixed ten-coin visualization.
 * Every positive category receives one coin before the remaining coins are
 * distributed with stable largest-remainder rounding.
 */
export function allocateSpendingCoins(
     categoryValues: Record<Category, number>,
): SpendingCoinAllocation[] {
     const positiveCategories = SPENDING_COIN_CATEGORY_ORDER.map(
          (category, order) => ({
               category,
               order,
               value: sanitizeValue(categoryValues[category]),
          }),
     ).filter(({ value }) => value > 0);

     if (positiveCategories.length === 0) return [];

     const positiveTotal = positiveCategories.reduce(
          (sum, { value }) => sum + value,
          0,
     );
     const remainingCoins = SPENDING_COIN_TOTAL - positiveCategories.length;
     const rows = positiveCategories.map((row) => ({
          ...row,
          count: 1,
          ideal: (row.value / positiveTotal) * SPENDING_COIN_TOTAL,
          extraQuota: 0,
          remainder: 0,
     }));

     if (remainingCoins > 0) {
          const residualTotal = rows.reduce(
               (sum, row) => sum + Math.max(0, row.ideal - 1),
               0,
          );

          for (const row of rows) {
               const residual = Math.max(0, row.ideal - 1);
               row.extraQuota =
                    residualTotal > 0
                         ? (residual / residualTotal) * remainingCoins
                         : (row.value / positiveTotal) * remainingCoins;
               const wholeCoins = Math.floor(row.extraQuota);
               row.count += wholeCoins;
               row.remainder = row.extraQuota - wholeCoins;
          }

          const assignedCoins = rows.reduce((sum, row) => sum + row.count, 0);
          const leftoverCoins = SPENDING_COIN_TOTAL - assignedCoins;
          const remainderOrder = [...rows].sort(
               (left, right) =>
                    right.remainder - left.remainder || left.order - right.order,
          );

          for (let index = 0; index < leftoverCoins; index += 1) {
               remainderOrder[index].count += 1;
          }
     }

     return rows.map(({ category, count, value }) => ({
          category,
          count,
          value,
     }));
}

function sanitizeValue(value: number) {
     return Number.isFinite(value) ? Math.max(0, value) : 0;
}
