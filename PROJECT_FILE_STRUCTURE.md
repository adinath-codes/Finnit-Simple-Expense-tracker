# Finn Project File Structure

> Fast architecture index for agents and contributors.
>
> Start here before searching the repository. This file describes ownership, intended routes, and the purpose of every scaffolded source file. The journal starts empty; unused feature placeholders remain intentionally unimplemented.

## Canonical references — read only when relevant

| File                        | Read when the task affects                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `PROJECT_CORE_IDEA.md`      | Product scope, domain behavior, data semantics, privacy, offline reliability, AI responsibilities, or MVP priority. |
| `PRODUCT_DESIGN.md`         | UI, UX, layout, visual styling, sheets, motion, native feel, or interaction details.                                |
| `PROJECT_FILE_STRUCTURE.md` | File location, module ownership, route placement, or architecture navigation. Start here.                           |
| `AGENTS.md`                 | Agent working rules and the required Expo SDK 57 documentation check.                                               |

Do not load both canonical product documents for routine maintenance. Search their headings and read only the sections relevant to the task.

## Browser product-video rig: `demo-web/`

`demo-web` is an isolated Expo web build that executes the production root
layout and route modules from `src/app`. It does not clone Finn's interface.
Metro swaps only backend-facing providers and services for local demo adapters,
so future production UI and motion changes are inherited on the next demo build
without entering the production application bundle.

| Path | Ownership |
| ---- | --------- |
| `demo-web/app/` | Thin production route bridges plus the demo-only `/studio` control surface; Calendar, Entry Details, and Settings add only their missing web sheet presentation. |
| `demo-web/src/demo/studio/` | iPhone/Dynamic Island frame, frame-only recording mode, and editable demo controls. |
| `demo-web/src/demo/components/web-form-sheet-route.tsx` | Demo-only web presenter that keeps production Calendar, Entry Details, and Settings content in an iOS-style bottom sheet over the production Journal screen. |
| `demo-web/src/demo/components/ios-demo-keyboard.tsx` | Interactive browser-only iOS keyboard for the exact production text inputs, including selection-aware typing, Shift/Caps Lock, number/symbol/emoji modes, Return actions, and deterministic demo-safe dictation feedback. |
| `demo-web/src/demo/components/ios-demo-keyboard.css` | Demo-only iOS keyboard geometry, key states, accessibility focus treatment, and home-indicator styling. |
| `demo-web/src/demo/components/motion.tsx` | Demo-only Journal-row adapter that removes Reanimated's web remount entrance while leaving every other production motion module untouched. |
| `demo-web/src/demo/providers/` | Local authenticated/premium/AI-consented app state adapters; the journal adapter wraps the IndexedDB workspace. |
| `demo-web/src/demo/hooks/use-search.ts` | Ask Finn proxy hook with configurable local delay, predetermined answers, source entries, and failure state. |
| `demo-web/src/demo/demo-web.css` | Narrow browser-only compatibility rules for the production app surface, including the journal paper's caret-without-box focus treatment. |
| `demo-web/src/react-dom.d.ts` | Minimal demo-workspace type declaration for rendering the keyboard portal outside the production root. |
| `demo-web/src/demo/services/` | No-op analytics/observability adapters plus local receipt and summary services. |
| `demo-web/src/demo/database.ts` | Browser IndexedDB workspace persistence and cross-frame synchronization. |
| `demo-web/src/demo/backend.ts` | Deterministic local journal parsing rules and configurable artificial latency. |
| `demo-web/src/demo/network-guard.ts` | Rejects cross-origin runtime requests from the demo app. |
| `demo-web/src/demo/default-workspace.ts` | Seed entries, scripted Ask Finn answers, journal rules, receipt output, and timing defaults. |
| `demo-web/metro.config.js` | Imports production source/assets and redirects only data-facing module boundaries to demo adapters. |
| `demo-web/package.json` | Separate demo-only dependencies and development/export/clean-preview commands; it is not referenced by the production package. |
| `demo-web/README.md` | Run, recording, persistence, and isolation instructions for the product-video rig. |

## iOS-first motion — September 19, 2026

Consult `docs/decisions/motion-platform-support.md` for the persistent per-effect iOS/Android support matrix and verification status. Apple page zoom and SF Symbol effects are iOS-only; shared Reanimated animations also run on Android. No automated or device validation was performed for this motion pass, per user instruction.

| File                                        | Ownership                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `docs/decisions/motion-platform-support.md` | Persistent motion decisions, exact missing Android effects, fallback behavior, and unverified device status. |
| `src/constants/motion.ts`                   | Shared durations and easing for press, loading, content, layout, and camera transitions.                     |
| `src/hooks/use-motion-preference.ts`        | Shared system reduced-motion subscription, including changes while the app is open.                          |
| `src/components/navigation/zoom-link.tsx`   | iOS 18+ native source-to-route zoom; standard links elsewhere and under reduced motion.                      |
| `src/components/ui/motion.tsx`              | Content fades, expandable sections, layout transitions, and disclosure chevrons.                             |
| `src/components/common/loading-state.tsx`   | Implemented loading variants, reusable skeleton blocks, and foreground/focus-aware shimmer.                  |

Shared buttons and icon buttons forward native refs and press props for Router links. Icons default to contextual effects and accept an explicit success trigger. Header, settings, composer, and journal-result launch controls use zoom links. Native startup remains on the configured splash until routing is known instead of mounting an in-app loading page. The journal keeps its header and composer usable while entry rows and totals skeletonize only when no durable snapshot is available. Search skeletonizes only pending contexts, answer values, explanations, and paged transaction rows. Entry references, preset forms, and custom date controls animate expansion. The camera owns measured toolbar-origin entry/reverse exit and retains its surface until dismissal completes. Calendar month/date feedback is restrained; existing processing and spending-panel motion remains.

## Implemented UI preview — September 2026

### Production observability — September 22, 2026

| File                                                        | Ownership                                                                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `index.js`                                                  | Initializes global production services before handing control to Expo Router.                                                |
| `src/lib/observability/sentry.ts`                           | Privacy-filtered Sentry initialization, navigation tracing, masked error replay, operational breadcrumbs, and error helpers. |
| `src/lib/observability/sentry-user-context.tsx`             | Synchronizes the authenticated opaque account ID and onboarding state into Sentry scope.                                     |
| `src/features/support/components/error-recovery-screen.tsx` | Friendly global render-error recovery with retry, Sentry-linked complaint feedback, and an optimistic toast.                 |
| `assets/images/character/error/recovery.webp`               | Optimized transparent Finn cutout calmly repairing a piggy bank for the global recovery screen.                              |
| `docs/observability/SENTRY.md`                              | Credential, EAS/source-map, privacy, sampling, and release-verification handoff.                                             |
| `.env.example`                                              | Safe local/EAS configuration template; real tokens remain outside source control.                                            |
| `app.json`                                                  | Expo app metadata plus the EAS project link, app-version runtime policy, and automatic update checks.                        |
| `eas.json`                                                  | Preview and production build profiles with matching EAS Update channels.                                                     |
| `docs/updates/EAS_UPDATE.md`                                | OTA release commands, preview-first rollout, native-build boundary, and runtime-version rules.                               |

Sentry is disabled in development and while the DSN is a placeholder. Production
events deliberately exclude financial text, receipt data/images, search questions,
emails, tokens, request bodies/query strings, console logs, screenshots, and view
hierarchies. Error replays mask all text, raster images, and vector graphics.

### Product analytics — September 23, 2026

| File                                                                | Ownership                                                                                                             |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/lib/analytics/analytics.ts`                                    | PostHog client, event contract, lifecycle/replay safeguards, and product-operation measurement.                       |
| `src/lib/analytics/analytics-provider.tsx`                          | Storage-ready opaque account identity, user opt-out synchronization, normalized manual screen capture, and app-open analytics. |
| `src/lib/analytics/analytics-sanitization.ts`                       | Outbound allowlist guard that removes financial/identity content, URLs, arbitrary objects, emails, and UUIDs.         |
| `docs/analytics/POSTHOG.md`                                         | Dashboard links, metric definitions, forbidden-data contract, environment, consent, replay, and verification handoff. |
| `tests/unit/analytics-sanitization.test.ts`                         | Regression coverage for financial/identity removal, route normalization, URL removal, and nested-payload rejection.   |
| `supabase/migrations/20260923100000_usage_analytics_preference.sql` | Durable account-level PostHog usage-analytics preference.                                                             |

PostHog touch autocapture is disabled. Screen routes are captured manually with
content identifiers normalized away, authenticated people use only the opaque
Supabase UUID, and no notes, amounts, receipt data, Ask queries, or emails are sent.
Users can disable product analytics from Settings.

### App Store Connect metadata — September 29, 2026

| File                                                                  | Ownership                                                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/app-store-connect/APP_PRIVACY_CATEGORY_AGE_RATING.md`           | Audited App Privacy data types, purposes, linkage/tracking answers, provider reconciliation, Finance category, and age-rating answers. |
| `docs/app-store-connect/APP_REVIEW_RELEASE_HANDOFF.md`                 | Live Apple/RevenueCat/EAS/Supabase audit, exact reviewer notes, reviewer-account requirements, IAP screenshot brief, Sandbox/TestFlight matrix, and submission order. |

### Onboarding question character flipbook — September 20, 2026

| File                                               | Ownership                                                                                                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/character/char-sprite-anim.tsx`    | Reusable `CharSpriteAnim` atlas player with hard frame cuts, UI-thread playback, live reduced-motion support, and active/background lifecycle handling.   |
| `src/components/character/character-animations.ts` | Typed animation names, bundled atlas sources, grid sizes, and per-frame hold durations.                                                                   |
| `assets/images/character/onboarding/*-base.png`    | Six transparent generated source scenes, each matched to one conversational onboarding question.                                                          |
| `assets/images/character/onboarding/*-sprite.webp` | Six optimized 1080 × 1080 registered 2 × 2 atlases rendered above the question copy. Local contours move inside a fixed 180-point viewport.               |
| `scripts/build-character-sprites.cjs`              | Deterministic Linux/ImageMagick atlas builder for registered contour deformation, imperfect green-shade variation, and optimized transparent WebP output. |
| `scripts/audit-assets.cjs`                         | Reports source and production-export asset size and enforces the 6 MiB project-owned shipped-asset budget.                                                |
| `assets/images/character/README.md`                | Asset provenance, question-to-animation map, rebuild command, component usage, and legacy generation prompts.                                             |

### Sign-in character scene — September 20, 2026

| File                                                      | Ownership                                                                                                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/auth/components/auth-screen.tsx`            | Sign-in composition, native iOS Apple control, Google/email controls, consent gating, and decorative edge-character/finance-doodle backdrop.    |
| `src/components/ui/custom-toast.tsx`                      | Reusable actionable Finn toast with error, warning, and info portraits, colored second line, dismissal, and reduced-motion-aware entrance/exit. |
| `src/components/ui/toast-provider.tsx`                    | App-wide queued toast host with deduplication, actions, accessible dismissal, and bounded display time.                                         |
| `src/features/auth/components/provider-marks.tsx`         | Official-style provider marks used by the non-native social controls.                                                                           |
| `assets/images/auth/finn-peek-left.webp`                  | Optimized transparent Finn cutout peeking from the left screen edge.                                                                            |
| `assets/images/auth/finn-peek-right.webp`                 | Optimized transparent Finn cutout presenting a receipt from the right screen edge.                                                              |
| `assets/images/character/toast/{error,warning,info}.webp` | 192 × 192 optimized transparent monochrome Finn portraits for toast states.                                                                     |

The sign-in surface uses the system-provided Apple authentication button on iOS
and a black, correctly branded fallback on Android/web. All sign-in methods stay
disabled until the user explicitly accepts the Privacy Policy and Terms of
Service; password recovery and both legal routes remain available beforehand.

Each of the six answer questions declares an `animType` that maps its new
conversational purpose onto the existing Finn atlas. The sprite stays registered
in the same 180-point position above the question copy while only its internal
frames change. Character, copy, and options share one scroll surface so choices
remain reachable with larger text or smaller screens.

The reference images are recreated with **Finn financial content**, confirmed by the user, and a small vector recreation of the reference’s green mountain mark. This direct request takes precedence over the earlier inspiration-only guidance in `PRODUCT_DESIGN.md`.

- `src/storage/journal-repository.ts` creates the empty first-run journal state. Components never import bundled data or call a backend directly.
- `src/providers/app-providers.tsx` subscribes to the authenticated account's durable cache, adapts cached text/receipt records for the UI, starts foreground sync/refresh, and exposes separate data, status, and action contexts. Entries, presets, goals, and settings are never acknowledged before their local write succeeds; sync-state changes no longer invalidate data-only consumers.

- `src/types/domain.ts` defines typed UI records; `src/utils/amounts.ts`, `currency.ts`, and `dates.ts` supply stored-entry totals, formatting, and date labels without interpreting draft text.
- `tests/unit/currency-display.test.ts` verifies that the Settings currency changes presentation symbols without converting or rescaling stored monetary values.
- `src/features/journal/components/journal-glyph.tsx` maps journal controls to the shared native-symbol layer: SF Symbols on iOS and Material Symbols on Android/web.
- `assets/images/character/header/` contains the optimized active Finn header/Ask artwork plus the notification-compatible paperwork PNG. `journal-header.tsx` displays the dollar-green rebus prototype, where Finn replaces both `i` glyphs.
- `assets/sf-pro-display/` contains the four loaded SF Pro Display faces. Regular, medium, and bold preserve full supplied coverage for user content; the heading-only Black face is subset to the app's UI ranges. The root layout loads them on Android/web before showing the app; iOS uses its native system font. `metro.config.js` registers the supplied uppercase `.OTF` extension.
- `src/components/ui/icon.tsx` maps SF Symbols on iOS to Material Symbols on Android/web and applies the native one-shot symbol effect requested by the nearest button. `button.tsx` supplies 120ms press feedback, triggers symbol effects, and respects reduced motion. `icon-button.tsx` supplies floating circular controls.
- `src/components/ui/magic-type-text.tsx` supplies a reusable reduced-motion-aware character reveal while reserving the final text layout.
- `src/components/common/screen.tsx` supplies the warm canvas, optional journal peach-to-lilac gradient, and desktop width limit. `src/components/sheets/app-sheet.tsx` owns sheet chrome, scrolling, dismissal, SDK-57 keyboard synchronization, and sticky footer spacing. `src/components/ui/use-rotating-placeholder.ts` shares the journal's reduced-motion-aware typing cadence with focused correction inputs.
- Implemented journal components: `journal-screen.tsx`, `journal-header.tsx`, `journal-entry-card.tsx`, `journal-composer.tsx`, `journal-processing-status.tsx`, and `journal-glyph.tsx`. The blank paper is the input; focusing it reveals the saved-entry/add, camera, and green-tick toolbar, and keyboard dismissal restores the compact totals pill. Offline and ordinary sync failures stay silent while the durable outbox retries them automatically; only a cross-device revision conflict surfaces because it needs a version choice. Drafts show only a subtle bouncing ellipsis while typing; only the tick or Return starts capture and parsing, with no artificial processing delay. Composer and in-place edit drafts persist locally through blur. The draft dots open note options. The camera action opens the permission-aware `expo-camera` preview with gallery import, persists and normalizes the image locally for offline retry, and sends it only as a transient authenticated parsing request. Successful extraction retains text/structured values and deletes the local image. Scanned receipts render as one generated journal sentence with the extracted total; their itemized arithmetic stays in Entry Details behind tap-to-expand ellipsis.
- Implemented detail components: `entry-detail-sheet.tsx`, `transaction-breakdown.tsx`, and `finn-correction-composer.tsx`. The sheet shows arithmetic and participant allocations, keeps the source note immutable during durable Gemini corrections, and entries can become saved shortcuts.
- `features/presets/components/preset-list.tsx` owns search, create/edit/delete, and one-tap journal insertion that closes the sheet and shows the new entry on the main journal.
- `features/settings/components/settings-screen.tsx` owns currency preferences, saved-entry navigation, legal-document links, local sign-out, and a custom immediate-or-30-day account-deletion flow with subscription safeguards. From the hard paywall it automatically limits the sheet to restore purchases, legal and privacy links, support, sign-out, and deletion; subscribed accounts retain the full settings surface. Retired location and Back Tap opt-ins are forced off for existing accounts.
- `features/guidance/` owns durable per-account, one-time guidance and versioned feature announcements. First-note guidance is shown only on an empty journal; the saved-entry announcement links directly to its action.
- `features/notifications/` owns Finn's first-person reminder copy, the post-first-entry journal-reminder rationale, per-account one-time rationale state, Android reminder channels, seven-day rolling journal schedule, verified-trial expiry scheduling, and iOS mascot attachments. Every durable first text, preset, or receipt entry emits the same in-process first-entry event. A successful RevenueCat trial purchase may request notification permission to deliver the paywall-promised reminder; daily journal nudges still require their separate rationale and opt-in after the first entry. Reminder bodies deliberately omit financial amounts and expense details.
- `assets/images/notifications/finn-notification-icon.png` is the generated, build-time Android monochrome Finn tray icon. Rich notification imagery uses the existing `character/header/finn-paperwork.png` asset on iOS and in the custom permission rationale.
- `features/summary/components/spending-breakdown-card.tsx` owns the floating total's ten-coin category breakdown and rolling amount.
- `features/calendar/components/calendar-screen.tsx` owns month browsing, selected-day journal navigation, and the header control that morphs into private current-view month search.
- `features/onboarding/` owns a seven-chapter Finn conversation that alternates one paper-cut story page with one question page. Each of the six answer questions restores the existing registered Finn sprite animation above its copy; the final invitation remains typographic. The questions collect only a preferred name, worry moment, main tracking pain, capture preference, default currency, and desired month-end answer. Each story sentence writes itself character by character at the shortened cadence while its always-visible action fills left-to-right; the action remains tappable during that visual progress. Every selection and navigation step is serialized to an AsyncStorage draft so interrupted onboarding resumes exactly. The Supabase `user_onboarding` row is authoritative per account: a missing or incomplete row sends that account to the conversation, and another account can never inherit a local draft. Successful owner-only uploads delete the local answers/progress.

Implemented routes in addition to `/`: onboarding; sign-in/reset/callback; versioned Google Gemini consent; privacy and terms web redirects; entry, settings and preset sheets; calendar; legacy quick add; and search. New users see the intro, answer the ICP questions, and then authenticate; existing users can skip directly to sign-in without overwriting a prior remote onboarding profile. Email/password, Google OAuth, and Apple OAuth share the persisted Supabase session. Native sheets use Expo Router form sheets; the web preview uses Router form sheets. The old `finn://quick-add` deep link now returns to the journal.

Run the preview with `node node_modules/expo/bin/cli start --web`. Run type checking with `node node_modules/typescript/bin/tsc --noEmit`. Direct Node invocation avoids the colon-in-project-path issue with package-manager executable lookup.

## Implemented text backend — September 19, 2026

The text, receipt, and caching backend migrations are deployed to the linked Finn project; dependent Edge Functions include the new `apply-preset` route. Its client
search page reads authenticated Supabase data through its own hook. The main journal
provider starts empty and is wired to authenticated durable capture/cache/sync services.
Read `docs/backend/DEPLOYMENT.md` for deployment, API contracts, monetary semantics,
limits, and the current integration boundary.

| File                                                                         | Responsibility                                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/backend/DEPLOYMENT.md`                                                 | Deployment handoff, endpoint/client contracts, accuracy rules, and remaining UI/MVP work.                                                                                                                  |
| `supabase/migrations/20260919062838_finn_financial_journal.sql`              | Schema/seeds, RLS/grants, atomic revision/idempotency RPCs, private quotas, indexed SQL search and insight views.                                                                                          |
| `supabase/migrations/20260919071006_finn_search_page.sql`                    | Recent context totals, bounded catalogs, keyset result pages, serialized journal revision tracking, and owner-scoped interpretation cache.                                                                 |
| `supabase/migrations/20260919082754_finn_onboarding_profile.sql`             | Bounded onboarding answers, extracted defaults, grants, and owner-only RLS policies.                                                                                                                       |
| `supabase/migrations/20260919113403_extra_ai_quota_and_support_requests.sql` | Private expiring AI-call credits, deduplicated support requests, and atomic minute/day/month quota reservations.                                                                                           |
| `supabase/migrations/20260919155015_receipt_scanning.sql`                    | Receipt source type, private attachments/lines and bucket policies, signed adjustments, atomic scan/correction commits, and receipt-aware search display.                                                  |
| `supabase/migrations/20260920030847_discard_receipt_images.sql`              | Removes persisted receipt-image identifiers/metadata and Storage access; receipt images become transient parsing inputs only.                                                                              |
| `supabase/migrations/20260920090000_account_preferences_and_presets.sql`     | Owner-scoped settings and saved-entry preset records with authenticated RLS mutation policies.                                                                                                             |
| `supabase/migrations/20260920160000_expand_spendable_iso_currencies.sql`     | Additive ISO 4217 spendable-currency catalog expansion for onboarding, settings, and capture validation.                                                                                                   |
| `supabase/migrations/20260922022045_revision_aware_entry_enrichment.sql`     | Revision-scoped Gemini claims and private mutation lookup for idempotent text reparses.                                                                                                                    |
| `supabase/migrations/20260922035031_transaction_semantics_v2.sql`            | Hierarchical categories, amount roles, participants, allocations, transaction contexts/components, AI-operation idempotency, and metric-aware Ask Finn RPC.                                                |
| `supabase/migrations/20260922085151_ask_finn_guarded_sql.sql`                | Curated read-only journal view, dedicated Ask Finn reader role/RLS, and private expiring advanced-search sessions.                                                                                         |
| `supabase/migrations/20260922090903_ask_finn_function_privileges.sql`        | Removes the reader role's inherited access to a platform public event-trigger function.                                                                                                                    |
| `supabase/migrations/20260922102945_ask_finn_auth_schema_usage.sql`          | Deployed managed-auth compatibility migration retained for ordered production history.                                                                                                                     |
| `supabase/migrations/20260922103031_ask_finn_claim_scope_no_auth.sql`        | Verified-subject RLS helper and view policies that avoid protected auth-schema access.                                                                                                                     |
| `supabase/migrations/20260922130000_revision_aware_caching.sql`              | Account revision change log, fixed-snapshot delta sync, bounded Ask/catalog caches, cache metrics, and realtime invalidation.                                                                              |
| `supabase/migrations/20260922165037_account_deletion_grace_period.sql`       | Private 30-day deletion requests, cancellation RPCs, and an hourly bounded Cron purge of expired Auth users.                                                                                               |
| `supabase/migrations/20260923100000_usage_analytics_preference.sql`          | Durable per-account usage-analytics opt-out preference.                                                                                                                                                    |
| `supabase/migrations/20260925100000_revenuecat_entitlement_cache.sql`        | Private RevenueCat entitlement snapshot and service-role-only local premium-check/update RPCs.                                                                                                             |
| `supabase/migrations/20260926042659_tester_access_codes.sql`                 | Empty migration-history placeholder retained after removal of the non-IAP tester unlock.                                                                                                                   |
| `supabase/migrations/20260927090000_revoke_tester_access_codes.sql`          | Revokes all legacy tester codes and removes their reservation/completion RPCs while retaining private audit records.                                                                                       |
| `supabase/migrations/20260927100000_ask_finn_full_journal_analytics.sql`     | Security-invoker deterministic Ask Finn totals, counts, averages, rankings, breakdowns, comparisons, currency isolation, and evidence paging.                                                              |
| `supabase/migrations/20260927101000_ask_finn_v3_variable_scope.sql`          | Production-safe variable-scope repair for the deployed v3 analytics definition.                                                                                                                           |
| `supabase/migrations/20260927102000_ask_finn_v3_confirmed_evidence.sql`      | Ensures rankings, debt rows, comparisons, and evidence use confirmed contributing values only.                                                                                                            |
| `supabase/migrations/20260927103000_ask_finn_v3_evidence_count.sql`          | Adds the exact contributing-source count used by the Ask Finn evidence list.                                                                                                                               |
| `supabase/migrations/20260927120500_retry_failed_ai_operations_after_upgrade.sql` | Lets only failed, identity-matched AI operations retry after parser metadata upgrades while preserving strict completed/in-flight idempotency.                                                        |
| `supabase/migrations/20260927121500_clear_stale_ungrounded_split_failures.sql` | Clears only uncommitted extraction failures created by the former equal-split validator so queued captures can be parsed by the repaired validator.                                                  |
| `supabase/migrations/20260927122917_fix_transaction_context_identifier.sql` | Removes a PL/pgSQL identifier collision so entries with transaction contexts and structured item breakdowns commit successfully.                                                                    |
| `supabase/migrations/20260927184158_ai_consent_records.sql` | Adds versioned, owner-scoped Google Gemini grant/decline records with explicit RLS and least-privilege grants. |
| `supabase/migrations/20260929112404_revoke_platform_rls_helper_execute.sql` | Re-revokes anonymous and authenticated Data API execution of Supabase's platform-installed `rls_auto_enable` helper. |
| `supabase/config.toml`                                                       | CLI-generated local project settings and authenticated Edge Function entry points.                                                                                                                         |
| `supabase/.gitignore`                                                        | Excludes CLI project links, temporary files and local secrets.                                                                                                                                             |
| `supabase/functions/deno.json`                                               | Server TypeScript runtime and formatting configuration, separate from Expo.                                                                                                                                |
| `supabase/functions/_shared/contracts.ts`                                    | Pure shared wire contracts, supported currencies/scales, extraction and search plans.                                                                                                                      |
| `supabase/functions/_shared/ai-consent-contract.ts`                          | Shared policy version, Google Gemini provider name, and disclosed financial-data categories.                                                                                                               |
| `supabase/functions/_shared/currencies.ts`                                   | Offline SIX List One snapshot with spendable ISO codes, names, issuing entities, minor units, validation, and local search.                                                                                |
| `supabase/functions/_shared/validation.ts`                                   | Runtime input, exact-money, entity, date and extraction validation.                                                                                                                                        |
| `supabase/functions/_shared/dates.ts`                                        | Timezone-aware calendar days, relative dates and period boundaries.                                                                                                                                        |
| `supabase/functions/_shared/money-evidence.ts`                               | Server-safe price evidence tokenization and exact minor-unit conversion; it makes no transaction or category decisions.                                                                                    |
| `supabase/functions/_shared/text.ts`                                         | Shared normalization and literal candidate matching for search and user rules.                                                                                                                             |
| `supabase/functions/_shared/pending-entry.ts`                                | Unparsed local placeholder used while an explicitly submitted note waits for Gemini.                                                                                                                       |
| `supabase/functions/_shared/entry-context.ts`                                | Adds the user-approved coarse place label to a validated interpretation.                                                                                                                                   |
| `supabase/functions/_shared/runtime.ts`                                      | Session verification, RLS/admin clients, local premium checks, request bounds, quotas, catalogs, and response-path-free private-text-free metrics.                                                         |
| `supabase/functions/_shared/revenuecat.ts`                                   | RevenueCat v2 active-entitlement reconciliation, expiry/lifetime validation, webhook user extraction, and private snapshot updates.                                                                        |
| `supabase/functions/_shared/gemini.ts`                                       | Role-based Gemini Flash-Lite selection, role-specific cost metrics, bounded structured output, and evidence-grounded interpretation validation.                                                            |
| `supabase/functions/_shared/json-stream.ts`                                  | Pure SSE frame splitting and balanced partial-JSON property extraction for streamed structured output.                                                                                                     |
| `supabase/functions/_shared/receipt.ts`                                      | Strict receipt evidence/money validation, partial JSON row parsing, reconciliation, and correction validation.                                                                                             |
| `supabase/functions/_shared/search.ts`                                       | Deterministic analytical-operation/entity/date parsing and normalized allowlisted multi-filter search-plan validation.                                                                                    |
| `supabase/functions/_shared/ask-sql-guard.ts`                                | PostgreSQL 17 AST allowlist for the curated cohort and typed answer SELECT shapes.                                                                                                                         |
| `supabase/functions/_shared/ask-sql.ts`                                      | Restricted-role read-only execution, answer/source consistency, private sessions, revision paging, and grounded explanations.                                                                              |
| `supabase/functions/_shared/cache.ts`                                        | Versioned SHA-256 cache keys and strict generic-explanation cacheability checks.                                                                                                                           |
| `supabase/functions/_shared/preset.ts`                                       | AI-free preset note formatting and deterministic extraction using ISO currency minor units.                                                                                                                |
| `supabase/tests/revenuecat.test.ts`                                          | Network-free validation of RevenueCat v2 active, lifetime, absent, expired, and malformed entitlement responses.                                                                                           |
| `supabase/tests/account-deletion.test.ts`                                    | Network-free Apple authorization-code exchange, refresh-token revocation, and cross-account mismatch protection.                                                                                          |
| `supabase/tests/support-email.test.ts`                                       | Verifies support notification bodies contain only bounded account/technical references and the explicit privacy notice.                                                                                   |
| `supabase/functions/parse-entry/index.ts`                                    | Idempotent Gemini-only text interpretation, grounded validation, and authoritative commit.                                                                                                                 |
| `supabase/functions/correct-entry/index.ts`                                  | Revision-checked text reparse, manual correction, and deletion with optional explicit personal category rules.                                                                                             |
| `supabase/functions/ask-money/index.ts`                                      | Single authenticated Ask Finn orchestrator for Settings-currency deterministic analytics and guarded unusual-question fallback.                                                                           |
| `supabase/functions/ask-sql/index.ts`                                        | Authenticated advanced Ask Finn route for validated SQL search, five-item pages, and verified-fact explanations.                                                                                           |
| `supabase/functions/request-quota-review/index.ts`                           | Authenticated, deduplicated support escalation for accounts that reach the AI allowance.                                                                                                                   |
| `supabase/functions/support-email/index.ts`                                  | Authenticated contact and error-report endpoint that sends privacy-bounded SMTP notifications without exposing credentials to Expo.                                                                        |
| `supabase/functions/_shared/support-email.ts`                                | Server-only SMTP transport, configuration validation, account reply routing, and journal-content-free support message formatting.                                                                           |
| `supabase/functions/delete-account/index.ts`                                 | Authenticated immediate deletion or 30-day scheduling/cancellation, with required Sign in with Apple token revocation and server-side expiry purge.                                                        |
| `supabase/functions/_shared/apple-auth.ts`                                   | Server-only Apple authorization-code exchange, identity matching, client-secret signing, and token revocation for account deletion.                                                                        |
| `supabase/functions/scan-receipt/index.ts`                                   | Authenticated transient multipart image parsing, Gemini structured-output stream, progressive NDJSON rows, and text-only authoritative commit.                                                             |
| `supabase/functions/apply-preset/index.ts`                                   | Idempotent, authenticated preset snapshot commit with no Gemini request.                                                                                                                                   |
| `supabase/functions/refresh-entitlement/index.ts`                            | Authenticated client reconciliation that refreshes the private entitlement snapshot outside capture requests.                                                                                              |
| `supabase/functions/revenuecat-webhook/index.ts`                             | Authorization-checked RevenueCat webhook that refreshes affected account snapshots and returns non-2xx for retryable failures.                                                                             |
| `src/features/auth/`                                                         | Session provider, same-screen email OTP sign-up/sign-in, Google/Apple OAuth, callback handling, recovery, and reset UI.                                                                                     |
| `src/features/ai-consent/`                                                   | Optional Google Gemini disclosure, per-account/version local-plus-remote consent decisions, first-use decline, and Settings grant/withdrawal controls; manual paid features remain available without AI consent. |
| `src/features/journal/components/manual-journal-entry-modal.tsx`             | Deterministic note, amount, and category capture used when Google Gemini data sharing is off.                                                                                                               |
| `src/features/legal/`                                                        | Canonical website redirect surface used by the in-app privacy and terms routes.                                                                                                                             |
| `src/constants/website-links.ts`                                             | Canonical Finn website URLs for legal, privacy, support, account deletion, and acknowledgement surfaces.                                                                                                    |
| `src/lib/supabase/client.ts`                                                 | Lazy publishable-key client, explicit optional anonymous auth and session identity.                                                                                                                        |
| `src/lib/supabase/session-storage.ts`                                        | Platform resolver for Supabase session persistence: SecureStore/Keychain on native and browser storage on web.                                                                                             |
| `src/lib/supabase/session-storage.native.ts`                                 | SecureStore-backed native Supabase session adapter with secure-first migration and plaintext AsyncStorage cleanup.                                                                                         |
| `src/lib/supabase/session-storage-migration.ts`                              | Testable secure-first migration contract that never deletes the legacy token until encrypted persistence succeeds.                                                                                        |
| `src/lib/supabase/database.types.ts`                                         | Shared backend wire types plus the generated SQL schema type exports.                                                                                                                                      |
| `src/lib/supabase/generated.types.ts`                                        | CLI-generated public-schema types from the linked Finn database after caching migration deployment.                                                                                                        |
| `src/lib/ai/api.ts`                                                          | Authenticated Edge requests, session refresh, bounded timeout and typed retry errors.                                                                                                                      |
| `src/lib/ai/entry-stream.ts`                                                 | Pure parse-entry NDJSON framing, event validation, and legacy JSON fallback checks.                                                                                                                        |
| `src/lib/offline/database.ts`                                                | Serialized account-scoped snapshot facade with a legacy whole-document path plus preferred entity-targeted immutable mutations and subscriptions.                                                          |
| `src/lib/offline/cache-mutation.ts`                                          | Targeted copy-on-write helper that clones only the entities declared by a mutation.                                                                                                                        |
| `src/lib/offline/cache-schema.ts`                                            | Versioned cache defaults, account keys, and lossless v1/v2-to-v3 normalization for semantic entries, receipts, outbox jobs, presets, goals, and settings.                                                  |
| `src/lib/offline/sync-retry-policy.ts`                                       | Pure AI-job classification and bounded model-validation retry policy; connectivity and provider outages remain deferred.                                                                                  |
| `src/lib/offline/sync-queue.ts`                                              | Network-aware concurrent text, receipt, and account queue lanes with per-entry ordering, retry backoff, reconnect replay, revision-conflict retention, and foreground lifecycle.                           |
| `src/lib/offline/persistent-store.types.ts`                                  | Shared native/web offline repository contract.                                                                                                                                                             |
| `src/lib/offline/persistent-store.ts`                                        | Platform-resolved offline repository entry point for shared imports.                                                                                                                                       |
| `src/lib/offline/persistent-store.native.ts`                                 | Normalized account-scoped SQLite persistence, entity-targeted row writes, atomic entry/outbox writes, verified rollback-safe AsyncStorage migration, and deletion.                                         |
| `src/lib/offline/persistent-store.web.ts`                                    | Web AsyncStorage repository implementation behind the shared contract.                                                                                                                                     |
| `src/lib/offline/sqlite.native.ts`                                           | Expo SQLite WAL/foreign-key schema for entries, receipts/lines, jobs, settings, presets, goals, metadata, Ask results, and metrics.                                                                        |
| `src/lib/offline/journal-retention.ts`                                       | Native persistence policy retaining completed journal and receipt details for today/yesterday while never pruning pending work or conflict recovery state.                                                 |
| `src/lib/offline/refresh-coordinator.ts`                                     | Account/resource request coalescing and 15-second/5-minute freshness policy.                                                                                                                               |
| `src/lib/offline/cache-metrics.ts`                                           | Locally aggregated, bounded, content-free cache telemetry.                                                                                                                                                 |
| `src/lib/cache/lru.ts`                                                       | Small bounded process-local LRU used by derived UI calculations.                                                                                                                                           |
| `src/types/sync.ts`                                                          | Cached entry, correction/deletion payload, durable job and cache types.                                                                                                                                    |
| `src/features/journal/services/journal-service.ts`                           | Durable capture, deterministic presets, fixed-snapshot delta sync, conflict shadows, one-release full-refresh fallback, and online-only hydration of historical ranges outside the two-day offline window. |
| `src/features/journal/services/journal-sync-merge.ts`                        | Pure complete-server-document merge with pending local edit and conflict-shadow protection.                                                                                                                |
| `src/features/journal/services/journal-adapter.ts`                           | Pure cached-record-to-UI adaptation and revision-safe text correction payload construction.                                                                                                                |
| `src/features/journal/services/sync-recovery-service.ts`                     | Entry-scoped retry plus explicit local-or-remote revision-conflict resolution.                                                                                                                             |
| `src/features/entries/services/entries-service.ts`                           | Offline reparse/manual correction/Gemini correction/deletion queue commands using server revisions while retaining the current breakdown during AI work.                                                   |
| `src/features/entries/services/breakdown-service.ts`                         | Pure amount-expression and participant-row derivation with exact minor-unit fallback.                                                                                                                      |
| `src/features/camera/services/receipt-service.ts`                            | Temporary local camera/gallery persistence, scan normalization, offline retry, correction, text-only remote hydration, and post-extraction image cleanup.                                                  |
| `supabase/tests/receipt.test.ts`                                             | Deterministic receipt parsing, arbitrary stream boundaries, reconciliation, discounts, confidence, limits, and malformed-output tests.                                                                     |
| `supabase/tests/money-evidence.test.ts`                                      | Exact minor-unit parsing, multiplier-aware money tokenization, deterministic equal allocations/remainder handling, mixed-currency evidence, and pending-entry safety tests.                                |
| `supabase/tests/search.test.ts`                                              | All-category analytical parsing, rankings, counts, comparisons, debt semantics, multi-entity/exclusion normalization, unsupported reasons, and legacy defaults.                                           |
| `supabase/tests/gemini-config.test.ts`                                       | Extraction/reasoning/fast model defaults, override isolation, identifier validation, and role-specific cost estimation.                                                                                    |
| `supabase/tests/gemini-preview.test.ts`                                      | Network-free amount-plan validation for personal, group, split, component, mixed-currency, duplicate, and unsafe preview cases.                                                                            |
| `supabase/tests/text-stream.test.ts`                                         | Arbitrary Gemini SSE chunk boundaries, escaped JSON evidence, and amount-plan completion gating.                                                                                                           |
| `supabase/tests/ask-sql-guard.test.ts`                                       | Valid aggregate/date/count plans plus hostile writes, CTEs, functions, schemas, joins, unions, and output-limit rejection.                                                                                 |
| `supabase/tests/ask-sql-role.test.ts`                                        | Live restricted-login RLS, date-window, write/function denial, and answer-to-five-item-source consistency checks.                                                                                          |
| `supabase/tests/ask_finn_v3_test.sql`                                        | Rollback-safe pgTAP fixtures for confirmed/missing amounts, category descendants, tied rankings, averages, comparisons, contexts, participants/debts, currency isolation, paging, stale revisions, and two-user RLS. |
| `supabase/migrations/20260922050000_fix_receipt_search_terms.sql`            | Post-deploy receipt writer repair that groups JSON text extraction correctly for linked-database lint and runtime execution.                                                                               |
| `src/features/ask/services/ask-service.ts`                                   | Search request and exact per-currency result contracts.                                                                                                                                                    |
| `src/features/ask/services/ask-presentation.ts`                              | Pure typed answer-row, factual fallback, evidence-count, unsupported-copy, and removable entity-filter presentation logic.                                                                                |
| `src/features/ask/services/ask-error.ts`                                     | Pure retry classification and user-safe Ask backend error copy.                                                                                                                                            |
| `src/features/ask/services/ask-result-cache.ts`                              | Web 50-root/24-hour revision-keyed Ask result cache; native uses the sibling SQLite implementation.                                                                                                        |
| `src/features/ask/services/ask-result-cache.native.ts`                       | Native SQLite-backed revision-keyed Ask answer storage.                                                                                                                                                    |
| `src/features/ask/services/ask-cache-policy.ts`                              | Successful, complete response eligibility and authoritative-revision reuse checks.                                                                                                                         |
| `src/features/ask/services/journal-revision-service.ts`                      | Coalesced authoritative journal revision verification for persisted Ask answers.                                                                                                                           |
| `src/features/summary/services/summary-service.ts`                           | Bounded revision-keyed derived summaries/breakdowns plus SQL-backed financial insight reads.                                                                                                               |
| `src/features/support/components/quota-reached-modal.tsx`                    | Calm global quota notice with a support-review action and email fallback.                                                                                                                                  |
| `src/features/support/services/`                                             | Quota-reached event fan-out and authenticated support-request submission.                                                                                                                                  |

## Status legend

- **Existing** — already contains working starter code.
- **Placeholder** — physically created and intentionally unimplemented.
- **Route placeholder** — directory exists with `.gitkeep`; add the route file only when implementing it so Expo Router does not register an invalid empty screen.
- **Planned** — create through the owning tool/workflow when implementation starts.
- **Generated** — produced by a CLI; do not hand-maintain.

## Architecture at a glance

```text
Expo Router route
    -> feature screen/component
        -> feature service/use case
            -> storage or shared service
                -> local offline database + Supabase
```

Rules:

1. `src/app/` owns routes and navigation composition only. Keep route files thin.
2. `src/features/<feature>/` owns product-specific UI, hooks, services, state, and feature types.
3. `src/components/` owns reusable UI with no Finn feature ownership.
4. `src/storage/` owns persistence interfaces; feature components should not query Supabase directly.
5. `src/lib/` owns third-party client setup and low-level infrastructure.
6. `src/services/` owns cross-feature device/network services.
7. `supabase/` owns database migrations, database tests, and server-side Edge Functions.
8. Capture is offline-first: save locally, render immediately, then sync/enrich in the background.
9. Store original journal text and structured financial data; never discard the original note.
10. Financial arithmetic stays deterministic. AI interprets language and context but does not become the source of truth for totals.

## Sketch-to-module map

| Sketch surface                                                     | Owning files                                                                                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home/journal with header, date, entries, keyboard composer         | `features/journal/components/journal-screen.tsx`, `journal-header.tsx`, `journal-day-section.tsx`, `journal-entry-card.tsx`, `journal-composer.tsx` |
| Calendar opened from the date/header                               | `features/calendar/components/calendar-screen.tsx`, `calendar-grid.tsx`, `calendar-day-cell.tsx`                                                    |
| Floating total and inline goal breakdown                           | `features/journal/components/journal-composer.tsx`, `features/summary/components/spending-breakdown-card.tsx`                                       |
| Item details bottom sheet with amount/quantity edits and breakdown | `features/entries/components/entry-detail-sheet.tsx`, `entry-editor.tsx`, `transaction-breakdown.tsx`                                               |
| Projects bottom sheet and “Add new item/project”                   | `features/projects/components/project-sheet.tsx`, `project-card.tsx`, `project-form.tsx`                                                            |
| Mini camera bottom sheet                                           | `features/camera/components/receipt-camera-sheet.tsx`, `receipt-review.tsx`                                                                         |
| Profile and settings                                               | `features/profile/components/profile-screen.tsx`, `features/settings/components/settings-screen.tsx`                                                |
| Ask financial history                                              | `features/ask/components/ask-screen.tsx`, `ask-thread.tsx`, `ask-composer.tsx`, `source-entry-list.tsx`                                             |

## Repository tree

```text
Finn/
├── AGENTS.md
├── PROJECT_CORE_IDEA.md
├── PRODUCT_DESIGN.md
├── PROJECT_FILE_STRUCTURE.md
├── app.json
├── package.json
├── metro.config.js
├── tsconfig.json
├── assets/
│   ├── expo.icon/
│   ├── logo/
│   │   └── long-light-bg.png
│   ├── sf-pro-display/
│   ├── marketing/
│   │   ├── app-store/
│   │   │   └── ipad/
│   │   │       ├── expense-breakdown-ipad.png
│   │   │       └── spending-insights-ipad.png
│   │   └── social/
│   │       ├── finnit-x-launch.png
│   │       ├── finnit-x-launch-clean.png
│   │       └── finnit-x-launch-source-screens.png
│   └── images/
│       └── journal/
│           └── finn-mark.svg
├── docs/
│   ├── app-store-connect/
│   └── decisions/
├── src/
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── explore.tsx
│   │   ├── calendar.tsx
│   │   ├── (auth)/
│   │   ├── onboarding/
│   │   ├── (tabs)/
│   │   ├── entries/
│   │   ├── projects/
│   │   └── settings/
│   ├── components/
│   │   ├── common/
│   │   ├── forms/
│   │   ├── navigation/
│   │   ├── sheets/
│   │   └── ui/
│   ├── features/
│   │   ├── journal/
│   │   ├── calendar/
│   │   ├── entries/
│   │   ├── summary/
│   │   ├── projects/
│   │   ├── camera/
│   │   ├── ask/
│   │   ├── presets/
│   │   ├── quick-capture/
│   │   ├── settings/
│   │   ├── profile/
│   │   ├── onboarding/
│   │   ├── support/
│   │   └── paywall/
│   ├── constants/
│   │   ├── website-links.ts
│   │   ├── theme.ts
│   │   └── typography.ts
│   ├── hooks/
│   ├── lib/
│   │   ├── ai/
│   │   ├── offline/
│   │   └── supabase/
│   ├── providers/
│   ├── services/
│   ├── storage/
│   ├── store/
│   ├── types/
│   └── utils/
├── supabase/
│   ├── functions/
│   │   └── _shared/
│   ├── migrations/
│   └── tests/
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Route layer: `src/app/`

### Existing route files

| File                           | Functionality                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `src/app/_layout.tsx`          | Light theme, mock data provider, gesture root, and native Stack form-sheet navigation. |
| `src/app/index.tsx`            | Thin route to the reference-matched financial journal.                                 |
| `src/app/onboarding/index.tsx` | Thin route to the implemented first-run Finn onboarding.                               |
| `src/app/explore.tsx`          | Redirects the old starter URL to the journal.                                          |

### Intended route map

Routes not listed in the implemented preview above remain planned. Expo Router registers every route module and requires a valid default screen export; unimplemented route directories contain only `.gitkeep`.

| Route                               | Functionality                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/app/(auth)/sign-in.tsx`        | Implemented same-screen email OTP, Google, and Apple sign-in/create-account route.                    |
| `src/app/(auth)/reset-password.tsx` | Password recovery completion route.                                                                   |
| `src/app/auth/callback.tsx`         | OAuth and email-confirmation callback route.                                                          |
| `src/app/legal/privacy.tsx`         | Bundled privacy policy, reachable from sign-in and Settings.                                          |
| `src/app/legal/terms.tsx`           | Bundled terms of service, reachable from sign-in and Settings.                                        |
| `src/app/onboarding/index.tsx`      | Implemented first-run onboarding route; `/` redirects here until local completion is durable.         |
| `src/app/(tabs)/_layout.tsx`        | Minimal Journal, Calendar, Ask, and Settings/Profile navigation. Prefer SDK 57-supported Router APIs. |
| `src/app/(tabs)/index.tsx`          | Primary Journal route.                                                                                |
| `src/app/(tabs)/calendar.tsx`       | Calendar/history navigation route.                                                                    |
| `src/app/(tabs)/ask.tsx`            | Planned legacy Ask route; search is presented by `/search`.                                           |
| `src/app/search.tsx`                | Thin route for the implemented natural-language search page.                                          |
| `src/app/(tabs)/settings.tsx`       | Settings/Profile route.                                                                               |
| `src/app/entries/[entryId].tsx`     | Deep-linkable entry detail/edit route or sheet presentation.                                          |
| `src/app/projects/[projectId].tsx`  | Deep-linkable project detail route or sheet presentation.                                             |
| `src/app/settings/presets.tsx`      | Preset management route.                                                                              |
| `src/app/quick-add.tsx`             | Legacy iOS Back Tap/Shortcut deep-link target that redirects to the journal.                          |
| `src/app/legal/privacy.tsx`         | Privacy policy route; account deletion remains in Settings.                                           |

## Shared components: `src/components/`

| File                                         | Functionality                                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/components/common/screen.tsx`           | Shared safe-area, max-width, background, and keyboard-aware screen shell.                                 |
| `src/components/common/empty-state.tsx`      | Calm reusable empty-content state.                                                                        |
| `src/components/common/error-state.tsx`      | Recoverable error message with retry affordance.                                                          |
| `src/components/common/loading-state.tsx`    | Non-disruptive shared loading state.                                                                      |
| `src/components/common/transaction-card.tsx` | Shared transaction surface for date, amount, journal message, and optional feature-owned details/actions. |
| `src/components/forms/amount-field.tsx`      | Editable amount field with currency-aware behavior.                                                       |
| `src/components/forms/currency-picker.tsx`   | Shared searchable ISO currency selector and display label used by Settings.                               |
| `src/components/navigation/app-header.tsx`   | Minimal shared app header primitive.                                                                      |
| `src/components/sheets/app-sheet.tsx`        | Accessible shared bottom-sheet wrapper and presentation defaults.                                         |
| `src/components/ui/button.tsx`               | Design-system button primitive.                                                                           |
| `src/components/ui/confirmation-modal.tsx`   | Shared app-styled confirmation card for destructive and state-replacement decisions; replaces native system alerts on every platform. |
| `src/components/ui/custom-toast.tsx`         | Compact animated status toast with Finn portrait, optional colored second line, action, and dismissal.    |
| `src/components/ui/toast-provider.tsx`       | Global queued toast state and safe-area overlay shared by authenticated features.                         |
| `src/components/ui/card.tsx`                 | Soft surface/card primitive.                                                                              |
| `src/components/ui/chip.tsx`                 | Compact suggestion, category, and filter chip primitive.                                                  |
| `src/components/ui/icon.tsx`                 | Cross-platform SF/Material icon map; no mascot artwork.                                                   |
| `src/components/ui/icon-button.tsx`          | Accessible icon-only button with touch target and pressed state.                                          |
| `src/components/ui/text-field.tsx`           | Shared text input primitive.                                                                              |
| `src/components/ui/magic-type-text.tsx`      | Reusable character-by-character text reveal with stable final layout and a Reduced Motion fallback.       |
| `src/components/ui/collapsible.tsx`          | Existing Expo starter collapsible; keep only if Finn needs it.                                            |
| `src/components/animated-icon.tsx`           | Legacy standalone Expo icon animation; it is not mounted during app startup.                              |
| `src/components/animated-icon.web.tsx`       | Web version of the starter icon animation.                                                                |
| `src/components/app-tabs.tsx`                | Existing starter tab navigator; replace during product navigation work.                                   |
| `src/components/app-tabs.web.tsx`            | Existing web tab implementation.                                                                          |
| `src/components/external-link.tsx`           | Existing cross-platform external link helper.                                                             |
| `src/components/hint-row.tsx`                | Existing starter hint UI; remove with starter screen.                                                     |
| `src/components/themed-text.tsx`             | Existing themed typography primitive.                                                                     |
| `src/components/themed-view.tsx`             | Existing themed surface primitive.                                                                        |
| `src/components/web-badge.tsx`               | Existing starter web badge; remove with starter screen.                                                   |

## Journal feature: `src/features/journal/`

| File                                              | Functionality                                                                                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/journal-screen.tsx`                   | Composes journal header, chronological entries, totals, presets, composer, and the guarded inline-edit resolution flow.                                                                            |
| `components/journal-glyph.tsx`                    | Fixed vector artwork for home toolbar and summary glyphs on every platform.                                                                                                                        |
| `components/journal-header.tsx`                   | Finn mark, selected date/calendar entry, and adjacent Ask Finn/settings buttons.                                                                                                                   |
| `components/journal-day-section.tsx`              | One chronological day group with daily total.                                                                                                                                                      |
| `components/journal-entry-card.tsx`               | Human-readable entry with amount and restrained metadata.                                                                                                                                          |
| `components/journal-entry-confirmation-modal.tsx` | Custom accessible recalculate/preserve and destructive-delete confirmation card for inline journal edits.                                                                                          |
| `components/journal-empty-prompt.tsx`             | Empty-day writing CTA with reduced-motion-aware rotating example text.                                                                                                                             |
| `components/journal-composer.tsx`                 | Primary natural-language input with camera, later voice, and explicit green-tick submit.                                                                                                           |
| `components/journal-processing-status.tsx`        | Reduced-motion-aware typing ellipsis, looping text-entry Thinking/Searching/Reading/Calculating and receipt Thinking/Scanning/Reading/Calculating shimmers, and sparkle-to-neutral amount handoff. |
| `hooks/use-journal.ts`                            | Queries and mutations for journal capture/browsing.                                                                                                                                                |
| `services/journal-service.ts`                     | Capture, retrieve, edit, and queue journal use cases.                                                                                                                                              |
| `services/journal-adapter.ts`                     | Pure durable-cache adaptation and correction payload construction.                                                                                                                                 |
| `services/journal-edit-flow.ts`                   | Pure inline-edit classification and recalculate-versus-preserve text-save planning.                                                                                                                |
| `services/sync-recovery-service.ts`               | Retry and local-or-remote conflict resolution for durable entry jobs.                                                                                                                              |
| `store/journal-draft-store.ts`                    | Account-scoped persisted composer and in-place edit drafts.                                                                                                                                        |
| `types/journal.types.ts`                          | Journal-only UI state and view models.                                                                                                                                                             |

## Calendar feature: `src/features/calendar/`

| File                                         | Functionality                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `components/calendar-screen.tsx`             | Calendar history-navigation surface with a persistent category selection, five-at-a-time transaction disclosure, and morphing month-search header. |
| `components/calendar-month-search.tsx`       | Minimal mascot empty states and gently staggered, deep-linkable local results for the month shown in the calendar.    |
| `components/calendar-grid.tsx`               | Month grid showing days with journal activity and optional totals.                                                  |
| `components/calendar-day-cell.tsx`           | Individual date cell and selection state.                                                                           |
| `components/calendar-spending-chart.tsx`     | Combined monthly total and accessible selectable category bars with active palette states.                          |
| `hooks/use-calendar-entries.ts`              | Loads entries/totals indexed by date range.                                                                         |
| `services/calendar-service.ts`               | Month range, selected date, and journal jump operations.                                                            |
| `services/calendar-category-items.ts`        | Pure month/category projection into stable per-item calendar transaction rows.                                      |
| `services/calendar-search.ts`                | Pure accent-insensitive month search across entry notes, merchants, items, and categories.                           |
| `types/calendar.types.ts`                    | Calendar cells, month ranges, activity, and category-item view models.                                              |
| `tests/unit/calendar-category-items.test.ts` | Month/category filtering plus private month-search matching, date bounds, accents, stable order, and empty-query coverage. |

## Entry details feature: `src/features/entries/`

| File                                      | Functionality                                                                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/entry-detail-sheet.tsx`       | Sheet shown after selecting a journal entry, with arithmetic, participant allocations, Finn interpretation artwork, and no source-reference panel. |
| `components/finn-correction-composer.tsx` | Keyboard-attached multiline Gemini correction input with a rotating reduced-motion-aware prompt and explicit green submit.                         |
| `components/entry-editor.tsx`             | Lightweight amount, quantity, date, category, merchant, and context correction.                                                                    |
| `components/transaction-breakdown.tsx`    | Multiple transactions/items parsed from one human note.                                                                                            |
| `components/receipt-preview.tsx`          | Temporary local receipt preview and post-extraction text-only privacy state.                                                                       |
| `services/breakdown-service.ts`           | Derives `*`/`+` amount expressions and expanded participant shares from authoritative extraction data.                                             |
| `services/entries-service.ts`             | Gemini reparse/correction, manual line correction, retry, and delete use cases.                                                                    |
| `types/entry.types.ts`                    | Entry editor and parsed-transaction feature types.                                                                                                 |

## Summary feature: `src/features/summary/`

| File                                          | Functionality                                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `components/spending-breakdown-card.tsx`      | Liquid floating-total card with a selectable ten-coin category visualization, alternating category icons, and rolling amount. |
| `components/category-summary.tsx`             | Restrained category rows or small bar chart.                                                                                  |
| `components/finn-thought-card.tsx`            | Plain-language insight based on real underlying records.                                                                      |
| `services/summary-service.ts`                 | Deterministic period totals and category aggregation.                                                                         |
| `services/spending-coin-allocation.ts`        | Pure constrained largest-remainder allocation of positive category totals into ten discrete coins.                            |
| `types/summary.types.ts`                      | Summary periods, category totals, and insight source types.                                                                   |
| `tests/unit/spending-coin-allocation.test.ts` | Ten-coin proportional allocation, minimum visibility, stable rounding, and empty-input coverage.                              |

## Projects feature: `src/features/projects/`

Projects preserve contextual grouping from the sketch without turning Finn into project-management software.

| File                           | Functionality                                                   |
| ------------------------------ | --------------------------------------------------------------- |
| `components/project-sheet.tsx` | Project list/detail sheet opened from relevant journal context. |
| `components/project-card.tsx`  | Project name, total, and recent activity.                       |
| `components/project-form.tsx`  | Minimal project creation/edit form.                             |
| `services/projects-service.ts` | Project CRUD and entry/transaction association.                 |
| `types/project.types.ts`       | Project and project-summary types.                              |

## Receipt camera feature: `src/features/camera/`

| File                                  | Functionality                                                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/receipt-camera-sheet.tsx` | Implemented compact permission-aware camera overlay with a rounded, clipped live preview, torch, camera flip, shutter, and denied/settings states. |
| `components/receipt-review.tsx`       | Implemented captured-photo preview with retake, close, and attach actions.                                                                         |
| `services/receipt-service.ts`         | Temporary local capture, transient multipart extraction, retry, and image cleanup.                                                                 |
| `types/receipt.types.ts`              | Local receipt-capture type for the camera and transient extraction handoff.                                                                        |

## Ask feature: `src/features/ask/`

| File                                    | Functionality                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ask-screen.tsx`             | Minimal light Ask Finn page with typed current-currency answers, removable entity filters, reason-specific unsupported states, evidence timeline, and five-item Show more paging. |
| `services/ask-presentation.ts`          | Pure rendering models for rankings, breakdowns, averages, counts, comparisons, factual fallback copy, filters, and evidence counts. |
| `services/ask-error.ts`                 | Pure retryability and user-facing backend-error classification. |
| `components/ask-date-range-popover.tsx` | Anchored light range picker with immediate month presets, platform-native date controls, draft validation, and exclusive-end conversion.                 |
| `components/ask-thread.tsx`             | User questions and grounded financial answers.                                                                                                           |
| `components/ask-composer.tsx`           | Financial-history question input.                                                                                                                        |
| `components/source-entry-list.tsx`      | Ask-specific transaction timeline with journal-date nodes, compact exact amounts, and entry-detail sheet links.                                          |
| `hooks/use-search.ts`                   | Auth-scoped fixed/advanced search, separate explanation loading, cancellation, private-session cursor paging, retry, and stale-result handling.          |
| `services/search-format.ts`             | Exact BigInt currency presentation plus full and compact inclusive/exclusive calendar-range formatting.                                                  |
| `services/ask-service.ts`               | Typed authenticated fixed/advanced search, explanation, context, and five-item source-page calls.                                                        |
| `types/ask.types.ts`                    | Typed amount/date/count/comparison answers, SQL sessions, exact-money sources, contexts, cursors, and response contracts.                                |

## Presets feature: `src/features/presets/`

| File                                 | Functionality                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `components/preset-list.tsx`         | Subtle repeated-expense shortcuts near the composer/settings.                                         |
| `components/preset-editor-sheet.tsx` | Create/edit/delete a user preset.                                                                     |
| `services/presets-service.ts`        | Offline-first preset writes and remote reconciliation.                                                |
| `services/preset-capture-service.ts` | One-tap preset-to-journal capture orchestration without coupling the preset and journal sync modules. |
| `services/preset-format.ts`          | Pure canonical note formatting for one-tap preset capture.                                            |
| `types/preset.types.ts`              | Preset definition and capture behavior.                                                               |

## Settings and profile features

| File                                                | Functionality                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `features/settings/components/settings-screen.tsx`  | Settings hub with a custom immediate-or-30-day deletion chooser, recovery rationale, and renewable-subscription cancellation warning. |
| `features/settings/components/currency-setting.tsx` | Base currency selection and current value.                                                                                     |
| `features/settings/services/settings-service.ts`    | Offline-first account preference writes, remote reconciliation, and disabling retired opt-ins.                                 |
| `features/settings/types/settings.types.ts`         | Preference models.                                                                                                             |
| `features/profile/components/profile-button.tsx`    | Small header button that opens profile/settings.                                                                               |
| `features/profile/components/profile-screen.tsx`    | Account, subscription, export, privacy, sign-out, and deletion entry points.                                                   |
| `features/profile/types/profile.types.ts`           | Profile presentation models.                                                                                                   |

## Guidance feature: `src/features/guidance/`

| File                                 | Functionality                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `components/guidance-toast-host.tsx` | Selects the first eligible unseen first-use or versioned feature message and wires its direct action. |
| `services/guidance-service.ts`       | Stores and clears per-account guidance message IDs in AsyncStorage so each version appears once.      |

## Quick capture feature: `src/features/quick-capture/`

| File                                  | Functionality                                             |
| ------------------------------------- | --------------------------------------------------------- |
| `components/quick-capture-screen.tsx` | Redirects legacy `finn://quick-add` links to the journal. |

## Onboarding and paywall features

| File                                                      | Functionality                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/onboarding/components/initial-story-screen.tsx` | One paper-cut Finn vignette and personalized sentence per story page, with a faster UI-thread character-by-character ink reveal, cursive quoted speech, selective Finn-green emphasis, a 0.7-second reading pause, lifecycle safety, and a complete still Reduced Motion branch.                                        |
| `features/onboarding/components/onboarding-screen.tsx`    | Seven-chapter story/question orchestration, narration-synchronized left-to-right story CTA fill that remains tappable while filling, six fixed-position question sprites, privacy-safe name entry, first-page-only sign-in handoff, searchable ISO currency selection, progress/footer chrome, reduced-motion transitions, and completion handoff. |
| `features/onboarding/data/onboarding-steps.ts`            | Alternating story/question script, three feature-introduction beats, six useful questions, final invitation, options, and chapter order.                                                                                                                                                                       |
| `features/onboarding/services/onboarding-service.ts`      | Local-first progress/completion orchestration and authenticated Supabase restore/sync.                                                                                                                                                                                                                         |
| `features/onboarding/services/onboarding-validation.ts`   | Pure allowlist sanitization for questionnaire answers and catalog-backed ISO currency codes.                                                                                                                                                                                                                   |
| `features/onboarding/types/onboarding.types.ts`           | Versioned answer, option, step, and persistence models.                                                                                                                                                                                                                                                        |
| `assets/images/onboarding/conversation-scenes/*.webp`     | Seven optimized transparent 900 × 900 paper-cut vignettes of the muscular Finn reference character: hello, worry, busy day, natural note, receipt scan, month-end question, and relief. These render only on story pages.                                                                                      |
| `assets/images/onboarding/story-scenes/*.webp`            | Superseded five-scene paper-theatre exports retained as unreferenced working assets.                                                                                                                                                                                                                           |
| `app/paywall.tsx`                                         | Authenticated, non-dismissible route selected whenever Premium entitlement is inactive.                                                                                                                                                                                                                        |
| `features/paywall/components/paywall-screen.tsx`          | Four-page chromatic, outcome-led hard paywall with a Finn value story, honest manual-vs-Premium comparison, eligibility-aware three-day trial timeline, localized plans, exact trial/renewal disclosure, restore, native App Store offer-code redemption, legal links, and account access.                         |
| `features/paywall/providers/subscription-provider.tsx`    | Event-driven RevenueCat lifecycle, offline-first cached access, Supabase UUID identity, lazy inactive-user product loading, purchases, restores, native offer-code redemption, entitlement state, and verified-trial reminder synchronization.                                                                            |
| `features/paywall/services/paywall-copy.ts`               | Eligibility-safe paywall navigation, timeline, checkout, and billing copy for eligible, ineligible, and unknown introductory-offer states.                                                                                                                                                                     |
| `features/paywall/services/subscription-service.ts`       | Platform SDK configuration, product/trial normalization, entitlement lookup, purchase, restore, native offer-code redemption, and management boundary.                                                                                                                                                          |
| `features/paywall/services/subscription-cache.ts`         | Per-account AsyncStorage persistence for the last verified RevenueCat entitlement, used only to unblock offline startup.                                                                                                                                                                                        |
| `features/paywall/services/subscription-cache-policy.ts`  | Pure expiration and RevenueCat-aligned three-day offline renewal-grace policy for cached Premium access.                                                                                                                                                                                                        |
| `features/paywall/types/subscription.types.ts`            | Subscription access, plan, trial eligibility, and context contracts.                                                                                                                                                                                                                                           |
| `tests/unit/subscription-cache-policy.test.ts`             | Offline Premium access regression coverage for unexpired, renewing/grace, cancelled, inactive, and lifetime entitlements.                                                                                                                                                                                       |
| `assets/images/paywall/finn-chromatic.webp`               | Optimized transparent chromatic Finn hero generated for the premium sequence.                                                                                                                                                                                                                                  |
| `assets/images/paywall/finn-pro-badge.webp`               | Optimized transparent chromatic Finn Pro badge generated for the first paywall page.                                                                                                                                                                                                                           |
| `assets/images/paywall/benefits/*.webp`                   | Optimized transparent chromatic benefit icons for natural capture, receipt scanning, and actionable money insights.                                                                                                                                                                                            |
| `docs/paywall/REVENUECAT.md`                              | RevenueCat, store, Sandbox/TestFlight, native offer-code, server-secret, hard-gate, and App Review release handoff.                                                                                                                                                                                            |
| `supabase/functions/_shared/runtime.ts`                   | Also enforces the RevenueCat Premium entitlement for shared premium Edge Function requests.                                                                                                                                                                                                                    |

## Shared infrastructure

| File                                | Functionality                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `src/storage/journal-repository.ts` | Empty first-run journal state; never contains bundled personal or demo records. |

| File                                     | Functionality                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/supabase/client.ts`             | Creates the public mobile Supabase client with a publishable key only. Never place a secret/service-role key in the app. |
| `src/lib/supabase/session-storage.ts`    | Native persistent storage adapter for Supabase Auth sessions.                                                            |
| `src/lib/supabase/database.types.ts`     | Generated database types. Once generation is configured, do not hand-edit.                                               |
| `src/lib/ai/contracts.ts`                | Client/server request and response contracts for parsing, receipts, and Ask.                                             |
| `src/lib/ai/api.ts`                      | Authenticated calls to server-side AI endpoints; never contains AI provider secrets.                                     |
| `src/lib/offline/database.ts`            | Shared snapshot facade over native SQLite and web AsyncStorage repositories.                                             |
| `src/lib/offline/sync-queue.ts`          | Durable background jobs for sync and transient receipt parsing; AI jobs pause locally unless the current policy version is granted.           |
| `src/providers/app-providers.tsx`        | Auth-scoped durable journal snapshot that renders before remote hydration, network-aware refresh/sync lifecycle, and async UI mutation commands. |
| `src/services/currency-service.ts`       | Exchange-rate retrieval/cache with deferred conversion when offline.                                                     |
| `src/services/network-service.ts`        | Connectivity changes and reconnect processing triggers.                                                                  |
| `src/storage/journal-repository.ts`      | Storage contract for raw notes, structured transactions, attachments, and sync status.                                   |
| `src/storage/onboarding-repository.ts`   | Validated AsyncStorage snapshot used for first-run gating and offline-safe onboarding progress.                          |
| `src/storage/settings-repository.ts`     | Reserved local/remote user preference storage contract; account-local settings currently live in the journal cache.      |
| `src/storage/preferences-storage.ts`     | Android/web legacy device-preference adapter used for one-time migration into the account cache.                         |
| `src/storage/preferences-storage.ios.ts` | iOS legacy preference/Back Tap adapter used for one-time account-cache migration.                                        |
| `src/store/session-store.ts`             | Small cross-feature app/session state boundary; do not duplicate server data here.                                       |
| `src/types/domain.ts`                    | Canonical client domain types shared across features.                                                                    |
| `src/types/sync.ts`                      | Queue job, retry, failure, conflict, and sync-state types.                                                               |
| `src/utils/amounts.ts`                   | Totals already-interpreted entry lines; it does not parse note text.                                                     |
| `src/utils/currency.ts`                  | Pure money formatting and safe conversion helpers.                                                                       |
| `src/utils/dates.ts`                     | Pure effective-date, relative-date, range, and display helpers.                                                          |
| `src/constants/theme.ts`                 | Existing color, font, spacing, and layout tokens. Evolve this rather than scattering raw values.                         |
| `src/constants/website-links.ts`         | Canonical external URLs surfaced from Settings.                                                                          |
| `src/hooks/use-color-scheme.ts`          | Existing platform color-scheme hook.                                                                                     |
| `src/hooks/use-color-scheme.web.ts`      | Existing web color-scheme implementation.                                                                                |
| `src/hooks/use-theme.ts`                 | Existing theme token hook.                                                                                               |
| `src/global.css`                         | Existing web-global styling entry point.                                                                                 |

## Supabase workspace: `supabase/`

| Path                                           | Functionality                                                                                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/`                         | Versioned database schema, indexes, triggers, grants, and RLS policies. Create files with `supabase migration new <name>`; do not invent migration timestamps. |
| `supabase/functions/_shared/`                  | Shared server-only helpers for auth checks, validation, AI providers, responses, and CORS.                                                                     |
| `supabase/tests/`                              | Database/RLS tests proving users cannot access one another's financial data.                                                                                   |
| `supabase/config.toml`                         | CLI-generated project settings and authenticated backend function entry points, including guarded Ask Finn SQL.                                                |
| `supabase/seed.sql`                            | **Planned:** deterministic local-only development data, added when a real schema exists.                                                                       |
| `supabase/functions/parse-entry/index.ts`      | Gemini-only text interpretation with grounded evidence validation and idempotent commits.                                                                      |
| `supabase/functions/scan-receipt/index.ts`     | **Planned:** receipt OCR/extraction without exposing provider secrets.                                                                                         |
| `supabase/functions/ask-money/index.ts`        | Single Ask Finn orchestrator for deterministic v3 analytics, structured interpretation, guarded fallback, and cursor-based evidence pages.                    |
| `supabase/functions/ask-sql/index.ts`          | Older-client compatibility route for the dedicated read-only role and private revision-aware guarded-SQL sessions.                                            |
| `supabase/functions/apply-preset/index.ts`     | Deterministic preset insertion from an immutable client snapshot; never calls Gemini.                                                                          |
| `supabase/functions/delete-account/index.ts`   | Verifies the caller, revokes linked Apple authorization, then immediately deletes or schedules/cancels private deletion.                                      |
| `supabase/functions/convert-currency/index.ts` | **Planned only if needed:** trusted exchange-rate proxy/cache.                                                                                                 |

Supabase safety requirements:

- Enable RLS on every table exposed through the Data API and use ownership predicates, not only `TO authenticated`.
- An update policy needs `SELECT`, `USING`, and `WITH CHECK` behavior appropriate to ownership.
- Keep AI keys, service-role keys, and other secrets in server/Edge Function environment variables only.
- Public client configuration may contain only the project URL and publishable key.
- New tables may require explicit Data API grants in addition to RLS; verify the project Data API settings.
- Never persist receipt images in Supabase Storage or Postgres; accept them only as authenticated transient parsing inputs.

## Root configuration and documentation

| File                                          | Functionality                                                                                                                                                                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.server` (ignored)                       | Local Edge Function secret-deployment input; never commit it or copy it into Expo configuration.                                                                                                                                                                        |
| `.gitignore`                                  | Excludes dependencies, generated output, native builds, and all real environment files.                                                                                                                                                                                 |
| `app.json`                                    | Expo app identity, plugins, platform config, scheme, icons, EAS project link, runtime policy, and update URL.                                                                                                                                                           |
| `eas.json`                                    | Preview/production build profiles and matching OTA update channels.                                                                                                                                                                                                     |
| `package.json`                                | Scripts, pinned application dependency ranges, and the Android source-build opt-in required for the patched Expo Camera module.                                                                                                                                         |
| `patches/expo-camera+57.0.6.patch`            | Keeps Android's Expo Camera preview on CameraX's compatible `TextureView`, allowing the animated receipt-camera surface to clip to rounded corners. Applied after installs by `patch-package`; `package.json` opts this module out of Expo's prebuilt Android artifact. |
| `package-lock.json`                           | Canonical npm dependency lockfile used locally and by EAS Build; the stale competing pnpm lockfile was removed.                                                                                                                                                         |
| `pnpm-workspace.yaml`                         | Retained workspace metadata; it is not a package-manager lockfile.                                                                                                                                                                                                      |
| `tsconfig.json`                               | Strict Expo TypeScript configuration, `@/*` aliases and pure shared TypeScript imports; excludes Deno entry points.                                                                                                                                                     |
| `README.md`                                   | Judge-facing Shipaton Next Gen overview with animated branding, live TestFlight and website access, public video demos, complete screenshot galleries, RevenueCat evidence, paywall gallery, architecture, and local setup.                                              |
| `CLAUDE.md`                                   | Existing alternate-agent instructions; keep aligned with project rules if used.                                                                                                                                                                                         |
| `docs/decisions/`                             | Short architecture decision records for choices that future contributors must understand.                                                                                                                                                                               |
| `docs/app-store-connect/`                     | App Store Connect privacy/category/age-rating source of truth plus the audited App Review release handoff, reviewer instructions, and test matrix.                                                                                                                        |
| `assets/logo/app-icon.png`                    | Canonical 1024 × 1024 opaque Finn artwork used for the default app icon, iOS icon, and web favicon.                                                                                                                                                                     |
| `assets/logo/android-adaptive-foreground.png` | Transparent 1024 × 1024 derivative with the canonical artwork constrained to Android's adaptive-icon safe area.                                                                                                                                                         |
| `assets/logo/splash-logo.png`                 | Transparent 1024 × 1024 splash derivative with wider optical padding than the app icon.                                                                                                                                                                                |
| `assets/logo/short-light-bg.png`              | Rounded-corner 1024 × 1024 derivative used only by the square animated in-app logo.                                                                                                                                                                                     |
| `assets/images/`                              | Raster images and future Finn-owned visuals.                                                                                                                                                                                                                            |
| `assets/marketing/app-store/ipad/*.png`       | Two 2048 × 2732 portrait iPad App Store marketing screenshots adapted from the supplied iPhone layouts without changing their app content.                                                                                                                         |
| `assets/marketing/social/finnit-x-launch.png` | 576 × 680 Finnit launch graphic for X, combining the canonical app icon with four supplied product screenshots in a compact editorial showcase.                                                                                                                    |
| `assets/marketing/social/finnit-x-launch-clean.png` | Cleaner 576 × 680 X variant with reference-matched negative space, restrained header chrome, simplified feature panels, and flatter presentation.                                                                                                              |
| `assets/marketing/social/finnit-x-launch-source-screens.png` | Corrected 576 × 680 X variant whose four iPhone displays are sourced from the supplied Finnit journal, receipt, Ask, and spending screenshots instead of invented replacement UI.                                                                            |
| `assets/marketing/readme/paywall/*.png`       | Six production iPhone screenshots used by the README paywall gallery: the three value/trial pages plus annual, monthly, and weekly plan-selection states.                                                                                                       |
| `assets/marketing/readme/money-header.svg`    | Animated README hero with floating dollar coins, a subtle money-ledger grid, Finnit branding, and a static Reduced Motion fallback.                                                                                                                            |
| `assets/marketing/readme/showcase/*`          | Nine portrait product-story images, a landing preview, and the linked iPhone mockup MP4 presented near the top of the judge-facing README.                                                                                                                     |
| `assets/marketing/readme/product-captures/*`  | Seventeen supplied app captures covering the journal, entry calculations, calendar, Ask Finn, receipt parsing, category summaries, and saved entries.                                                                                                         |

## Tests

| Directory                                     | Functionality                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/journal-offline.test.ts`          | Cache migration, adapter fidelity, bounded AI validation retries, correction, and preset-capture regression tests.   |
| `tests/unit/entry-stream.test.ts`             | Arbitrarily chunked, duplicate, warning, final, and legacy parse-entry protocol coverage.                            |
| `tests/unit/journal-sync-merge.test.ts`       | Repeated remote versions, tombstones, complete receipt lines, and pending-local conflict preservation.               |
| `tests/unit/ask-cache-policy.test.ts`         | Answer eligibility and revision-safe cache reuse rules.                                                              |
| `tests/unit/ask-search-format.test.ts`        | Compact same-month, cross-month, cross-year, historical-year, and inclusive/exclusive Ask date-range coverage.       |
| `tests/unit/ask-presentation.test.ts`         | Typed answer shapes, current-currency fidelity, removable filters, unsupported/retry copy, and evidence-count coverage. |
| `tests/unit/sqlite-schema.test.ts`            | Native SQLite schema, receipt-line foreign keys, account isolation, and atomic entry/outbox rollback in Node SQLite. |
| `tests/unit/supabase-function-config.test.ts` | Guards every configured Edge Function entrypoint against cross-function deployment.                                  |
| `tests/unit/analytics-sanitization.test.ts`   | Verifies analytics never exports financial/identity keys, URLs, arbitrary nested values, emails, or UUIDs.           |
| `tests/unit/ai-consent.test.ts`               | Locks the explicit Google Gemini provider name, consent-policy version format, and disclosed data categories.        |
| `tests/unit/paywall-copy.test.ts`             | Verifies unknown trial eligibility stays offer-neutral and eligible/ineligible plans receive accurate checkout copy. |
| `tests/unit/notification-content.test.ts`      | Verifies journal reminder timing/copy and RevenueCat trial-expiry reminder eligibility and timing.                  |
| `tests/unit/session-storage.test.ts`           | Verifies secure-first native session migration, plaintext cleanup, failure safety, and dual-store sign-out removal.  |
| `tests/integration/`                          | Repository, offline queue, local database, and API boundary tests.                                                   |
| `tests/e2e/`                                  | Critical user flows: offline capture, reopen, sync, correction, receipt, and Ask source inspection.                  |
| `supabase/tests/`                             | SQL/RLS tests separate from client tests.                                                                            |
| `supabase/tests/money-evidence.test.ts`       | Grounded amount evidence and exact minor-unit conversion tests; semantic interpretation remains Gemini-only.         |
| `supabase/tests/cache.test.ts`                | Zero/two/three-decimal preset capture and safe explanation-cache eligibility tests.                                  |
| `supabase/tests/ai_consent_records_rls.test.sql` | Verifies consent-table grants, owner-only select/insert/update, cross-account denial, and non-deletable audit rows. |

## Fast search guide

Use targeted searches before opening large files:

```bash
# Find an owning feature
rg -n "journal|calendar|receipt|project|preset|ask" PROJECT_FILE_STRUCTURE.md

# Find product requirements by heading or keyword
rg -n "^#|offline|receipt|currency|calendar|privacy" PROJECT_CORE_IDEA.md

# Find design guidance by heading or keyword
rg -n "^#|sheet|composer|motion|calendar|profile" PRODUCT_DESIGN.md

# Find actual implementation references
rg -n "ComponentOrFunctionName" src supabase tests
```

## Maintenance rule

Whenever a file is added, moved, renamed, deleted, or given a materially different responsibility, update this index in the same change. Keep descriptions to one responsibility per file so future queries can locate the smallest relevant context.
