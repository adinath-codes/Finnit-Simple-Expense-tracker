# Finn Premium and RevenueCat release setup

Finn is implemented as a premium-only app. After onboarding and authentication,
the root navigator exposes the journal only while RevenueCat reports the
`finn_it_pro` entitlement active. Without that entitlement, the only product route
is the non-dismissible four-page paywall; legal pages and account settings stay
available so a user can restore purchases, sign out, or delete their account.

The journal provider does not load, synchronize, or mutate financial data while
the entitlement is inactive. Premium Edge Functions read the private Supabase
entitlement snapshot and reject inactive users with `premium_required`.
`refresh-entitlement` and the RevenueCat webhook keep that snapshot current;
the latency-sensitive capture path does not call RevenueCat.

The client does not poll RevenueCat. It configures the SDK once for the signed-in
Supabase UUID, reads `CustomerInfo` once at session bootstrap, and then reacts to
SDK customer-info events plus explicit purchase, restore, retry, redemption, and
expiration boundaries. Store offerings are loaded only for inactive users who
need the paywall. The last verified entitlement is also stored per account so an
existing subscriber can open the durable local journal without waiting for a
network request. Cached renewing access is bounded to the store expiration plus
RevenueCat's three-day offline grace; known cancellations stop at expiration.

## Environment

Replace the placeholders in the local ignored `.env` and in the corresponding
EAS environments:

```dotenv
EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY=test_...
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...
EXPO_PUBLIC_REVENUECAT_WEB_API_KEY=rcb_...
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=finn_it_pro
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default
```

RevenueCat platform SDK keys are public app configuration, not secrets. Never
put a RevenueCat secret API key in an `EXPO_PUBLIC_` variable.
iOS native builds, including development builds, use the Apple public SDK key
so StoreKit can load the real App Store products, trial eligibility, purchases,
and restores in Sandbox. Android and non-iOS debug builds keep the existing Test
Store-first behavior. Release builds reject a Test Store key, preventing
synthetic billing from reaching an App Store or Google Play release.

Set the following only in the ignored `.env.server` and in Supabase Edge
Function secrets:

```dotenv
REVENUECAT_SECRET_API_KEY=sk_...
REVENUECAT_ENTITLEMENT_ID=finn_it_pro
REVENUECAT_PROJECT_ID=proj...
REVENUECAT_ENTITLEMENT_RESOURCE_ID=entl...
REVENUECAT_WEBHOOK_AUTHORIZATION=Bearer your-random-webhook-secret
```

Generate the secret as a RevenueCat API v2 key. Grant only the read access
required for active-entitlement reconciliation; all unrelated permissions can
remain **No access**.
`REVENUECAT_ENTITLEMENT_ID` is the public lookup key (`finn_it_pro`),
while `REVENUECAT_ENTITLEMENT_RESOURCE_ID` is RevenueCat's internal `entl...`
resource ID. A legacy v1 key cannot call the v2 active-entitlements endpoint.

Deploy the Edge secrets before deploying the gated functions:

```bash
npx supabase secrets set --project-ref YOUR_FINN_PROJECT_REF --env-file .env.server
npx supabase functions deploy parse-entry correct-entry apply-preset ask-money ask-sql request-quota-review scan-receipt delete-account refresh-entitlement revenuecat-webhook --project-ref YOUR_FINN_PROJECT_REF
npx supabase functions delete redeem-testing-code --project-ref YOUR_FINN_PROJECT_REF
```

`delete-account` deliberately authenticates the user without requiring Premium.

## RevenueCat and store configuration

1. Add the iOS app with bundle identifier `com.finnit.app` and the Android app
   with package `com.finnit.app` to one RevenueCat project.
2. Connect App Store Connect and Google Play to the RevenueCat project.
3. Create the `finn_it_pro` entitlement.
4. Create the intended auto-renewable subscription products in App Store
   Connect and Play Console. Attach every sellable product to `finn_it_pro`.
5. Add a three-day, zero-price introductory trial to every product shown in the
   Finn offering. The app disables checkout when the selected store product does
   not report that exact trial, so release copy cannot over-promise it.
6. Create the RevenueCat `default` offering and add the packages. Annual and
   monthly packages use RevenueCat's standard package identifiers when present.
7. Use a single App Store subscription group for Finn Premium unless the
   products grant genuinely different service levels.
8. Configure RevenueCat restore behavior for Finn's identified users. The app
   uses the authenticated Supabase UUID as the RevenueCat App User ID on every
   platform.
9. Build a native development or TestFlight build for real purchase testing.
   Expo Go can preview the UI but cannot complete real store purchases.

RevenueCat Test Store is useful for purchase success, failure, cancellation,
restore, renewal, expiry, and entitlement tests, but it does not simulate store
introductory offers. Verify the three-day iOS trial itself with a fresh Apple
Sandbox account in a native development or TestFlight build. Android remains on
its existing development/test path until its store rollout is configured.

## Test access and offer codes

Custom tester codes are not supported. Test subscription access with StoreKit
Sandbox or TestFlight. Store-managed promotions use the “Redeem offer code”
link, which opens Apple's native redemption sheet through RevenueCat.

The revocation migration disables every legacy tester code and drops its
reservation/completion RPCs while retaining private redemption records for
audit. Delete any previously deployed `redeem-testing-code` Edge Function with
the cleanup command above so older app builds cannot call the retired endpoint.

## App Store paywall checklist

Implemented in the in-app purchase flow:

- Subscription name, service included, and billing duration.
- Localized full renewal price from StoreKit/RevenueCat, shown more prominently
  than the monthly equivalent.
- “3 days free” and the exact localized post-trial renewal price when the store
  reports eligibility; ineligible accounts see immediate-charge language.
- A local notification is scheduled from RevenueCat's verified `TRIAL`
  entitlement expiry, 24 hours before the trial ends. Permission is requested
  only after checkout succeeds; normal, inactive, and expired entitlements
  cannot schedule it, and accelerated sandbox trials use a before-expiry
  fallback. The scheduled expiry is recorded locally so reopening the app does
  not postpone or duplicate the one-shot reminder.
- Offer-neutral navigation, timeline, and checkout copy while StoreKit
  eligibility is unknown; only a confirmed eligible plan promises the 3-day
  trial, while confirmed ineligible plans show the localized immediate price.
- Auto-renewal and cancellation language.
- Restore Purchases.
- Native App Store offer-code redemption.
- Terms of Service and Privacy Policy links.
- Account settings remain reachable from the hard paywall for sign-out and
  in-app account deletion.
- Active subscribers can open the store's subscription-management UI from
  Settings.

The September 29, 2026 live audit verified that all three App Store products
have English (U.S.) localization, all-storefront prices, and three-day free
introductory offers. In-App Purchase is enabled for `com.finnit.app`. Remaining
work is tracked precisely in
`docs/app-store-connect/APP_REVIEW_RELEASE_HANDOFF.md`; the principal blockers
are missing IAP review screenshots, no iOS/TestFlight build or Sandbox testers,
and blank app-version review access/notes. RevenueCat now has valid Apple
credentials and correctly maps all three iOS products to `finn_it_pro` and the
annual, monthly, and weekly packages. App Privacy, age rating, product-page
metadata, StoreKit scenario testing, and joint app/subscription submission
remain external release gates.

Passing the repository checks cannot guarantee approval. Store configuration,
metadata, reviewer access, and live sandbox behavior are part of review and must
be verified before submission.
