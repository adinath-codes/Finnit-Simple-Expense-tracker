import { LegalDocumentScreen } from "@/features/legal/components/legal-document-screen";

export default function TermsRoute() {
  return (
    <LegalDocumentScreen
      title="Terms of Service"
      effectiveDate="September 23, 2026"
      intro="These terms govern your use of Finn. By creating an account or using the service, you agree to them."
      sections={[
        {
          heading: "Using Finn",
          paragraphs: [
            "You must provide accurate account information, protect your credentials, and use Finn only for lawful personal purposes. You are responsible for activity performed through your account.",
            "Do not misuse the service, attempt unauthorized access, interfere with other users, upload unlawful content, or use automated traffic that harms availability.",
          ],
        },
        {
          heading: "Your journal",
          paragraphs: [
            "You retain ownership of the notes and information you submit. You give Finn the limited permission needed to host, process, organize, synchronize, and display that content back to you.",
            "You should keep independent records for information you cannot afford to lose. Features may change while Finn is being developed.",
          ],
        },
        {
          heading: "Not financial advice",
          paragraphs: [
            "Finn is a journaling and information tool. It does not provide financial, tax, accounting, investment, or legal advice. Review entries and calculations before relying on them for important decisions.",
          ],
        },
        {
          heading: "Finn Premium subscription",
          paragraphs: [
            "Finn requires an active Premium subscription. The purchase screen shows the subscription name, billing period, localized full renewal price, included service, and any introductory trial for which your store account is eligible before you confirm a purchase.",
            "Subscriptions purchased through Apple are charged to your Apple Account and renew automatically unless you cancel before the current period ends. You can manage or cancel the subscription in your App Store subscription settings. Deleting your Finn account does not automatically cancel a store subscription.",
            "If an eligible three-day free trial is shown, billing begins at the displayed renewal price when the trial ends unless you cancel first. Offer-code eligibility, duration, redemption, billing, refunds, and renewals are administered by the App Store under its terms.",
          ],
        },
        {
          heading: "Availability and responsibility",
          paragraphs: [
            "The service is provided on an as-available basis. To the extent permitted by law, Finn is not responsible for indirect or consequential losses, decisions made from inaccurate entries, or interruptions outside its reasonable control.",
          ],
        },
        {
          heading: "Ending your account",
          paragraphs: [
            "You may stop using Finn or delete your account from Settings. Finn may restrict access when necessary to protect users, comply with law, or address serious misuse.",
            "Provisions that by their nature should continue—including ownership, disclaimers, and limitations—survive account termination.",
          ],
        },
        {
          heading: "Changes",
          paragraphs: [
            "These terms may be updated as the service evolves. Material changes should be communicated in the app. Continuing to use Finn after updated terms take effect means you accept them.",
          ],
        },
      ]}
    />
  );
}
