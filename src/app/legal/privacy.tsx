import { LegalDocumentScreen } from "@/features/legal/components/legal-document-screen";

export default function PrivacyPolicyRoute() {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      effectiveDate="September 23, 2026"
      intro="Finn is a private financial journal. This policy explains what the app handles, why it is needed, and the choices you have."
      sections={[
        {
          heading: "Information you provide",
          paragraphs: [
            "Finn processes account details such as your email address and the financial notes, amounts, categories, people, places, extracted receipt text, and preferences you choose to save.",
            "A receipt image is kept on your device only while parsing or retry is pending, sent as a transient authenticated request, and deleted after extraction succeeds. Finn does not store receipt images in its backend.",
            "Finn no longer requests location when you save a note. Older notes may still contain place context saved when that option was available.",
          ],
        },
        {
          heading: "How Finn uses information",
          paragraphs: [
            "Your information is used to authenticate you, save and sync your journal, organize entries, calculate totals, answer searches about your own history, prevent abuse, and keep the service reliable.",
            "AI may receive a note, a transient receipt image, or the limited context needed to structure an entry or interpret a search. Deterministic records—not an AI model—remain the source of truth for financial totals.",
          ],
        },
        {
          heading: "Storage and service providers",
          paragraphs: [
            "Account and synced journal data are stored through Supabase. Selected text may be processed by the configured AI provider to organize entries. Device storage can hold session information, preferences, and an offline journal queue. RevenueCat receives Finn's opaque account ID plus app, device, storefront, product, purchase, trial, and entitlement information needed to provide and restore Premium access. RevenueCat does not receive your journal notes, amounts, receipts, or searches from Finn.",
            "Production builds use Sentry to diagnose crashes, errors, failed requests, and performance problems, and PostHog to understand onboarding, retention, conversion, and feature usage.",
            "Diagnostic reports may include app, build, device, route, timing, and pseudonymous account-ID context. Error-session replays mask all text, images, and vector graphics. Finn does not intentionally include financial notes, receipt content or images, search questions, email addresses, authentication tokens, request bodies or query strings, console logs, standalone screenshots, or view-hierarchy attachments in Sentry reports.",
            "PostHog receives named product events such as an onboarding step being completed or a journal feature being used, plus coarse app, device, operating-system, locale, route, outcome, and timing properties. It uses only Finn's opaque account ID after sign-in and discards client IP addresses after permitted ingestion transformations. Touch autocapture is disabled. Analytics deliberately excludes journal text, amounts, merchant names, receipt data or images, search questions, email addresses, tokens, and record identifiers. For approximately 10% of opted-in app sessions, privacy-masked session replay is enabled: all text and images are masked, touch coordinates, logs, and network telemetry are disabled, and no replay is recorded after analytics is turned off.",
            "Finn does not sell your financial journal or use it for targeted advertising.",
          ],
        },
        {
          heading: "Your choices",
          paragraphs: [
            "You can turn usage analytics off at any time in Settings. You can also sign out on this device and delete your account from Settings. Account deletion removes the authentication account and server records linked to it; the app also clears the account-scoped offline journal stored on this device.",
            "Some short-lived operational records may remain where required for security, legal compliance, or reliable deletion, and provider backups may expire on their normal schedule.",
          ],
        },
        {
          heading: "Security and changes",
          paragraphs: [
            "Finn uses authenticated, owner-scoped access controls, but no online service can promise absolute security. Keep your device and sign-in credentials protected.",
            "This policy may change as Finn develops. Material changes should be presented in the app with a new effective date before they apply.",
          ],
        },
      ]}
    />
  );
}
