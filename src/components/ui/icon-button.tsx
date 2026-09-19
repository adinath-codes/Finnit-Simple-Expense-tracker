import { Finn } from "@/constants/theme";
import { Button } from "./button";
import { Icon, type IconName } from "./icon";
export function IconButton({
  name,
  label,
  onPress,
  color = Finn.ink,
  filled = false,
  disabled = false,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  filled?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 44,
        height: 44,
        borderRadius: 24,
        backgroundColor: filled ? Finn.primary : Finn.surface,
        ...Finn.shadow,
      }}
    >
      <Icon name={name} color={filled ? "#fff" : color} size={19} />
    </Button>
  );
}
