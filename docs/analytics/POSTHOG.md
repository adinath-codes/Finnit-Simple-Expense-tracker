# PostHog product analytics

Finn sends privacy-bounded product behavior to PostHog. The implementation is
designed to answer activation, retention, feature adoption, funnel, and
reliability questions without copying the user's financial journal into a
third-party analytics system.

## Project and dashboards

PostHog project: `622987` in the US region.

- [Finn — Executive & Retention](https://us.posthog.com/project/622987/dashboard/2124064)
- [Finn — Onboarding & Conversion](https://us.posthog.com/project/622987/dashboard/2124065)
- [Finn — Product & Reliability](https://us.posthog.com/project/622987/dashboard/2124066)

The saved insight set covers:

- week 0–8 retention after onboarding and after the first journal entry;
- onboarding, sign-in, receipt capture, activation, and Ask Finn funnels;
- DAU, WAU, active-user lifecycle, and 30-day journal stickiness;
- first journal entries and weekly journal volume;
- feature adoption across journal, receipts, Ask Finn, presets, calendar, and
  entry details;
- sign-in, sync, product-operation, recovery, quota, and complaint health.

Charts are expected to be empty until a build configured with the PostHog
environment variables sends its first event batch.

## Data contract

Event names live in `src/lib/analytics/analytics.ts`. The contract uses
lowercase, space-separated past-tense events. Common properties are bounded
enums, booleans, counts, and durations, for example `feature`, `action`,
`outcome`, `method`, `source`, `step_id`, `duration_ms`, and `result_count`.

Manual screen events use stable names and normalized routes. Entry routes are
reported as `/entries/:entryId`; the actual entry identifier is never sent.
Touch autocapture is disabled.

The client identifies an authenticated person only with the opaque Supabase
user UUID. No email, display name, or social-provider identity is attached.
Anonymous pre-auth events are merged into that opaque identity after sign-in by
the PostHog SDK.

## Forbidden data

Never add any of these to an analytics event or person property:

- monetary amounts, currencies tied to a transaction, balances, or goals;
- journal notes, descriptions, Ask Finn questions, prompts, or AI responses;
- receipt images, extracted receipt text, merchant names, or line items;
- email addresses, phone numbers, access tokens, passwords, or secrets;
- entry, receipt, attachment, sync-job, or other content identifiers;
- raw URLs, URI paths, request bodies, query strings, or arbitrary nested data.

`analytics-sanitization.ts` is the last-line outbound guard. It removes
sensitive keys, URLs, nested custom payloads, email-like strings, and UUIDs.
Keep explicit event call sites privacy-safe as well; the sanitizer is defense in
depth, not permission to send raw application objects.

## Consent and session replay

Usage analytics defaults on and can be switched off under **Settings → Privacy
& legal → Share usage analytics**. Opt-out stops capture through the SDK and is
stored locally immediately. Migration
`20260923100000_usage_analytics_preference.sql` adds the durable account-level
preference so it follows the user across devices.

Session replay is enabled for approximately 10% of opted-in sessions. Both the
PostHog project and the client use a `0.1` sample rate. Finn's client replay
configuration masks text inputs, images, and sandboxed views; disables touch
capture, console logs, network telemetry, and rage-click collection; and
compresses screenshots. The PostHog project additionally uses **Total privacy**
masking and disables project-side console-log and network capture. Re-test these
protections whenever a native SDK is upgraded.

PostHog's project privacy setting discards client IP addresses after permitted
ingestion transformations. The SDK also sends `disableGeoip: true`, providing a
client-side guard against GeoIP enrichment.

## Environment

Set the following locally and as EAS build environment variables:

```dotenv
EXPO_PUBLIC_POSTHOG_KEY=phc_your-public-project-token
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
EXPO_PUBLIC_POSTHOG_ENABLED=true
EXPO_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE=0.1
```

The project token is a public ingestion token, but it should still be managed
through local/EAS environment configuration so environments can use separate
projects. Never put a PostHog personal API key in the app.

## Verification

1. Install a fresh native Android/iOS build after changing the PostHog native
   plugin.
2. Open Finn, complete a safe test journey, and wait for the SDK flush interval.
3. Confirm the matching events in PostHog's live events view.
4. Inspect event properties and verify that no forbidden data or raw route IDs
   are present.
5. Turn usage analytics off, repeat an action, and verify that no new event is
   received. Turn it back on only if desired.
6. Run `npm run test:analytics` and `npm run typecheck`.

For SDK behavior and upgrades, consult the official
[PostHog React Native documentation](https://posthog.com/docs/libraries/react-native)
and the versioned [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/).
