// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
     allocateSpendingCoins,
     SPENDING_COIN_TOTAL,
} from "../../src/features/summary/services/spending-coin-allocation.ts";

function values(food = 0, transport = 0, shopping = 0, other = 0) {
     return { food, transport, shopping, other };
}

function counts(food = 0, transport = 0, shopping = 0, other = 0) {
     return { food, transport, shopping, other };
}

function allocationCounts(input) {
     return Object.assign(
          counts(),
          Object.fromEntries(
               allocateSpendingCoins(input).map(({ category, count }) => [
                    category,
                    count,
               ]),
          ),
     );
}

test("allocates all ten coins to a single positive category", () => {
     assert.deepEqual(allocationCounts(values(1_000)), counts(10));
});

test("uses stable palette order to break balanced largest-remainder ties", () => {
     assert.deepEqual(
          allocationCounts(values(250, 250, 250, 250)),
          counts(3, 3, 2, 2),
     );
});

test("keeps exact uneven proportions when they map cleanly to ten coins", () => {
     assert.deepEqual(
          allocationCounts(values(500, 300, 200)),
          counts(5, 3, 2),
     );
});

test("guarantees one coin to every positive category in a skewed split", () => {
     assert.deepEqual(
          allocationCounts(values(970, 10, 10, 10)),
          counts(7, 1, 1, 1),
     );
});

test("keeps a tiny positive category visible", () => {
     assert.deepEqual(
          allocationCounts(values(900, 99, 1)),
          counts(8, 1, 1),
     );
});

test("ignores negative, zero, and non-finite values", () => {
     const allocation = allocateSpendingCoins({
          food: -100,
          transport: 200,
          shopping: Number.NaN,
          other: 0,
     });

     assert.deepEqual(allocation, [
          { category: "transport", count: 10, value: 200 },
     ]);
});

test("returns an empty allocation when there is no positive spending", () => {
     assert.deepEqual(allocateSpendingCoins(values()), []);
});

test("every positive category receives a coin and allocations total ten", () => {
     const scenarios = [
          values(1, 1, 1, 1),
          values(1_000, 1, 0, 0),
          values(43, 29, 19, 9),
          values(0, 42, 7, 3),
     ];

     for (const scenario of scenarios) {
          const allocation = allocateSpendingCoins(scenario);
          assert.equal(
               allocation.reduce((sum, row) => sum + row.count, 0),
               SPENDING_COIN_TOTAL,
          );
          assert.equal(allocation.every(({ count }) => count >= 1), true);
     }
});
