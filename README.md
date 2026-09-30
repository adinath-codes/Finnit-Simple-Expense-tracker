<a id="top"></a>

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:05083D,52:3246D3,100:20C878&text=Finnit&fontColor=F7FAF8&fontSize=78&fontAlignY=38&desc=Apple%20Notes%20for%20your%20money&descAlignY=60&descSize=19&animation=fadeIn" alt="Finnit — Apple Notes for your money" width="100%" />

<img src="assets/logo/app-icon.png" width="112" alt="Finnit app icon" />
<br />
<a href="#what-finnit-does">
  <img src="https://readme-typing-svg.demolab.com?font=Krona+One&size=21&duration=2200&pause=850&color=20C878&center=true&vCenter=true&width=600&lines=Write+what+happened.;Scan+the+receipt.;Ask+your+money.;Finnit+organizes+the+rest." alt="Write what happened. Scan the receipt. Ask your money. Finnit organizes the rest." />
</a>

<p>
  <b>Finnit is a financial journal for people who never stick with expense trackers.</b><br />
  Write one natural sentence, scan a receipt, or ask a question. Finnit quietly turns the details into a searchable money memory.
</p>

<p>
  <img alt="Platforms: iOS and Android" src="https://img.shields.io/badge/platform-iOS%20%2B%20Android-000000?style=for-the-badge&logo=apple&logoColor=white" />
  <img alt="Expo SDK 57" src="https://img.shields.io/badge/Expo%20SDK-57-000020?style=for-the-badge&logo=expo&logoColor=white" />
  <img alt="React Native 0.86" src="https://img.shields.io/badge/React%20Native-0.86-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <br />
  <a href="https://www.shipaton.com/categories/next-gen-award"><img alt="RevenueCat Shipaton 2026 Next Gen Award" src="https://img.shields.io/badge/RevenueCat-Shipaton%202026%20Next%20Gen-F2545B?style=for-the-badge&logo=revenuecat&logoColor=white" /></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-20C878?style=for-the-badge" /></a>
  <a href="https://github.com/adinath-codes/Finn/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/adinath-codes/Finn?style=for-the-badge&color=05083D" /></a>
</p>

<p>
  <a href="#try-finnit"><kbd>&nbsp;Try the app&nbsp;</kbd></a>&nbsp;
  <a href="#demo-video"><kbd>&nbsp;Demo&nbsp;</kbd></a>&nbsp;
  <a href="#what-finnit-does"><kbd>&nbsp;Features&nbsp;</kbd></a>&nbsp;
  <a href="#the-paywall"><kbd>&nbsp;Paywall&nbsp;</kbd></a>&nbsp;
  <a href="#revenuecat"><kbd>&nbsp;RevenueCat&nbsp;</kbd></a>&nbsp;
  <a href="#under-the-hood"><kbd>&nbsp;Stack&nbsp;</kbd></a>&nbsp;
  <a href="#run-it-locally"><kbd>&nbsp;Setup&nbsp;</kbd></a>
</p>

<img src="assets/marketing/social/finnit-x-launch-source-screens.png" width="560" alt="Finnit product screens showing the journal, receipt capture, Ask Finn, and spending insights" />

</div>

<br />

## Why Finnit

Traditional expense apps ask people to think like accountants: pick a type, enter an amount,
choose a category, set a date, add a merchant, and repeat. That is precise, but it is also why
many people stop tracking.

Finnit starts from a simpler question:

> **What happened with your money?**

Write `Dinner with Maya $42, then Uber home $18` and Finnit keeps the original memory while
quietly extracting the useful structure. The product feels closer to **Apple Notes + Day One +
personal-finance intelligence** than a spreadsheet with AI bolted on.

<div align="center">
<table>
  <tr>
    <td align="center" width="18%"><h3>✍️</h3><b>Capture</b><br /><sub>write naturally</sub></td>
    <td align="center">→</td>
    <td align="center" width="18%"><h3>🧠</h3><b>Understand</b><br /><sub>extract the details</sub></td>
    <td align="center">→</td>
    <td align="center" width="18%"><h3>🗂️</h3><b>Organize</b><br /><sub>build the journal</sub></td>
    <td align="center">→</td>
    <td align="center" width="18%"><h3>🔎</h3><b>Remember</b><br /><sub>ask and find</sub></td>
  </tr>
</table>
</div>

## Try Finnit

| Access | Current status | Link |
| :-- | :-- | :-- |
| **TestFlight public beta** | Build 6 is awaiting Apple Beta App Review. The external `Paywall QA` group exists, but Apple has not created a public invitation URL yet. | **Public link pending review** |
| **Latest iOS build** | Version 1.0.0, build 7 is processed and available to the internal TestFlight group. | [TestFlight console](https://appstoreconnect.apple.com/apps/6816385439/testflight) *(authorized reviewers/team)* |
| **Source** | Complete public source, assets, setup instructions, and MIT license. | [GitHub repository](https://github.com/adinath-codes/Finn) |

> [!NOTE]
> This section deliberately does not invent a `testflight.apple.com/join/...` URL. Replace
> **Public link pending review** with the public invitation as soon as Apple approves the
> external build and the link is enabled.

## Demo video

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=rect&height=230&color=0:05083D,100:3246D3&text=Demo%20video%20coming%20here&fontColor=F7FAF8&fontSize=34&desc=Add%20the%20public%20YouTube%20link%20before%20submission&descAlignY=68&descSize=16&animation=fadeIn" alt="Reserved space for the Finnit demo video" width="86%" />

<!--
When the video is uploaded, replace the placeholder image above with:

<a href="https://www.youtube.com/watch?v=YOUR_VIDEO_ID">
  <img src="https://img.youtube.com/vi/YOUR_VIDEO_ID/maxresdefault.jpg" width="86%" alt="Watch the Finnit demo video on YouTube" />
</a>

Shipaton requires the public demo video to be under two minutes and to show the app working
on its target device.
-->

</div>

## What Finnit does

### ✍️ Capture money like a note

One sentence can contain multiple expenses, dates, people, splits, places, purposes, and
currencies. Finnit preserves the raw note and the structured result, so the human memory is
never replaced by a machine interpretation.

### 🧾 Turn a receipt into memory

Photograph or import a receipt and Finnit extracts the merchant, total, date, and useful line
items. Receipt images are transient: they remain only while parsing or an offline retry is
pending, then are deleted after successful extraction.

### 🔎 Ask the journal

Ask questions such as “What quietly added up this month?” or “How much did I spend with
Maya?” Answers keep their evidence attached, so users can inspect the journal entries behind
the total.

### 📴 Work through unreliable connections

The journal is offline-first. Local SQLite data renders before the network is asked anything;
durable background jobs retry safely when connectivity returns.

<table>
  <tr>
    <td width="33%" valign="top"><b>📓 Financial journal</b><br /><sub>A chronological record instead of a form-heavy ledger.</sub></td>
    <td width="33%" valign="top"><b>📅 Calendar and summaries</b><br /><sub>Browse by day, month, category, and rolling totals.</sub></td>
    <td width="33%" valign="top"><b>⚡ Saved entries</b><br /><sub>Repeat common spending without retyping it.</sub></td>
  </tr>
  <tr>
    <td width="33%" valign="top"><b>🌍 Multiple currencies</b><br /><sub>Capture in the currency people actually used.</sub></td>
    <td width="33%" valign="top"><b>🔐 Privacy controls</b><br /><sub>Explicit Gemini consent and a deterministic manual mode.</sub></td>
    <td width="33%" valign="top"><b>✨ Native motion</b><br /><sub>Responsive iOS-first transitions with Reduced Motion support.</sub></td>
  </tr>
</table>

## The paywall

Finnit Premium uses a four-page, outcome-led paywall. It explains the value first, compares
manual and Premium honestly, shows how the trial works, and only then asks the user to choose
a plan. StoreKit prices and trial eligibility drive the final page, so the checkout copy does
not promise an offer Apple says the user cannot receive.

<table>
  <tr>
    <td align="center" width="33%"><img src="assets/marketing/readme/paywall/01-value-story.png" alt="Finnit Premium value story page" width="100%" /></td>
    <td align="center" width="33%"><img src="assets/marketing/readme/paywall/02-manual-vs-premium.png" alt="Finnit manual versus Premium comparison page" width="100%" /></td>
    <td align="center" width="33%"><img src="assets/marketing/readme/paywall/03-trial-timeline.png" alt="Finnit three-day trial timeline page" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>1 · Lead with outcomes</b></sub></td>
    <td align="center"><sub><b>2 · Compare honestly</b></sub></td>
    <td align="center"><sub><b>3 · Explain the trial</b></sub></td>
  </tr>
</table>

<details>
<summary><b>See every store-backed plan-selection state</b></summary>
<br />
<table>
  <tr>
    <td align="center" width="33%"><img src="assets/marketing/readme/paywall/04-plans-annual.png" alt="Annual Finnit Premium plan selected" width="100%" /></td>
    <td align="center" width="33%"><img src="assets/marketing/readme/paywall/04-plans-monthly.png" alt="Monthly Finnit Premium plan selected" width="100%" /></td>
    <td align="center" width="33%"><img src="assets/marketing/readme/paywall/04-plans-weekly.png" alt="Weekly Finnit Premium plan selected" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Annual</b></sub></td>
    <td align="center"><sub><b>Monthly</b></sub></td>
    <td align="center"><sub><b>Weekly</b></sub></td>
  </tr>
</table>
</details>

### RevenueCat

<div align="center">
  <a href="https://app.revenuecat.com/projects/f1fbb14c">
    <img alt="Open the Finn-it RevenueCat project" src="https://img.shields.io/badge/Open%20Finn--it-RevenueCat%20project-F2545B?style=for-the-badge&logo=revenuecat&logoColor=white" />
  </a>
</div>

RevenueCat owns the subscription lifecycle behind `finn_it_pro`: the current offering maps
weekly, monthly, and annual App Store products to one entitlement, keeps the client and
Supabase entitlement snapshot synchronized, supports restore and offer-code redemption, and
drives the verified trial-expiry reminder. The dashboard link is access-controlled; Shipaton
judges or collaborators with authorization can inspect the live project.

## Built for the Shipaton 2026 Next Gen Award

Finnit is prepared for RevenueCat's **Next Gen Award**, the student category judged from a
working demo video and public open-source code. The official category page and rules require
a clear product description, a public repository with an open-source license, and a public
YouTube or Vimeo demo that is under two minutes and shows the app running on its target device.

| Requirement | Finnit evidence |
| :-- | :-- |
| Public open-source repository | This repository |
| Detectable open-source license | [`LICENSE`](LICENSE) — MIT |
| Clear description of what was built and why it matters | This README |
| Working mobile application | iOS 1.0.0 builds 6 and 7 are processed in TestFlight |
| Public demo video under two minutes | Reserved [demo section](#demo-video); add the final YouTube URL before submission |
| RevenueCat-powered purchase | `react-native-purchases`, one Premium entitlement, three App Store subscription durations |

Read the [Next Gen Award category page](https://www.shipaton.com/categories/next-gen-award)
and the [official Shipaton rules](https://revenuecat-shipaton-2026.devpost.com/rules) before
submitting. Entrants who are under the age of majority must also complete the required
parent or legal-guardian consent process.

## Under the hood

| Layer | Technology |
| :-- | :-- |
| **App** | Expo SDK 57 · React Native 0.86 · React 19 · TypeScript · Expo Router |
| **Motion and native UI** | Reanimated 4 · Gesture Handler · Expo UI · SF Symbols · haptics |
| **Offline data** | SQLite on native · AsyncStorage on web · durable background sync queue |
| **Backend** | Supabase Auth · Postgres · Row Level Security · Deno Edge Functions |
| **Money intelligence** | Google Gemini behind consented server-side functions · deterministic manual fallback |
| **Billing** | RevenueCat SDK · StoreKit subscriptions · webhook-backed entitlement cache |
| **Quality and operations** | Node test runner · TypeScript · ESLint · Sentry · PostHog · EAS Build/Update |

Three architectural choices matter most:

- **Raw memory and structured money coexist.** The original note remains visible even after
  Finnit extracts transactions and context.
- **Offline is the starting point, not an error mode.** The durable local journal opens first
  and remote work catches up later.
- **AI is optional infrastructure.** Users explicitly choose whether to share journal content
  with Gemini; manual capture, billing, settings, and account controls remain available when
  they decline.

## Run it locally

### Prerequisites

- Node.js and npm
- Xcode for iOS development or Android Studio for Android development
- A native development build for real RevenueCat/StoreKit purchase testing

### Setup

```bash
git clone https://github.com/adinath-codes/Finn.git
cd Finn
npm install
cp .env.example .env
npx expo start
```

Configure the public Supabase, RevenueCat, PostHog, and Sentry values described in
`.env.example`. Server secrets belong only in the ignored server environment and deployed
Supabase functions—never in an `EXPO_PUBLIC_` variable.

Useful checks:

```bash
npm run typecheck
npm run lint
npm run test:paywall
```

> [!IMPORTANT]
> Expo Go can preview parts of the interface, but real purchases, StoreKit introductory-offer
> eligibility, and restore behavior must be verified in a native development or TestFlight build.

## License

Finnit is available under the [MIT License](LICENSE).

<div align="center">

Built by [Adinath](https://github.com/adinath-codes) for
[RevenueCat Shipaton 2026](https://www.shipaton.com/).

<a href="#top"><sub>↑ back to top</sub></a>

</div>
