/**
 * Shared typography tokens for the Finn interface.
 *
 * Keep every React Native `fontSize` and `fontWeight` reference on these
 * scales so visual type can be adjusted consistently from one place.
 */
export const FontSize = {
  micro: 8,
  tiny: 9,
  caption: 10,
  label: 11,
  bodySmall: 12,
  body: 13,
  bodyLarge: 14,
  heading: 15,
  title: 16,
  titleLarge: 17,
  displaySmall: 18,
  display: 20,
  hero: 26,
  heroLarge: 27,
  heroXL: 28,
  jumbo: 32,
  splash: 48,
} as const;

export const FontWeight = {
  medium: "600",
  semibold: "800",
  bold: "900",
} as const;
