import { cubicBezier, Easing } from "react-native-reanimated";

export const Motion = {
  press: 120,
  fade: 150,
  content: 180,
  layout: 200,
  panelEnter: 250,
  panelExit: 180,
  month: 140,
  loadingDelay: 150,
  shimmer: 1500,
  easeOut: Easing.bezier(0.23, 1, 0.32, 1),
  easeInOut: Easing.bezier(0.77, 0, 0.175, 1),
  cssEaseOut: cubicBezier(0.23, 1, 0.32, 1),
} as const;
