import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";

export function ConfirmationModal({
  body,
  busy = false,
  cancelLabel = "Cancel",
  confirmLabel,
  destructive = false,
  icon = destructive ? "trash" : "sparkle",
  onConfirm,
  onDismiss,
  title,
  visible,
}: {
  body: string;
  busy?: boolean;
  cancelLabel?: string;
  confirmLabel: string;
  destructive?: boolean;
  icon?: IconName;
  onConfirm: () => void;
  onDismiss: () => void;
  title: string;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useMotionPreference();
  const close = () => {
    if (!busy) onDismiss();
  };

  return (
    <Modal
      animationType={reducedMotion ? "none" : "fade"}
      navigationBarTranslucent
      onRequestClose={close}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel={cancelLabel}
          accessibilityRole="button"
          disabled={busy}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[styles.card, { marginBottom: Math.max(insets.bottom, 20) }]}
        >
          <View style={[styles.iconWrap, destructive && styles.destructiveIconWrap]}>
            <Icon
              animation={false}
              color={destructive ? Finn.destructive : Finn.primary}
              name={icon}
              size={22}
            />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>
          <Button
            disabled={busy}
            label={confirmLabel}
            onPress={onConfirm}
            style={[styles.confirmButton, destructive && styles.destructiveButton]}
          >
            <Text style={styles.confirmButtonText}>
              {busy ? "Please wait…" : confirmLabel}
            </Text>
          </Button>
          <Button disabled={busy} label={cancelLabel} onPress={close}>
            <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    backgroundColor: "rgba(23, 23, 23, 0.24)",
  },
  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 440,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 12,
    borderRadius: 28,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  iconWrap: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    borderRadius: 23,
    backgroundColor: Finn.primarySoft,
  },
  destructiveIconWrap: { backgroundColor: "#FFF0EF" },
  title: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 23,
    lineHeight: 28,
  },
  body: {
    marginTop: 9,
    marginBottom: 22,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  confirmButton: {
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: Finn.primary,
  },
  destructiveButton: { backgroundColor: Finn.destructive },
  confirmButtonText: {
    color: Finn.surface,
    fontFamily: JournalType.bold,
    fontSize: 16,
  },
  cancelButtonText: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 15,
  },
});
