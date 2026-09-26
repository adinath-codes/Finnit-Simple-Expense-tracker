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
Debug builds prefer the Test Store key. Release builds ignore it and reject any
platform variable that still contains a `test_` key, preventing synthetic
billing from reaching an App Store or Google Play release.

Set the following only in the ignored `.env.server` and in Supabase Edge
Function secrets:

```dotenv
REVENUECAT_SECRET_API_KEY=sk_...
REVENUECAT_ENTITLEMENT_ID=finn_it_pro
REVENUECAT_PROJECT_ID=proj...
REVENUECAT_ENTITLEMENT_RESOURCE_ID=entl...
REVENUECAT_WEBHOOK_AUTHORIZATION=Bearer your-random-webhook-secret
```

Generate the secret as a RevenueCat API v2 key. Grant **Customer information →
Customers → Read & write** so the tester-code endpoint can create a promotional
entitlement; all unrelated permissions can remain **No access**.
`REVENUECAT_ENTITLEMENT_ID` is the public lookup key (`finn_it_pro`),
while `REVENUECAT_ENTITLEMENT_RESOURCE_ID` is RevenueCat's internal `entl...`
resource ID. A legacy v1 key cannot call the v2 active-entitlements endpoint.

Deploy the Edge secrets before deploying the gated functions:

```bash
npx supabase secrets set --project-ref YOUR_FINN_PROJECT_REF --env-file .env.server
npx supabase functions deploy parse-entry correct-entry apply-preset ask-money ask-sql request-quota-review scan-receipt delete-account refresh-entitlement redeem-testing-code revenuecat-webhook --project-ref YOUR_FINN_PROJECT_REF
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
introductory offers. Verify the three-day trial itself with a fresh Apple
Sandbox account and a Google Play license tester on an Internal Testing build.

## Tester codes

“Have a code?” opens Finn's cross-platform code-entry modal. The authenticated
`redeem-testing-code` function hashes the normalized input, atomically reserves
one of the code record's `max_redemptions`, grants the configured RevenueCat
entitlement until `premium_days` elapse, and refreshes both the server snapshot
and SDK customer cache. Premium therefore unlocks without a store purchase.

The initial `early-testers-2026` record allows 25 unique Supabase accounts and
grants 30 days. Only its SHA-256 digest and final-four hint are committed; keep
the supplied raw code in the team's secret manager. Change capacity or duration
by editing that private row. Disable it with `enabled = false`. To add a code,
normalize it by uppercasing and removing spaces/hyphens, SHA-256 that value, and
insert the digest, a non-secret hint, `max_redemptions`, and `premium_days` into
`finn_private.testing_access_codes` through an administrator-only SQL session.

Code tables, reservation functions, and redemption history are private and have
RLS enabled; `anon` and `authenticated` receive no table or RPC grants. Pending
reservations expire from capacity calculations after 15 minutes so a RevenueCat
outage cannot permanently consume a slot. The iOS modal retains a secondary
link to Apple's native offer-code sheet for store-managed promotions.

## App Store paywall checklist

Implemented in the in-app purchase flow:

- Subscription name, service included, and billing duration.
- Localized full renewal price from StoreKit/RevenueCat, shown more prominently
  than the monthly equivalent.
- “3 days free” and the exact localized post-trial renewal price when the store
  reports eligibility; ineligible accounts see immediate-charge language.
- Auto-renewal and cancellation language.
- Restore Purchases.
- Native App Store offer-code redemption.
- Terms of Service and Privacy Policy links.
- Account settings remain reachable from the hard paywall for sign-out and
  in-app account deletion.
- Active subscribers can open the store's subscription-management UI from
  Settings.

Still required outside the repository before App Review:

- Complete App Store Connect subscription products, prices, localization,
  review screenshots, three-day introductory offers, and tester offer code.
- Put working public Privacy Policy and Terms links in App Store Connect
  metadata in addition to the in-app routes.
- Enable the In-App Purchase capability for the App Store target and submit the
  subscription products with the app version.
- Add clear App Review notes and a review account or instructions that let the
  reviewer reach and exercise the purchase flow.
- Complete App Privacy and age-rating questionnaires accurately and test
  purchase, restore, expiry, cancellation, billing retry, ineligible-trial, and
  offer-code paths in Sandbox/TestFlight.

Passing the repository checks cannot guarantee approval. Store configuration,
metadata, reviewer access, and live sandbox behavior are part of review and must
be verified before submission.
