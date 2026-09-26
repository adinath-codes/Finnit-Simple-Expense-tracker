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
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { Finn, JournalType } from "@/constants/theme";
import {
  useJournalActions,
  useJournalData,
  useJournalStatus,
} from "@/providers/app-providers";
import { useSession } from "@/features/auth/providers/session-provider";
import type { JournalEntry, ReceiptPhoto } from "@/types/domain";
import { captureReceipt } from "@/features/camera/services/receipt-service";
import { JournalHeader } from "./journal-header";
import { JournalEntryCard } from "./journal-entry-card";
import { JournalComposer } from "./journal-composer";
import {
  JournalEntryConfirmationModal,
  type JournalEntryConfirmationKind,
} from "./journal-entry-confirmation-modal";
import { JournalEmptyPrompt } from "./journal-empty-prompt";
import {
  JournalProcessingDots,
  JournalProcessingStatus,
} from "./journal-processing-status";
import { loadJournalDrafts, saveJournalDrafts } from "../store/journal-draft-store";
import {
  classifyJournalEdit,
  type EntryTextSaveMode,
} from "../services/journal-edit-flow";

type EditContinuation =
  | { kind: "none" }
  | { kind: "entry"; entryId: string }
  | { kind: "composer" };

type EditPrompt = {
  kind: JournalEntryConfirmationKind;
  entryId: string;
  draft: string;
};

export default function JournalScreen() {
  const { entries, selectedDate, settings, recentPresetEntryId } = useJournalData();
  const {
    captureNote,
    saveEntryText,
    deleteEntry,
    clearMutationError,
    clearRecentPresetEntry,
  } = useJournalActions();
  const { mutationError, journalLoading } = useJournalStatus();
  const ownerId = useSession().session?.user.id;
  const screenActive = useIsFocused();
  const [draft, setDraft] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryDraft, setEntryDraft] = useState("");
  const [editPrompt, setEditPrompt] = useState<EditPrompt | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [tool, setTool] = useState<"add" | "receipt" | null>(null);
  const input = useRef<TextInput>(null);
  const entryInputs = useRef(new Map<string, TextInput>());
  const editingEntryIdRef = useRef<string | null>(null);
  const entryDraftRef = useRef("");
  const editPromptRef = useRef<EditPrompt | null>(null);
  const editContinuation = useRef<EditContinuation>({ kind: "none" });
  const editResolutionLock = useRef(false);
  const suppressEditBlur = useRef(false);
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
  useFocusEffect(
    useCallback(
      () => {
        suppressEditBlur.current = false;
        return () => {
          suppressEditBlur.current = true;
          setFocused(false);
          Keyboard.dismiss();
        };
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
    });
    return () => cancelAnimationFrame(frame);
  }, [screenActive, recentPresetEntryId, recentPresetVisible]);
  const clearStoredEdit = useCallback((entryId: string) => {
    setEditDrafts((current) => {
      const { [entryId]: _saved, ...remaining } = current;
      return remaining;
    });
  }, []);
  const beginEditingEntry = useCallback((entry: JournalEntry) => {
    const nextDraft = editDrafts[entry.id] ?? entry.note;
    suppressEditBlur.current = false;
    editingEntryIdRef.current = entry.id;
    entryDraftRef.current = nextDraft;
    setEditingEntryId(entry.id);
    setEntryDraft(nextDraft);
    requestAnimationFrame(() => entryInputs.current.get(entry.id)?.focus());
  }, [editDrafts]);
  const finishEditState = useCallback((entryId: string) => {
    clearStoredEdit(entryId);
    if (editingEntryIdRef.current === entryId) {
      editingEntryIdRef.current = null;
      entryDraftRef.current = "";
      setEditingEntryId(null);
      setEntryDraft("");
    }
  }, [clearStoredEdit]);
  const runEditContinuation = useCallback((continuation: EditContinuation) => {
    if (continuation.kind === "entry") {
      const nextEntry = dayEntries.find((entry) => entry.id === continuation.entryId);
      if (nextEntry && !nextEntry.receipt) beginEditingEntry(nextEntry);
      return;
    }
    if (continuation.kind === "composer") {
      setFocused(true);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [beginEditingEntry, dayEntries]);
  const requestEditResolution = useCallback((continuation: EditContinuation) => {
    if (
      editPromptRef.current ||
      suppressEditBlur.current ||
      editResolutionLock.current
    ) {
      if (continuation.kind !== "none") editContinuation.current = continuation;
      return;
    }

    const entryId = editingEntryIdRef.current;
    if (!entryId) {
      runEditContinuation(continuation);
      return;
    }
    const entry = dayEntries.find((candidate) => candidate.id === entryId);
    if (!entry) {
      finishEditState(entryId);
      runEditContinuation(continuation);
      return;
    }

    editContinuation.current = continuation;
    const nextDraft = entryDraftRef.current;
    const change = classifyJournalEdit(entry.note, nextDraft);
    if (change === "unchanged") {
      finishEditState(entryId);
      runEditContinuation(continuation);
      return;
    }

    const prompt: EditPrompt = {
      kind: change === "delete" ? "delete" : "recalculate",
      entryId,
      draft: nextDraft,
    };
    suppressEditBlur.current = true;
    editPromptRef.current = prompt;
    setEditPrompt(prompt);
    entryInputs.current.get(entryId)?.blur();
    Keyboard.dismiss();
  }, [dayEntries, finishEditState, runEditContinuation]);
  const startEditingEntry = useCallback((entry: JournalEntry) => {
    const currentId = editingEntryIdRef.current;
    if (!currentId) {
      beginEditingEntry(entry);
      return;
    }
    if (currentId === entry.id) {
      entryInputs.current.get(entry.id)?.focus();
      return;
    }
    requestEditResolution({ kind: "entry", entryId: entry.id });
  }, [beginEditingEntry, requestEditResolution]);
  const changeEntryDraft = (nextDraft: string) => {
    entryDraftRef.current = nextDraft;
    setEntryDraft(nextDraft);
    const entryId = editingEntryIdRef.current;
    if (entryId) {
      setEditDrafts((current) => ({ ...current, [entryId]: nextDraft }));
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
        requestEditResolution({ kind: "composer" });
        return;
      }
      requestEditResolution({ kind: "entry", entryId: nextEntry.id });
    },
    [dayEntries, requestEditResolution],
  );
  const showDeletePrompt = useCallback((entry: JournalEntry) => {
    if (editPromptRef.current || editResolutionLock.current) return;
    const prompt: EditPrompt = {
      kind: "delete",
      entryId: entry.id,
      draft: entryDraftRef.current,
    };
    editContinuation.current = { kind: "none" };
    suppressEditBlur.current = true;
    editPromptRef.current = prompt;
    setEditPrompt(prompt);
    entryInputs.current.get(entry.id)?.blur();
    Keyboard.dismiss();
  }, []);
  const dismissEditPrompt = useCallback(() => {
    if (editResolutionLock.current) return;
    const entryId = editPromptRef.current?.entryId;
    editPromptRef.current = null;
    editContinuation.current = { kind: "none" };
    suppressEditBlur.current = false;
    setEditPrompt(null);
    if (entryId) {
      requestAnimationFrame(() => entryInputs.current.get(entryId)?.focus());
    }
  }, []);
  const applyEditPrompt = useCallback(async (mode?: EntryTextSaveMode) => {
    const prompt = editPromptRef.current;
    if (!prompt || editResolutionLock.current) return;
    editResolutionLock.current = true;
    setEditSaving(true);
    try {
      if (prompt.kind === "delete") {
        await deleteEntry(prompt.entryId);
      } else if (mode) {
        await saveEntryText(prompt.entryId, prompt.draft, mode);
      } else {
        throw new Error("Choose how Finn should save this edit.");
      }
    } catch {
      editResolutionLock.current = false;
      editPromptRef.current = null;
      editContinuation.current = { kind: "none" };
      suppressEditBlur.current = false;
      setEditSaving(false);
      setEditPrompt(null);
      requestAnimationFrame(() => entryInputs.current.get(prompt.entryId)?.focus());
      return;
    }

    const continuation = editContinuation.current;
    editResolutionLock.current = false;
    editPromptRef.current = null;
    editContinuation.current = { kind: "none" };
    suppressEditBlur.current = false;
    setEditSaving(false);
    setEditPrompt(null);
    finishEditState(prompt.entryId);
    requestAnimationFrame(() => runEditContinuation(continuation));
  }, [deleteEntry, finishEditState, runEditContinuation, saveEntryText]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const hidden = Keyboard.addListener("keyboardDidHide", () => {
      setFocused(false);
      input.current?.blur();
      requestEditResolution({ kind: "none" });
    });
    return () => hidden.remove();
  }, [requestEditResolution]);
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
          {journalLoading ? (
            <LoadingState
              variant="journal"
              label="Restoring your journal entries…"
              active={screenActive}
            />
          ) : (
            dayEntries.map((entry) => (
              <JournalEntryCard
                key={entry.id}
                entry={entry}
                currency={settings.currency}
                editing={editingEntryId === entry.id}
                draft={editingEntryId === entry.id ? entryDraft : entry.note}
                onStartEditing={() => startEditingEntry(entry)}
                onChangeDraft={changeEntryDraft}
                onRequestFinish={(advance) => {
                  if (advance) advanceEditingEntry(entry.id);
                  else requestEditResolution({ kind: "none" });
                }}
                onEditBlur={() => requestEditResolution({ kind: "none" })}
                onPrepareDelete={() => showDeletePrompt(entry)}
                onRequestDelete={() => showDeletePrompt(entry)}
                inputRef={(node) => setEntryInput(entry.id, node)}
                editBusy={editSaving && editPrompt?.entryId === entry.id}
                magicType={screenActive && entry.id === recentPresetEntryId}
                onMagicTypeComplete={clearRecentPresetEntry}
              />
            ))
          )}
          <View style={styles.editor}>
            {!journalLoading && dayEntries.length === 0 && draft.length === 0 && !focused && (
              <JournalEmptyPrompt
                key={selectedDate}
                currency={settings.currency}
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
              onFocus={() => {
                if (editingEntryIdRef.current) {
                  requestEditResolution({ kind: "composer" });
                  input.current?.blur();
                  return;
                }
                setFocused(true);
              }}
              onBlur={() => {
                if (Platform.OS !== "web") setFocused(false);
              }}
              style={styles.input}
              textAlignVertical="top"
              selectionColor={Finn.primary}
            />
            {focused && !!draft && (
              <View style={styles.statusSlot}>
                {submitting ? (
                  <JournalProcessingStatus phase="organizing" result={null} />
                ) : (
                  <Button label="Note options" onPress={() => {
                    Keyboard.dismiss();
                    input.current?.blur();
                    setFocused(false);
                    setTool("add");
                  }} style={styles.noteOptionsButton}>
                    <JournalProcessingDots decorative />
                  </Button>
                )}
              </View>
            )}
          </View>
        </ScrollView>
          <JournalComposer
            focused={focused || !!editingEntryId}
            draft={draft}
            saveValue={editingEntryId ? entryDraft : draft}
            saveLabel={editingEntryId ? "Review edited note" : "Save note"}
            editingEntry={!!editingEntryId}
            submitting={submitting || editSaving}
            input={input}
            onSave={() => {
              if (editingEntryIdRef.current) {
                requestEditResolution({ kind: "none" });
              } else {
                void submitDraft(draft, true);
              }
            }}
            onReceiptCaptured={attachReceiptPhoto}
            onDismiss={() => setFocused(false)}
            tool={tool}
            setTool={setTool}
          />
        </KeyboardAvoidingView>
        <JournalEntryConfirmationModal
          kind={editPrompt?.kind ?? null}
          busy={editSaving}
          onDismiss={dismissEditPrompt}
          onRecalculate={() => { void applyEditPrompt("recalculate"); }}
          onPreserve={() => { void applyEditPrompt("preserve"); }}
          onDelete={() => { void applyEditPrompt(); }}
        />
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
