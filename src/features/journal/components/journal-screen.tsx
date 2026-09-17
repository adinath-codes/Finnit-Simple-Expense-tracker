import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Finn, JournalType } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
import { amountFromNote } from "@/utils/amounts";
import { money } from "@/utils/currency";
import { JournalHeader } from "./journal-header";
import { JournalEntryCard } from "./journal-entry-card";
import { JournalComposer } from "./journal-composer";
import { JournalEmptyPrompt } from "./journal-empty-prompt";
import {
  JournalProcessingDots,
  JournalProcessingStatus,
} from "./journal-processing-status";
import {
  useJournalEntryProcessing,
  type PendingEntryResult,
} from "../hooks/use-journal-entry-processing";

export default function JournalScreen() {
  const {
    entries,
    selectedDate,
    addEntry,
    updateEntry,
    deleteEntry,
    settings,
  } = useJournal();
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryDraft, setEntryDraft] = useState("");
  const [processingEntryDrafts, setProcessingEntryDrafts] = useState<Record<string, string>>({});
  const [tool, setTool] = useState<"add" | "voice" | "receipt" | null>(null);
  const input = useRef<TextInput>(null);
  const entryInputs = useRef(new Map<string, TextInput>());
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const hidden = Keyboard.addListener("keyboardDidHide", () => {
      setFocused(false);
      input.current?.blur();
    });
    return () => hidden.remove();
  }, []);
  useFocusEffect(
    useCallback(
      () => () => {
        setFocused(false);
        Keyboard.dismiss();
      },
      [],
    ),
  );
  const buildPendingEntry = useCallback(
    (note: string): PendingEntryResult => {
      const id = `note-${Date.now()}`;
      const amount = amountFromNote(note);
      const entry = {
        id,
        date: selectedDate,
        note: note.trim(),
        merchant: "Your note",
        category: "other" as const,
        status: amount ? ("ready" as const) : ("review" as const),
        time: "Just now",
        items: [
          {
            id: `${id}-item`,
            name: note.trim(),
            quantity: 1,
            amountMinor: amount,
            category: "other" as const,
          },
        ],
        thought: amount
          ? "The amount at the end of your note has been added to your journal. This is a local preview; you can edit the category and amount in the item below."
          : "Your words are saved in this preview. Add an amount in the item details whenever you’re ready.",
        sources: [
          {
            title: "Your original note",
            detail: note.trim(),
            icon: "note" as const,
          },
        ],
      };
      return {
        entry,
        resultLabel: amount ? money(amount, settings.currency) : "Add amount",
        review: !amount,
        sourceCount: entry.sources.length,
      };
    },
    [selectedDate, settings.currency],
  );
  const commitPendingEntry = useCallback(
    (
      result: PendingEntryResult,
      { dismissKeyboard }: { dismissKeyboard: boolean },
    ) => {
      addEntry(result.entry);
      setDraft("");
      if (dismissKeyboard) {
        setFocused(false);
        input.current?.blur();
        Keyboard.dismiss();
      } else {
        setFocused(true);
        requestAnimationFrame(() => input.current?.focus());
      }
      requestAnimationFrame(() => {
        scroll.current?.scrollToEnd({ animated: false });
      });
    },
    [addEntry],
  );
  const processing = useJournalEntryProcessing({
    draft,
    enabled: focused,
    buildResult: buildPendingEntry,
    onCommit: commitPendingEntry,
  });
  const dayEntries = entries.filter((entry) => entry.date === selectedDate);
  const commitEntryDraft = (
    entry: (typeof entries)[number],
    nextDraft: string,
  ) => {
    const note = nextDraft.trim();
    if (!note) {
      deleteEntry(entry.id);
      return;
    }

    const parsedAmount = amountFromNote(note);
    const sources = entry.sources.map((source) =>
      source.title === "Your original note"
        ? { ...source, detail: note }
        : source,
    );
    updateEntry({
      ...entry,
      note,
      sources,
      ...(parsedAmount
        ? {
            status: "ready" as const,
            items: [
              {
                id: entry.items[0]?.id ?? `${entry.id}-item`,
                name: note,
                quantity: 1,
                amountMinor: parsedAmount,
                category: entry.category,
              },
            ],
          }
        : {}),
    });
  };
  const startEditingEntry = (entry: (typeof entries)[number]) => {
    if (editingEntryId && editingEntryId !== entry.id) {
      const activeEntry = entries.find((item) => item.id === editingEntryId);
      if (activeEntry) commitEntryDraft(activeEntry, entryDraft);
    }
    setEditingEntryId(entry.id);
    setEntryDraft(processingEntryDrafts[entry.id] ?? entry.note);
  };
  const finishEditingEntry = (entry: (typeof entries)[number]) => {
    commitEntryDraft(entry, entryDraft);
    setEditingEntryId((current) =>
      current === entry.id ? null : current,
    );
  };
  const setEntryInput = useCallback((entryId: string, input: TextInput | null) => {
    if (input) {
      entryInputs.current.set(entryId, input);
    } else {
      entryInputs.current.delete(entryId);
    }
  }, []);
  const startEntryProcessing = useCallback((entryId: string, nextDraft: string) => {
    setProcessingEntryDrafts((current) =>
      current[entryId] === nextDraft
        ? current
        : { ...current, [entryId]: nextDraft },
    );
  }, []);
  const advanceEditingEntry = useCallback(
    (entryId: string) => {
      const currentIndex = dayEntries.findIndex((entry) => entry.id === entryId);
      const nextEntry = currentIndex >= 0 ? dayEntries[currentIndex + 1] : undefined;

      if (!nextEntry) {
        setEditingEntryId(null);
        setEntryDraft("");
        requestAnimationFrame(() => input.current?.focus());
        return;
      }

      setEditingEntryId(nextEntry.id);
      setEntryDraft(nextEntry.note);
      requestAnimationFrame(() => entryInputs.current.get(nextEntry.id)?.focus());
    },
    [dayEntries],
  );
  const commitProcessedEdit = useCallback(
    (entry: (typeof entries)[number], finishEditing: boolean) => {
      updateEntry(entry);
      setProcessingEntryDrafts((current) => {
        if (!(entry.id in current)) return current;
        const { [entry.id]: _processedDraft, ...remaining } = current;
        return remaining;
      });
      if (finishEditing) {
        setEditingEntryId((current) =>
          current === entry.id ? null : current,
        );
      }
    },
    [updateEntry],
  );
  return (
    <Screen journal>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <JournalHeader />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={styles.paper}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {dayEntries.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              currency={settings.currency}
              editing={editingEntryId === entry.id}
              draft={editingEntryId === entry.id ? entryDraft : entry.note}
              processingDraft={processingEntryDrafts[entry.id] ?? null}
              onStartEditing={() => startEditingEntry(entry)}
              onChangeDraft={setEntryDraft}
              onCommit={() => finishEditingEntry(entry)}
              onProcessedCommit={commitProcessedEdit}
              onProcessingStarted={startEntryProcessing}
              onReturn={advanceEditingEntry}
              inputRef={(node) => setEntryInput(entry.id, node)}
            />
          ))}
          <View style={styles.editor}>
            {dayEntries.length === 0 && draft.length === 0 && !focused && (
              <JournalEmptyPrompt
                key={selectedDate}
                onPress={() => input.current?.focus()}
              />
            )}
            <TextInput
              ref={input}
              accessibilityLabel="Write an expense"
              accessibilityHint="Pause to save automatically, or use the keyboard button to save now."
              multiline
              value={draft}
              onChangeText={setDraft}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                if (Platform.OS !== "web") setFocused(false);
              }}
              style={styles.input}
              textAlignVertical="top"
              selectionColor={Finn.blue}
            />
            {focused && !!draft && (
              <View style={styles.statusSlot}>
                {processing.phase === "typing" ? (
                  <Button label="Note options" onPress={() => {
                    processing.cancel();
                    Keyboard.dismiss();
                    input.current?.blur();
                    setFocused(false);
                    setTool("add");
                  }} style={styles.noteOptionsButton}>
                    <JournalProcessingDots />
                  </Button>
                ) : (
                  <JournalProcessingStatus
                    phase={processing.phase}
                    result={processing.pendingResult}
                  />
                )}
              </View>
            )}
          </View>
        </ScrollView>
          <JournalComposer
            focused={focused}
            draft={draft}
            input={input}
            onSave={processing.requestManualCommit}
            onInsert={setDraft}
            onDismiss={() => setFocused(false)}
            tool={tool}
            setTool={setTool}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  paper: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 0 },
  editor: { flex: 1, flexDirection: "row", minHeight: 160 },
  statusSlot: {
    alignItems: "flex-end",
    marginLeft: 16,
    paddingTop: 14,
    width: 112,
  },
  noteOptionsButton: {
    alignSelf: "flex-end",
    minHeight: 30,
    width: 44,
  },
  input: {
    flex: 1,
    minHeight: 160,
    paddingTop: 14,
    paddingBottom: 30,
    paddingHorizontal: 0,
    fontFamily: JournalType.medium,
    fontSize: 16,
    lineHeight: 25,
    includeFontPadding: false,
    color: Finn.ink,
    letterSpacing: -0.2,
  },
});
