/** Bundled, transparent atlases. Frames are numbered left-to-right, top-to-bottom. */
export const characterAnimations = {
  desiredOutcome: {
    source: require("@/assets/images/character/onboarding/desired-outcome-sprite.png"),
    columns: 2,
    rows: 2,
    sequence: [
      { frame: 0, duration: 260 },
      { frame: 1, duration: 240 },
      { frame: 2, duration: 280 },
      { frame: 3, duration: 240 },
    ],
  },
  blindSpot: {
    source: require("@/assets/images/character/onboarding/blind-spot-sprite.png"),
    columns: 2,
    rows: 2,
    sequence: [
      { frame: 0, duration: 230 },
      { frame: 1, duration: 250 },
      { frame: 2, duration: 210 },
      { frame: 3, duration: 270 },
    ],
  },
  futureQuestion: {
    source: require("@/assets/images/character/onboarding/future-question-sprite.png"),
    columns: 2,
    rows: 2,
    sequence: [
      { frame: 0, duration: 280 },
      { frame: 1, duration: 240 },
      { frame: 2, duration: 300 },
      { frame: 3, duration: 220 },
    ],
  },
  memoryContext: {
    source: require("@/assets/images/character/onboarding/memory-context-sprite.png"),
    columns: 2,
    rows: 2,
    sequence: [
      { frame: 0, duration: 300 },
      { frame: 1, duration: 260 },
      { frame: 2, duration: 300 },
      { frame: 3, duration: 240 },
    ],
  },
  captureStyle: {
    source: require("@/assets/images/character/onboarding/capture-style-sprite.png"),
    columns: 2,
    rows: 2,
    sequence: [
      { frame: 0, duration: 210 },
      { frame: 1, duration: 230 },
      { frame: 2, duration: 200 },
      { frame: 3, duration: 260 },
    ],
  },
  currency: {
    source: require("@/assets/images/character/onboarding/currency-sprite.png"),
    columns: 2,
    rows: 2,
    sequence: [
      { frame: 0, duration: 280 },
      { frame: 1, duration: 240 },
      { frame: 2, duration: 260 },
      { frame: 3, duration: 240 },
    ],
  },
} as const;

export type CharacterAnimationType = keyof typeof characterAnimations;
