# App Review release handoff

Last audited: September 29, 2026

This is the release-control document for Finnit's first iOS submission. It
records what was verified in the live Apple, RevenueCat, EAS, and Supabase
projects and keeps credentials and private key material out of the repository.

## Live configuration audit

| Area | Verified state | Release status |
| --- | --- | --- |
| App Store subscriptions | One `Finn Premium` group contains annual, monthly, and weekly products. All three are `Prepare for Submission`, available in all 175 storefronts, have English (U.S.) display name/description, and show `Free for the first 3 days` in all 175 storefronts. | Product metadata and introductory offers are ready. The first subscription group still has to be added to app version 1.0 and submitted with it. |
| IAP review information | Annual, monthly, and weekly each have an empty review screenshot and empty product review notes. | Blocked until a real iOS paywall screenshot is captured and uploaded for each product. |
| Apple App ID | `com.finnit.app` has In-App Purchase enabled. Sign in with Apple is also enabled. | Complete. No capability change is required. |
| App version 1.0 | Status is `Prepare for Submission`. The version has no selected build, no iPhone product screenshots, and blank App Review username, password, and notes fields. | Not ready to submit. |
| EAS / TestFlight | `eas build:list --platform ios` returned no builds. | A production iOS build must be created, uploaded, processed, and selected before review or StoreKit validation. |
| Apple Sandbox | No Sandbox test account is listed in App Store Connect. | Create dedicated fresh and used-trial testers before the test matrix. Do not reuse a personal Apple Account. |
| RevenueCat products | The iOS app contains annual, monthly, and weekly Apple products. All three attach to `finn_it_pro` and to `$rc_annual`, `$rc_monthly`, and `$rc_weekly` in the current `default` offering alongside their Test Store equivalents. RevenueCat's offering verifier reports only that no RevenueCat-hosted paywall is attached; Finnit intentionally uses its in-app custom paywall. | Complete. |
| RevenueCat Apple credentials | Both the In-App Purchase key and the dedicated App Store Connect API key report `Valid credentials`. RevenueCat reads prices, availability, localization, and the three-day introductory offer for all three products. Apple reports `MISSING_METADATA` because `review_information` is still empty. | Credentials are complete. Add the IAP review screenshot and review information before submission. |
| RevenueCat webhook | `Finn entitlement cache` is active and targets the deployed Supabase `revenuecat-webhook` function. | Complete; recheck one event after the first Sandbox purchase. |
| Production environment | EAS production has the iOS RevenueCat public key, entitlement ID, offering ID, Supabase URL, and Supabase publishable key. No Test Store key is selected for iOS builds. | Complete for the currently declared variables. |
| Supabase backend | All ten required Edge Functions are `ACTIVE`, including deletion, entitlement refresh, and the RevenueCat webhook. Local and remote migration histories match through the AI-consent migration. | Live. Keep the project unpaused and functions available for the full review window. |
| Public support pages | Privacy Policy, Terms, and Support returned HTTP 200. | Live. Add the public URLs to App Store Connect metadata before submission. |
| Reviewer sign-in | The app now exposes `Use a password instead` and calls Supabase password sign-in, while retaining email OTP, Apple, and Google sign-in. | Create a dedicated confirmed review account and put its credentials only in App Store Connect's Sign-In Information fields. |

## RevenueCat configuration

Completed on September 29, 2026:

1. The Apple In-App Purchase key was uploaded and validated for StoreKit 2
   transaction validation.
2. A dedicated App Store Connect API key and Vendor Number were saved and
   validated.
3. These iOS products are present in RevenueCat:
   - `com.finnit.app.premium.monthly` — Finn Premium Monthly
   - `com.finnit.app.premium.weekly` — Finn Premium Weekly
   - `com.finnit.app.premium.annual` — Finn Premium Annual
4. All three products attach to the existing `finn_it_pro` entitlement.
5. Monthly, weekly, and annual attach to `$rc_monthly`, `$rc_weekly`, and
   `$rc_annual` respectively in the current `default` offering.
6. Store-state reads confirm all-storefront pricing, English (U.S.)
   localization, and a three-day introductory offer on every product.

The remaining `MISSING_METADATA` state is an Apple review-information issue,
not a RevenueCat mapping or credential issue: `review_information` is null for
all three products until a real production-candidate paywall screenshot and
review notes are supplied.

Do not change the App Store product IDs, bundle ID, entitlement identifier, or
offering identifier; the released client already relies on those exact values.

## Reviewer account

Create one dedicated Supabase user for review with all of the following:

- a non-personal email controlled by the team;
- a strong password;
- a confirmed email state, so sign-in does not require OTP or inbox access;
- completed onboarding state or the ability to use the first onboarding page's
  `Already have an account? Sign in` link;
- no RevenueCat entitlement before the review purchase; and
- no real financial journal data.

Put the email and password in App Store Connect's **User name** and **Password**
fields. Never paste the password into Review Notes or commit it to this file.

## App Review Notes

Paste the following into the app-version **Notes** field after replacing only
the build-specific wording if navigation changes:

```text
REVIEW ACCESS
The dedicated review username and password are provided in the Sign-In Information fields above. No email OTP or inbox access is required.

1. On first launch, tap “Already have an account? Sign in” on the first onboarding screen.
2. Accept the Privacy Policy and Terms checkbox.
3. Under “or use email,” tap “Use a password instead,” then sign in with the supplied username and password.

PURCHASE AND RESTORE
The account intentionally starts without Premium so the subscription flow is visible. Continue through the paywall to “Review plans and pricing,” choose Annual, Monthly, or Weekly, and use Apple’s Sandbox purchase sheet. The 3-day introductory offer appears only when StoreKit reports this Apple tester as eligible. An ineligible tester sees the localized immediate subscription price instead.

“Restore purchases” is visible on the final paywall page. “Settings” is beside it and remains available without a subscription. Settings includes Restore Purchases, Sign Out, subscription management, and Delete My Account.

RECEIPT CAMERA
After Premium activates, Finnit asks separately for Google Gemini data-sharing consent. Tap “I agree and continue” to enable AI receipt scanning. In the journal, focus the entry composer and tap the camera control labeled “Open receipt camera.” Camera permission is requested only at that point. Receipt images are sent transiently for extraction and are not retained as journal attachments.

AI CONSENT AND MANUAL MODE
On the AI consent screen, “Not now — use manual journal” declines Gemini sharing while keeping the paid journal usable. Enter a note in the journal and save it to open deterministic Amount and Category fields; nothing is sent to Gemini. Consent can be granted or withdrawn later at Settings > AI features & data sharing. With consent off, only Gemini-dependent text interpretation, receipt scanning, and Ask Finn are disabled.

ACCOUNT DELETION
Settings is reachable from both the hard paywall and the subscribed journal. Settings > Delete my account offers immediate deletion or the default 30-day recovery period, warns active subscribers that Apple billing continues, links to subscription management, and revokes Sign in with Apple tokens when applicable.

BACKEND AVAILABILITY
Supabase authentication, journal APIs, account deletion, RevenueCat entitlement refresh/webhook processing, and Gemini-backed functions will remain live throughout review.
```

For each subscription product's optional review-notes field, use:

```text
This product is available from the final page of the in-app Finnit Premium paywall. Sign in with the app-version review credentials, continue through the paywall, select this duration, and confirm with Apple's Sandbox purchase sheet. The StoreKit-confirmed 3-day introductory offer is displayed only for eligible testers. Restore Purchases and Settings are on the same page.
```

## IAP review screenshot

Capture a real iPhone screenshot from the production-candidate build showing the
final paywall page with:

- Annual, Monthly, and Weekly plan cards loaded from StoreKit;
- localized full prices and durations;
- eligibility-safe checkout text;
- Restore Purchases, Settings, Terms, and Privacy; and
- no debug banner, Test Store copy, personal account data, or placeholder error.

Upload that screenshot to the Review Information section of all three
subscription products. This screenshot is for App Review, not the product-page
marketing gallery. Do not use the existing iPad marketing composites as IAP
review evidence because they do not show the purchase surface.

## Sandbox and TestFlight verification matrix

Record the build number, tester alias, product ID, timestamp, expected result,
actual result, and RevenueCat customer/event evidence for every row.

| Path | Tester state | Verification |
| --- | --- | --- |
| Eligible trial purchase | Fresh Sandbox Apple tester that has never used an intro offer in the subscription group | The selected product reports eligible, CTA says `Start your 3-day free trial`, Apple sheet confirms the offer, `finn_it_pro` activates, and Supabase receives the entitlement update. |
| Trial-expiry reminder | Fresh eligible trial purchase; allow notifications after checkout | The notification permission prompt appears only after the purchase succeeds, one local reminder is scheduled for 24 hours before RevenueCat's verified trial expiry, and daily journal reminders remain off until their separate post-first-entry opt-in. |
| Ineligible trial purchase | A separate tester that previously consumed the group's introductory offer | No free-trial promise appears; CTA uses the localized immediate price and the purchase activates Premium. |
| Restore | Existing active Sandbox purchase, app signed into the matching Finnit account and Apple Sandbox account | Restore succeeds from both paywall and Settings and reactivates the same entitlement without creating a second account. |
| Cancellation | Active Sandbox subscription cancelled in Apple's subscription management UI | Access remains until the reported expiry, `willRenew` becomes false, and Settings continues to expose management and deletion. |
| Expiry | Cancelled Sandbox subscription allowed to expire at Apple's accelerated test cadence | RevenueCat and Supabase mark Premium inactive and the app returns to the paywall without losing the account or journal. |
| Billing retry | Sandbox tester configured for an interrupted or failed renewal | Entitlement behavior matches the configured Apple grace-period policy, and recovery restores access without manual data repair. |
| Offer code | Active App Store offer code redeemed from the native `Redeem offer code` action | Apple's sheet opens, the code applies to the intended product, and entitlement/webhook state updates. |
| Purchase cancellation | User dismisses Apple's purchase sheet | No error entitlement is granted, the paywall remains usable, and retry works. |
| AI consent decline | Premium active; choose `Not now` | Manual amount/category journal entry works; receipt scanning and Ask Finn remain disabled with clear Settings recovery. |
| AI consent grant/withdraw | Premium active; grant, then withdraw in Settings | Gemini features enable after grant and disable after withdrawal without affecting Premium or manual data. |
| Receipt camera | Premium active, AI consent granted | Camera permission is contextual, a receipt can be parsed, and no receipt image persists after processing. |
| Account deletion | Active Sandbox subscription | The modal warns that Apple billing continues, offers subscription management, and both immediate and 30-day paths behave as documented. Use disposable Finnit accounts. |

Run the purchase matrix in a native TestFlight or iOS development build. Expo Go
and RevenueCat Test Store cannot verify StoreKit introductory-offer eligibility.

## Submission order

1. Create the dedicated review account and Apple Sandbox testers.
2. Produce an iOS production build and upload it to TestFlight.
3. Execute the full matrix and capture the real paywall review screenshot.
4. Upload the screenshot and review notes to all three subscription products.
5. Select the processed build on app version 1.0 and fill the app-version Sign-In
   Information and Review Notes.
6. Complete the App Privacy, category, age rating, legal URLs, product-page
   screenshots, description, keywords, support URL, copyright, and contact data.
7. Add all three subscriptions to the version's In-App Purchases and
   Subscriptions section.
8. Recheck every backend and public URL, then submit the app version and its
   first subscription group together.

Apple references:

- [Submit an in-app purchase](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase)
- [Create Sandbox Apple Accounts](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/create-sandbox-apple-ids)
- [Test in-app purchases](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/overview-of-testing-in-sandbox)
