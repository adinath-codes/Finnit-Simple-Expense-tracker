# Finn Project File Structure

> Fast architecture index for agents and contributors.
>
> Start here before searching the repository. This file describes ownership, intended routes, and the purpose of every scaffolded source file. The core reference-matched UI is implemented with in-memory JSON fixtures; unused feature placeholders remain intentionally unimplemented.

## Canonical references — read only when relevant

| File | Read when the task affects |
| --- | --- |
| `PROJECT_CORE_IDEA.md` | Product scope, domain behavior, data semantics, privacy, offline reliability, AI responsibilities, or MVP priority. |
| `PRODUCT_DESIGN.md` | UI, UX, layout, visual styling, sheets, motion, native feel, or interaction details. |
| `PROJECT_FILE_STRUCTURE.md` | File location, module ownership, route placement, or architecture navigation. Start here. |
| `AGENTS.md` | Agent working rules and the required Expo SDK 57 documentation check. |

Do not load both canonical product documents for routine maintenance. Search their headings and read only the sections relevant to the task.

## Implemented UI preview — September 2026

The reference images are recreated with **Finn financial content**, confirmed by the user, and a small vector recreation of the reference’s green mountain mark. This direct request takes precedence over the earlier inspiration-only guidance in `PRODUCT_DESIGN.md`.

- `src/data/mock-journal.json` owns all seeded journal entries, line items, references, presets, goals, profile values, and preferences. Amounts use integer minor units.
- `src/storage/journal-repository.ts` is the fixture-loading adapter. Replace this boundary when adding persistence; components never import JSON or call a backend.
- `src/providers/app-providers.tsx` owns session-only preview entries, presets, goals, and selected date. Preferences persist locally with AsyncStorage so launch-time routes can honor settings; the remaining preview data resets to the fixture on reload. This screen provider is not connected to the new backend/auth services, notification scheduling, location collection, or recording.

- `src/types/domain.ts` defines typed UI records; `src/utils/amounts.ts`, `currency.ts`, and `dates.ts` supply deterministic totals, formatting, date labels, and the simple trailing-amount demo parser.
- `src/features/journal/components/journal-glyph.tsx` maps journal controls to the shared native-symbol layer: SF Symbols on iOS and Material Symbols on Android/web. `assets/images/journal/` owns the small reference-inspired header mark and legacy static SVG glyph assets.
- `assets/sf-pro-display/` contains the supplied SF Pro Display fonts. The root layout loads regular, medium, and bold faces for Android/web before showing the app; iOS uses its native system font. `metro.config.js` registers the supplied uppercase `.OTF` extension.
- `src/components/ui/icon.tsx` maps SF Symbols on iOS to Material Symbols on Android/web and applies the native one-shot symbol effect requested by the nearest button. `button.tsx` supplies 120ms press feedback, triggers symbol effects, and respects reduced motion. `icon-button.tsx` supplies floating circular controls.
- `src/components/common/screen.tsx` supplies the warm canvas, optional journal peach-to-lilac gradient, and desktop width limit. `src/components/sheets/app-sheet.tsx` owns sheet chrome, scrolling, dismissal, keyboard avoidance, and footer spacing.
- Implemented journal components: `journal-screen.tsx`, `journal-header.tsx`, `journal-entry-card.tsx`, `journal-composer.tsx`, `journal-processing-status.tsx`, `journal-glyph.tsx`, `voice-recording-waveform.tsx`. The blank paper is the input; focusing it reveals the mic/add/camera/keyboard toolbar, and keyboard dismissal restores the compact totals pill. When connectivity is unavailable, a quiet footer pill reports the durable outbox's pending-job count without blocking capture. New notes and in-place edits share the same bouncing-dots, shimmered-status, source, calculation, and result sequence. A 150ms idle pause reveals optimistic processing feedback, one unchanged second starts a cancellable local parsing sequence, and the completed entry auto-saves while keeping the composer ready. The keyboard button can start the same sequence immediately and dismiss after it finishes. The draft dots open note options. Voice is an explicitly labeled sample preview; the waveform loops horizontally, responds to normalized live amplitude when supplied, and provides its own preview envelope when no recorder is connected. The camera action opens the real permission-aware `expo-camera` preview in a compact floating panel, provides torch/flip/capture/review controls, and attaches the accepted local photo to a session entry for manual review.
- Implemented detail components: `entry-detail-sheet.tsx`, `transaction-breakdown.tsx`. Editing quantities/amounts updates totals; references expand; entries can become saved shortcuts.
- `features/presets/components/preset-list.tsx` owns search, create/edit/delete, and one-tap journal insertion.
- `features/settings/components/settings-screen.tsx` owns location/reminder switches, frequency/time controls, saved-entry navigation, iOS Back Tap setup, legal-document links, local sign-out, and confirmed account deletion.
- `features/summary/components/spending-breakdown-card.tsx` owns the floating total's inline goal breakdown and animated progress bars.
- `features/calendar/components/calendar-screen.tsx` owns month browsing and selected-day journal navigation.
- `features/onboarding/` adapts the Life Outside card/progress/slide language into a short Finn flow: two product explainers and three questions covering the user's desired outcome, tracking friction, and default currency. Progress resumes from AsyncStorage, completion gates `/`, and a signed-in or explicitly enabled anonymous Supabase session synchronizes the owner-only result.

Implemented routes in addition to `/`: onboarding; sign-in/reset/callback; privacy and terms; entry, settings and preset sheets; calendar; quick add; and search. Onboarding is always first on a new install, then the session gate presents authentication before any private route. Email/password, Google OAuth, and Apple OAuth share the persisted Supabase session. Native sheets use Expo Router form sheets; the web preview uses Router form sheets. The iOS-only Back Tap flow uses the `finn://quick-add` deep link, a persisted Settings toggle, and the focused quick-capture screen in `src/features/quick-capture/`.

Run the preview with `node node_modules/expo/bin/cli start --web`. Run type checking with `node node_modules/typescript/bin/tsc --noEmit`. Direct Node invocation avoids the colon-in-project-path issue with package-manager executable lookup.

## Implemented text backend — September 19, 2026

The backend below is implemented locally but **not deployed or tested**. Its client
search page reads authenticated Supabase data through its own hook. The main journal
provider still uses fixtures; connecting capture/auth/sync UI remains separate. Do not map
exact backend transaction totals onto the preview's per-item or INR-only arithmetic.
Read `docs/backend/DEPLOYMENT.md` for deployment, API contracts, monetary semantics,
limits, and the current integration boundary.

| File | Responsibility |
| --- | --- |
| `docs/backend/DEPLOYMENT.md` | Deployment handoff, endpoint/client contracts, accuracy rules, and remaining UI/MVP work. |
| `supabase/migrations/20260919062838_finn_financial_journal.sql` | Schema/seeds, RLS/grants, atomic revision/idempotency RPCs, private quotas, indexed SQL search and insight views. |
| `supabase/migrations/20260919071006_finn_search_page.sql` | Recent context totals, bounded catalogs, keyset result pages, serialized journal revision tracking, and owner-scoped interpretation cache. |
| `supabase/migrations/20260919082754_finn_onboarding_profile.sql` | Bounded onboarding answers, extracted defaults, grants, and owner-only RLS policies. |
| `supabase/migrations/20260919113403_extra_ai_quota_and_support_requests.sql` | Private expiring AI-call credits, deduplicated support requests, and atomic minute/day/month quota reservations. |
| `supabase/config.toml` | CLI-generated local project settings and authenticated Edge Function entry points. |
| `supabase/.gitignore` | Excludes CLI project links, temporary files and local secrets. |
| `supabase/functions/deno.json` | Server TypeScript runtime and formatting configuration, separate from Expo. |
| `supabase/functions/_shared/contracts.ts` | Pure shared wire contracts, supported currencies/scales, extraction and search plans. |
| `supabase/functions/_shared/validation.ts` | Runtime input, exact-money, entity, date and extraction validation. |
| `supabase/functions/_shared/dates.ts` | Timezone-aware calendar days, relative dates and period boundaries. |
| `supabase/functions/_shared/parser.ts` | Deterministic amount/quantity/direction parsing, splitting, entities and category precedence. |
| `supabase/functions/_shared/runtime.ts` | Session verification, RLS/admin clients, request bounds, quotas, catalogs and private-text-free metrics. |
| `supabase/functions/_shared/gemini.ts` | Bounded Gemini Flash structured output and evidence-grounded interpretation validation. |
| `supabase/functions/_shared/search.ts` | Deterministic query-to-filter parsing and allowlisted search-plan validation. |
| `supabase/functions/parse-entry/index.ts` | Durable capture before AI enrichment, extraction caching and retry deduplication. |
| `supabase/functions/correct-entry/index.ts` | Revision-checked correction/deletion with optional explicit personal category rules. |
| `supabase/functions/ask-money/index.ts` | Authenticated natural-language/explicit-filter search with SQL-only financial totals. |
| `supabase/functions/request-quota-review/index.ts` | Authenticated, deduplicated support escalation for accounts that reach the AI allowance. |
| `supabase/functions/delete-account/index.ts` | Authenticated, server-only deletion of the caller's account and cascading owner data. |
| `src/features/auth/` | Session provider, email/password auth, Google/Apple OAuth, callback handling, recovery, and reset UI. |
| `src/features/legal/` | Shared readable legal-document surface used by the bundled privacy policy and terms. |
| `src/lib/supabase/client.ts` | Lazy publishable-key client, explicit optional anonymous auth and session identity. |
| `src/lib/supabase/session-storage.ts` | AsyncStorage session persistence adapter. |
| `src/lib/supabase/database.types.ts` | Shared backend wire type exports; live generated schema types await Finn deployment. |
| `src/lib/ai/api.ts` | Authenticated Edge requests, session refresh, bounded timeout and typed retry errors. |
| `src/lib/offline/database.ts` | Serialized account-scoped durable cache/outbox document and subscriptions. |
| `src/lib/offline/sync-queue.ts` | Ordered retry queue, revision-conflict retention and foreground sync lifecycle. |
| `src/types/sync.ts` | Cached entry, correction/deletion payload, durable job and cache types. |
| `src/features/journal/services/journal-service.ts` | Durable capture, local reads, remote refresh and offline catalog caching. |
| `src/features/entries/services/entry-parser.ts` | Expo re-export of shared pure parser functions, with no server/provider imports. |
| `src/features/entries/services/entries-service.ts` | Offline correction/deletion queue commands using server revisions. |
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
├── .env.example
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
│   ├── data/
│   │   └── mock-journal.json
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
| `src/app/quick-add.tsx` | iOS Back Tap/Shortcut deep-link target for minimal expense-note capture. |
| `src/app/legal/privacy.tsx` | Privacy policy route; account deletion remains in Settings. |

## Shared components: `src/components/`

| File | Functionality |
| --- | --- |
| `src/components/common/screen.tsx` | Shared safe-area, max-width, background, and keyboard-aware screen shell. |
| `src/components/common/empty-state.tsx` | Calm reusable empty-content state. |
| `src/components/common/error-state.tsx` | Recoverable error message with retry affordance. |
| `src/components/common/loading-state.tsx` | Non-disruptive shared loading state. |
| `src/components/forms/amount-field.tsx` | Editable amount field with currency-aware behavior. |
| `src/components/forms/currency-picker.tsx` | Shared base/original currency selector. |
| `src/components/navigation/app-header.tsx` | Minimal shared app header primitive. |
| `src/components/sheets/app-sheet.tsx` | Accessible shared bottom-sheet wrapper and presentation defaults. |
| `src/components/ui/button.tsx` | Design-system button primitive. |
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
| `components/journal-header.tsx` | Finn mark, selected date/calendar entry, and adjacent search/settings buttons. |
| `components/journal-day-section.tsx` | One chronological day group with daily total. |
| `components/journal-entry-card.tsx` | Human-readable entry with amount and restrained metadata. |
| `components/journal-empty-prompt.tsx` | Empty-day writing CTA with reduced-motion-aware rotating example text. |
| `components/journal-composer.tsx` | Primary natural-language input with camera, later voice, and send actions. |
| `components/voice-recording-waveform.tsx` | Reusable reduced-motion-aware recording waveform with horizontal tick travel and optional normalized live-amplitude response. |
| `components/journal-processing-status.tsx` | Shared bouncing dots, shimmered clipped Reanimated status carousel, source badges, and emphasized-to-settled entry result. |
| `hooks/use-journal.ts` | Queries and mutations for journal capture/browsing. |
| `hooks/use-journal-entry-processing.ts` | Cancellable debounce, parsing phase schedule, and atomic auto-save coordinator. |
| `services/journal-service.ts` | Capture, retrieve, edit, and queue journal use cases. |
| `store/journal-draft-store.ts` | Unsaved composer text/attachments so navigation does not lose a draft. |
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
| `components/entry-detail-sheet.tsx` | Sheet shown after selecting a journal entry. |
| `components/entry-editor.tsx` | Lightweight amount, quantity, date, category, merchant, and context correction. |
| `components/transaction-breakdown.tsx` | Multiple transactions/items parsed from one human note. |
| `components/receipt-preview.tsx` | Receipt image, upload state, and extraction state. |
| `services/entry-parser.ts` | Deterministic amount/date/currency parsing followed by optional AI enrichment. |
| `services/entries-service.ts` | Entry update, split, merge, retry, and delete use cases. |
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
| `services/receipt-service.ts` | Local attachment creation, upload queueing, and extraction request. |
| `types/receipt.types.ts` | Local receipt-capture type; upload and extraction statuses remain planned. |

## Ask feature: `src/features/ask/`

| File | Functionality |
| --- | --- |
| `components/ask-screen.tsx` | Theme-matched search page with recent context cards, editable filters/dates, grounded answer, and Show more sources. |
| `components/ask-thread.tsx` | User questions and grounded financial answers. |
| `components/ask-composer.tsx` | Financial-history question input. |
| `components/source-entry-list.tsx` | Grouped dated source notes with expandable item/category/merchant/amount details. |
| `hooks/use-search.ts` | Auth-scoped context and search requests, cancellation, result state, cursor paging, retry, and stale-result handling. |
| `services/search-format.ts` | Exact BigInt currency presentation and calendar-range formatting. |
| `services/ask-service.ts` | Typed authenticated search/context calls with a 20-item page default. |
| `types/ask.types.ts` | Exact-money answer, active context, source item, and cursor request/response contracts. |

## Presets feature: `src/features/presets/`

| File | Functionality |
| --- | --- |
| `components/preset-list.tsx` | Subtle repeated-expense shortcuts near the composer/settings. |
| `components/preset-editor-sheet.tsx` | Create/edit/delete a user preset. |
| `services/presets-service.ts` | Preset persistence and journal-entry creation. |
| `types/preset.types.ts` | Preset definition and capture behavior. |

## Settings and profile features

| File | Functionality |
| --- | --- |
| `features/settings/components/settings-screen.tsx` | Settings hub for preferences, legal documents, sign-out, and confirmed account deletion. |
| `features/settings/components/currency-setting.tsx` | Base currency selection and current value. |
| `features/settings/components/location-setting.tsx` | Optional location capture and permission status. |
| `features/settings/services/settings-service.ts` | Settings retrieval/update use cases. |
| `features/settings/types/settings.types.ts` | Preference models. |
| `features/profile/components/profile-button.tsx` | Small header button that opens profile/settings. |
| `features/profile/components/profile-screen.tsx` | Account, subscription, export, privacy, sign-out, and deletion entry points. |
| `features/profile/types/profile.types.ts` | Profile presentation models. |

## Quick capture feature: `src/features/quick-capture/`

| File | Functionality |
| --- | --- |
| `components/quick-capture-screen.tsx` | Minimal iOS-only Finn logo, prompt, expense-note input, and save/cancel actions opened by `finn://quick-add`. |

## Onboarding and paywall features

| File | Functionality |
| --- | --- |
| `features/onboarding/components/onboarding-screen.tsx` | Reference-adapted welcome, question cards, progress/footer chrome, product explainers, reduced-motion transitions, and completion handoff. |
| `features/onboarding/data/onboarding-steps.ts` | Finn-specific questions, options, education copy, and flow order. |
| `features/onboarding/services/onboarding-service.ts` | Local-first progress/completion orchestration and authenticated Supabase restore/sync. |
| `features/onboarding/types/onboarding.types.ts` | Versioned answer, option, step, and persistence models. |
| `features/paywall/components/paywall-screen.tsx` | Subscription value shown only after the user understands the product. |
| `features/paywall/services/subscription-service.ts` | Product/entitlement lookup and purchase boundary. |
| `features/paywall/types/subscription.types.ts` | Subscription product and entitlement types. |

## Shared infrastructure

| UI fixture | Functionality |
| --- | --- |
| `src/data/mock-journal.json` | Replaceable sample values for the session-only UI preview. |


| File | Functionality |
| --- | --- |
| `src/lib/supabase/client.ts` | Creates the public mobile Supabase client with a publishable key only. Never place a secret/service-role key in the app. |
| `src/lib/supabase/session-storage.ts` | Native persistent storage adapter for Supabase Auth sessions. |
| `src/lib/supabase/database.types.ts` | Generated database types. Once generation is configured, do not hand-edit. |
| `src/lib/ai/contracts.ts` | Client/server request and response contracts for parsing, receipts, and Ask. |
| `src/lib/ai/api.ts` | Authenticated calls to server-side AI endpoints; never contains AI provider secrets. |
| `src/lib/offline/database.ts` | Local database initialization and transaction boundary. |
| `src/lib/offline/sync-queue.ts` | Durable background jobs for sync, AI enrichment, receipt upload, and currency conversion. |
| `src/providers/app-providers.tsx` | Root composition for theme, auth, local data, connectivity, and other providers. |
| `src/services/currency-service.ts` | Exchange-rate retrieval/cache with deferred conversion when offline. |
| `src/services/location-service.ts` | Optional, permission-aware, approximate location captured only for an entry. |
| `src/services/network-service.ts` | Connectivity changes and reconnect processing triggers. |
| `src/storage/journal-repository.ts` | Storage contract for raw notes, structured transactions, attachments, and sync status. |
| `src/storage/onboarding-repository.ts` | Validated AsyncStorage snapshot used for first-run gating and offline-safe onboarding progress. |
| `src/storage/settings-repository.ts` | Planned local/remote user preference storage contract. |
| `src/storage/preferences-storage.ts` | Android/web session-only preference adapter that avoids requiring an iOS-only native module. |
| `src/storage/preferences-storage.ios.ts` | iOS AsyncStorage adapter for persisted preferences and Back Tap state. |
| `src/store/session-store.ts` | Small cross-feature app/session state boundary; do not duplicate server data here. |
| `src/types/domain.ts` | Canonical client domain types shared across features. |
| `src/types/sync.ts` | Queue job, retry, failure, conflict, and sync-state types. |
| `src/utils/amounts.ts` | Pure deterministic parsing/normalization of obvious monetary amounts and quantities. |
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
| `supabase/config.toml` | CLI-generated project settings and three authenticated text-backend function entry points. |
| `supabase/seed.sql` | **Planned:** deterministic local-only development data, added when a real schema exists. |
| `supabase/functions/parse-entry/index.ts` | Durable deterministic capture and evidence-validated Gemini enrichment. |
| `supabase/functions/scan-receipt/index.ts` | **Planned:** receipt OCR/extraction without exposing provider secrets. |
| `supabase/functions/ask-money/index.ts` | Bounded context/catalog reads, cached Gemini filter interpretation, SQL totals and cursor-based source pages. |
| `supabase/functions/delete-account/index.ts` | Verifies the caller and deletes that auth user through a server-only admin client. |
| `supabase/functions/convert-currency/index.ts` | **Planned only if needed:** trusted exchange-rate proxy/cache. |

Supabase safety requirements:

- Enable RLS on every table exposed through the Data API and use ownership predicates, not only `TO authenticated`.
- An update policy needs `SELECT`, `USING`, and `WITH CHECK` behavior appropriate to ownership.
- Keep AI keys, service-role keys, and other secrets in server/Edge Function environment variables only.
- Public client configuration may contain only the project URL and publishable key.
- New tables may require explicit Data API grants in addition to RLS; verify the project Data API settings.
- Store receipt images in a private bucket with tested policies.

## Root configuration and documentation

| File | Functionality |
| --- | --- |
| `.env.example` | Public/server setting names and concrete Gemini/quota defaults; unknown project credentials and API secrets remain blank. |
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
| `tests/unit/` | Pure parsing, amount, currency, date, and service tests. |
| `tests/integration/` | Repository, offline queue, local database, and API boundary tests. |
| `tests/e2e/` | Critical user flows: offline capture, reopen, sync, correction, receipt, and Ask source inspection. |
| `supabase/tests/` | SQL/RLS tests separate from client tests. |

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
