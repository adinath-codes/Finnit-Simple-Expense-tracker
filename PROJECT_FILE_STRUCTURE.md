# Finn Project File Structure

> Fast architecture index for agents and contributors.
>
> Start here before searching the repository. This file describes ownership, intended routes, and the purpose of every scaffolded source file. The journal starts empty; unused feature placeholders remain intentionally unimplemented.

## Canonical references — read only when relevant

| File | Read when the task affects |
| --- | --- |
| `PROJECT_CORE_IDEA.md` | Product scope, domain behavior, data semantics, privacy, offline reliability, AI responsibilities, or MVP priority. |
| `PRODUCT_DESIGN.md` | UI, UX, layout, visual styling, sheets, motion, native feel, or interaction details. |
| `PROJECT_FILE_STRUCTURE.md` | File location, module ownership, route placement, or architecture navigation. Start here. |
| `AGENTS.md` | Agent working rules and the required Expo SDK 57 documentation check. |

Do not load both canonical product documents for routine maintenance. Search their headings and read only the sections relevant to the task.

## iOS-first motion — September 19, 2026

Consult `docs/decisions/motion-platform-support.md` for the persistent per-effect iOS/Android support matrix and verification status. Apple page zoom and SF Symbol effects are iOS-only; shared Reanimated animations also run on Android. No automated or device validation was performed for this motion pass, per user instruction.

| File | Ownership |
| --- | --- |
| `docs/decisions/motion-platform-support.md` | Persistent motion decisions, exact missing Android effects, fallback behavior, and unverified device status. |
| `src/constants/motion.ts` | Shared durations and easing for press, loading, content, layout, and camera transitions. |
| `src/hooks/use-motion-preference.ts` | Shared system reduced-motion subscription, including changes while the app is open. |
| `src/components/navigation/zoom-link.tsx` | iOS 18+ native source-to-route zoom; standard links elsewhere and under reduced motion. |
| `src/components/ui/motion.tsx` | Content fades, expandable sections, layout transitions, and disclosure chevrons. |
| `src/components/common/loading-state.tsx` | Implemented loading variants, reusable skeleton blocks, and foreground/focus-aware shimmer. |

Shared buttons and icon buttons forward native refs and press props for Router links. Icons default to contextual effects and accept an explicit success trigger. Header, settings, composer, and journal-result launch controls use zoom links. Search shows skeletons for initial loads and preserves same-request answers on refresh; entry references, preset forms, and custom date controls animate expansion. The camera owns measured toolbar-origin entry/reverse exit and retains its surface until dismissal completes. Calendar month/date feedback is restrained; existing processing and spending-panel motion remains.

## Implemented UI preview — September 2026

### Onboarding character flipbook — September 20, 2026

| File | Ownership |
| --- | --- |
| `src/components/character/char-sprite-anim.tsx` | Reusable `CharSpriteAnim` atlas player with hard frame cuts, UI-thread playback, live reduced-motion support, and active/background lifecycle handling. |
| `src/components/character/character-animations.ts` | Typed animation names, bundled atlas sources, grid sizes, and per-frame hold durations. |
| `assets/images/character/onboarding/*-base.png` | Six transparent generated source scenes, each with an expression and finance props matched to one onboarding question. |
| `assets/images/character/onboarding/*-sprite.png` | Six active registered 2 × 2 atlases. Local contours morph while broken green hatch patches appear, disappear, and move slightly inside the fixed composition. |
| `assets/images/character/thinking*.png` | Retained earlier thinking-scene development assets; no longer loaded by onboarding. |
| `scripts/build-character-sprites.cjs` | Deterministic atlas builder for registered contour deformation, imperfect green-shade variation, and `#20C878` normalization. |
| `assets/images/character/README.md` | Asset provenance, question-to-animation map, rebuild command, component usage, and legacy generation prompts. |

### Sign-in character scene — September 20, 2026

| File | Ownership |
| --- | --- |
| `src/features/auth/components/auth-screen.tsx` | Sign-in composition, native iOS Apple control, Google/email controls, consent gating, and decorative edge-character/finance-doodle backdrop. |
| `src/components/ui/custom-toast.tsx` | Reusable Finn toast with error, warning, and info portraits, colored second line, and reduced-motion-aware entrance/exit. |
| `src/features/auth/components/provider-marks.tsx` | Official-style provider marks used by the non-native social controls. |
| `assets/images/auth/finn-peek-left.png` | Transparent Finn cutout peeking from the left screen edge. |
| `assets/images/auth/finn-peek-right.png` | Transparent Finn cutout presenting a receipt from the right screen edge. |
| `assets/images/character/toast/{error,warning,info}.png` | Transparent monochrome Finn portraits for toast states. |

The sign-in surface uses the system-provided Apple authentication button on iOS
and a black, correctly branded fallback on Android/web. All sign-in methods stay
disabled until the user explicitly accepts the Privacy Policy and Terms of
Service; password recovery and both legal routes remain available beforehand.

Each of the six questions declares its own `animType` beside its question ID in
`onboarding-steps.ts`, so its scene can be swapped without changing the screen.
Question copy, character, and options share one scroll surface so choices remain
reachable with larger text or smaller screens.

The reference images are recreated with **Finn financial content**, confirmed by the user, and a small vector recreation of the reference’s green mountain mark. This direct request takes precedence over the earlier inspiration-only guidance in `PRODUCT_DESIGN.md`.

- `src/storage/journal-repository.ts` creates the empty first-run journal state. Components never import bundled data or call a backend directly.
- `src/providers/app-providers.tsx` subscribes to the authenticated account's durable cache, adapts cached text/receipt records for the UI, starts foreground sync/refresh, and exposes promise-returning mutations. Entries, presets, goals, and settings are never acknowledged before their local write succeeds.

- `src/types/domain.ts` defines typed UI records; `src/utils/amounts.ts`, `currency.ts`, and `dates.ts` supply stored-entry totals, formatting, and date labels without interpreting draft text.
- `src/features/journal/components/journal-glyph.tsx` maps journal controls to the shared native-symbol layer: SF Symbols on iOS and Material Symbols on Android/web. `assets/images/journal/` owns the small reference-inspired header mark and legacy static SVG glyph assets.
- `assets/sf-pro-display/` contains the supplied SF Pro Display fonts. The root layout loads regular, medium, and bold faces for Android/web before showing the app; iOS uses its native system font. `metro.config.js` registers the supplied uppercase `.OTF` extension.
- `src/components/ui/icon.tsx` maps SF Symbols on iOS to Material Symbols on Android/web and applies the native one-shot symbol effect requested by the nearest button. `button.tsx` supplies 120ms press feedback, triggers symbol effects, and respects reduced motion. `icon-button.tsx` supplies floating circular controls.
- `src/components/common/screen.tsx` supplies the warm canvas, optional journal peach-to-lilac gradient, and desktop width limit. `src/components/sheets/app-sheet.tsx` owns sheet chrome, scrolling, dismissal, SDK-57 keyboard synchronization, and sticky footer spacing. `src/components/ui/use-rotating-placeholder.ts` shares the journal's reduced-motion-aware typing cadence with focused correction inputs.
- Implemented journal components: `journal-screen.tsx`, `journal-header.tsx`, `journal-entry-card.tsx`, `journal-composer.tsx`, `journal-processing-status.tsx`, and `journal-glyph.tsx`. The blank paper is the input; focusing it reveals the saved-entry/add, camera, and green-tick toolbar, and keyboard dismissal restores the compact totals pill. When connectivity is unavailable, a quiet footer pill reports the durable outbox's pending-job count without blocking capture. Drafts show a shimmered “Tap tick” prompt; only the tick or Return starts capture and parsing, with no artificial processing delay. Composer and in-place edit drafts persist locally through blur. The draft dots open note options. The camera action opens the permission-aware `expo-camera` preview with gallery import, persists and normalizes the image locally for offline retry, and sends it only as a transient authenticated parsing request. Successful extraction retains text/structured values and deletes the local image. Scanned receipts render as one generated journal sentence with the extracted total; their itemized arithmetic stays in Entry Details behind tap-to-expand ellipsis.
- Implemented detail components: `entry-detail-sheet.tsx`, `transaction-breakdown.tsx`, and `finn-correction-composer.tsx`. The sheet shows arithmetic and participant allocations, keeps the source note immutable during durable Gemini corrections, and entries can become saved shortcuts.
- `features/presets/components/preset-list.tsx` owns search, create/edit/delete, and one-tap journal insertion that closes the sheet and shows the new entry on the main journal.
- `features/settings/components/settings-screen.tsx` owns currency preferences, saved-entry navigation, legal-document links, local sign-out, and confirmed account deletion. Retired location and Back Tap opt-ins are forced off for existing accounts.
- `features/summary/components/spending-breakdown-card.tsx` owns the floating total's inline goal breakdown and animated progress bars.
- `features/calendar/components/calendar-screen.tsx` owns month browsing and selected-day journal navigation.
- `features/onboarding/` owns a short Finn flow: eight illustrated story slides, a paced conversational handoff, and six white question slides covering desired outcomes, memory gaps, context, capture style, and default currency. Every selection and navigation step is serialized to an AsyncStorage draft so interrupted onboarding resumes exactly. The Supabase `user_onboarding` row is authoritative per account: a missing or incomplete row sends that account to the questions, and another account can never inherit a local draft. Successful owner-only uploads delete the local answers/progress.

Implemented routes in addition to `/`: onboarding; sign-in/reset/callback; privacy and terms; entry, settings and preset sheets; calendar; legacy quick add; and search. New users see the intro, answer the ICP questions, and then authenticate; existing users can skip directly to sign-in without overwriting a prior remote onboarding profile. Email/password, Google OAuth, and Apple OAuth share the persisted Supabase session. Native sheets use Expo Router form sheets; the web preview uses Router form sheets. The old `finn://quick-add` deep link now returns to the journal.

Run the preview with `node node_modules/expo/bin/cli start --web`. Run type checking with `node node_modules/typescript/bin/tsc --noEmit`. Direct Node invocation avoids the colon-in-project-path issue with package-manager executable lookup.

## Implemented text backend — September 19, 2026

The text backend migrations and five original Edge Functions are deployed to the linked Finn project; receipt deployment is staged separately. Its client
search page reads authenticated Supabase data through its own hook. The main journal
provider starts empty and is wired to authenticated durable capture/cache/sync services.
Read `docs/backend/DEPLOYMENT.md` for deployment, API contracts, monetary semantics,
limits, and the current integration boundary.

| File | Responsibility |
| --- | --- |
| `docs/backend/DEPLOYMENT.md` | Deployment handoff, endpoint/client contracts, accuracy rules, and remaining UI/MVP work. |
| `supabase/migrations/20260919062838_finn_financial_journal.sql` | Schema/seeds, RLS/grants, atomic revision/idempotency RPCs, private quotas, indexed SQL search and insight views. |
| `supabase/migrations/20260919071006_finn_search_page.sql` | Recent context totals, bounded catalogs, keyset result pages, serialized journal revision tracking, and owner-scoped interpretation cache. |
| `supabase/migrations/20260919082754_finn_onboarding_profile.sql` | Bounded onboarding answers, extracted defaults, grants, and owner-only RLS policies. |
| `supabase/migrations/20260919113403_extra_ai_quota_and_support_requests.sql` | Private expiring AI-call credits, deduplicated support requests, and atomic minute/day/month quota reservations. |
| `supabase/migrations/20260919155015_receipt_scanning.sql` | Receipt source type, private attachments/lines and bucket policies, signed adjustments, atomic scan/correction commits, and receipt-aware search display. |
| `supabase/migrations/20260920030847_discard_receipt_images.sql` | Removes persisted receipt-image identifiers/metadata and Storage access; receipt images become transient parsing inputs only. |
| `supabase/migrations/20260920090000_account_preferences_and_presets.sql` | Owner-scoped settings and saved-entry preset records with authenticated RLS mutation policies. |
| `supabase/migrations/20260920160000_expand_spendable_iso_currencies.sql` | Additive ISO 4217 spendable-currency catalog expansion for onboarding, settings, and capture validation. |
| `supabase/migrations/20260922022045_revision_aware_entry_enrichment.sql` | Revision-scoped Gemini claims and private mutation lookup for idempotent text reparses. |
| `supabase/migrations/20260922035031_transaction_semantics_v2.sql` | Hierarchical categories, amount roles, participants, allocations, transaction contexts/components, AI-operation idempotency, and metric-aware Ask Finn RPC. |
| `supabase/migrations/20260922085151_ask_finn_guarded_sql.sql` | Curated read-only journal view, dedicated Ask Finn reader role/RLS, and private expiring advanced-search sessions. |
| `supabase/migrations/20260922090903_ask_finn_function_privileges.sql` | Removes the reader role's inherited access to a platform public event-trigger function. |
| `supabase/migrations/20260922102945_ask_finn_auth_schema_usage.sql` | Deployed managed-auth compatibility migration retained for ordered production history. |
| `supabase/migrations/20260922103031_ask_finn_claim_scope_no_auth.sql` | Verified-subject RLS helper and view policies that avoid protected auth-schema access. |
| `supabase/config.toml` | CLI-generated local project settings and authenticated Edge Function entry points. |
| `supabase/.gitignore` | Excludes CLI project links, temporary files and local secrets. |
| `supabase/functions/deno.json` | Server TypeScript runtime and formatting configuration, separate from Expo. |
| `supabase/functions/_shared/contracts.ts` | Pure shared wire contracts, supported currencies/scales, extraction and search plans. |
| `supabase/functions/_shared/currencies.ts` | Offline SIX List One snapshot with spendable ISO codes, names, issuing entities, minor units, validation, and local search. |
| `supabase/functions/_shared/validation.ts` | Runtime input, exact-money, entity, date and extraction validation. |
| `supabase/functions/_shared/dates.ts` | Timezone-aware calendar days, relative dates and period boundaries. |
| `supabase/functions/_shared/money-evidence.ts` | Server-safe price evidence tokenization and exact minor-unit conversion; it makes no transaction or category decisions. |
| `supabase/functions/_shared/text.ts` | Shared normalization and literal candidate matching for search and user rules. |
| `supabase/functions/_shared/pending-entry.ts` | Unparsed local placeholder used while an explicitly submitted note waits for Gemini. |
| `supabase/functions/_shared/entry-context.ts` | Adds the user-approved coarse place label to a validated interpretation. |
| `supabase/functions/_shared/runtime.ts` | Session verification, RLS/admin clients, request bounds, quotas, catalogs and private-text-free metrics. |
| `supabase/functions/_shared/gemini.ts` | Role-based Gemini Flash-Lite selection, role-specific cost metrics, bounded structured output, and evidence-grounded interpretation validation. |
| `supabase/functions/_shared/receipt.ts` | Strict receipt evidence/money validation, partial JSON row parsing, reconciliation, and correction validation. |
| `supabase/functions/_shared/search.ts` | Deterministic query-to-filter parsing and allowlisted search-plan validation. |
| `supabase/functions/_shared/ask-sql-guard.ts` | PostgreSQL 17 AST allowlist for the curated cohort and typed answer SELECT shapes. |
| `supabase/functions/_shared/ask-sql.ts` | Restricted-role read-only execution, answer/source consistency, private sessions, revision paging, and grounded explanations. |
| `supabase/functions/parse-entry/index.ts` | Idempotent Gemini-only text interpretation, grounded validation, and authoritative commit. |
| `supabase/functions/correct-entry/index.ts` | Revision-checked text reparse, manual correction, and deletion with optional explicit personal category rules. |
| `supabase/functions/ask-money/index.ts` | Authenticated natural-language/explicit-filter search with SQL-only financial totals. |
| `supabase/functions/ask-sql/index.ts` | Authenticated advanced Ask Finn route for validated SQL search, five-item pages, and verified-fact explanations. |
| `supabase/functions/request-quota-review/index.ts` | Authenticated, deduplicated support escalation for accounts that reach the AI allowance. |
| `supabase/functions/delete-account/index.ts` | Authenticated, server-only deletion of the caller's account and cascading owner data. |
| `supabase/functions/scan-receipt/index.ts` | Authenticated transient multipart image parsing, Gemini structured-output stream, progressive NDJSON rows, and text-only authoritative commit. |
| `src/features/auth/` | Session provider, email/password auth, Google/Apple OAuth, callback handling, recovery, and reset UI. |
| `src/features/legal/` | Shared readable legal-document surface used by the bundled privacy policy and terms. |
| `src/lib/supabase/client.ts` | Lazy publishable-key client, explicit optional anonymous auth and session identity. |
| `src/lib/supabase/session-storage.ts` | AsyncStorage session persistence adapter. |
| `src/lib/supabase/database.types.ts` | Shared backend wire type exports; live generated schema types await Finn deployment. |
| `src/lib/ai/api.ts` | Authenticated Edge requests, session refresh, bounded timeout and typed retry errors. |
| `src/lib/offline/database.ts` | Serialized account-scoped durable cache/outbox document and subscriptions. |
| `src/lib/offline/cache-schema.ts` | Versioned cache defaults, account keys, and lossless v1/v2-to-v3 normalization for semantic entries, receipts, outbox jobs, presets, goals, and settings. |
| `src/lib/offline/sync-queue.ts` | Ordered retry queue, revision-conflict retention and foreground sync lifecycle. |
| `src/types/sync.ts` | Cached entry, correction/deletion payload, durable job and cache types. |
| `src/features/journal/services/journal-service.ts` | Durable unparsed capture, local reads, and authoritative remote refresh. |
| `src/features/journal/services/journal-adapter.ts` | Pure cached-record-to-UI adaptation and revision-safe text correction payload construction. |
| `src/features/journal/services/sync-recovery-service.ts` | Entry-scoped retry plus explicit local-or-remote revision-conflict resolution. |
| `src/features/entries/services/entries-service.ts` | Offline reparse/manual correction/Gemini correction/deletion queue commands using server revisions while retaining the current breakdown during AI work. |
| `src/features/entries/services/breakdown-service.ts` | Pure amount-expression and participant-row derivation with exact minor-unit fallback. |
| `src/features/camera/services/receipt-service.ts` | Temporary local camera/gallery persistence, scan normalization, offline retry, correction, text-only remote hydration, and post-extraction image cleanup. |
| `supabase/tests/receipt.test.ts` | Deterministic receipt parsing, arbitrary stream boundaries, reconciliation, discounts, confidence, limits, and malformed-output tests. |
| `supabase/tests/money-evidence.test.ts` | Exact minor-unit parsing, multiplier-aware money tokenization, deterministic equal allocations/remainder handling, mixed-currency evidence, and pending-entry safety tests. |
| `supabase/tests/search.test.ts` | Metric-aware deterministic query planning, backwards-compatible defaults, and query-plan allowlist tests. |
| `supabase/tests/gemini-config.test.ts` | Extraction/reasoning/fast model defaults, override isolation, identifier validation, and role-specific cost estimation. |
| `supabase/tests/ask-sql-guard.test.ts` | Valid aggregate/date/count plans plus hostile writes, CTEs, functions, schemas, joins, unions, and output-limit rejection. |
| `supabase/tests/ask-sql-role.test.ts` | Live restricted-login RLS, date-window, write/function denial, and answer-to-five-item-source consistency checks. |
| `supabase/migrations/20260922050000_fix_receipt_search_terms.sql` | Post-deploy receipt writer repair that groups JSON text extraction correctly for linked-database lint and runtime execution. |
| `src/features/ask/services/ask-service.ts` | Search request and exact per-currency result contracts. |
| `src/features/summary/services/summary-service.ts` | SQL-based spending summaries and RLS-protected financial insight reads. |
| `src/features/support/components/quota-reached-modal.tsx` | Calm global quota notice with a support-review action and email fallback. |
| `src/features/support/services/` | Quota-reached event fan-out and authenticated support-request submission. |

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

| Sketch surface | Owning files |
| --- | --- |
| Home/journal with header, date, entries, keyboard composer | `features/journal/components/journal-screen.tsx`, `journal-header.tsx`, `journal-day-section.tsx`, `journal-entry-card.tsx`, `journal-composer.tsx` |
| Calendar opened from the date/header | `features/calendar/components/calendar-screen.tsx`, `calendar-grid.tsx`, `calendar-day-cell.tsx` |
| Floating total and inline goal breakdown | `features/journal/components/journal-composer.tsx`, `features/summary/components/spending-breakdown-card.tsx` |
| Item details bottom sheet with amount/quantity edits and breakdown | `features/entries/components/entry-detail-sheet.tsx`, `entry-editor.tsx`, `transaction-breakdown.tsx` |
| Projects bottom sheet and “Add new item/project” | `features/projects/components/project-sheet.tsx`, `project-card.tsx`, `project-form.tsx` |
| Mini camera bottom sheet | `features/camera/components/receipt-camera-sheet.tsx`, `receipt-review.tsx` |
| Profile and settings | `features/profile/components/profile-screen.tsx`, `features/settings/components/settings-screen.tsx` |
| Ask financial history | `features/ask/components/ask-screen.tsx`, `ask-thread.tsx`, `ask-composer.tsx`, `source-entry-list.tsx` |

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
│   └── images/
│       └── journal/
│           └── finn-mark.svg
├── docs/
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

| File | Functionality |
| --- | --- |
| `src/app/_layout.tsx` | Light theme, mock data provider, gesture root, and native Stack form-sheet navigation. |
| `src/app/index.tsx` | Thin route to the reference-matched financial journal. |
| `src/app/onboarding/index.tsx` | Thin route to the implemented first-run Finn onboarding. |
| `src/app/explore.tsx` | Redirects the old starter URL to the journal. |

### Intended route map

Routes not listed in the implemented preview above remain planned. Expo Router registers every route module and requires a valid default screen export; unimplemented route directories contain only `.gitkeep`.

| Route | Functionality |
| --- | --- |
| `src/app/(auth)/sign-in.tsx` | Implemented email/password, Google, and Apple sign-in/create-account route. |
| `src/app/(auth)/reset-password.tsx` | Password recovery completion route. |
| `src/app/auth/callback.tsx` | OAuth and email-confirmation callback route. |
| `src/app/legal/privacy.tsx` | Bundled privacy policy, reachable from sign-in and Settings. |
| `src/app/legal/terms.tsx` | Bundled terms of service, reachable from sign-in and Settings. |
| `src/app/onboarding/index.tsx` | Implemented first-run onboarding route; `/` redirects here until local completion is durable. |
| `src/app/(tabs)/_layout.tsx` | Minimal Journal, Calendar, Ask, and Settings/Profile navigation. Prefer SDK 57-supported Router APIs. |
| `src/app/(tabs)/index.tsx` | Primary Journal route. |
| `src/app/(tabs)/calendar.tsx` | Calendar/history navigation route. |
| `src/app/(tabs)/ask.tsx` | Planned legacy Ask route; search is presented by `/search`. |
| `src/app/search.tsx` | Thin route for the implemented natural-language search page. |
| `src/app/(tabs)/settings.tsx` | Settings/Profile route. |
| `src/app/entries/[entryId].tsx` | Deep-linkable entry detail/edit route or sheet presentation. |
| `src/app/projects/[projectId].tsx` | Deep-linkable project detail route or sheet presentation. |
| `src/app/settings/presets.tsx` | Preset management route. |
| `src/app/quick-add.tsx` | Legacy iOS Back Tap/Shortcut deep-link target that redirects to the journal. |
| `src/app/legal/privacy.tsx` | Privacy policy route; account deletion remains in Settings. |

## Shared components: `src/components/`

| File | Functionality |
| --- | --- |
| `src/components/common/screen.tsx` | Shared safe-area, max-width, background, and keyboard-aware screen shell. |
| `src/components/common/empty-state.tsx` | Calm reusable empty-content state. |
| `src/components/common/error-state.tsx` | Recoverable error message with retry affordance. |
| `src/components/common/loading-state.tsx` | Non-disruptive shared loading state. |
| `src/components/forms/amount-field.tsx` | Editable amount field with currency-aware behavior. |
| `src/components/forms/currency-picker.tsx` | Shared searchable ISO currency selector and display label used by Settings. |
| `src/components/navigation/app-header.tsx` | Minimal shared app header primitive. |
| `src/components/sheets/app-sheet.tsx` | Accessible shared bottom-sheet wrapper and presentation defaults. |
| `src/components/ui/button.tsx` | Design-system button primitive. |
| `src/components/ui/custom-toast.tsx` | Compact animated status toast with Finn portrait and optional colored second line. |
| `src/components/ui/card.tsx` | Soft surface/card primitive. |
| `src/components/ui/chip.tsx` | Compact suggestion, category, and filter chip primitive. |
| `src/components/ui/icon.tsx` | Cross-platform SF/Material icon map; no mascot artwork. |
| `src/components/ui/icon-button.tsx` | Accessible icon-only button with touch target and pressed state. |
| `src/components/ui/text-field.tsx` | Shared text input primitive. |
| `src/components/ui/collapsible.tsx` | Existing Expo starter collapsible; keep only if Finn needs it. |
| `src/components/animated-icon.tsx` | Existing starter splash/icon animation. |
| `src/components/animated-icon.web.tsx` | Web version of the starter icon animation. |
| `src/components/app-tabs.tsx` | Existing starter tab navigator; replace during product navigation work. |
| `src/components/app-tabs.web.tsx` | Existing web tab implementation. |
| `src/components/external-link.tsx` | Existing cross-platform external link helper. |
| `src/components/hint-row.tsx` | Existing starter hint UI; remove with starter screen. |
| `src/components/themed-text.tsx` | Existing themed typography primitive. |
| `src/components/themed-view.tsx` | Existing themed surface primitive. |
| `src/components/web-badge.tsx` | Existing starter web badge; remove with starter screen. |

## Journal feature: `src/features/journal/`

| File | Functionality |
| --- | --- |
| `components/journal-screen.tsx` | Composes journal header, chronological entries, totals, presets, and composer. |
| `components/journal-glyph.tsx` | Fixed vector artwork for home toolbar and summary glyphs on every platform. |
| `components/journal-header.tsx` | Finn mark, selected date/calendar entry, and adjacent Ask Finn/settings buttons. |
| `components/journal-day-section.tsx` | One chronological day group with daily total. |
| `components/journal-entry-card.tsx` | Human-readable entry with amount and restrained metadata. |
| `components/journal-empty-prompt.tsx` | Empty-day writing CTA with reduced-motion-aware rotating example text. |
| `components/journal-composer.tsx` | Primary natural-language input with camera, later voice, and explicit green-tick submit. |
| `components/journal-processing-status.tsx` | Reduced-motion-aware shimmered “Tap tick” and real processing status. |
| `hooks/use-journal.ts` | Queries and mutations for journal capture/browsing. |
| `services/journal-service.ts` | Capture, retrieve, edit, and queue journal use cases. |
| `services/journal-adapter.ts` | Pure durable-cache adaptation and correction payload construction. |
| `services/sync-recovery-service.ts` | Retry and local-or-remote conflict resolution for durable entry jobs. |
| `store/journal-draft-store.ts` | Account-scoped persisted composer and in-place edit drafts. |
| `types/journal.types.ts` | Journal-only UI state and view models. |

## Calendar feature: `src/features/calendar/`

| File | Functionality |
| --- | --- |
| `components/calendar-screen.tsx` | Calendar history-navigation surface. |
| `components/calendar-grid.tsx` | Month grid showing days with journal activity and optional totals. |
| `components/calendar-day-cell.tsx` | Individual date cell and selection state. |
| `components/calendar-spending-chart.tsx` | Combined monthly total and relative colored category bars with expense emojis. |
| `hooks/use-calendar-entries.ts` | Loads entries/totals indexed by date range. |
| `services/calendar-service.ts` | Month range, selected date, and journal jump operations. |
| `types/calendar.types.ts` | Calendar cells, month ranges, and activity view models. |

## Entry details feature: `src/features/entries/`

| File | Functionality |
| --- | --- |
| `components/entry-detail-sheet.tsx` | Sheet shown after selecting a journal entry, with arithmetic, participant allocations, Finn interpretation artwork, and no source-reference panel. |
| `components/finn-correction-composer.tsx` | Keyboard-attached multiline Gemini correction input with a rotating reduced-motion-aware prompt and explicit green submit. |
| `components/entry-editor.tsx` | Lightweight amount, quantity, date, category, merchant, and context correction. |
| `components/transaction-breakdown.tsx` | Multiple transactions/items parsed from one human note. |
| `components/receipt-preview.tsx` | Temporary local receipt preview and post-extraction text-only privacy state. |
| `services/breakdown-service.ts` | Derives `*`/`+` amount expressions and expanded participant shares from authoritative extraction data. |
| `services/entries-service.ts` | Gemini reparse/correction, manual line correction, retry, and delete use cases. |
| `types/entry.types.ts` | Entry editor and parsed-transaction feature types. |

## Summary feature: `src/features/summary/`

| File | Functionality |
| --- | --- |
| `components/spending-breakdown-card.tsx` | Reference-matched goal card whose liquid shell rises from the floating total before revealing and animating each progress fill. |
| `components/category-summary.tsx` | Restrained category rows or small bar chart. |
| `components/finn-thought-card.tsx` | Plain-language insight based on real underlying records. |
| `services/summary-service.ts` | Deterministic period totals and category aggregation. |
| `types/summary.types.ts` | Summary periods, category totals, and insight source types. |

## Projects feature: `src/features/projects/`

Projects preserve contextual grouping from the sketch without turning Finn into project-management software.

| File | Functionality |
| --- | --- |
| `components/project-sheet.tsx` | Project list/detail sheet opened from relevant journal context. |
| `components/project-card.tsx` | Project name, total, and recent activity. |
| `components/project-form.tsx` | Minimal project creation/edit form. |
| `services/projects-service.ts` | Project CRUD and entry/transaction association. |
| `types/project.types.ts` | Project and project-summary types. |

## Receipt camera feature: `src/features/camera/`

| File | Functionality |
| --- | --- |
| `components/receipt-camera-sheet.tsx` | Implemented compact permission-aware camera overlay with live preview, torch, camera flip, shutter, and denied/settings states. |
| `components/receipt-review.tsx` | Implemented captured-photo preview with retake, close, and attach actions. |
| `services/receipt-service.ts` | Temporary local capture, transient multipart extraction, retry, and image cleanup. |
| `types/receipt.types.ts` | Local receipt-capture type for the camera and transient extraction handoff. |

## Ask feature: `src/features/ask/`

| File | Functionality |
| --- | --- |
| `components/ask-screen.tsx` | Ask Finn page with the requested value first, verified-fact explanation, editable fixed-plan filters, reusable source cards, and five-item Show more paging. |
| `components/ask-thread.tsx` | User questions and grounded financial answers. |
| `components/ask-composer.tsx` | Financial-history question input. |
| `components/source-entry-list.tsx` | Reusable per-transaction evidence card with message, description, date, exact amount, review state, detail expansion, and entry link. |
| `hooks/use-search.ts` | Auth-scoped fixed/advanced search, separate explanation loading, cancellation, private-session cursor paging, retry, and stale-result handling. |
| `services/search-format.ts` | Exact BigInt currency presentation and calendar-range formatting. |
| `services/ask-service.ts` | Typed authenticated fixed/advanced search, explanation, context, and five-item source-page calls. |
| `types/ask.types.ts` | Typed amount/date/count/comparison answers, SQL sessions, exact-money sources, contexts, cursors, and response contracts. |

## Presets feature: `src/features/presets/`

| File | Functionality |
| --- | --- |
| `components/preset-list.tsx` | Subtle repeated-expense shortcuts near the composer/settings. |
| `components/preset-editor-sheet.tsx` | Create/edit/delete a user preset. |
| `services/presets-service.ts` | Offline-first preset writes and remote reconciliation. |
| `services/preset-capture-service.ts` | One-tap preset-to-journal capture orchestration without coupling the preset and journal sync modules. |
| `services/preset-format.ts` | Pure canonical note formatting for one-tap preset capture. |
| `types/preset.types.ts` | Preset definition and capture behavior. |

## Settings and profile features

| File | Functionality |
| --- | --- |
| `features/settings/components/settings-screen.tsx` | Minimal settings hub for saved entries, currency, legal documents, sign-out, and confirmed account deletion. |
| `features/settings/components/currency-setting.tsx` | Base currency selection and current value. |
| `features/settings/services/settings-service.ts` | Offline-first account preference writes, remote reconciliation, and disabling retired opt-ins. |
| `features/settings/types/settings.types.ts` | Preference models. |
| `features/profile/components/profile-button.tsx` | Small header button that opens profile/settings. |
| `features/profile/components/profile-screen.tsx` | Account, subscription, export, privacy, sign-out, and deletion entry points. |
| `features/profile/types/profile.types.ts` | Profile presentation models. |

## Quick capture feature: `src/features/quick-capture/`

| File | Functionality |
| --- | --- |
| `components/quick-capture-screen.tsx` | Redirects legacy `finn://quick-add` links to the journal. |

## Onboarding and paywall features

| File | Functionality |
| --- | --- |
| `features/onboarding/components/onboarding-screen.tsx` | Reference-adapted welcome, paced story-to-question conversation, question cards, searchable ISO currency selection with keyboard dismissal, progress/footer chrome, reduced-motion transitions, and completion handoff. |
| `features/onboarding/data/onboarding-steps.ts` | Finn-specific questions, options, education copy, and flow order. |
| `features/onboarding/services/onboarding-service.ts` | Local-first progress/completion orchestration and authenticated Supabase restore/sync. |
| `features/onboarding/services/onboarding-validation.ts` | Pure allowlist sanitization for questionnaire answers and catalog-backed ISO currency codes. |
| `features/onboarding/types/onboarding.types.ts` | Versioned answer, option, step, and persistence models. |
| `features/paywall/components/paywall-screen.tsx` | Subscription value shown only after the user understands the product. |
| `features/paywall/services/subscription-service.ts` | Product/entitlement lookup and purchase boundary. |
| `features/paywall/types/subscription.types.ts` | Subscription product and entitlement types. |

## Shared infrastructure

| File | Functionality |
| --- | --- |
| `src/storage/journal-repository.ts` | Empty first-run journal state; never contains bundled personal or demo records. |


| File | Functionality |
| --- | --- |
| `src/lib/supabase/client.ts` | Creates the public mobile Supabase client with a publishable key only. Never place a secret/service-role key in the app. |
| `src/lib/supabase/session-storage.ts` | Native persistent storage adapter for Supabase Auth sessions. |
| `src/lib/supabase/database.types.ts` | Generated database types. Once generation is configured, do not hand-edit. |
| `src/lib/ai/contracts.ts` | Client/server request and response contracts for parsing, receipts, and Ask. |
| `src/lib/ai/api.ts` | Authenticated calls to server-side AI endpoints; never contains AI provider secrets. |
| `src/lib/offline/database.ts` | Serialized account-scoped AsyncStorage transaction boundary and cache subscriptions. |
| `src/lib/offline/sync-queue.ts` | Durable background jobs for sync, AI enrichment, transient receipt parsing, and currency conversion. |
| `src/providers/app-providers.tsx` | Auth-scoped durable journal snapshot, background refresh/sync lifecycle, and async UI mutation commands. |
| `src/services/currency-service.ts` | Exchange-rate retrieval/cache with deferred conversion when offline. |
| `src/services/network-service.ts` | Connectivity changes and reconnect processing triggers. |
| `src/storage/journal-repository.ts` | Storage contract for raw notes, structured transactions, attachments, and sync status. |
| `src/storage/onboarding-repository.ts` | Validated AsyncStorage snapshot used for first-run gating and offline-safe onboarding progress. |
| `src/storage/settings-repository.ts` | Reserved local/remote user preference storage contract; account-local settings currently live in the journal cache. |
| `src/storage/preferences-storage.ts` | Android/web legacy device-preference adapter used for one-time migration into the account cache. |
| `src/storage/preferences-storage.ios.ts` | iOS legacy preference/Back Tap adapter used for one-time account-cache migration. |
| `src/store/session-store.ts` | Small cross-feature app/session state boundary; do not duplicate server data here. |
| `src/types/domain.ts` | Canonical client domain types shared across features. |
| `src/types/sync.ts` | Queue job, retry, failure, conflict, and sync-state types. |
| `src/utils/amounts.ts` | Totals already-interpreted entry lines; it does not parse note text. |
| `src/utils/currency.ts` | Pure money formatting and safe conversion helpers. |
| `src/utils/dates.ts` | Pure effective-date, relative-date, range, and display helpers. |
| `src/constants/theme.ts` | Existing color, font, spacing, and layout tokens. Evolve this rather than scattering raw values. |
| `src/hooks/use-color-scheme.ts` | Existing platform color-scheme hook. |
| `src/hooks/use-color-scheme.web.ts` | Existing web color-scheme implementation. |
| `src/hooks/use-theme.ts` | Existing theme token hook. |
| `src/global.css` | Existing web-global styling entry point. |

## Supabase workspace: `supabase/`

| Path | Functionality |
| --- | --- |
| `supabase/migrations/` | Versioned database schema, indexes, triggers, grants, and RLS policies. Create files with `supabase migration new <name>`; do not invent migration timestamps. |
| `supabase/functions/_shared/` | Shared server-only helpers for auth checks, validation, AI providers, responses, and CORS. |
| `supabase/tests/` | Database/RLS tests proving users cannot access one another's financial data. |
| `supabase/config.toml` | CLI-generated project settings and authenticated backend function entry points, including guarded Ask Finn SQL. |
| `supabase/seed.sql` | **Planned:** deterministic local-only development data, added when a real schema exists. |
| `supabase/functions/parse-entry/index.ts` | Gemini-only text interpretation with grounded evidence validation and idempotent commits. |
| `supabase/functions/scan-receipt/index.ts` | **Planned:** receipt OCR/extraction without exposing provider secrets. |
| `supabase/functions/ask-money/index.ts` | Bounded context/catalog reads, cached Gemini filter interpretation, SQL totals and cursor-based source pages. |
| `supabase/functions/ask-sql/index.ts` | Guarded advanced questions through a dedicated read-only role and private revision-aware source sessions. |
| `supabase/functions/delete-account/index.ts` | Verifies the caller and deletes that auth user through a server-only admin client. |
| `supabase/functions/convert-currency/index.ts` | **Planned only if needed:** trusted exchange-rate proxy/cache. |

Supabase safety requirements:

- Enable RLS on every table exposed through the Data API and use ownership predicates, not only `TO authenticated`.
- An update policy needs `SELECT`, `USING`, and `WITH CHECK` behavior appropriate to ownership.
- Keep AI keys, service-role keys, and other secrets in server/Edge Function environment variables only.
- Public client configuration may contain only the project URL and publishable key.
- New tables may require explicit Data API grants in addition to RLS; verify the project Data API settings.
- Never persist receipt images in Supabase Storage or Postgres; accept them only as authenticated transient parsing inputs.

## Root configuration and documentation

| File | Functionality |
| --- | --- |
| `.env.server` (ignored) | Local Edge Function secret-deployment input; never commit it or copy it into Expo configuration. |
| `.gitignore` | Excludes dependencies, generated output, native builds, and all real environment files. |
| `app.json` | Expo app identity, plugins, platform config, scheme, icons, and experiments. |
| `package.json` | Scripts and pinned application dependency ranges. |
| `package-lock.json` | npm dependency lockfile currently present. Choose one package manager before changing dependencies. |
| `pnpm-lock.yaml` | pnpm dependency lockfile currently present and untracked. Do not maintain two lockfiles long-term. |
| `pnpm-workspace.yaml` | pnpm workspace configuration currently present and untracked. |
| `tsconfig.json` | Strict Expo TypeScript configuration, `@/*` aliases and pure shared TypeScript imports; excludes Deno entry points. |
| `README.md` | General repository setup/readme. |
| `CLAUDE.md` | Existing alternate-agent instructions; keep aligned with project rules if used. |
| `docs/decisions/` | Short architecture decision records for choices that future contributors must understand. |
| `assets/expo.icon/` | Expo icon source bundle. |
| `assets/images/` | Raster images, splash/icon sources, tab icons, and future Finn-owned visuals. |
| `assets/images/splash-screen.xml` | Transparent Android splash drawable configured in `app.json`; supplies the required native logo resource while keeping the warm background-only splash. |

## Tests

| Directory | Functionality |
| --- | --- |
| `tests/unit/journal-offline.test.ts` | Cache migration, adapter fidelity, correction, and preset-capture regression tests. |
| `tests/integration/` | Repository, offline queue, local database, and API boundary tests. |
| `tests/e2e/` | Critical user flows: offline capture, reopen, sync, correction, receipt, and Ask source inspection. |
| `supabase/tests/` | SQL/RLS tests separate from client tests. |
| `supabase/tests/money-evidence.test.ts` | Grounded amount evidence and exact minor-unit conversion tests; semantic interpretation remains Gemini-only. |

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
