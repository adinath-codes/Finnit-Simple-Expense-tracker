import { LoadingState } from "@/components/common/loading-state";
import { ContentFade } from "@/components/ui/motion";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";

export default function QuickCaptureScreen() {
  const { captureNote, setSelectedDate, settings, settingsReady, today } =
    useJournal();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const input = useRef<TextInput>(null);
  const available = Platform.OS === "ios" && settings.backTapQuickAdd;

  useEffect(() => {
    if (!settingsReady) return;
    if (!available) {
      router.replace("/");
      return;
    }
    const focusTimer = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(focusTimer);
  }, [available, settingsReady]);

  const save = async () => {
    const trimmedNote = note.trim();
    if (!trimmedNote || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await captureNote(trimmedNote, today);
      setSelectedDate(today);
      router.replace("/");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn’t save this note on your device.");
      setSaving(false);
    }
  };

  if (!settingsReady) return <LoadingState variant="capture" label="Getting your note ready…" />;
  if (!available) return <View style={styles.loading} />;

  return (
    <ContentFade style={{ flex: 1 }}><Screen journal>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior="padding"
        >
          <View style={styles.header}>
            <Image
              source={require("../../../../assets/images/journal/finn-mark.svg")}
              style={styles.logo}
              contentFit="contain"
            />
            <Text accessibilityRole="header" style={styles.name}>finn</Text>
            <Text style={styles.tagline}>notes for your money.</Text>
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.prompt}>What happened with your money?</Text>
            <TextInput
              ref={input}
              accessibilityLabel="Expense note"
              accessibilityHint="Write what happened, ending with the amount if you know it."
              autoFocus
              multiline
              value={note}
              onChangeText={setNote}
              onSubmitEditing={save}
              placeholder="coffee 180"
              placeholderTextColor="#B8B0AB"
              selectionColor={Finn.primary}
              returnKeyType="done"
              blurOnSubmit
              style={styles.input}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.actions}>
            <Button
              label="Cancel quick add"
              onPress={() => router.replace("/")}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Button>
            <Button
              label="Save expense note"
              disabled={!note.trim() || saving}
              onPress={() => void save()}
              style={styles.saveButton}
            >
              <Text style={styles.saveText}>{saving ? "Saving…" : "Save note"}</Text>
              <Icon name="send" color="#FFFFFF" size={16} />
            </Button>
          </View>
          {saveError && (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {saveError}
            </Text>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen></ContentFade>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: Finn.canvas },
  safeArea: { flex: 1 },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 10,
  },
  header: { alignItems: "center" },
  logo: { width: 58, height: 58 },
  name: {
    marginTop: 12,
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 32,
    letterSpacing: -1.6,
  },
  tagline: {
    marginTop: 2,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 13,
  },
  noteCard: {
    flex: 1,
    minHeight: 220,
    marginTop: 38,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(77, 55, 43, 0.06)",
    boxShadow: "0px 10px 30px rgba(156, 128, 108, 0.12)",
  },
  prompt: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
  input: {
    flex: 1,
    marginTop: 15,
    padding: 0,
    color: Finn.ink,
    fontFamily: JournalType.regular,
    fontSize: 25,
    lineHeight: 34,
    letterSpacing: -0.45,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
  },
  cancelButton: {
    minWidth: 94,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: Finn.wash,
  },
  cancelText: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 14,
  },
  saveButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: Finn.ink,
  },
  saveText: {
    color: "#FFFFFF",
    fontFamily: JournalType.medium,
    fontSize: 15,
  },
  errorText: {
    color: Finn.danger,
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    textAlign: "center",
  },
});
