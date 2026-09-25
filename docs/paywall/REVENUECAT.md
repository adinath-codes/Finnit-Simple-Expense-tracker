# Finn Premium and RevenueCat release setup

Finn is implemented as a premium-only app. After onboarding and authentication,
the root navigator exposes the journal only while RevenueCat reports the
`finn_it_pro` entitlement active. Without that entitlement, the only product route
is the non-dismissible four-page paywall; legal pages and account settings stay
available so a user can restore purchases, sign out, or delete their account.

The journal provider does not load, synchronize, or mutate financial data while
the entitlement is inactive. Premium Edge Functions independently query
RevenueCat with a server-only secret key and reject inactive users with
`premium_required`. Successful checks are cached in the warm Edge isolate for at
most 60 seconds; inactive checks are cached for 10 seconds.

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
```

Deploy the Edge secrets before deploying the gated functions:

```bash
npx supabase secrets set --project-ref YOUR_FINN_PROJECT_REF --env-file .env.server
npx supabase functions deploy parse-entry correct-entry apply-preset ask-money ask-sql request-quota-review scan-receipt delete-account --project-ref YOUR_FINN_PROJECT_REF
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

## One-month tester code

The “Redeem offer code” action opens Apple's native offer-code redemption sheet.
Create the tester code in App Store Connect as a custom offer code with a
one-month free duration for the Finn Premium subscription. Apple owns code
validation and the redemption disclosure; RevenueCat observes the resulting
transaction and activates `finn_it_pro` for the same Supabase UUID.

This design intentionally does not ship a shared tester code or a secret
promotional-entitlement endpoint in the client. For Android testers, create the
equivalent Play promo code in Play Console and have the tester redeem it with the
same Google Play account used on the device, then use Restore purchases in Finn.

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
