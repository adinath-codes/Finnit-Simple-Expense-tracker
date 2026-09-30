import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { AI_CONSENT_PROVIDER } from "../services/ai-consent-service";

export function AiConsentSettingsModal({
  busy,
  enabled,
  error,
  onConfirm,
  onDismiss,
  visible,
}: {
  busy: boolean;
  enabled: boolean;
  error: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionPreference();
  const close = () => { if (!busy) onDismiss(); };

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
          accessibilityLabel="Close AI data sharing settings"
          accessibilityRole="button"
          disabled={busy}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[styles.card, { marginBottom: Math.max(insets.bottom, 20) }]}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {enabled ? "Turn off AI features?" : "Turn on AI features?"}
          </Text>
          {enabled ? (
            <Text style={styles.body}>
              Finnit will stop sending new data to {AI_CONSENT_PROVIDER}. Manual journal entry,
              saved entries, totals, and existing records will keep working. Receipt scanning,
              natural-language organization, Ask Finn, and AI corrections will turn off.
            </Text>
          ) : (
            <>
              <Text style={styles.body}>
                If you agree, Finnit may send data to {AI_CONSENT_PROVIDER} only when you use an
                AI feature:
              </Text>
              <Text style={styles.list}>
                • Financial notes for organization or revision{"\n"}
                • Receipt images for extraction{"\n"}
                • Relevant financial context for AI answers
              </Text>
              <Text style={styles.body}>
                This data is not used for advertising. You can withdraw permission here at any time.
              </Text>
            </>
          )}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Button
            disabled={busy}
            label={enabled ? "Turn off AI features" : `Allow ${AI_CONSENT_PROVIDER} data sharing`}
            onPress={onConfirm}
            style={[styles.primary, enabled && styles.disableButton]}
          >
            <Text style={styles.primaryText}>
              {busy ? "Saving…" : enabled ? "Turn off AI" : "I agree — turn on AI"}
            </Text>
          </Button>
          <Button disabled={busy} label="Keep current AI setting" onPress={close}>
            <Text style={styles.cancel}>{enabled ? "Keep AI on" : "Keep AI off"}</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(23, 23, 23, 0.24)",
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  card: {
    alignSelf: "center",
    backgroundColor: Finn.surface,
    borderRadius: 28,
    maxWidth: 440,
    paddingBottom: 12,
    paddingHorizontal: 24,
    paddingTop: 26,
    width: "100%",
    ...Finn.shadow,
  },
  title: { color: Finn.ink, fontFamily: JournalType.bold, fontSize: 23 },
  body: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  list: {
    backgroundColor: Finn.wash,
    borderRadius: 15,
    color: Finn.ink,
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 22,
    marginTop: 14,
    padding: 14,
  },
  error: { color: Finn.danger, fontSize: 12, lineHeight: 18, marginTop: 12 },
  primary: { backgroundColor: Finn.primary, borderRadius: 16, marginTop: 20, minHeight: 50 },
  disableButton: { backgroundColor: Finn.ink },
  primaryText: { color: Finn.surface, fontFamily: JournalType.medium, fontSize: 15 },
  cancel: { color: Finn.secondary, fontFamily: JournalType.medium, fontSize: 14 },
});
