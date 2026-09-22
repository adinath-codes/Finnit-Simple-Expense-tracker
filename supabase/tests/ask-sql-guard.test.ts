import assert from "node:assert/strict";
import { validateAskSql } from "../functions/_shared/ask-sql-guard.ts";

Deno.test("accepts bounded cohorts and amount, count, date, comparison calculations", async () => {
  const accepted: ["cohort" | "answer", string][] = [
    ["cohort", "SELECT id FROM ask_read.transactions WHERE merchant_name ILIKE '%Uber%' AND direction = 'expense'"],
    ["answer", "SELECT currency, sum(metric_minor) AS value_minor FROM matched GROUP BY currency"],
    ["answer", "SELECT count(*) AS value_count FROM matched"],
    ["answer", "SELECT occurred_on AS value_date, currency, sum(metric_minor) AS value_minor FROM matched GROUP BY occurred_on,currency ORDER BY value_minor DESC LIMIT 1"],
    ["answer", "SELECT date_trunc('month',occurred_on)::date AS value_date,currency,sum(metric_minor) AS value_minor FROM matched GROUP BY date_trunc('month',occurred_on),currency ORDER BY value_date LIMIT 5"],
  ];
  for (const [mode, sql] of accepted) assert.equal(await validateAskSql(sql, mode), sql);
});

Deno.test("rejects writes, hidden writes, other schemas, functions, unions, broad output and unapproved columns", async () => {
  const rejected: ["cohort" | "answer", string][] = [
    ["cohort", "DELETE FROM public.transactions RETURNING id"],
    ["cohort", "WITH x AS (DELETE FROM public.transactions RETURNING id) SELECT id FROM ask_read.transactions"],
    ["cohort", "SELECT id FROM public.transactions"],
    ["cohort", "SELECT id FROM ask_read.transactions; DROP TABLE public.transactions"],
    ["cohort", "SELECT id FROM ask_read.transactions WHERE pg_sleep(9) IS NULL"],
    ["cohort", "SELECT id FROM ask_read.transactions UNION SELECT id FROM public.transactions"],
    ["cohort", "SELECT id FROM ask_read.transactions WHERE user_id = '00000000-0000-0000-0000-000000000000'"],
    ["cohort", "SELECT id FROM ask_read.transactions /* comment */"],
    ["answer", "SELECT * FROM matched"],
    ["answer", "SELECT count(*) AS value_count FROM matched LIMIT 999999"],
    ["answer", "SELECT pg_sleep(9) AS value_count FROM matched"],
    ["answer", "SELECT count(*) AS value_count FROM matched JOIN public.transactions USING (id)"],
  ];
  for (const [mode, sql] of rejected) {
    await assert.rejects(validateAskSql(sql, mode), /unsafe_sql/, sql);
  }
});
