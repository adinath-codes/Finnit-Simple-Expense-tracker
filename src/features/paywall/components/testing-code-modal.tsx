import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "@/components/ui/button";
import { JournalType } from "@/constants/theme";
import { testingCodeErrorMessage } from "@/features/paywall/services/subscription-service";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TestingCodeModalProps = {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onRedeem: (code: string) => Promise<void>;
  onRedeemStoreCode?: () => Promise<boolean>;
};

export function TestingCodeModal({
  visible,
  busy,
  onClose,
  onRedeem,
  onRedeemStoreCode,
}: TestingCodeModalProps) {
  const insets = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setCode("");
      setError(null);
      return;
    }
    const timer = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [visible]);

  const close = () => {
    if (!busy) onClose();
  };

  const submit = async () => {
    if (!code.trim() || busy) return;
    setError(null);
    try {
      await onRedeem(code);
    } catch (submissionError) {
      setError(testingCodeErrorMessage(submissionError));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.fill}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close code entry"
          disabled={busy}
          onPress={close}
          style={styles.scrim}
        >
          <Pressable
            accessibilityViewIsModal
            accessibilityRole="none"
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.card,
              { paddingBottom: Math.max(22, insets.bottom + 14) },
            ]}
          >
            <View style={styles.handle} />
            <Text style={styles.title}>Have a code?</Text>
            <Text style={styles.body}>
              Enter your Finn code. Tester codes unlock Premium right away.
            </Text>

            <TextInput
              ref={input}
              accessibilityLabel="Finn code"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!busy}
              maxLength={80}
              onChangeText={(value) => {
                setCode(value);
                if (error) setError(null);
              }}
              onSubmitEditing={() => void submit()}
              placeholder="FINN-TEST-…"
              placeholderTextColor="#8581A8"
              returnKeyType="done"
              selectionColor="#3E4DE0"
              spellCheck={false}
              style={styles.input}
              value={code}
            />

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <Button
              label="Apply code"
              disabled={!code.trim() || busy}
              onPress={() => void submit()}
              style={styles.applyButton}
            >
              {busy ? (
                <ActivityIndicator color="#082C26" />
              ) : (
                <Text style={styles.applyButtonText}>Apply code</Text>
              )}
            </Button>
            <Button
              label="Cancel"
              disabled={busy}
              onPress={close}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Button>

            {onRedeemStoreCode ? (
              <Button
                label="Redeem an App Store offer code"
                disabled={busy}
                onPress={() => void onRedeemStoreCode()}
                style={styles.storeCodeButton}
              >
                <Text style={styles.storeCodeText}>
                  Have an App Store offer code instead?
                </Text>
              </Button>
            ) : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(3, 8, 28, 0.68)",
  },
  card: {
    width: "100%",
    paddingHorizontal: 22,
    paddingTop: 10,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#F8F7FF",
    borderWidth: 1,
    borderColor: "#D6D7F5",
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CAC9DA",
    marginBottom: 18,
  },
  title: {
    color: "#17144C",
    fontFamily: JournalType.bold,
    fontSize: 24,
    textAlign: "center",
  },
  body: {
    marginTop: 8,
    color: "#66648B",
    fontFamily: JournalType.regular,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  input: {
    minHeight: 54,
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#757BE6",
    backgroundColor: "#FFFFFF",
    color: "#25206E",
    fontFamily: JournalType.bold,
    fontSize: 17,
    letterSpacing: 0.8,
    textAlign: "center",
  },
  error: {
    marginTop: 10,
    color: "#A52F4A",
    fontFamily: JournalType.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  applyButton: {
    height: 52,
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: "#79FFD1",
    borderWidth: 1,
    borderColor: "#53DDB0",
  },
  applyButtonText: {
    color: "#082C26",
    fontFamily: JournalType.bold,
    fontSize: 15,
  },
  cancelButton: { height: 42, marginTop: 4 },
  cancelButtonText: {
    color: "#4D4A75",
    fontFamily: JournalType.medium,
    fontSize: 14,
  },
  storeCodeButton: {
    minHeight: 38,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D8D6E8",
  },
  storeCodeText: {
    color: "#4C55C9",
    fontFamily: JournalType.medium,
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
