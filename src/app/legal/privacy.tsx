import { LegalDocumentScreen } from "@/features/legal/components/legal-document-screen";

export default function PrivacyPolicyRoute() {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      effectiveDate="September 20, 2026"
      intro="Finn is a private financial journal. This policy explains what the app handles, why it is needed, and the choices you have."
      sections={[
        {
          heading: "Information you provide",
          paragraphs: [
            "Finn processes account details such as your email address and the financial notes, amounts, categories, people, places, extracted receipt text, and preferences you choose to save.",
            "A receipt image is kept on your device only while parsing or retry is pending, sent as a transient authenticated request, and deleted after extraction succeeds. Finn does not store receipt images in its backend.",
            "Location is optional. When enabled, Finn may attach approximate place context when you save an entry; it is not intended for continuous tracking.",
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
            "Account and synced journal data are stored through Supabase. Selected text may be processed by the configured AI provider to organize entries. Device storage can hold session information, preferences, and an offline journal queue.",
            "Finn does not sell your financial journal or use it for targeted advertising.",
          ],
        },
        {
          heading: "Your choices",
          paragraphs: [
            "You can leave optional location features off, sign out on this device, and delete your account from Settings. Account deletion removes the authentication account and server records linked to it; the app also clears the account-scoped offline journal stored on this device.",
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
