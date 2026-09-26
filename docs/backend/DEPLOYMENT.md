# Finn journal and receipt backend deployment

The Text → Money → Categories → Search backend is deployed to the linked Finn
Supabase project. Receipt scanning is implemented in this repository but must be
deployed in the ordered release below. Ambiguous records deliberately require review.

The journal starts empty; no example transactions, presets, goals, or profile data are bundled.
The search page at `/search` and the journal use the same account-scoped durable
cache/outbox. Onboarding now leads into
the Supabase-backed sign-in screen, with email/password, Google OAuth, and Apple
OAuth options. Search requires an existing Supabase session; it never treats
the preview entries as synced financial records. In particular, do not feed the backend's mixed-currency records into
the preview's INR-only arithmetic or multiply transaction totals by quantity.

## 1. Set the deployment target and configuration

Use a dedicated Finn Supabase project with PostgreSQL 17 or newer. Supabase MCP
was used for project discovery and current documentation. The connected account
only listed “life outside”; that project was not assumed to belong to Finn and
was not changed.

Set the project's public URL and publishable key in an ignored local `.env` file.
The Expo app uses the public Supabase settings plus the public,
platform-specific RevenueCat SDK keys documented in
`docs/paywall/REVENUECAT.md`. The Supabase publishable key must start with
`sb_publishable_`; do not use an admin key. No RevenueCat secret API key belongs
in Expo.

Create an ignored `.env.server` containing only the following server settings,
using your Gemini API key:

```dotenv
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_EXTRACTION_MODEL=gemini-3.5-flash-lite
GEMINI_REASONING_MODEL=gemini-3.1-flash-lite
GEMINI_FAST_MODEL=gemini-3.5-flash-lite
GEMINI_MAX_OUTPUT_TOKENS=4096
GEMINI_TIMEOUT_MS=20000
GEMINI_EXTRACTION_INPUT_USD_PER_MILLION=0.30
GEMINI_EXTRACTION_OUTPUT_USD_PER_MILLION=2.50
GEMINI_REASONING_INPUT_USD_PER_MILLION=0.25
GEMINI_REASONING_OUTPUT_USD_PER_MILLION=1.50
GEMINI_FAST_INPUT_USD_PER_MILLION=0.30
GEMINI_FAST_OUTPUT_USD_PER_MILLION=2.50
FINN_AI_DAILY_LIMIT=60
FINN_AI_MONTHLY_LIMIT=600
FINN_AI_MINUTE_LIMIT=10
FINN_API_DAILY_LIMIT=1000
FINN_API_MONTHLY_LIMIT=20000
FINN_API_MINUTE_LIMIT=120
REVENUECAT_SECRET_API_KEY=sk_your_secret_revenuecat_api_key
REVENUECAT_ENTITLEMENT_ID=premium
REVENUECAT_PROJECT_ID=proj_your_revenuecat_project_id
REVENUECAT_ENTITLEMENT_RESOURCE_ID=entl_your_entitlement_resource_id
REVENUECAT_WEBHOOK_AUTHORIZATION=Bearer your-random-webhook-secret
# A URL for the dedicated finn_ask_reader login. Provision its password outside
# migrations and use the session-pooler host with TLS.
FINN_ASK_READ_DB_URL=postgresql://finn_ask_reader.PROJECT_REF:PASSWORD@POOLER_HOST:5432/postgres?sslmode=require
```

The role-specific price settings enable estimated cost reporting. Verify them
against the provider's current prices when deploying; token usage is recorded
even when a price is absent or invalid, and then estimated cost is null.

Financial extraction, corrections, and receipt reading use the extraction model.
Complex fixed-search and guarded SQL plans use the reasoning model. Short
verified-fact explanations use the fast model. Explicit stable IDs prevent a
moving alias from changing behavior silently. `GEMINI_MODEL` is deprecated and
no longer selects a model. There is no cross-model retry, so a provider failure
cannot silently consume a second quota reservation.

The linked production Gemini project returned `404 NOT_FOUND` for
`gemini-2.5-flash-lite` during the September 22, 2026 rollout. The verified fast
model is therefore the stable `gemini-3.5-flash-lite`; do not restore 2.5 without
first proving availability with the production API key.

Production verification also showed that 3.1 Flash-Lite generated valid guarded
SQL plans but failed strict amount-evidence validation for simple journal notes.
The extraction role therefore uses 3.5 Flash-Lite, which passed the same contract.
All Gemini requests use the selected model's provider-default thinking behavior;
Finn does not force a thinking level. This keeps each stable model compatible with
its supported thinking modes.

Supabase injects `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` and
`SUPABASE_SECRET_KEYS` into Edge Functions. The code uses the `default` named keys,
with fallback to legacy injected anon/service-role keys. Those admin credentials
never belong in Expo or committed examples.

## 2. Deploy the database, secrets, and functions

Run these yourself from the repository root, replacing `YOUR_FINN_PROJECT_REF`:

```bash
npx supabase login
npx supabase link --project-ref YOUR_FINN_PROJECT_REF
npx supabase db push
npx supabase secrets set --project-ref YOUR_FINN_PROJECT_REF --env-file .env.server
npx supabase functions deploy parse-entry correct-entry apply-preset ask-money ask-sql request-quota-review delete-account scan-receipt refresh-entitlement redeem-testing-code revenuecat-webhook --project-ref YOUR_FINN_PROJECT_REF
```

Apply all migrations in filename order:

- `supabase/migrations/20260919062838_finn_financial_journal.sql`: base schema and category/currency/merchant seeds.
- `supabase/migrations/20260919071006_finn_search_page.sql`: context cards, bounded search catalogs, cursor pages, journal revision tracking, and interpretation caching.
- `supabase/migrations/20260919082754_finn_onboarding_profile.sql`: the bounded, owner-only onboarding profile synchronized after local completion.
- `supabase/migrations/20260919113403_extra_ai_quota_and_support_requests.sql`: private, expiring per-user AI-call credits, deduplicated quota-review requests, and atomic minute/day/month guards.
- `supabase/migrations/20260919155015_receipt_scanning.sql`: receipt source records, extracted lines, signed discounts, receipt correction RPCs, and receipt-aware search display.
- `supabase/migrations/20260920030847_discard_receipt_images.sql`: removes persisted receipt-image fields and Storage access so only extracted receipt text/financial structure remains.
- `supabase/migrations/20260920090000_account_preferences_and_presets.sql`: owner-scoped settings and saved-entry presets, both synchronized through the authenticated Data API.
- `supabase/migrations/20260920160000_expand_spendable_iso_currencies.sql`: adds the current spendable ISO 4217 codes and exact minor-unit scales before clients can select them.
- `supabase/migrations/20260922022045_revision_aware_entry_enrichment.sql`: makes reparse claims revision-aware and exposes private mutation retries.
- `supabase/migrations/20260922035031_transaction_semantics_v2.sql`: adds hierarchical categories, transaction participants/contexts/allocations, exact amount components, AI-operation idempotency, and metric-aware search.
- `supabase/migrations/20260922085151_ask_finn_guarded_sql.sql`: creates the curated Ask Finn view, dedicated read role, owner policies, and expiring private SQL sessions.
- `supabase/migrations/20260922090903_ask_finn_function_privileges.sql`: removes an inherited public event-trigger function privilege from the reader.
- `supabase/migrations/20260922102945_ask_finn_auth_schema_usage.sql`: records the managed-auth compatibility attempt retained in deployed migration history.
- `supabase/migrations/20260922103031_ask_finn_claim_scope_no_auth.sql`: scopes the reader from the verified transaction-local subject without depending on managed `auth` schema grants.
- `supabase/migrations/20260922130000_revision_aware_caching.sql`: adds the revision change log and paged journal sync RPC, bounded private Ask/catalog caches, cache metrics, and realtime revision invalidation.
- `supabase/migrations/20260922165037_account_deletion_grace_period.sql`: adds private 30-day account-deletion requests, recovery cancellation, and the bounded hourly `pg_cron` purge.
- `supabase/migrations/20260925100000_revenuecat_entitlement_cache.sql`: adds the private webhook/reconciliation-backed entitlement snapshot used by latency-sensitive APIs.
- `supabase/migrations/20260926042659_tester_access_codes.sql`: adds hashed, capacity-limited tester codes, private redemption history, atomic reservation/completion RPCs, and the initial 25-account/30-day tester cohort.

The caching migration was applied to the linked Finn project on September 22,
2026. The RevenueCat entitlement-cache migration, existing-customer backfill,
webhook integration, and all dependent Edge Function bundles were deployed on
September 25, 2026. The public
schema types in `src/lib/supabase/generated.types.ts` were generated from that
deployed schema. No native client release is implied by these server steps.

Premium functions read the private local entitlement snapshot and never call
RevenueCat on the capture path. `refresh-entitlement` securely reconciles the
authenticated Supabase UUID at sign-in, purchase, restore, and offer-code
redemption. Configure RevenueCat's project webhook to POST all environments to
`https://YOUR_FINN_PROJECT_REF.supabase.co/functions/v1/revenuecat-webhook` and
send the exact `REVENUECAT_WEBHOOK_AUTHORIZATION` value as its Authorization
header. Both the RevenueCat secret key and webhook secret remain server-only.
The RevenueCat secret must be an API v2 key with **Customer information →
Customers → Read & write** permission because tester redemption grants a
promotional entitlement. `REVENUECAT_PROJECT_ID` is the `proj...`
resource ID and `REVENUECAT_ENTITLEMENT_RESOURCE_ID` is the `entl...` resource
ID; the human-facing entitlement lookup key remains
`REVENUECAT_ENTITLEMENT_ID`. A v1-only key will fail reconciliation before any
Gemini work begins.
The `delete-account` function intentionally remains available without Premium
so a paywalled user can delete their account.

The account-deletion grace-period migration and updated `delete-account`
function are deployed on the linked project. The function intentionally remains
available without Premium so subscription state can never prevent account
deletion.

The tester-code migration and `redeem-testing-code` function are repository
changes only until the database push and function deployment above are run.
The client never receives the RevenueCat secret or direct access to the private
code and redemption tables.

No separate seed step is needed. If the base backend is already deployed, push
the currency migration first, then redeploy `parse-entry`, `correct-entry`,
`ask-money`, and `scan-receipt` before shipping the expanded picker. Onboarding,
settings, and presets use the Data API directly with authenticated, owner-scoped
RLS. Saved-entry capture uses the authenticated `apply-preset` function so it can
commit exact user-approved values without reserving or calling Gemini.
CLI configuration was generated with `supabase init`, and the migration filename
was generated with `supabase migration new`.

Deploy all functions, not only the database. They are responsible for auth,
validation, quotas, parsing, and correction. `verify_jwt=false` in `config.toml`
supports modern API keys; it does **not** make these public APIs. Every handler
requires a bearer session token and validates it with `auth.getUser()` before any
privileged database operation. Normal reads and SQL search use the caller's RLS
client. Admin-only mutation RPCs receive the verified user's ID, never a body ID.

Email/password authentication is enabled by the app. In Supabase Authentication,
enable email signups, configure production SMTP and decide whether confirmation
is required. Add `finn://auth/callback` and `finn://reset-password` to the Auth
redirect allow list (plus the production HTTPS equivalents for web).

Enable Google and Apple in Supabase Authentication > Sign In / Providers. Google
requires a web OAuth client ID and secret whose authorized callback is the
Supabase callback shown in the dashboard. Apple requires an App ID/Services ID,
team and key details, and a periodically rotated OAuth client secret. Add the
same `finn://` redirect URLs above to Supabase; provider consoles still redirect
to Supabase's own `/auth/v1/callback`. For Finn, list
`com.finnit.app.service` before `com.finnit.app` in Apple Client IDs; the latter
is the shared iOS bundle ID and Android package. Provider credentials are external secrets
and intentionally do not belong in this repository.

Existing sessions can capture offline after their first sign-in. Signing out is
local to the current device and does not upload one account's cached notes to
another. `delete-account` verifies the caller's access token and creates a
private, idempotent deletion request whose server timestamp expires after 30
days. The app clears that account's local journal cache and onboarding answers,
then globally revokes refresh sessions. Signing in before expiry cancels the
request and confirms recovery in-app. The migration enables `pg_cron`; an hourly
bounded job permanently removes expired Auth users, allowing the schema's
`ON DELETE CASCADE` ownership links to remove synced journal data. A failed user
purge remains queued for a later run without blocking the rest of the batch.

Rebuild the native development app for the SDK 57 `expo-image-picker`,
`expo-image-manipulator`, `expo-file-system`, and `expo-crypto` modules. Restart
Expo after setting public environment variables.

### Receipt release order

1. If `receipt-images` was ever used, empty and delete it through the Supabase
   Storage API or Dashboard before the privacy migration. Never delete Storage
   rows with SQL because that orphans the physical files.
2. Push `20260919155015_receipt_scanning.sql`, then
   `20260920030847_discard_receipt_images.sql`.
3. Deploy `correct-entry` and `scan-receipt`, then verify the existing Gemini
   and quota secrets.
4. Run `npx supabase db lint --linked --level warning` and the Supabase Security
   and Performance advisors. Test two authenticated users cannot read the other
   user's extracted receipt metadata or lines.
5. Release the rebuilt Expo client.

`scan-receipt` accepts the normalized JPEG as transient authenticated multipart
data and forwards it to Gemini without writing it to Storage, Postgres, logs, or
the response. Do not send `GEMINI_API_KEY` to Expo. Receipt images, OCR text, and
model responses must not be written to ordinary application logs.

### Quota increases and support review

Normal accounts use the server defaults and have no override row. Grant a
temporary monthly allowance only after verifying the target auth user ID:

```sql
insert into finn_private.extra_ai_quota(user_id, extra_monthly_calls, expires_at, reason)
values ('USER_UUID', 300, now() + interval '30 days', 'Support-approved increase')
on conflict(user_id) do update
set extra_monthly_calls = excluded.extra_monthly_calls,
    expires_at = excluded.expires_at,
    reason = excluded.reason,
    updated_at = now();
```

Extra credits do not raise the global minute or daily guards. Contact-support
taps are deduplicated by user in `finn_private.ai_quota_support_requests`; resolve
one by setting `status='resolved'` and `resolved_at=now()`. The app also opens a
prefilled message to the support address. No SMTP credential belongs in the app
or repository.

## 3. API contracts

All endpoints are `POST /functions/v1/<name>`, with JSON, an `apikey` header
containing the publishable key, and `Authorization: Bearer <user access token>`.
The client helper `callBackend` supplies them and refreshes expiring sessions.

### Capture: `parse-entry`

```json
{
  "id": "74996398-bc0c-40e8-8ed0-a2aa8cb8bb4e",
  "raw_text": "lunch with Aswin 340 and Uber 280 yesterday",
  "captured_at": "2026-09-19T10:00:00+05:30",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "approximate_place": "Chennai, Tamil Nadu, India"
}
```

`approximate_place` is optional, entry-scoped city/region/country context. The
client never sends coordinates, a street address, or background location data.

Optional `selected_date` is the reference date selected in the journal. Omit it
to use capture time in the given timezone. Original text is preserved verbatim.
The entry uses its first transaction's effective day; each transaction also has
its own day for accurate search/calendar queries. A different payload with the
same capture ID produces a 409, rather than silently creating or altering money.

Clients may send `Accept: application/x-ndjson` to receive one streamed response.
The first optional event is a server-validated Gemini amount plan:

```json
{"type":"amount_preview","entry_id":"74996398-bc0c-40e8-8ed0-a2aa8cb8bb4e","preview":{"amount_minor":"34000","currency":"INR","scope":"user_share","estimated":true,"needs_review":false}}
{"type":"final","entry":{},"cached":false}
```

`scope` is `personal_total`, `user_share`, or `group_total`. Every preview is
provisional and stays outside authoritative transactions and aggregates. It is
emitted only after the complete first `amount_plans` array is grounded against
literal evidence and exact integer arithmetic. Mixed currencies, incompatible
scopes, incomplete plans, and missing amounts produce no preview. If headers
have already streamed and processing fails, the last event is
`{ "type": "warning", "code": "...", "retryable": true }`. Cached/idempotent
requests emit only `final` and do not call Gemini.

Clients without that Accept header keep the backwards-compatible JSON
`{ entry, cached }` response. New clients also accept that legacy JSON shape.
Normal text capture uses one Gemini request: `amount_plans` is generated first,
then transaction details, participants/contexts, ignored evidence, and the
interpretation summary continue in the same structured stream. The extraction
model uses minimal thinking without lowering the output cap. Receipt streaming
is unchanged.

`entry.extraction.transactions` keeps the
exact stated `amount_minor` plus its `primary_amount_role`; `group_total_minor`,
`user_share_minor`, and `paid_by_user_minor` are separate. Amount is null when
absent. Do not treat it as zero or multiply it by quantity again. Arithmetic such
as `2 × 100 + 1 × 20` is stored in `amount_components`; Gemini selects grounded
terms and the server calculates each line and total with integer arithmetic.
`original_text` is immutable even after corrections. SQL search/source results
also return money as strings.

The device stores a non-financial pending record before the request. The server
claims the exact entry/revision/input hash/schema/prompt/model tuple before Gemini;
completed retries return the persisted interpretation without another model call,
and stale interrupted claims can be retried. Provider or semantic-validation
failure leaves the local pending note available for retry without fabricating a
financial result.

Deploy `parse-entry` before releasing the streaming client. The Edge runtime
passes streaming `Response` objects through without JSON wrapping while keeping
the same authentication, Premium entitlement, quota, CORS, and bounded-body
checks. Stream timing metrics contain durations and a preview-emitted boolean
only—never note text, amount, currency, merchant, participants, or model output.

### Correction and deletion: `correct-entry`

For correction, send `action: "correct"`, a new UUID `operation_id`, the last
`expected_revision`, a full capture `input`, and the full edited `extraction`.
Use the same operation ID and exact body for a retry. Preserve capture timestamp
and timezone; update transaction `occurred_on` when correcting dates. Optional
`remember_rule: { merchant_key: "figma", category_id: "work" }` stores an explicit
personal rule. A correction does not run Gemini. It atomically replaces the
structured transactions, linked people/contexts and search document, and appends
an owner-only audit record. Category choices must come from `categories`.

For deletion:

```json
{
  "action": "delete",
  "id": "74996398-bc0c-40e8-8ed0-a2aa8cb8bb4e",
  "operation_id": "ef6b0ee0-68c7-43c9-aee6-e2314d584c55",
  "expected_revision": 2
}
```

Deletion is a tombstone: it excludes the entry from every search/insight and
prevents an old capture retry from resurrecting it. It retains the private source
and audit data; account erasure/retention controls are separate future work.
Conflicting revisions return 409. Clients must show/reconcile the newer version,
not automatically overwrite it. The local queue keeps blocked mutations intact.

Receipt corrections use `action: "correct_receipt"`, the current entry revision,
merchant/printed-total metadata, and the full ordered line list. Description,
quantity, amount, category, adjustment kind, and add/remove changes are validated
and reconciled deterministically without another model call. A failed scan can use
`action: "create_receipt_manual"`; it commits only the manually entered receipt
text and structured values, with no image dependency.

### Streaming receipt scan: `scan-receipt`

The authenticated multipart request contains a small JSON capture descriptor and
one normalized JPEG. The image exists only for the lifetime of that request and
the Gemini call. The response is NDJSON: zero or more `{ "type": "item" }` events
followed by one authoritative `{ "type": "final" }`, or a retryable/non-retryable
warning.

Gemini only transcribes and classifies visible receipt evidence into strict JSON.
The server parses money, signs explicit discounts, validates categories and
quantities, and performs all arithmetic. Exactly reconciled rows become individual
transactions. A mismatch keeps every line for review but uses the printed receipt
total as the single temporary accounting transaction, preventing double counting.
Low-confidence lines remain visible and are excluded from confirmed aggregates.
The selected journal date always owns the entry; a printed date is metadata only.

Scans are idempotent by entry ID plus the capture descriptor. A retry after server
commit returns stored lines without a second Gemini call. The device keeps the
normalized image only while an offline/retryable scan is pending and deletes it
after extraction or manual entry succeeds. Deletion tombstones the text entry and
removes any remaining local image; there is no backend image cleanup job.

### Search: `ask-money`

```json
{
  "query": "how much did I spend on Uber with Aswin last month?",
  "timezone": "Asia/Kolkata",
  "selected_range": { "start_date": "2026-09-01", "end_date": "2026-10-01" },
  "limit": 5
}
```

Explicit date words override the selected period; otherwise search defaults to
the selected range/current calendar month. All ranges have an exclusive end.
`last week` means the previous Monday–Sunday calendar week. `on the 12th` in capture
means the latest such date on or before the reference day. Ambiguous dates are
marked for review, not guessed.

The first response returns `applied_filters`, the selected `metric`, filter labels,
per-currency totals, known/unknown counts, and bounded transaction-level sources,
participants, contexts, splits, and amount components. Supported metrics are
`stated_amount`, `user_share`, `group_total`, `paid_by_user`, `owed_to_user`,
`user_owes`, `reimbursed`, and `gross_spend`. Totals are SQL sums across **all**
matches, never just the returned page. Unknown or review-required values remain
inspectable but are excluded from the requested metric. No implicit FX occurs.

Editable filter requests can send `filters` instead of `query`:

```json
{
  "filters": {
    "operation": "sum", "direction": "expense",
    "start_date": "2026-09-01", "end_date": "2026-10-01",
    "merchant_id": null, "category_id": "food",
    "person": null, "context": null, "text": null, "currency": "INR"
  }
}
```

For more items, send the returned `applied_filters` as `filters`, plus
`cursor: next_cursor`, `revision`, and `limit: 5`. Limits are 1–30. Nonzero offsets
are rejected. Subsequent pages use the `(occurred_on, entry_id, id)` cursor, perform
no model call, and omit totals/counts; clients retain the first page's answer.
If the journal changes between pages, `{ stale: true }` requests a fresh first
page instead of mixing old totals with changed items. The per-user revision is
incremented transactionally under a row lock so concurrent commits cannot bypass
this check. Updates made through Finn's capture/correction/deletion RPCs update
the parent journal entry and its revision.

`{ "action": "contexts", "timezone": "Asia/Kolkata" }` returns up to six contexts
with expense activity in the last 90 calendar days. Their confirmed per-currency
totals describe that same window, not a guessed lifetime trip cost. A context
links to a search with its exact name and range; an all-review currency shows
“Needs review” rather than zero spending.

The page submits only on a search action, never on each keystroke. Simple queries
use deterministic filters; complex supported queries use Gemini's structured
plan. Valid model interpretations are cached per user for 24 hours (up to 30
plans), keyed by question hash, day, selected range and the relevant catalog.
Pages and filter changes never call Gemini. Catalog payloads include only up to
50 matching entities of each type and the fixed category list. No transaction
history is sent to the model. Source items arrive in pages of five and are displayed
in a virtualized list with an explicit Show more button.

An unsupported fixed-plan question is offered to `ask-sql`. Gemini receives the
curated `ask_read.transactions` contract and returns two PostgreSQL SELECTs: one
matching transaction IDs and one calculating the typed answer from that cohort.
Both statements must pass the PostgreSQL 17 AST allowlist before execution. The
Edge Function runs them in a repeatable-read, read-only transaction through the
dedicated `finn_ask_reader` login with a five-second statement timeout. RLS, the
view, and transaction-local settings independently enforce the verified user and
a date window of at most ten years. The role has no table writes or callable
public functions.

Validated cohort SQL and its journal revision live for 15 minutes in a private
session. Pages fetch five source transactions without another SQL-generation
call and fail stale if the journal revision changes. Gemini explanations receive
only the verified answer rows, count, and range; the client uses factual fixed
text if explanation generation fails. Invalid model SQL executes nothing and
returns the clarification state.

## 4. App integration boundary

The journal provider now adapts the account-scoped durable cache into the
four-category UI model while preserving exact backend category IDs for later
corrections. Search keeps its own authenticated hook and displays exact backend
money. The live capture/auth integration uses these service entry points:

- `SessionProvider` restores the persisted Supabase session and gates onboarding,
  authentication, and private routes.
- `signInWithEmail()` / `createAccountWithEmail()` and
  `signInWithSocialProvider()` establish the user's explicit session.
- `createCaptureInput()` generates the durable request UUID once.
- `captureJournalNote(input)` persists the note and outbox before returning.
- `listLocalJournal()` / `subscribeJournalCache()` power an offline journal.
- `startJournalSync()` mounts foreground/reconnect polling; it returns cleanup.
- `refreshJournal()` fetches remote data without overwriting pending local edits.
- `refreshJournalCatalog()` caches personal rules and names for offline parsing.
- `correctJournalEntry()` / `deleteJournalEntry()` queue revision-checked writes.
- Saved-entry CRUD and settings use the account cache as an offline-first source
  and reconcile through owner-scoped Data API tables; applying a saved entry
  creates a normal outbox-backed capture. Goals remain device-local.
- `searchJournal()` / `spendingSummary()` return server-computed money; `recentSearchContexts()` loads the search landing cards.
- `financialInsight()` reads the RLS-protected SQL insight views.

The outbox uses account-scoped SQLite tables on iOS/Android and an
account-scoped AsyncStorage document on web. Native entry+job writes use one
exclusive transaction; all platforms retain serialized writes, exponential
backoff, stable IDs, and per-entry ordering. The offline store is not encrypted.
A cache read/storage
failure rejects capture; journal and quick-capture callers keep the draft and
show a retryable local error. Corrections are accepted after the prior change
for that entry has synchronized. Pending and permanently blocked jobs remain
visible in the journal. Pending and failed changes are labeled in place, retries
are entry-scoped, and revision conflicts offer an explicit local-or-synced choice.

## 5. Financial rules and deliberate limits

- Money parsing uses decimal strings and BigInt; Postgres uses bigint/numeric.
  Currency scales include 0, 2 and 3 decimal places. No floating-point money math.
- Quantities, ordinal dates, times, account-like numbers and percentages do not
  automatically become prices. `2 coffees at Starbucks` keeps amount null.
- `2 notebooks 120 each` multiplies a proven unit price by quantity exactly;
  `3 coffees for 450` preserves 450 as the transaction total.
- AI amounts must select numeric evidence already found by the deterministic
  scanner. Invented amounts, duplicate token use, ungrounded entities and
  unreconciled omitted amounts are rejected.
- A total plus a detailed breakdown is held for reconciliation. The model cannot
  count both; an omitted grand total must exactly equal the selected line totals.
- Personal rules beat merchant aliases, which beat keywords, then Gemini, then
  Other. Sources and confidence remain auditable. The MVP category set is fixed.
- People/contexts label the whole journal entry. Their spending views attribute
  an entry's expenses to each linked person/context; those group totals are not
  mutually exclusive and must not be added together.
- Lending balances use explicit counterparties and repayment cash direction.
  `owes me`/`I owe` may describe an existing balance, so they stay review-required.
- Recurring results are **candidates** (a merchant seen in at least three distinct
  months), not proof of an active subscription. No future payment is invented.
- Supported currency codes are in `currencies` and the shared contract. Ambiguous
  comma-decimal locales, unsupported currencies, fractional quantities, verbal
  amounts and complex date expressions can require correction. Prices are never
  estimated from menus/location/web search.
- FX-rate ingestion, precise location, paywall and remaining live capture UI are
  outside this text-backend pass.
  They remain separate MVP work; no stub pretends to perform them.

## 6. Observability and follow-up validation

`extraction_audits` stores parser output, model output (including rejected interpretations), confidence,
and corrections under owner RLS. `backend_events` records parser outcomes, AI
calls/tokens/optional cost, failures, corrections, and search success/zero results.
Service logs contain error codes and HTTP status only, not notes, tokens or model
responses. Private UTC day/month counters enforce AI/API limits atomically.

Client cache telemetry contains only enum cache names, hit/miss counts, latency
buckets, row counts, and response byte totals. It never submits questions,
answers, notes, amounts, receipt text, or cached payloads. Server plan,
explanation, and catalog events use the existing private backend event table.

Release the database migration before any dependent client or function. Ship
delta sync/refresh/Ask caches first and retain the legacy full-refresh fallback
for one client release. Enable the SQLite client only after delta-sync errors are
below 0.5%, reconciliation mismatches remain zero, and median transferred bytes
fall by at least 80%. Native releases must be rebuilt after adding `expo-sqlite`;
web continues to use the same repository contract over AsyncStorage.

Client type checking, lint, the deterministic journal, receipt, money,
currency, search, preset-scale, and explanation-cache tests, plus Node SQLite
schema/transaction checks, are part of this change. A local database reset/lint
still requires Docker or Podman. Before a dependent client release, run the
live two-user RLS/delta-pagination suite against a staging project and complete
the Android migration/offline/reconnect/account-switching checklist on a
connected device. The September 22 server rollout had a live owner-versus-
nonowner sync smoke check and receipt-line reconciliation; it did not complete
those client-release gates.

Reference documentation consulted: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[Gemini models](https://ai.google.dev/gemini-api/docs/models),
[Gemini structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output),
[Supabase API key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
