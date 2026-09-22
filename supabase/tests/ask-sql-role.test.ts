import assert from "node:assert/strict";
import { Pool } from "jsr:@db/postgres@0.19.5";

const connectionUrl = Deno.env.get("FINN_ASK_READ_DB_URL");
const testUserId = Deno.env.get("FINN_ASK_TEST_USER_ID");

Deno.test({ name: "restricted role enforces journal scope and read-only access", ignore: !connectionUrl || !testUserId,
  fn: async () => {
    const pool = new Pool(connectionUrl!, 1);
    const db = await pool.connect();
    try {
      await db.queryArray("BEGIN READ ONLY");
      const count = async () => (await db.queryObject<{ n: number }>(
        "SELECT count(*)::integer AS n FROM ask_read.transactions"
      )).rows[0].n;
      assert.equal(await count(), 0, "no caller and no date window expose no rows");
      await db.queryArray("SELECT set_config('request.jwt.claim.sub',$1,true)", [testUserId!]);
      assert.equal(await count(), 0, "caller without date window exposes no rows");
      await db.queryArray("SELECT set_config('finn.ask_start','2020-01-01',true),set_config('finn.ask_end','2030-01-01',true)");
      assert.ok(await count() > 0, "test principal has matching journal rows");
      await db.queryArray("SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true)");
      assert.equal(await count(), 0, "another principal sees no rows");
      await db.queryArray("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('finn.ask_start','2000-01-01',true),set_config('finn.ask_end','2050-01-01',true)", [testUserId!]);
      assert.equal(await count(), 0, "a window above ten years exposes no rows");
      await db.queryArray("ROLLBACK");

      const privileges = (await db.queryObject<{ write_table: boolean; call_commit: boolean; call_session: boolean }>(
        "SELECT has_table_privilege(current_user,'public.transactions','update') AS write_table, has_function_privilege(current_user,'public.finn_commit_entry(uuid,jsonb,jsonb,jsonb,integer,uuid,jsonb)','execute') AS call_commit, has_function_privilege(current_user,'public.finn_store_ask_sql_session(uuid,text,text,text,jsonb,integer,text,date,date,text)','execute') AS call_session"
      )).rows[0];
      assert.deepEqual(privileges, { write_table: false, call_commit: false, call_session: false });
      await db.queryArray("BEGIN READ ONLY");
      await assert.rejects(db.queryArray("UPDATE public.transactions SET description=description WHERE false"), /permission denied|read-only/i);
      await db.queryArray("ROLLBACK");
      await db.queryArray("BEGIN READ ONLY");
      await assert.rejects(db.queryArray("SELECT count(*) FROM finn_private.ask_sql_sessions"), /permission denied/i);
      await db.queryArray("ROLLBACK");
    } finally {
      db.release();
      await pool.end();
    }
  },
});

Deno.test({ name: "answer amounts equal five-at-a-time source transactions by currency", ignore: !connectionUrl || !testUserId,
  fn: async () => {
    const pool = new Pool(connectionUrl!, 1);
    const db = await pool.connect();
    try {
      await db.queryArray("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await db.queryArray("SET LOCAL statement_timeout = '5s'");
      await db.queryArray("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('finn.ask_start','2020-01-01',true),set_config('finn.ask_end','2030-01-01',true)", [testUserId!]);
      const matched = "WITH matched AS MATERIALIZED (SELECT t.*,t.user_share_minor AS metric_minor FROM ask_read.transactions t JOIN (SELECT id FROM ask_read.transactions) c ON c.id=t.id)";
      const answers = (await db.queryObject<{ currency: string; value_minor: string | null }>(
        `${matched} SELECT currency,sum(metric_minor) AS value_minor FROM matched GROUP BY currency`
      )).rows;
      const count = (await db.queryObject<{ n: number }>(`${matched} SELECT count(*)::integer AS n FROM matched`)).rows[0].n;
      const sourceTotals = new Map<string, bigint>();
      type SourceRow = { id: string; entry_id: string; occurred_on: Date; currency: string; metric_minor: bigint | null };
      let cursor: { occurred_on: Date; entry_id: string; id: string } | null = null;
      let seen = 0;
      while (true) {
        const where: string = cursor ? "WHERE (occurred_on,entry_id,id)<($1::date,$2::uuid,$3::uuid)" : "";
        const rows: SourceRow[] = (await db.queryObject<SourceRow>(
          `${matched} SELECT id,entry_id,occurred_on,currency,metric_minor FROM matched ${where} ORDER BY occurred_on DESC,entry_id DESC,id DESC LIMIT 5`,
          cursor ? [cursor.occurred_on, cursor.entry_id, cursor.id] : [],
        )).rows;
        if (!rows.length) break;
        for (const row of rows) {
          seen++;
          if (row.metric_minor != null) sourceTotals.set(row.currency, (sourceTotals.get(row.currency) ?? 0n) + BigInt(row.metric_minor));
        }
        cursor = rows.at(-1)!;
      }
      assert.equal(seen, count);
      for (const answer of answers) assert.equal(BigInt(answer.value_minor ?? "0"), sourceTotals.get(answer.currency) ?? 0n);
      await db.queryArray("ROLLBACK");
    } finally {
      db.release();
      await pool.end();
    }
  },
});
