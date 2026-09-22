import { requireQuota, serve } from "../_shared/runtime.ts";
import { askSqlExplain, askSqlPage, askSqlSearch } from "../_shared/ask-sql.ts";

serve(async (body, ctx) => {
  await requireQuota(ctx);
  if (body.action === "page") return await askSqlPage(ctx, body);
  if (body.action === "explain") return await askSqlExplain(ctx, body);
  return await askSqlSearch(ctx, body);
});
