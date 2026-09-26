import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";

export type JournalEntryConfirmationKind = "recalculate" | "delete";

export function JournalEntryConfirmationModal({
  kind,
  busy,
  onDismiss,
  onRecalculate,
  onPreserve,
  onDelete,
}: {
  kind: JournalEntryConfirmationKind | null;
  busy: boolean;
  onDismiss: () => void;
  onRecalculate: () => void;
  onPreserve: () => void;
  onDelete: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionPreference();
  const deleting = kind === "delete";
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
      visible={kind !== null}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel={deleting ? "Keep entry" : "Continue editing"}
          accessibilityRole="button"
          disabled={busy}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.card,
            { marginBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={[styles.iconWrap, deleting && styles.deleteIconWrap]}>
            <Icon
              animation={false}
              color={deleting ? Finn.destructive : Finn.primary}
              name={deleting ? "trash" : "sparkle"}
              size={22}
            />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {deleting ? "Delete this entry?" : "Recalculate this entry?"}
          </Text>
          <Text style={styles.body}>
            {deleting
              ? "This removes it from your journal, totals, insights, and search. This can’t be undone."
              : "Finn can read the edited note again and update its amount and details. Or keep the current amount and details."}
          </Text>

          {deleting ? (
            <>
              <Button
                disabled={busy}
                label="Delete entry"
                onPress={onDelete}
                style={[styles.primaryButton, styles.deleteButton]}
              >
                <Text style={styles.primaryButtonText}>
                  {busy ? "Deleting…" : "Delete entry"}
                </Text>
              </Button>
              <Button disabled={busy} label="Keep entry" onPress={close}>
                <Text style={styles.secondaryButtonText}>Keep entry</Text>
              </Button>
            </>
          ) : (
            <>
              <Button
                disabled={busy}
                label="Recalculate with Finn"
                onPress={onRecalculate}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {busy ? "Saving…" : "Recalculate with Finn"}
                </Text>
              </Button>
              <Button
                disabled={busy}
                label="Keep current amount and details"
                onPress={onPreserve}
                style={styles.preserveButton}
              >
                <Text style={styles.preserveButtonText}>Keep current amount</Text>
              </Button>
              <Button disabled={busy} label="Continue editing" onPress={close}>
                <Text style={styles.secondaryButtonText}>Continue editing</Text>
              </Button>
            </>
          )}
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
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
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
  deleteIconWrap: { backgroundColor: "#FFF0EF" },
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
  primaryButton: {
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: Finn.primary,
  },
  deleteButton: { backgroundColor: Finn.destructive },
  primaryButtonText: {
    color: Finn.surface,
    fontFamily: JournalType.bold,
    fontSize: 16,
  },
  preserveButton: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: Finn.primarySoft,
  },
  preserveButtonText: {
    color: Finn.primary,
    fontFamily: JournalType.bold,
    fontSize: 15,
  },
  secondaryButtonText: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 15,
  },
});
