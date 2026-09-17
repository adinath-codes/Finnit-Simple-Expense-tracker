# Finn — Project Core Idea and MVP V1

> Canonical product reference for Finn.
>
> This document consolidates the complete core-product brief and the complete MVP V1 scope. If the earlier MVP priority notes and the later **MVP V1 — Required Product Scope** differ, treat the later required scope as authoritative for V1 while preserving the earlier notes as product context.

---

## Part I — Core Product Idea

You are working on a consumer personal-finance app whose core idea is:

# “Apple Notes for your money.”

This is NOT primarily a budgeting app.

This is NOT a traditional expense manager with AI added on top.

This is NOT another finance dashboard full of graphs, budgets, accounts, forms, and configuration.

The product is a **financial journal / financial memory layer**.

The user should be able to describe what happened with their money in the same natural way they would write something in Apple Notes, Messages, or a personal journal.

The system uses AI to quietly understand, structure, organize, summarize, and later retrieve that financial information.

The fundamental product loop is:

**Capture → Understand → Organize → Remember → Ask**

Everything we build should support this loop.

---

# 1. Core product philosophy

Traditional finance apps force users to think like accountants.

They ask users to manually specify things such as:

* amount
* merchant
* category
* date
* account
* payment method
* notes
* transaction type

We want to remove almost all of this friction.

The user should think like a normal human.

For example:

`coffee 180`

or:

`had lunch with Aswin for 340 and uber back home was 280`

or:

`bought a domain for my new project for $12`

or:

`spent around 4.5k yesterday at phoenix mall, 3200 was shoes and around 1300 on food`

or:

`paid Raj 700 back for yesterday`

or:

`Netflix renewed today for 649`

The user should never need to think:

> “How do I create the correct financial transaction?”

They should only think:

> “What happened with my money?”

The AI handles the structure.

---

# 2. Product positioning

The product should feel like:

**Apple Notes + Day One + personal finance intelligence**

rather than:

**YNAB + AI**

Our positioning should remain close to:

* “Notes for your money.”
* “Write what happened. We organize the rest.”
* “Track money like taking notes.”
* “Your financial journal.”
* “Remember your financial life.”

Do not design the product around the phrase:

“AI expense tracker.”

AI is infrastructure.

It should mostly feel invisible.

The magic is not that we use AI.

The magic is that the user no longer has to behave like an accountant.

---

# 3. Target user

Our initial target user is NOT a hardcore budgeting enthusiast.

The primary user is someone who thinks:

> “I want to know where my money goes, but I never stick with expense trackers.”

Typical users may include:

* students
* young professionals
* freelancers
* creators
* founders
* people with irregular spending
* people who dislike spreadsheets
* people who have previously downloaded expense trackers and stopped using them

They want financial awareness.

They do not necessarily want financial administration.

The app should therefore optimize for:

**consistency of capture**

rather than:

**maximum accounting precision.**

---

# 4. Core UX principle

The home screen should feel closer to a note-taking app than a finance dashboard.

The primary UI should be a chronological financial journal.

Example:

## Today

Coffee with Aswin
₹180

Uber to college
₹260

Bought Claude subscription
₹1,700

Dinner
₹320

---

₹2,460 spent today

At the bottom should be a natural composer similar to a messaging or notes interface:

**“What happened with your money?”**

Possible inputs:

* text
* camera / receipt
* voice later

There should NOT be a giant traditional:

“+ Add Transaction”

flow unless required as an advanced/manual fallback.

The default user flow must be:

**open → type → done**

---

# 5. Natural-language entry

This is the heart of the product.

When the user writes:

`had dinner with Aswin and Ashok 820 then uber home 240`

the application should understand something conceptually like:

Original note:

`had dinner with Aswin and Ashok 820 then uber home 240`

Structured interpretation:

Event/context:

* Dinner with Aswin and Ashok

Transactions:

1. ₹820

   * category: Dining / Food
   * context: dinner with friends

2. ₹240

   * category: Transport
   * merchant/type: Uber
   * context: returning home after dinner

People:

* Aswin
* Ashok

Total:

* ₹1,060

Date:

* inferred from entry timestamp unless the user says otherwise

The original note must remain stored.

Never throw away the user's original language after structuring it.

The raw human note is valuable context.

---

# 6. Keep raw data AND structured data

The system should conceptually preserve two layers.

## Layer 1 — Human memory

Example:

`went to phoenix mall with friends, uber was 380, lunch 620 and bought shoes for 3200`

This should remain exactly as the user entered it.

## Layer 2 — Machine-understood structure

Example:

Event:

* Phoenix Mall trip

Transactions:

* Transport ₹380
* Dining ₹620
* Shopping / Shoes ₹3,200

People/context:

* friends

Total:

* ₹4,200

This dual representation is important.

Traditional finance apps primarily preserve transactions.

Our app should preserve:

**transactions + meaning/context.**

---

# 7. Context is a major differentiator

Do not reduce everything into:

merchant + category + amount.

We want the system to eventually understand relationships such as:

* purchases belonging to a trip
* purchases belonging to a project
* expenses associated with particular people
* recurring purchases
* money borrowed/lent
* subscriptions
* purchases associated with college
* expenses related to building a startup
* gifts
* events
* reimbursements

Example:

`Bangalore trip - hotel 3400, uber from airport 520, dinner 670`

Traditional finance software sees three transactions.

Our product should also understand:

**Bangalore trip**
Total: ₹4,590

Later the user should be able to ask:

`How much did my Bangalore trip cost?`

and get a useful answer.

---

# 8. AI responsibilities

AI should perform tasks such as:

## Parsing

Understand:

* amount
* currency
* date/time
* merchant
* category
* type
* people
* event
* project
* tags/context
* recurrence
* income vs expense
* transfer
* money lent
* money borrowed

## Normalization

Examples:

`4.5k` → ₹4,500 when currency context indicates INR.

`yesterday` → correct date.

`zomato` → food delivery / dining.

`uber` → transport.

But AI must not invent facts when uncertain.

If confidence is low:

* make the least destructive interpretation
* preserve raw input
* allow easy correction
* optionally ask the user only when necessary

Do not make every entry trigger clarification questions.

The app must remain fast.

---

# 9. AI should be mostly invisible

Avoid filling the UI with:

* AI badges
* sparkle icons everywhere
* “Ask AI” inside every card
* technical AI terminology
* model names
* prompt terminology

AI should feel like:

> “I wrote something and the app understood me.”

Explicit AI interaction belongs mainly inside the **Ask** experience.

---

# 10. “Ask your money”

One major surface is conversational retrieval over the user's financial history.

Example questions:

`How much did I spend eating outside this month?`

`What was my most expensive week?`

`How much did the Bangalore trip cost?`

`How much have I spent building my app?`

`How much money did I spend with Aswin this month?`

`What subscriptions am I currently paying for?`

`Who owes me money?`

`How much did I spend on Uber this semester?`

`What changed compared to last month?`

`Where is most of my money disappearing?`

The system should answer from actual user data.

It must never fabricate financial records.

For numeric answers:

* compute from structured data when possible
* cite or expose the relevant underlying entries
* let users inspect what transactions contributed to the answer

Trust is extremely important.

---

# 11. Summaries

AI can generate useful summaries such as:

## Today

You spent ₹2,460 today.

Most spending:

* Food ₹920
* Transport ₹540
* Software ₹1,000

## This month

You spent ₹18,420 so far.

Dining is ₹2,100 higher than last month.

Most dining expenses happened during weekends.

But avoid turning the entire app into analytics dashboards.

Summaries should feel like:

**a useful paragraph from someone who understood your notes**

rather than:

**a CFO dashboard.**

Charts can exist when genuinely useful, but should not dominate the experience.

---

# 12. Receipt scanning

Receipt scanning is a FEATURE.

It is not the product's identity.

The input methods are conceptually:

**Type · Speak · Snap**

All should create the same underlying financial-journal objects.

Example:

User photographs a restaurant receipt.

The application extracts:

Merchant:
Absolute Barbecues

Date:
September 14

Total:
₹2,487

Potential line items:

* food
* drinks
* taxes
  etc.

Then creates a journal entry.

The receipt image should remain attached to the entry.

Do not build the entire application around OCR.

---

# 13. Timeline / journal

The financial history should primarily be viewed as a chronological journal.

Think:

Apple Notes / iMessage / Day One.

Possible organization:

Today

Yesterday

Monday, September 14

September 13

etc.

Individual entries should prioritize:

* human-readable description
* amount
* subtle category/context
* optional receipt/photo
* minimal metadata

Avoid turning every row into a dense banking transaction table.

---

# 14. Editing

AI will occasionally misunderstand the user.

Correction must therefore be effortless.

The user should be able to:

* change amount
* change category
* change date
* change merchant
* change associated event/project/person
* split transactions
* merge entries
* edit original note
* delete entry

Corrections should feel lightweight.

Do not make users navigate through complicated forms.

---

# 15. Product surfaces

For the MVP, think primarily about three areas.

## Journal

The default/home experience.

Capture and browse financial memories.

## Summary

Simple views such as:

* today
* this week
* this month

Keep this lightweight.

## Ask

Conversational interface over stored financial data.

Do NOT prematurely add many navigation tabs.

The app should feel extremely focused.

---

# 16. MVP scope

We are intentionally building a SMALL MVP.

Priority order:

### P0

1. Natural-language financial note entry
2. AI extraction into structured transactions
3. Store raw input
4. Chronological journal/timeline
5. Basic editing
6. Today/week/month totals
7. Category summaries

### P1

8. Ask-your-money chat
9. Receipt/photo scanning
10. Better contextual grouping

### Later

* voice
* recurring expense detection
* subscriptions
* people relationships
* projects
* trips
* financial memories
* smarter insights
* imports/exports
* widgets

Do NOT overbuild before validating retention.

---

# 17. Explicit non-goals for the initial product

Do NOT turn the MVP into:

* YNAB
* Monarch
* Copilot Money
* Money Manager
* accounting software
* investment portfolio tracker
* banking super-app

Do not add unless explicitly requested:

* bank account linking
* credit score
* investment portfolios
* stock tracking
* loan calculators
* SIP calculators
* tax filing
* complex budgets
* financial news
* net-worth dashboards
* complex savings goals
* dozens of charts
* gamification
* social feeds

If a proposed feature moves the product away from:

**“financial journaling with almost zero friction”**

question whether it belongs.

---

# 18. Budgeting is NOT the core

The app may eventually support budgets.

But budgeting should not define the product.

Traditional budgeting asks:

> “What should I spend?”

Our core experience asks:

> “What happened with my money?”

Our primary model is:

**capture → understand → remember**

not:

**plan → restrict → reconcile**

---

# 19. Design principles

The interface should feel:

* calm
* premium
* minimal
* personal
* conversational
* fast
* trustworthy

Prefer:

* typography
* spacing
* subtle hierarchy
* beautiful transitions
* restrained UI

over:

* colorful dashboards
* dozens of cards
* excessive gradients
* fintech clichés
* neon “AI” effects
* cluttered charts

Apple Notes should be a major interaction inspiration, but do NOT directly clone Apple's proprietary visual assets or create a pixel-for-pixel copy.

Take inspiration from its principles:

* content first
* low friction
* understated controls
* familiar writing experience
* focus on the user's information

The app should look like something users WANT to open every day.

---

# 20. Example ideal interaction

User opens the app.

Cursor is immediately ready.

User types:

`lunch with aswin 340 and uber to college 180`

Presses send/enter.

The text immediately appears naturally inside today's journal.

In the background the system extracts:

Dining ₹340

Transport ₹180

Context:

* with Aswin
* college

Total:
₹520

The user sees subtle confirmation.

No loading-heavy AI workflow.

No complicated transaction modal.

No mandatory category selection.

No unnecessary confirmation screen.

It should feel almost instantaneous.

---

# 21. Error philosophy

When AI interpretation is uncertain, do not block the user unnecessarily.

Example:

`spent 500 with arun`

We may know:

amount: ₹500

But not:

category.

It is acceptable to store:

category: Uncategorized

rather than interrupting the user.

Preserve the note.

We can improve/categorize later.

The primary product promise is:

**You can write freely.**

Never break that promise by requiring perfect structured data.

---

# 22. Privacy and trust

Financial information is extremely sensitive.

Architect features with privacy in mind.

Principles:

* collect only what is required
* do not expose financial data unnecessarily
* clearly define what is sent to AI providers
* minimize sending unrelated history to models
* use scoped retrieval for Ask
* never train unrelated systems from private user financial history without explicit consent
* allow users to delete their information
* design toward exportability
* preserve user ownership of data

Do not implement insecure shortcuts just because this is an MVP.

---

# 23. AI architecture principle

Do not send the entire user's financial history to an LLM every time.

Prefer:

1. deterministic structured storage
2. deterministic calculations for totals
3. scoped retrieval
4. LLM only where semantic understanding is valuable

For example:

Question:

`How much did I spend on food this month?`

Do not ask an LLM to manually add 500 transactions if the database can perform:

SUM(amount)
WHERE category = food
AND date within current month

Use the LLM for:

* understanding intent
* interpreting context
* generating natural-language summaries

Use deterministic code/database operations for:

* arithmetic
* filtering
* totals
* dates
* financial calculations

This improves:

* correctness
* latency
* cost
* privacy

---

# 24. Suggested conceptual data structure

Do not blindly implement this schema if the existing architecture suggests something better.

Treat this as product intent.

Possible entities:

## JournalEntry

* id
* user_id
* raw_text
* created_at
* effective_date
* source_type

  * text
  * receipt
  * voice
* receipt_attachment
* AI processing status
* metadata/context

## Transaction

* id
* journal_entry_id
* amount
* currency
* transaction_type
* category
* merchant
* description
* effective_date
* confidence

## ContextEntity

Potentially later:

* person
* trip
* project
* event
* place
* subscription

Relations could connect transactions/journal entries to these entities.

Again:

DO NOT over-engineer this for MVP.

Start simple.

---

# 25. Validation philosophy

The goal of the MVP is NOT maximum feature completeness.

The thing we are testing is:

> “Will someone who normally fails to track expenses voluntarily use this product repeatedly because writing financial notes is dramatically easier?”

The key product metric is therefore retention.

The strongest signal is:

**Does the person record another real purchase tomorrow without being reminded?**

Not:

* number of AI features
* number of dashboards
* number of categories
* number of charts

When implementing features, always ask:

> “Does this make someone more likely to capture their financial life consistently?”

---

# 26. Avoid feature creep

Before implementing something new, classify it.

Does it improve:

1. Capture?
2. Understanding?
3. Organization?
4. Memory?
5. Recall?

If it does none of these, it is probably not core.

Always prioritize making:

`coffee 180`

feel amazing.

A beautifully executed core loop is more valuable right now than 30 finance features.

---

# 27. Product mantra

Keep these principles in mind while working:

**The user writes. We structure.**

**The user remembers events. We remember the financial details.**

**Finance software should adapt to human language — humans should not adapt to finance software.**

**The original note is first-class data.**

**Context matters as much as category.**

**AI should remove friction, not introduce another interface.**

**Do not build a dashboard when a sentence would communicate the information better.**

**Do not make users become accountants.**

And above everything:

# Open → write → done.

That is the experience we are protecting.

---

# 28. Instructions while implementing

When I ask you to implement something in this project:

1. Read the existing project architecture before changing it.
2. Reuse existing components, utilities, stores, APIs, types, and design-system patterns.
3. Do not create parallel architecture unnecessarily.
4. Preserve the product philosophy described above.
5. Prefer the smallest clean implementation that supports the requested behavior.
6. Do not add unrelated features.
7. Do not redesign unrelated screens.
8. Do not add dependencies without a meaningful reason.
9. Keep AI calls scoped and cost-conscious.
10. Use deterministic logic for calculations wherever possible.
11. Preserve the user's raw journal entry.
12. Handle AI failure gracefully.
13. Make corrections easy.
14. Optimize heavily for perceived speed.
15. Maintain financial-data privacy.
16. Stop when the requested feature is implemented and appropriately verified.

If an implementation choice conflicts with this product philosophy, prioritize the product philosophy unless I explicitly instruct otherwise.

The goal is not to create the most feature-rich financial application.

The goal is to build:

# the most frictionless place to remember your financial life.

---

## Part II — MVP V1 Required Product Scope

# MVP V1 — Required Product Scope

The following features are required for MVP V1.

The product philosophy remains:

# Open → write → done.

Even though the MVP contains several capabilities, they must NOT make the app feel like traditional accounting software.

The home experience remains a Notes-style financial journal.

---

## 1. Detect amounts naturally from text

The application must identify monetary amounts from natural language without requiring the user to manually enter an amount field.

Examples:

`coffee 180`

→ ₹180

`spent 2.5k on shoes`

→ ₹2,500

`lunch was 340 and uber was 180`

→ two expenses:

* Lunch ₹340
* Uber ₹180

`paid $12 for my domain`

→ $12

`bought 3 coffees for 450`

→ total ₹450
→ quantity 3 when applicable

The parser should recognize common representations such as:

* 100
* ₹100
* $100
* 100rs
* Rs 100
* 1k
* 1.5k
* 2,500
* 2.5K
* approximately 500
* around 500
* spent 500
* paid 500

Do not depend entirely on the LLM for obvious numeric extraction.

Use deterministic parsing where appropriate, with AI used to understand semantic relationships.

---

# 2. Automatic categorization

Every extracted expense should be categorized automatically.

Examples:

`coffee 180`
→ Food & Drinks

`uber 240`
→ Transport

`bought keyboard 3500`
→ Shopping / Electronics

`Netflix 649`
→ Entertainment / Subscription

Do not force the user to choose the category before saving.

The user can correct the category afterward.

For MVP, keep the category system intentionally compact.

Do NOT create dozens of highly specific categories.

Start with a small understandable set such as:

* Food & Drinks
* Transport
* Shopping
* Entertainment
* Bills
* Subscriptions
* Health
* Education
* Travel
* Work / Projects
* Other

If the product design currently calls for a smaller initial category system, prefer simplicity over completeness.

The UI may surface the user's **top categories** in summaries rather than overwhelming them with a large category breakdown.

---

# 3. Currency and currency conversion

The application must support multiple currencies.

The user must have a configurable:

**Base Currency**

inside Settings.

For example:

Base currency:
`INR ₹`

But journal entries may contain:

`paid $12 for domain`

or:

`hotel was €80`

The application should preserve:

* original amount
* original currency

and optionally store:

* converted amount
* base currency
* exchange rate used
* conversion timestamp

Example:

Original:
$12

Approximate base value:
₹1,0xx

Do NOT destroy the original currency information after conversion.

Currency conversion should be treated as infrastructure rather than something that dominates the UI.

If exchange-rate data is unavailable:

* preserve the original amount
* do not block entry creation
* convert later when connectivity returns

Currency preferences belong inside Settings.

---

# 4. Item quantity

The system should understand quantity where relevant.

Examples:

`3 coffees for 450`

should conceptually understand:

quantity: 3
total: ₹450
item: coffee

`bought 2 notebooks 120 each`

should understand:

quantity: 2
unit price: ₹120
total: ₹240

`4 movie tickets for 1200`

should understand:

quantity: 4
total: ₹1,200

Quantity should remain optional.

Do NOT require quantity for ordinary entries.

It exists because preserving purchase information can make the financial journal more useful later.

---

# 5. Location-aware entries

Location support should exist but remain optional.

There should be a Settings control such as:

**Use location for journal entries**

When enabled, an entry may store useful approximate context such as:

* city
* place
* merchant location
* country

Example:

`coffee 180`

could later have contextual information:

Coffee
₹180
Chennai

This can eventually enable questions such as:

`How much did I spend in Bangalore?`

or:

`How much did my Chennai trip cost?`

Privacy is critical.

Do NOT make precise location mandatory.

Do NOT continuously track the user.

Location should only be captured when necessary and with permission.

The product must continue working perfectly without location access.

---

# 6. Receipt photo input

Receipt scanning is part of MVP V1.

It is still a **feature**, not the identity of the product.

The composer should allow the user to:

📷 photograph or upload a receipt.

The application should attempt to extract:

* merchant
* date
* total
* currency
* taxes where useful
* individual items where reasonably reliable
* quantities where available
* approximate categories

Example:

Receipt:

Starbucks

2 × Cappuccino
1 × Sandwich

Total ₹780

The journal may create:

> Starbucks
> ₹780 · Food & Drinks
> 3 items

and preserve the receipt image as an attachment.

If extraction confidence is poor:

* never fabricate details
* preserve the image
* extract only what is reasonably certain
* make correction easy

Receipt scanning must feed into the same journal system as normal text input.

There should NOT be a completely separate receipt-management architecture.

Conceptually:

**Text / Photo / Voice → Journal Entry → Structured Financial Data**

---

# 7. Cache, offline mode and API-limit handling

The core journal should remain usable even when the user has poor or no internet connectivity.

This is important.

A user should be able to open the app and record:

`coffee 180`

even without network connectivity.

The application should store the entry locally and synchronize/process it later.

Design toward an offline-first capture model.

Conceptually:

User writes entry

↓

Immediately save locally

↓

Show it in journal

↓

If online:
process AI

If offline:
queue processing

↓

When connectivity returns:
process/sync automatically

Do NOT make the user stare at a loading spinner before their note appears.

The user's note must never disappear because:

* AI API timed out
* internet disappeared
* rate limit occurred
* backend temporarily failed

---

## API limit protection

AI calls are a cost and reliability constraint.

Architect the system carefully.

Do NOT send requests unnecessarily.

Use:

* deterministic parsing where possible
* caching
* deduplication
* batching where appropriate
* scoped context
* request limits
* graceful retries

Avoid repeatedly reprocessing the same journal entry.

Store processed results.

For example:

`coffee 180`

should not require another LLM call every time the user opens the journal.

If the AI quota/API becomes unavailable:

the financial journal must remain functional.

AI enrichment can happen later.

The hierarchy is:

**Capture reliability > AI availability**

---

# 8. Presets / quick entries

Support simple presets for repeated expenses.

Examples:

`☕ Coffee ₹120`

`🚌 Bus ₹40`

`🍱 College lunch ₹100`

`🏋️ Gym ₹1,000`

A preset should let the user record a common transaction extremely quickly.

However, presets should NOT replace the main natural-language input.

Natural text remains the primary product interaction.

Presets exist for users who repeatedly record the same thing.

Ideally:

tap preset

→ entry immediately created

or

→ pre-fills composer for quick editing.

Allow the user to create/edit/delete their own presets.

Keep the UI subtle.

---

# 9. Calendar

The journal should have a lightweight calendar/navigation capability.

The calendar exists primarily for answering:

> What happened with my money on this day?

Users should be able to:

* navigate to a date
* see whether a date has journal activity
* inspect entries for that date
* jump between historical days

Do NOT turn the calendar into a complicated financial-planning interface.

For MVP it is a **history navigation mechanism**.

Example:

September 2026

14
₹1,480

15
₹620

16
₹2,310

Selecting September 15 opens that day's financial journal.

The normal chronological timeline should still remain the primary browsing experience.

---

# 10. Onboarding

The onboarding must explain the philosophy quickly.

Do NOT create a long financial questionnaire.

Do NOT ask users to configure their financial life before they can experience the product.

The user should reach the core experience extremely quickly.

Potential onboarding:

### Screen 1

# Your money.

Like Notes.

Write naturally.

`coffee 180`

and we'll organize the rest.

---

### Screen 2

# Say anything.

`Lunch with friends 640 and Uber home 220`

We understand:

Food ₹640
Transport ₹220

---

### Screen 3

# Remember everything.

Ask later:

`How much did I spend eating out this month?`

---

Then:

**Start journaling**

The first actual interaction should ideally teach the product through use rather than additional explanation.

---

# 11. Paywall

The application will eventually monetize through a subscription/paywall.

However:

the paywall must NOT appear before the user understands the product.

Give the user an opportunity to experience the core magic first.

The exact monetization model can evolve, but possible premium capabilities include:

* higher/unlimited AI processing
* receipt scanning
* Ask-your-money
* advanced summaries
* longer financial-memory history
* more presets
* advanced contextual analysis

Do NOT arbitrarily block basic access to someone's own financial journal.

The user's own captured information should never feel held hostage.

The paywall should communicate value in terms of outcomes rather than AI tokens.

Bad:

> 500 AI generations

Better:

> Understand your complete financial history.

---

# 12. Summary / top categories

MVP should provide lightweight summaries.

Examples:

## Today

₹1,840 spent

Food & Drinks ₹720
Transport ₹320
Shopping ₹800

or:

## September

₹18,420 spent

Top categories:

1. Food & Drinks — ₹6,200
2. Transport — ₹3,800
3. Shopping — ₹3,100

Do NOT turn this into a dashboard full of analytics.

The journal remains the product.

The summary exists to answer:

> Where did my money go?

Prefer concise information.

---

# 13. Updated MVP navigation

Keep navigation minimal.

A possible structure is:

### Journal

Primary screen.

Natural input + financial timeline.

### Calendar

Browse financial history by date.

### Ask

Talk to financial history.

### Settings/Profile

Currency
Location preference
Presets
Subscription
Privacy
etc.

Do not add tabs simply because traditional finance applications have them.

If Summary can naturally exist inside Journal, prefer that instead of creating another major tab.

---

# 14. Required V1 input experience

The composer is one of the most important components in the entire application.

It should conceptually support:

`What happened with your money?`

with:

📷 Camera

⌨️ Text

and later:

🎙 Voice

Example:

User writes:

`bought 2 coffees for 360 with Aswin`

The UI immediately displays:

> Coffee with Aswin
> **₹360**
>
> Food & Drinks · 2 items

The user should not have to complete another form.

---

# 15. Required MVP reliability hierarchy

When tradeoffs occur, prioritize features in this order:

1. User can always capture a note.
2. User's note is never lost.
3. Amounts are extracted correctly.
4. Multiple expenses are correctly separated.
5. Date/currency are correct.
6. Categorization is useful.
7. Context is preserved.
8. Receipt extraction is useful.
9. AI summaries are useful.
10. Everything else.

A beautiful AI summary means nothing if:

`coffee 180`

sometimes disappears.

---

# 16. V1 feature checklist

Before considering MVP V1 complete, verify:

* [ ] Natural-language expense capture
* [ ] Numeric/amount extraction
* [ ] Multiple amounts from one note
* [ ] Automatic categorization
* [ ] Original note preservation
* [ ] Currency selection in Settings
* [ ] Multiple currency detection
* [ ] Currency conversion
* [ ] Quantity extraction
* [ ] Optional location context
* [ ] Location permission/settings
* [ ] Receipt photo capture/upload
* [ ] Receipt information extraction
* [ ] Local caching
* [ ] Offline capture
* [ ] Deferred AI processing
* [ ] API/rate-limit failure handling
* [ ] User-created presets
* [ ] Calendar/history navigation
* [ ] Daily totals
* [ ] Weekly/monthly summaries
* [ ] Top categories
* [ ] Onboarding
* [ ] Paywall/subscription foundation
* [ ] Editing/correction
* [ ] Delete entry
* [ ] Basic Ask-your-money capability if included in V1

---

# 17. Do not misunderstand this feature list

Even with all of these capabilities, the product must still feel extremely simple.

The user should NOT open the app and see:

10 features.

They should see:

# their financial journal.

Most complexity should live underneath the interface.

The ideal experience remains:

**Open**

↓

**Write**

`coffee and sandwich 340`

↓

**Done**

Everything else:

currency conversion
categorization
offline processing
location
quantity
AI
calendar indexing
summaries

should happen quietly around that interaction.

The V1 philosophy remains:

# Complexity underneath. Simplicity on top.

