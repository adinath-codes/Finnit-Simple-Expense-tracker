import { Icon, type IconName } from "@/components/ui/icon";

// Journal controls use SF Symbols on iOS and their Material counterparts elsewhere.
const journalNames = {
  flame: "flame",
  settings: "settings",
  mic: "mic",
  plus: "plus",
  keyboard: "keyboard",
  sparkle: "sparkle",
  more: "more",
  food: "food",
  car: "car",
  bag: "bag",
} as const satisfies Record<string, IconName>;

export type JournalGlyphName = keyof typeof journalNames;

export function JournalGlyph({
  name,
  size = 20,
  color = "#171717",
  colors,
}: {
  name: JournalGlyphName;
  size?: number;
  color?: string;
  colors?: string[];
}) {
  return (
    <Icon
      name={journalNames[name]}
      size={size}
      color={color}
      colors={colors}
    />
  );
}
