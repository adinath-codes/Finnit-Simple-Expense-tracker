# Finn character sprites

`onboarding/` contains a distinct illustration for every onboarding question.
Each `*-sprite.png` is a transparent 1254 × 1254 atlas with four registered
627 × 627 cells, numbered left-to-right and top-to-bottom. Each matching
`*-base.png` is the complete generated source scene used to build that atlas.

| Animation | Question scene |
| --- | --- |
| `desiredOutcome` | Relieved Finn releases a money bag beside a loose feather. |
| `blindSpot` | Surprised Finn searches for falling receipts and cash with a magnifier. |
| `futureQuestion` | Curious Finn thinks at a laptop beside a question bubble, calendar and chart. |
| `memoryContext` | Reflective Finn holds a memory journal with people, place and moment doodles. |
| `captureStyle` | Brisk Finn captures a receipt with a phone and small pouch. |
| `currency` | Decisive Finn chooses a coin beside a wallet, money bag and globe. |

The built-in image generation tool created the six bases on September 20, 2026,
using the user's Finn storyboard and approved thinking atlas as character/style
references. All scenes keep the swept quiff, black rectangular sunglasses,
angular face, white interiors, wobbly variable-pressure ink, dry-pencil grain,
and dollar-green `#20C878` hatching. Props and expressions change to match the
question. The PNG background stays transparent.

`scripts/build-character-sprites.cjs` deterministically rebuilds the six atlases.
It scales each source to one cell, applies small local contour bulges with zero
movement at each deformation region's center and edge, then varies the green
hatching independently. Shade fragments appear or disappear, use uneven density,
and sit slightly higher or lower per frame. The character and props remain
registered; the app never translates, bobs, rotates, or crossfades the scene.

```bash
npm run build:character-sprites
```

The older `thinking*.png` files remain as unused development history.

## Sign-in edge characters

`../auth/finn-peek-left.png` and `../auth/finn-peek-right.png` are transparent
sign-in decorations generated with the built-in image tool on September 20,
2026. The existing `desired-outcome-base.png` and `capture-style-base.png` scenes
were strict identity and drawing-style references. One pose peeks around the
left screen edge; the other leans around the right edge with a blank receipt.
Both retain the swept quiff, black sunglasses, imperfect ink contour, white
interiors, and sparse `#20C878` pencil hatching. They contain no text or logos.

Generation prompts requested isolated, genuinely transparent mobile cutouts in
the established black/white/Finn-green editorial-cartoon style, cropped by an
implied screen edge and readable around 150–160 px tall. The left prompt asked
for a curious head, shoulder, and fingers peeking inward; the right prompt asked
for a cheerful inward-looking pose presenting a blank receipt. Backgrounds,
gradients, shadows, extra characters, and watermarks were explicitly excluded.

## Toast reactions

`toast/error.png`, `toast/warning.png`, and `toast/info.png` are three transparent
black-and-white Finn bust portraits generated with the built-in image tool on
September 21, 2026. The existing sign-in peek illustration was used as the
strict identity and ink-style reference. Error is concerned with a hand near his
chin, warning raises a finger, and info offers an open-handed explanation. The
toast component supplies state color in text rather than in the character art.

## Playback and adding another animation

```tsx
import { CharSpriteAnim } from "@/components/character/char-sprite-anim";

<CharSpriteAnim animType="futureQuestion" size={180} active={screenFocused} />
```

Add an evenly spaced transparent atlas here, then register its literal `require`,
column/row counts and ordered `{ frame, duration }` holds in
`src/components/character/character-animations.ts`. Durations are milliseconds.
Keep frame dimensions square and artwork consistently anchored inside each cell.
The animation name becomes part of `CharacterAnimationType` automatically. Set
`animType` next to the relevant question in `onboarding-steps.ts` to choose it.

The player uses one decoded image and Reanimated CSS `steps(1, "end")` transforms
to cut between cells. It does not interpolate drawings, crossfade frames, or
update React state on every frame. Every loop uses slightly uneven holds.
Playback pauses while loading, inactive, or backgrounded; reduced motion removes
the animation and displays the first pose. The illustration is decorative and
hidden from accessibility navigation.

## Legacy thinking-scene generation prompt

Built-in image generation, using the user's hand-drawn sleeping-cat screenshot
for line/texture style and `thinking-green.png` for human character identity.
Generate four complete scenes in an exact invisible 2 × 2 atlas. Preserve the
quiff, rectangular sunglasses, long angular face/neck, hand-on-chin pose and
crossed arm. Regenerate all artwork with slightly wobbly black contours, varying
pressure/width, occasional doubled contour fragments, dry-pencil breaks and
grain only inside the marks. White interiors, dollar-green #20C878 hatching on
the neck, hair underside, shoulders and arms. Irregular short scribbles and
crosshatching with varied angles, spacing and ragged boundaries, not polished
vector lines or evenly ruled shading.

Above-left: prominent rough green question mark with a hatched offset shadow.
Upper-right: small black-outlined lightbulb with green scribbled fill and short
idea rays. Near the left shoulder: tiny thought spiral. Add a few sparse small
green circles, asterisks and uneven dots. Keep the doodles relevant to thinking,
clearly visible at phone size and spaced around the figure. No cat, sleep Zs,
purple palette, video controls, captions, or finance dashboard.

Four copies of one held pose and composition; only hatching/grain and a few tiny
accent strokes or bulb-ray lengths change. Imperfect contours remain visually
registered. Complete character and doodles in every square cell, identical scale
and baseline, transparent padding, no cell overlap. Real transparent alpha,
opaque white interiors, no paper rectangle, grid, border, logo or watermark.
Requested 1536 × 1536; returned 1254 × 1254 and consumed proportionally.

## Previous green character generation prompt (unused asset)

Create a complete character sprite sheet: four full finished drawings, with the
supplied storyboard used for identity only. Young man with a sculptural swept-up
quiff, black rectangular sunglasses, angular face and long neck, short-sleeve
t-shirt, confident thoughtful expression. Redesign in sparse Procreate pencil and
ink using black outlines, white interiors, and dollar-green #20C878 colored-pencil
shadows. Thinking hand-on-chin pose with one arm folded across the torso.

Design one character and copy the same pose and outline into four cells. No head
tilt, breathing, bobbing, rotation, expression changes, or silhouette drift. Only
scribbled green hatching and shadow density vary slightly in anchored regions.
Allow a few shade strokes to spill beyond one elbow like handmade offset print.
Keep white skin and hair, black sunglasses, a mainly white shirt with black ink
outlines and small black underarm shadows. Green crosshatching belongs on the
shoulders, side of neck, beneath the quiff and lower crossed forearm. No gradients,
gloss, green face, detached blobs, or separate art layers.

Exact invisible 2 × 2 grid, complete waist-up character in each equal square cell,
identical scale and baseline, generous transparent padding, complete hair and
elbows. Genuine alpha outside the drawings; opaque white interiors. No paper,
borders, words, numbers, logos, watermark, thought bubbles or captions. Four
versions of the shading over the same held pose. Requested 1536 × 1536; built-in
image generation returned 1254 × 1254, handled by proportional atlas playback.

## Original monochrome generation prompt (unused asset)

Use case: illustration-story. Production sprite sheet for an Expo onboarding
character: four hand-drawn frames of one subtle looping thinking animation.
Use the supplied storyboard only for character identity and monochrome drawing
style, especially its second thinking panel. Do not reproduce storyboard text,
panels or multiple actions. Request a square PNG in an exact 2 × 2 invisible grid.
Each cell contains the same waist-up young man: swept white quiff outlined in
black, small black rectangular sunglasses, angular face and long neck, solid
black short-sleeve t-shirt, one forearm folded and the other hand touching his
chin. Minimal organic black ink outlines; opaque white skin and hair. Friendly,
thoughtful, confident. No shading, paper grain, shadows or color.

Reading order: neutral thinking; tiny upward head tilt and quiff shift; tiny
opposite tilt and chin-finger shift; back toward neutral. Subtle changes with
hand-drawn line boil. Same body scale, shoulder position and baseline throughout,
complete elbows, generous transparent gutters. Genuine transparent alpha outside
the character with clean antialiased edges; preserve opaque white interiors.
No baked-in checkerboard, text, captions, numbers, borders, props or watermark.
The output is an atlas for hard-cut frame playback, not a comic.

The tool returned 1254 × 1254 rather than the requested 1024 × 1024. Playback uses
the grid proportions and is independent of the source pixel size.
