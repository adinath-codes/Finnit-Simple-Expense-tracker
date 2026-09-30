# Sentry production observability

Finn initializes Sentry before Expo Router and enables it only in non-development
builds with a non-placeholder DSN. The integration covers JavaScript errors,
native crashes, unhandled promise rejections, release health, failed requests,
navigation/interaction performance, app-start timing, and error-triggered mobile
session replay.

Native transport remains enabled, which is the React Native SDK boundary that
provides device context and its bounded offline envelope cache. Events captured
during a normal connectivity outage can therefore be delivered after the device
reconnects without adding an app-level polling loop.

## Configure the real project

Replace these values in the local `.env` and in the matching EAS build/update
environment:

- `EXPO_PUBLIC_SENTRY_DSN`: the client DSN from Sentry project settings.
- `SENTRY_ORG`: the Sentry organization slug.
- `SENTRY_PROJECT`: the Sentry project slug.
- `SENTRY_AUTH_TOKEN`: a secret organization token with release and source-map
  upload access. Keep this value in EAS with sensitive visibility.
- `SENTRY_DISABLE_AUTO_UPLOAD`: remove this variable or change it to `false`
  only after the real organization, project, and auth token are configured.

The `EXPO_PUBLIC_*_SAMPLE_RATE` values accept a decimal from `0` through `1`.
Current defaults collect 15% of performance traces, no continuous replays, and a
masked replay for every captured error session.

The non-secret organization and project slugs are also pinned in the Expo
config plugin so native source-map configuration cannot silently target another
project. `SENTRY_AUTH_TOKEN` remains environment-only and must never be added to
app config or source control.

Create a new release build after replacing the placeholders. Native debug files
and Metro source maps are uploaded by the Sentry Expo plugin. For an EAS Update,
export the update and run `npx sentry-expo-upload-sourcemaps dist` with the same
Sentry environment variables available.

## Privacy boundary

Finn sends the authenticated Supabase user UUID only; it does not attach the
user's email or profile fields. Session replay masks all text, images, and vector
graphics. Screenshots and view-hierarchy attachments are disabled. Console
breadcrumbs, request bodies, headers, cookies, query strings, event extras, and
dispatched navigation parameters are removed before an event is sent.

Operational breadcrumbs must contain only stable action names, status codes,
counts, and booleans. Never attach journal text, receipt content or images,
search questions, correction instructions, email addresses, tokens, local file
paths, full payloads, or financial amounts.

## Recovery screen and complaints

The root Sentry error boundary automatically captures render failures and shows
Finn's recovery screen instead of a technical crash page. “Try again” resets the
boundary. “Raise a complaint” does not send a duplicate exception: it creates a
fixed, content-free Sentry feedback event associated with the original event ID
and includes the already privacy-masked error replay when available. The action
immediately confirms through the app toast and disables itself to prevent
duplicate feedback.

## Verification when credentials are available

1. Build a production release so source maps and native symbols are generated.
2. Trigger a handled test exception through a temporary local-only test action.
3. Confirm the event has a readable source-mapped stack, release/environment,
   route, app/device context, opaque user ID, masked replay, and preceding
   operational breadcrumbs.
4. Remove the temporary test action before shipping.

Do not validate Sentry only in Expo Go: native crash handling, release metadata,
debug files, and production sampling require a release build.
