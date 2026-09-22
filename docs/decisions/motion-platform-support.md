# Finn motion platform support

Updated September 19, 2026. Persistent implementation record for future tasks.

## User preference and status

Prioritize iOS motion. Do not build Android equivalents of Apple-only effects merely to achieve parity. When asked about an interaction, report its exact platform support from the table below.

**Android lacks Apple button-to-page zoom and native SF Symbol effects; ordinary native transitions and shared Reanimated effects may still run.**

Implementation status is source changes only. At the user's explicit request, no tests, builds, typechecks, simulator sessions, device QA, or performance measurements were run. Do not describe these animations as device-verified or guarantee frame rates. The existing journal processing and spending-panel animations remain in place.

## Effect-by-effect record

| Interaction / controls | iOS implementation | Android implementation / omitted effect |
| --- | --- | --- |
| Journal date → calendar; search button → search; settings buttons → settings | `ZoomLink` wraps the source in `Link.AppleZoom` on iOS 18+ with reduced motion off. Native reverse zoom returns toward the source. Existing sheet detents and route definitions are retained. | No Apple button-to-page zoom. Existing native navigation/form-sheet transitions remain. |
| Settings → Manage saved entries; composer plus → saved entries | Same native zoom. The composer retains its toolbar source during navigation and briefly through return; keyboard cleanup still runs before navigation. | No Apple source zoom; ordinary navigation and button press feedback remain. |
| Journal entry result/amount → entry details | Native zoom from the result control; entry ID and detail-sheet presentation are unchanged. | No source-to-detail zoom. Existing native form sheet remains. |
| Search and camera icons | One native SF Symbol pulse on activation. | No SF Symbol pulse; Material icons plus shared button feedback. |
| Bookmark state / entry saved as shortcut | Native SF Symbol scale. The entry confirmation uses an explicit success event. | No SF Symbol scale. Confirmation icon and text still appear. |
| Save note, save preset, add preset to journal | One native checkmark bounce after the local operation succeeds, with a visible confirmation. | No SF Symbol bounce. Confirmation icon/text and opacity reveal remain. |
| All shared buttons | 120ms opacity and scale to 0.97, no universal icon bounce. | Same shared Reanimated press feedback. |
| Startup and onboarding hydration | Delayed skeletons with 1.5s clipped gradient shimmer; content reveal on readiness. | Same shared skeleton/shimmer primitives. The retired quick-capture route redirects to the journal. |
| Search contexts and first results | Skeletons after 150ms pending; fade loaded content over 180ms. Refresh of the same request retains prior results; pagination appends without replaying row entrances. | Same shared loading behavior. |
| Entry references; saved-entry create/edit form; custom search dates | 200ms layout transition and 150ms content fades; disclosure chevrons rotate with expanded state. | Same shared Reanimated effects. |
| Saved-entry insert/delete | Stable keys and layout/fade effects for editing operations; search focus/input suppresses list motion. | Same shared Reanimated effects. |
| Receipt camera toolbar → floating panel | Measured button origin; translation + scale 0.95→1 + opacity in 250ms, reverse in 180ms before unmount. Missing measurement uses a small vertical offset. Camera/review content fades on state changes. | Same Reanimated panel effect; this is not Apple's native page zoom. No Android visual QA performed. |
| Streamed receipt rows | Each newly completed row fades in over 180ms; the list uses a 200ms layout transition. Totals do not animate and rows do not trigger haptics. | Same shared fade/layout behavior. Reduced motion keeps the opacity entrance and removes layout movement. |
| Calendar month and selected date | Month label/grid fade in 140ms; selection highlight opacity in 120ms. Chart/totals receive no decorative count-up motion. | Same shared Reanimated effects. |
| Story → onboarding questions | Three conversational lines advance like synced lyrics: the active line occupies the center in full contrast, then moves upward and dims while the next line takes focus. The user-controlled handoff button appears after the final line. Reduced Motion presents the full message and action immediately. | Same shared Reanimated sequence and reduced-motion behavior. |

## Accessibility, lifecycle, and fallback rules

### Onboarding sprite addition — September 20, 2026

`CharSpriteAnim` renders transparent four-frame complete-scene atlases with
Reanimated CSS stepped transforms. The same implementation runs on iOS and
Android; there are no Apple-only effects in this player. Each question chooses
its own atlas through a typed `animType` field. One atlas is decoded before
playback begins, with no React frame timer or crossfade. Focus loss and app
backgrounding pause playback; the live reduced-motion preference selects the
static first frame.

The six current question atlases are `desiredOutcome`, `blindSpot`,
`futureQuestion`, `memoryContext`, `captureStyle`, and `currency`. Each has a
separate pose, expression, and small set of relevant finance props. The complete
composition stays registered inside its loop. Deterministic local deformation
only bulges, pinches, or wobbles contours; it does not translate the character or
props. Dollar-green hatch fragments independently appear, disappear, change
density, and sit slightly higher or lower in different frames. Every frame is a
complete raster scene; no shade layer or runtime body transform is involved.

The earlier `thinking*.png` work remains as unused development history. Its
Android screenshot and recording checks are historical evidence for the shared
player. Per the user's explicit request, the six new question-specific atlases
were not checked on the connected Android device. Their transparent cells and
frame registration were inspected from the generated files. The deterministic
rebuild, TypeScript, targeted ESLint, and an Android Metro export passed; iOS and
release performance remain unverified.

- Shared motion preference subscribes to system changes while the app is open.
- Reduced motion omits Apple zoom, press scaling, camera translation/scaling, symbol effects, shimmer, and layout movement. Opacity feedback and static skeletons remain; chevrons switch orientation immediately.
- Shimmer runs only while pending, foregrounded, and active. Search passes route focus to stop shimmer when covered by another route.
- Empty/error states are real content, not an indefinite loading state. No artificial minimum loading period delays ready content.
- Older iOS and source-less deep links use normal native navigation. Only the listed launch controls receive zoom; legal documents, auth redirects, and Back Tap are not given fake source anchors.
- Expo documents an upstream rapid open/close latency limitation for native zoom. No custom workaround or native dependency upgrade was added, and device behavior remains unverified.
- Do not add animation to typing, scrolling, financial arithmetic, or native switches for decoration.

## Ownership and references

- Shared tokens: `src/constants/motion.ts`; live preference: `src/hooks/use-motion-preference.ts`.
- Native source links: `src/components/navigation/zoom-link.tsx`; button/ref forwarding and SF effects: `src/components/ui/button.tsx`, `icon-button.tsx`, `icon.tsx`.
- Skeleton/shimmer: `src/components/common/loading-state.tsx`; state/layout/fade helpers: `src/components/ui/motion.tsx`.
- Camera owns its measured-origin props and presentation lifetime. Search hook changes only retain results for the same request while refreshing; financial calculations and backend contracts are unchanged.

Sources read before implementation: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [native zoom](https://docs.expo.dev/router/advanced/zoom-transition/), [Expo Symbols](https://docs.expo.dev/versions/v57.0.0/sdk/symbols/), [micro-interactions skill](https://github.com/solinkz/micro-interactions-skill), local Animate Expo / Reanimated / Find Animation Opportunities skills. Exact installed Router and Symbols types were consulted for integration.
