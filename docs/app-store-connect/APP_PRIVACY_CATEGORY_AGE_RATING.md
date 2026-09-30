# App Store Connect privacy, category, and age rating

This is the source of truth for Finnit's App Store Connect answers. Re-audit it
whenever a data flow, SDK configuration, provider, or user-facing feature
changes. App Privacy answers are app-level and must include data collected by
the app and its third-party service providers.

## App Privacy

### Privacy links

- Privacy Policy URL: `https://www.finn-it.app/privacy/`
- User Privacy Choices URL: `https://www.finn-it.app/privacy-choices/`

### Data collection

Answer **Yes, we collect data from this app** and select the following data
types. Unless a row says otherwise, the data is linked to the user's identity
and is not used for tracking.

| App Store data type | Purpose selections | Why it is collected |
| --- | --- | --- |
| Contact Info → Name | App Functionality | Supabase Auth can receive and store the name returned by Sign in with Apple or Google. |
| Contact Info → Email Address | App Functionality | Supabase Auth uses email for account creation, sign-in, verification, and password recovery. |
| Financial Info → Other Financial Info | App Functionality | Supabase stores the user's private journal transactions, amounts, goals, categories, merchants, and related financial context. With explicit AI consent, relevant financial content is processed by Google Gemini. |
| User Content → Photos or Videos | App Functionality | A user can submit a receipt photo to Google Gemini for extraction. Finnit's backend does not persist the image, but Gemini may retain API inputs for abuse monitoring under its service terms. |
| User Content → Other User Content | App Functionality | Supabase stores journal notes, descriptions, presets, receipt-derived text, corrections, and settings. With explicit AI consent, relevant notes and context are processed by Gemini. |
| Search History | App Functionality | Ask Finn sends an explicitly submitted financial-journal query to Gemini. Queries are not sent on each keystroke and are not included in PostHog or Sentry. |
| Purchases → Purchase History | App Functionality; Analytics | RevenueCat validates App Store receipts, grants entitlements, restores purchases, and provides customer and subscription analytics. |
| Identifiers → User ID | App Functionality; Analytics | The opaque Supabase account UUID identifies the account in Supabase, RevenueCat, PostHog, and Sentry. Email and display name are not sent to PostHog or Sentry. |
| Identifiers → Device ID | Analytics | PostHog assigns an anonymous SDK distinct identifier before authentication and associates it with the opaque account ID after sign-in. No IDFA or advertising identifier is used. |
| Usage Data → Product Interaction | App Functionality; Analytics | PostHog records bounded feature and screen events plus privacy-masked sampled replay; RevenueCat records paywall impressions; Sentry records privacy-filtered navigation and interaction diagnostics. |
| Diagnostics → Crash Data | App Functionality | Sentry collects production JavaScript/native crash and error information and associates it with the opaque account ID. |
| Diagnostics → Performance Data | App Functionality | Sentry samples app-start, navigation, transaction, and other performance traces. |
| Diagnostics → Other Diagnostic Data | App Functionality | Sentry collects privacy-filtered failed-request and operational diagnostics, release health, device/app context, and masked error replay. |

For every row above:

- **Linked to the user's identity:** Yes.
- **Used for tracking:** No.

Do not select Third-Party Advertising, Developer's Advertising or Marketing,
or Other Purposes for any data type. Do not declare that the app uses data to
track users. Finnit does not combine app data with third-party data for
advertising, advertising measurement, or data-broker use.

### Do not select

- Payment Info: Apple handles billing details outside Finnit and the developer
  never receives the card or bank information.
- Credit Info, Precise Location, Coarse Location, Contacts, Sensitive Info,
  Emails or Text Messages, Audio Data, Browsing History, Advertising Data,
  Health, Fitness, Gameplay Content, Environment Scanning, Hands, Head, or
  Other Data Types.
- Customer Support is omitted under Apple's optional-disclosure criteria: the
  in-app support action opens a user-initiated mail composer, is infrequent and
  optional, and is not part of the app's primary functionality. Sentry's
  complaint action sends a fixed, content-free feedback event rather than user
  support text.

### Provider reconciliation

| Provider | Data represented by the selections above | Important boundary |
| --- | --- | --- |
| Supabase | Name, email address, opaque user ID, financial information, journal/user content, consent/account settings, and account-scoped operational records | Auth tokens use native secure storage. Receipt image bytes are never written to Supabase Storage, Postgres, logs, or the response. |
| Google Gemini | Financial notes/context, receipt photos, explicitly submitted search queries, and generated responses | Only after explicit user consent. No Supabase user ID is included in the Gemini payload. Paid-service inputs are not used to improve Google's products, but may be retained for abuse monitoring unless the project has approved zero-data-retention controls. |
| PostHog | Opaque user ID, anonymous SDK/device identifier, app lifecycle, screens, bounded feature events, and sampled masked session replay | Financial values, notes, receipt data, search queries, email, raw routes, touch capture, network telemetry, console logs, and GeoIP are disabled or removed. Users can opt out in Settings. |
| RevenueCat | Opaque user ID, purchase history, subscription status, entitlements, restore activity, and paywall impressions | No payment-card/bank data, location, or advertising identifier is supplied by Finnit. Purchase History is used for both App Functionality and Analytics. |
| Sentry | Opaque user ID, crash data, performance data, operational diagnostics, app/device context, privacy-filtered navigation/interaction metadata, and masked error replay | Default PII, email/profile data, request bodies, headers, cookies, query strings, screenshots, view hierarchies, console breadcrumbs, journal content, receipt content, searches, and financial amounts are excluded. |

## Categories

- Primary Category: **Finance**
- Secondary Category: **Productivity**

Finance is primary because Finnit's core experience is personal financial
management: recording expenses and income, organizing transactions, reviewing
spending, and querying a private financial journal. Productivity is an honest
secondary category for the journal and organization workflow.

## Age rating questionnaire

Use these answers in the current App Store Connect questionnaire.

### In-App Controls

- Parental Controls: **No**
- Age Assurance: **No**

### Capabilities

- Unrestricted Web Access: **No**
- User-Generated Content: **No** — private journal entries are not broadly
  distributed to other users.
- Social Media: **No**
- Social Media Disabled for Users Under 13: **No**
- Messaging and Chat: **No**
- Advertising: **No**

### Mature Themes

- Profanity or Crude Humor: **None**
- Horror/Fear Themes: **None**
- Alcohol, Tobacco, or Drug Use or References: **None**

### Medical or Wellness

- Medical or Treatment Information: **None**
- Health or Wellness Topics: **None**

### Sexuality or Nudity

- Mature or Suggestive Themes: **None**
- Sexual Content or Nudity: **None**
- Graphic Sexual Content and Nudity: **None**

### Violence

- Cartoon or Fantasy Violence: **None**
- Realistic Violence: **None**
- Prolonged Graphic or Sadistic Realistic Violence: **None**
- Guns or Other Weapons: **None**

### Chance-Based Activities

- Gambling: **No**
- Simulated Gambling: **None**
- Contests: **None**
- Loot Boxes: **No**

### Additional Information

- Age Category and Override: **Not Applicable**
- Made for Kids: **No**
- Override to Higher Age Rating: **No**
- Age Suitability URL: leave blank
- Expected calculated global rating: **4+**

The private journal and narrow financial extraction/search model are not social
or open-ended chat capabilities. If Finnit later adds shared journals, a public
feed, direct messaging, ads, unrestricted browsing, or broader AI chat, repeat
the questionnaire before the next submission.
