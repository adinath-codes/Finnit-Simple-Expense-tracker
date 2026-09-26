import { useEffect, useMemo, useRef, useState } from "react";
import { Text, type TextProps } from "react-native";
import { useMotionPreference } from "@/hooks/use-motion-preference";

const DEFAULT_CHARACTER_DELAY = 18;
const DEFAULT_START_DELAY = 90;

export type MagicTypeTextProps = Omit<TextProps, "children"> & {
  children: string;
  characterDelay?: number;
  enabled?: boolean;
  onComplete?: () => void;
  startDelay?: number;
};

/**
 * Reveals text one character at a time while reserving its final layout.
 * Reduced Motion and disabled instances render the complete copy immediately.
 */
export function MagicTypeText({
  children,
  characterDelay = DEFAULT_CHARACTER_DELAY,
  enabled = true,
  onComplete,
  startDelay = DEFAULT_START_DELAY,
  ...textProps
}: MagicTypeTextProps) {
  const reducedMotion = useMotionPreference();
  const characters = useMemo(() => Array.from(children), [children]);
  const shouldType = enabled && !reducedMotion && characters.length > 0;
  const [visibleCount, setVisibleCount] = useState(
    shouldType ? 0 : characters.length,
  );
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    if (!shouldType) {
      setVisibleCount(characters.length);
      onCompleteRef.current?.();
      return;
    }

    let nextCount = 0;
    setVisibleCount(0);
    const typeNextCharacter = () => {
      if (cancelled) return;
      nextCount += 1;
      setVisibleCount(nextCount);
      if (nextCount >= characters.length) {
        onCompleteRef.current?.();
        return;
      }
      timer = setTimeout(typeNextCharacter, characterDelay);
    };

    timer = setTimeout(typeNextCharacter, startDelay);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [characterDelay, characters, shouldType, startDelay]);

  const visible = characters.slice(0, visibleCount).join("");
  const waiting = characters.slice(visibleCount).join("");

  return (
    <Text {...textProps}>
      {visible}
      {waiting ? <Text style={{ color: "transparent" }}>{waiting}</Text> : null}
    </Text>
  );
}
