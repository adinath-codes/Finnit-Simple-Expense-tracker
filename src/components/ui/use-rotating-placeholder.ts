import { useEffect, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";

export const ROTATING_PLACEHOLDER_TIMING = {
  type: 55,
  delete: 30,
  hold: 2500,
} as const;

export function useRotatingPlaceholder(phrases: readonly string[]) {
  const reducedMotion = useReducedMotion();
  const [visibleText, setVisibleText] = useState(reducedMotion ? phrases[0] ?? "" : "");

  useEffect(() => {
    const first = phrases[0] ?? "";
    if (reducedMotion || phrases.length < 2) {
      setVisibleText(first);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let phraseIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    const schedule = (delay: number) => { timer = setTimeout(tick, delay); };
    const tick = () => {
      if (cancelled) return;
      const phrase = phrases[phraseIndex] ?? "";
      if (!deleting) {
        characterIndex += 1;
        setVisibleText(phrase.slice(0, characterIndex));
        if (characterIndex === phrase.length) {
          deleting = true;
          schedule(ROTATING_PLACEHOLDER_TIMING.hold);
        } else schedule(ROTATING_PLACEHOLDER_TIMING.type);
        return;
      }
      characterIndex -= 1;
      setVisibleText(phrase.slice(0, characterIndex));
      if (characterIndex === 0) {
        phraseIndex = (phraseIndex + 1) % phrases.length;
        deleting = false;
        schedule(ROTATING_PLACEHOLDER_TIMING.type);
      } else schedule(ROTATING_PLACEHOLDER_TIMING.delete);
    };
    setVisibleText("");
    schedule(ROTATING_PLACEHOLDER_TIMING.type);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phrases, reducedMotion]);

  return visibleText;
}
