import { metric, requireQuota, rpc, serve } from "../_shared/runtime.ts";
import { generate } from "../_shared/gemini.ts";
import { parseSearch, validatePlan } from "../_shared/search.ts";
import { localDay, shiftDay } from "../_shared/dates.ts";
import { ApiError, date, object, text, uuid } from "../_shared/validation.ts";
import { contains } from "../_shared/parser.ts";
import type { Catalog, SearchPlan } from "../_shared/contracts.ts";

serve(async (body, ctx) => {
  await requireQuota(ctx);
  if (body.action === "contexts") {
    const timezone = text(body.timezone, 80);
    let today: string;
    try {
      today = localDay(new Date().toISOString(), timezone);
    } catch {
      throw new ApiError(400, "invalid_timezone");
    }
    return await rpc(ctx.db, "finn_active_contexts", {
      p_start: shiftDay(today, -89),
      p_end: shiftDay(today, 1),
    });
  }
  if (body.cursor && !body.filters)
    throw new ApiError(400, "pagination_requires_filters");
  const candidates = await rpc<Catalog>(ctx.db, "finn_search_catalog", {
    p_query: body.filters ? "" : text(body.query, 500),
    p_filters: body.filters ? object(body.filters) : null,
  });
  let plan: SearchPlan;
  let interpretation = "explicit_filters";
  if (body.filters) plan = validatePlan(body.filters, candidates);
  else {
    const query = text(body.query, 500);
    const timezone = text(body.timezone, 80);
    let reference: string;
    try {
      reference = localDay(new Date().toISOString(), timezone);
    } catch {
      throw new ApiError(400, "invalid_timezone");
    }
    const range = body.selected_range ? object(body.selected_range) : null;
    const parsed = parseSearch(
      query,
      reference,
      candidates,
      range
        ? { start_date: date(range.start_date), end_date: date(range.end_date) }
        : undefined,
    );
    plan = parsed.plan;
    if (parsed.unsupported)
      return {
        needs_filters: true,
        suggested_filters: plan,
        reason: "query_needs_explicit_filters",
      };
    interpretation = "deterministic";
    if (parsed.complex) {
      const cacheSource = JSON.stringify({
        query,
        reference,
        range,
        candidates,
        version: 3,
      });
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(cacheSource),
      );
      const cacheKey = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const { data: cached } = await ctx.db
        .from("search_plan_cache")
        .select("plan")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      let cachedPlan: SearchPlan | null = null;
      if (cached) {
        try {
          cachedPlan = validatePlan(cached.plan, candidates);
        } catch {
          /* Interpret again. */
        }
      }
      if (cachedPlan) {
        plan = cachedPlan;
        interpretation = "cached_model";
      } else {
        // Only matching entity names, never transactions or whole user history.
        const relevant = {
          merchants: candidates.merchants,
          aliases: candidates.aliases,
          people: candidates.people.filter((p) => contains(query, p.name)),
          contexts: candidates.contexts.filter((c) => contains(query, c.name)),
        };
        try {
          const nullable = { type: ["string", "null"] };
          const result = object(
            await generate(
              ctx,
              "Convert the query into filters only. Allowed operations sum/list. For comparisons, rankings, amount thresholds, exclusions, recurring-payment inference, debt balances or other unsupported operations return supported=false. Never broaden the requested period. Preserve every explicit merchant/person/context constraint; if it cannot resolve to a supplied candidate, return supported=false. Unknown proper names must remain in text. end_date is exclusive. A selected range is the default unless the query explicitly specifies a period. Do not answer or calculate.",
              {
                query,
                reference_date: reference,
                timezone,
                default_plan: plan,
                categories: candidates.categories,
                ...relevant,
              },
              {
                type: "object",
                required: ["supported", "plan"],
                properties: {
                  supported: { type: "boolean" },
                  plan: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "operation",
                      "direction",
                      "start_date",
                      "end_date",
                      "merchant_id",
                      "category_id",
                      "person",
                      "context",
                      "text",
                      "currency",
                    ],
                    properties: {
                      operation: { type: "string", enum: ["sum", "list"] },
                      direction: nullable,
                      start_date: { type: "string" },
                      end_date: { type: "string" },
                      merchant_id: nullable,
                      category_id: nullable,
                      person: nullable,
                      context: nullable,
                      text: nullable,
                      currency: nullable,
                    },
                  },
                },
              },
            ),
          );
          if (result.supported !== true)
            throw new ApiError(422, "query_needs_explicit_filters");
          const proposed = validatePlan(result.plan, candidates);
          if (
            parsed.periodRecognized &&
            (proposed.start_date !== plan.start_date ||
              proposed.end_date !== plan.end_date)
          )
            throw new ApiError(422, "query_needs_explicit_filters");
          if (
            parsed.directionRecognized &&
            proposed.direction !== plan.direction
          )
            throw new ApiError(422, "query_needs_explicit_filters");
          // Recognized names cannot be silently discarded by the model.
          for (const key of [
            "merchant_id",
            "category_id",
            "person",
            "context",
            "currency",
          ] as const)
            if (plan[key] && proposed[key] !== plan[key])
              throw new ApiError(422, "query_needs_explicit_filters");
          plan = proposed;
          interpretation = "structured_model";
          // Cache writes are best effort; a valid answer survives cache downtime.
          try {
            await rpc(ctx.admin, "finn_cache_search_plan", {
              p_user: ctx.userId,
              p_key: cacheKey,
              p_plan: plan,
            });
          } catch {
            /* optional cache */
          }
        } catch (error) {
          if (
            error instanceof ApiError &&
            error.code === "ai_quota_exhausted"
          )
            throw error;
          // Returning an overbroad numeric answer would be worse than requesting filters.
          return {
            needs_filters: true,
            suggested_filters: plan,
            reason: "query_needs_explicit_filters",
          };
        }
      }
    }
    plan = validatePlan(plan, candidates);
  }
  const limit = body.limit ?? 20;
  if (
    !Number.isInteger(limit) ||
    Number(limit) < 1 ||
    Number(limit) > 30 ||
    (body.offset !== undefined && body.offset !== 0)
  )
    throw new ApiError(400, "invalid_pagination");
  let cursor = null;
  if (body.cursor) {
    const c = object(body.cursor);
    cursor = { day: date(c.day), entry_id: uuid(c.entry_id), id: uuid(c.id) };
    if (typeof body.revision !== "string" || !/^\d{1,19}$/.test(body.revision))
      throw new ApiError(400, "invalid_revision");
  }
  const result = await rpc<Record<string, unknown>>(
    ctx.db,
    "finn_search_page",
    {
      p_filters: plan,
      p_limit: limit,
      p_cursor: cursor,
      p_revision: cursor ? body.revision : null,
    },
  );
  const filter_labels = {
    merchant:
      candidates.merchants.find((m) => m.id === plan.merchant_id)
        ?.canonical_name ?? null,
    category:
      candidates.categories.find((c) => c.id === plan.category_id)?.name ??
      null,
  };
  await metric(
    ctx,
    result.matching_count === 0 ? "search_zero_results" : "search_success",
  );
  return {
    ...result,
    applied_filters: plan,
    filter_labels,
    interpretation,
    person_context_scope: "entry",
    totals_scope: "all_matching_confirmed_transactions",
    currencies_combined: false,
  };
});
