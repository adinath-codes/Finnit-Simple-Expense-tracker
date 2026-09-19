import { createContext, useContext } from "react";
import { Platform } from "react-native";
import {
  SymbolView,
  type AnimationSpec,
  type SymbolViewProps,
} from "expo-symbols";
import { Finn } from "@/constants/theme";

export const SymbolAnimationContext = createContext({
  reduceMotion: false,
  trigger: 0,
});

export const BLUE_SPARKLE_COLORS = [
  Finn.blueSparkleStart,
  Finn.blueSparkleEnd,
];

const names = {
  plus: ["plus", "add"],
  close: ["xmark", "close"],
  chevron: ["chevron.right", "chevron_right"],
  down: ["chevron.down", "keyboard_arrow_down"],
  up: ["chevron.up", "keyboard_arrow_up"],
  quantity: ["list.number", "format_list_numbered"],
  back: ["chevron.left", "chevron_left"],
  settings: ["gearshape.fill", "settings"],
  mic: ["mic.fill", "mic"],
  keyboard: ["keyboard", "keyboard"],
  send: ["arrow.up", "arrow_upward"],
  calendar: ["calendar", "calendar_today"],
  search: ["magnifyingglass", "search"],
  edit: ["pencil", "edit"],
  check: ["checkmark", "check"],
  bookmark: ["bookmark", "bookmark"],
  location: ["location.fill", "near_me"],
  bell: ["bell.fill", "notifications"],
  flame: ["flame.fill", "local_fire_department"],
  food: ["fork.knife", "restaurant"],
  car: ["car.fill", "directions_car"],
  bag: ["bag.fill", "shopping_bag"],
  note: ["doc.text", "description"],
  sparkle: ["sparkles", "auto_awesome"],
  camera: ["camera", "photo_camera"],
  flash: ["bolt.fill", "flash_on"],
  flashOff: ["bolt.slash.fill", "flash_off"],
  flipCamera: ["arrow.triangle.2.circlepath.camera", "flip_camera_android"],
  refresh: ["arrow.counterclockwise", "refresh"],
  trash: ["trash", "delete"],
  moon: ["moon.fill", "dark_mode"],
  clock: ["clock", "schedule"],
  more: ["ellipsis", "more_horiz"],
  wallet: ["wallet.bifold", "account_balance_wallet"],
  globe: ["globe", "language"],
  arrow: ["arrow.up.right", "north_east"],
  offline: ["wifi.slash", "wifi_off"],
} as const;
export type IconName = keyof typeof names;
export function Icon({
  name,
  size = 20,
  color = Finn.ink,
  colors,
  animation = "bounce",
}: {
  name: IconName;
  size?: number;
  color?: string;
  colors?: string[];
  animation?: NonNullable<AnimationSpec["effect"]>["type"] | false;
}) {
  const [ios, other] = names[name];
  const { reduceMotion, trigger } = useContext(SymbolAnimationContext);
  const animationSpec: AnimationSpec | undefined =
    animation && trigger > 0 && !reduceMotion
      ? {
          effect: {
            type: animation,
            direction: "up",
            wholeSymbol: true,
          },
          repeatCount: 1,
        }
      : undefined;

  return (
    <SymbolView
      key={
        Platform.OS === "ios" && animationSpec
          ? `${name}-${trigger}`
          : name
      }
      name={{ ios, android: other, web: other } as SymbolViewProps["name"]}
      animationSpec={animationSpec}
      colors={colors}
      size={size}
      tintColor={colors?.[0] ?? color}
      type={colors?.length ? "palette" : "monochrome"}
      style={{ width: size, height: size }}
    />
  );
}
