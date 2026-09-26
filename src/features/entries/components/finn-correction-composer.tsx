import { IconButton } from "@/components/ui/icon-button";
import { useRotatingPlaceholder } from "@/components/ui/use-rotating-placeholder";
import { Finn, JournalType } from "@/constants/theme";
import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

const PHRASES = [
  "Tell Finn what to edit",
  "\"The amount was equally split\"",
  "\"Can you add another item in the list\"",
] as const;

export function FinnCorrectionComposer({
  disabled,
  onSubmit,
}: {
  disabled?: boolean;
  onSubmit: (instruction: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const phrases = useMemo(() => PHRASES, []);
  const placeholder = useRotatingPlaceholder(phrases);
  const submit = async () => {
    const instruction = value.trim();
    if (!instruction || submitting || disabled) return;
    setSubmitting(true);
    try {
      await onSubmit(instruction);
      setValue("");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <View style={styles.container}>
      <TextInput
        accessibilityLabel="Tell Finn what to change in the breakdown"
        autoFocus
        maxLength={500}
        multiline
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={Finn.muted}
        returnKeyType="done"
        style={styles.input}
        value={value}
      />
      <IconButton
        accessibilityState={{ disabled: disabled || submitting || !value.trim() }}
        disabled={disabled || submitting || !value.trim()}
        filled
        label="Apply correction with Finn"
        name="check"
        onPress={() => { void submit(); }}
        style={styles.submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-end",
    backgroundColor: Finn.canvas,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  input: {
    backgroundColor: Finn.surface,
    borderColor: Finn.line,
    borderRadius: 20,
    borderWidth: 1,
    color: Finn.ink,
    flex: 1,
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 19,
    maxHeight: 110,
    minHeight: 50,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  submit: { height: 48, width: 48 },
});
