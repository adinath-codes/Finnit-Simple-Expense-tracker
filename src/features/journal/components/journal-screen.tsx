import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useIsFocused } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Finn, JournalType } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
import { useSession } from "@/features/auth/providers/session-provider";
import type { ReceiptPhoto } from "@/types/domain";
import { captureReceipt } from "@/features/camera/services/receipt-service";
import { JournalHeader } from "./journal-header";
import { JournalEntryCard } from "./journal-entry-card";
import { JournalComposer } from "./journal-composer";
import { JournalEmptyPrompt } from "./journal-empty-prompt";
import { JournalProcessingStatus } from "./journal-processing-status";
import { loadJournalDrafts, saveJournalDrafts } from "../store/journal-draft-store";

export default function JournalScreen() {
  const {
    entries,
    selectedDate,
    captureNote,
    updateEntry,
    deleteEntry,
    settings,
    mutationError,
    clearMutationError,
    retrySync,
    recentPresetEntryId,
    clearRecentPresetEntry,
  } = useJournal();
  const ownerId = useSession().session?.user.id;
  const screenActive = useIsFocused();
  const [draft, setDraft] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryDraft, setEntryDraft] = useState("");
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [tool, setTool] = useState<"add" | "receipt" | null>(null);
  const input = useRef<TextInput>(null);
  const entryInputs = useRef(new Map<string, TextInput>());
  const lastReturnSubmission = useRef<string | null>(null);
  const submitLock = useRef(false);
  const draftTouchedBeforeLoad = useRef(false);
  const draftOwner = useRef<string | undefined>(undefined);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (draftOwner.current === ownerId) return;
    draftOwner.current = ownerId;
    draftTouchedBeforeLoad.current = false;
    setDraft("");
    setEditDrafts({});
    setDraftLoaded(false);
  }, [ownerId]);
  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    setDraftLoaded(false);
    void loadJournalDrafts(ownerId).then((saved) => {
      if (!active) return;
      if (!draftTouchedBeforeLoad.current) setDraft(saved.composer);
      setEditDrafts(saved.edits);
      setDraftLoaded(true);
    });
    return () => { active = false; };
  }, [ownerId]);
  useEffect(() => {
    if (ownerId && draftLoaded) {
      void saveJournalDrafts(ownerId, { composer: draft, edits: editDrafts });
    }
  }, [draft, draftLoaded, editDrafts, ownerId]);
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
  const submitDraft = useCallback(
    async (submittedDraft: string, dismissKeyboard: boolean) => {
      const note = submittedDraft.trim();
      if (!note || submitLock.current) return;
      submitLock.current = true;
      setSubmitting(true);
      try {
        await captureNote(note, selectedDate);
      } catch {
        submitLock.current = false;
        setSubmitting(false);
        return;
      }
      setDraft((current) => current.trim() === note ? "" : current);
      if (dismissKeyboard) {
        setFocused(false);
        input.current?.blur();
        Keyboard.dismiss();
      } else {
        setFocused(true);
        requestAnimationFrame(() => input.current?.focus());
      }
      submitLock.current = false;
      setSubmitting(false);
      requestAnimationFrame(() => {
        scroll.current?.scrollToEnd({ animated: false });
      });
    },
    [captureNote, selectedDate],
  );
  const submitOnReturn = useCallback(
    (submittedDraft: string) => {
      const note = submittedDraft.trim();
      if (!note || lastReturnSubmission.current === note) return;

      lastReturnSubmission.current = note;
      void submitDraft(note, false);
    },
    [submitDraft],
  );
  const changeDraft = useCallback(
    (nextDraft: string) => {
      draftTouchedBeforeLoad.current = true;
      const [submittedDraft, ...continuation] = nextDraft.split(/\r\n|\r|\n/);
      if (continuation.length === 0) {
        lastReturnSubmission.current = null;
        setDraft(nextDraft);
        return;
      }

      submitOnReturn(submittedDraft);
      const remainingDraft = continuation.join(" ").trimStart();
      // Keep the submitted text durable until local capture completes. A typed
      // continuation takes over the editor without being cleared by that save.
      setDraft(remainingDraft || submittedDraft);
    },
    [submitOnReturn],
  );
  const attachReceiptPhoto = useCallback(
    (receipt: ReceiptPhoto) => {
      setFocused(false);
      setReceiptError(null);
      void captureReceipt(receipt, selectedDate, settings.currency).catch((error) => {
        setReceiptError(
          error instanceof Error ? error.message : "Couldn’t save this receipt on your device.",
        );
      });
      requestAnimationFrame(() => {
        scroll.current?.scrollToEnd({ animated: false });
      });
    },
    [selectedDate, settings.currency],
  );
  const dayEntries = entries.filter((entry) => entry.date === selectedDate);
  const recentPresetVisible = dayEntries.some((entry) => entry.id === recentPresetEntryId);
  useEffect(() => {
    if (!screenActive || !recentPresetEntryId || !recentPresetVisible) return;
    const frame = requestAnimationFrame(() => {
      scroll.current?.scrollToEnd({ animated: false });
      clearRecentPresetEntry();
    });
    return () => cancelAnimationFrame(frame);
  }, [screenActive, recentPresetEntryId, recentPresetVisible, clearRecentPresetEntry]);
  const commitEntryDraft = async (
    entry: (typeof entries)[number],
    nextDraft: string,
  ) => {
    const note = nextDraft.trim();
    if (!note) {
      try { await deleteEntry(entry.id); } catch { return false; }
      return true;
    }

    const sources = entry.sources.map((source) =>
      source.title === "Your original note"
        ? { ...source, detail: note }
        : source,
    );
    if (note !== entry.note) {
      try { await updateEntry({ ...entry, note, sources }); }
      catch { return false; }
    }
    return true;
  };
  const startEditingEntry = (entry: (typeof entries)[number]) => {
    setEditingEntryId(entry.id);
    setEntryDraft(editDrafts[entry.id] ?? entry.note);
  };
  const finishEditingEntry = async (entry: (typeof entries)[number], nextDraft: string) => {
    if (!(await commitEntryDraft(entry, nextDraft))) return false;
    setEditDrafts((current) => {
      const { [entry.id]: _saved, ...remaining } = current;
      return remaining;
    });
    setEditingEntryId((current) =>
      current === entry.id ? null : current,
    );
    return true;
  };
  const changeEntryDraft = (nextDraft: string) => {
    setEntryDraft(nextDraft);
    if (editingEntryId) {
      setEditDrafts((current) => ({ ...current, [editingEntryId]: nextDraft }));
    }
  };
  const setEntryInput = useCallback((entryId: string, input: TextInput | null) => {
    if (input) {
      entryInputs.current.set(entryId, input);
    } else {
      entryInputs.current.delete(entryId);
    }
  }, []);
  const advanceEditingEntry = useCallback(
    (entryId: string) => {
      const currentIndex = dayEntries.findIndex((entry) => entry.id === entryId);
      const nextEntry = currentIndex >= 0
        ? dayEntries.slice(currentIndex + 1).find((entry) => !entry.receipt)
        : undefined;

      if (!nextEntry) {
        setEditingEntryId(null);
        setEntryDraft("");
        requestAnimationFrame(() => input.current?.focus());
        return;
      }

      setEditingEntryId(nextEntry.id);
      setEntryDraft(editDrafts[nextEntry.id] ?? nextEntry.note);
      requestAnimationFrame(() => entryInputs.current.get(nextEntry.id)?.focus());
    },
    [dayEntries, editDrafts],
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
          onContentSizeChange={() => {
            if (focused) scroll.current?.scrollToEnd({ animated: false });
          }}
          showsVerticalScrollIndicator={false}
        >
          {(mutationError || receiptError) && (
            <View accessibilityLiveRegion="polite" style={styles.saveError}>
              <Text style={styles.saveErrorText}>{mutationError ?? receiptError}</Text>
              <Button label="Dismiss save error" onPress={() => {
                clearMutationError();
                setReceiptError(null);
              }}>
                <Text style={styles.saveErrorAction}>Dismiss</Text>
              </Button>
            </View>
          )}
          {dayEntries.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              currency={settings.currency}
              editing={editingEntryId === entry.id}
              draft={editingEntryId === entry.id ? entryDraft : entry.note}
              onStartEditing={() => startEditingEntry(entry)}
              onChangeDraft={changeEntryDraft}
              onCommit={(note) => finishEditingEntry(entry, note)}
              onReturn={advanceEditingEntry}
              inputRef={(node) => setEntryInput(entry.id, node)}
              onRetrySync={() => { void retrySync(entry.id).catch(() => undefined); }}
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
              accessibilityHint="Press Return or tap the green tick to save. Pausing or dismissing the keyboard keeps this draft."
              multiline
              value={draft}
              onChangeText={changeDraft}
              onKeyPress={(event) => {
                if (event.nativeEvent.key === "Enter") submitOnReturn(draft);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                if (Platform.OS !== "web") setFocused(false);
              }}
              style={styles.input}
              textAlignVertical="top"
              selectionColor={Finn.primary}
            />
            {focused && !!draft && (
              <View style={styles.statusSlot}>
                <JournalProcessingStatus
                  phase={submitting ? "organizing" : "thinking"}
                  result={null}
                  idle={!submitting}
                />
                {!submitting && (
                  <Button label="Note options" onPress={() => {
                    Keyboard.dismiss();
                    input.current?.blur();
                    setFocused(false);
                    setTool("add");
                  }} style={styles.noteOptionsButton}>
                    <Text style={styles.noteOptionsText}>···</Text>
                  </Button>
                )}
              </View>
            )}
          </View>
        </ScrollView>
          <JournalComposer
            focused={focused}
            draft={draft}
            submitting={submitting}
            input={input}
            onSave={() => { void submitDraft(draft, true); }}
            onReceiptCaptured={attachReceiptPhoto}
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
  saveError: {
    alignItems: "center",
    backgroundColor: "#FFF4F2",
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  saveErrorText: { color: Finn.danger, flex: 1, fontSize: 12, lineHeight: 17 },
  saveErrorAction: { color: Finn.danger, fontSize: 11, fontWeight: "600" },
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
  noteOptionsText: {
    color: Finn.muted,
    fontSize: 18,
    lineHeight: 24,
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
