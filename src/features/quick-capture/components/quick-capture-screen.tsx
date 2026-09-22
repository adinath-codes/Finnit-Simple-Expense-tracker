import { Redirect } from "expo-router";

/** Preserve old Back Tap links while quick capture is turned off. */
export default function QuickCaptureScreen() {
  return <Redirect href="/" />;
}
