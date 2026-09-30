import { Image } from "expo-image";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";

export function NotificationPermissionModal({
  visible,
  busy,
  error,
  onAllow,
  onDismiss,
}: {
  visible: boolean;
  busy: boolean;
  error: string | null;
  onAllow: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionPreference();
  const close = () => {
    if (!busy) onDismiss();
  };

  return (
    <Modal
      animationType={reduced ? "none" : "fade"}
      navigationBarTranslucent
      onRequestClose={close}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Not now"
          accessibilityRole="button"
          disabled={busy}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[styles.card, { marginBottom: Math.max(insets.bottom, 20) }]}
        >
          <View style={styles.characterStage}>
            <Image
              accessibilityElementsHidden
              contentFit="contain"
              importantForAccessibility="no-hide-descendants"
              source={require("@/assets/images/character/header/finn-paperwork.png")}
              style={styles.character}
            />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            Let me keep the gaps out?
          </Text>
          <Text style={styles.body}>
            You might forget on some days — everyone does. One missed day can turn into a blind spot in your money story. Let me send a light evening nudge when your journal goes quiet.
          </Text>
          <Text style={styles.privacy}>
            I’ll keep amounts and expense details out of notifications.
          </Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Button
            disabled={busy}
            label="Let Finnit remind me"
            onPress={onAllow}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {busy ? "Asking your phone…" : "Let Finnit remind me"}
            </Text>
          </Button>
          <Button disabled={busy} label="Not now" onPress={close}>
            <Text style={styles.secondaryButtonText}>Not now</Text>
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
    backgroundColor: "rgba(23, 23, 23, 0.28)",
  },
  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 440,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 12,
    borderRadius: 28,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  characterStage: {
    height: 112,
    marginHorizontal: -6,
    marginBottom: 8,
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: Finn.primarySoft,
  },
  character: {
    alignSelf: "center",
    width: 232,
    height: 110,
  },
  title: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 24,
    lineHeight: 29,
  },
  body: {
    marginTop: 9,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  privacy: {
    marginTop: 9,
    marginBottom: 20,
    color: Finn.primary,
    fontFamily: JournalType.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    marginBottom: 12,
    color: Finn.danger,
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: Finn.primary,
  },
  primaryButtonText: {
    color: Finn.surface,
    fontFamily: JournalType.bold,
    fontSize: 16,
  },
  secondaryButtonText: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 15,
  },
});
