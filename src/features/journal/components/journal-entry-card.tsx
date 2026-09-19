import { useCallback, useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputSubmitEditingEvent,
  View,
} from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { BLUE_SPARKLE_COLORS } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { JournalGlyph } from "./journal-glyph";
import type { JournalEntry } from "@/types/domain";
import { money } from "@/utils/currency";
import { amountFromNote, entryTotal } from "@/utils/amounts";
import {
  useJournalEntryProcessing,
  type PendingEntryResult,
} from "../hooks/use-journal-entry-processing";
import {
  JournalProcessingDots,
  JournalProcessingStatus,
} from "./journal-processing-status";

export function PendingJournalEntryCard({
  note,
  buildResult,
  onCommit,
}: {
  note: string;
  buildResult: (note: string) => PendingEntryResult;
  onCommit: (result: PendingEntryResult) => void;
}) {
  const processing = useJournalEntryProcessing({
    draft: note,
    enabled: false,
    buildResult,
    onCommit: (result) => onCommit(result),
    preserveActivePipeline: true,
  });

  useEffect(() => {
    processing.requestManualCommit({ note, dismissKeyboard: false });
  }, [note, processing.requestManualCommit]);

  return (
    <View style={styles.row}>
      <Text style={styles.note}>{note}</Text>
      <View style={[styles.meta, styles.loader]}>
        {processing.phase === "typing" ? (
          <JournalProcessingDots />
        ) : (
          <JournalProcessingStatus
            phase={processing.phase}
            result={processing.pendingResult}
          />
        )}
      </View>
    </View>
  );
}

export function JournalEntryCard({
  entry,
  currency,
  editing,
  draft,
  processingDraft,
  onStartEditing,
  onChangeDraft,
  onCommit,
  onProcessedCommit,
  onProcessingStarted,
  onReturn,
  inputRef,
}: {
  entry: JournalEntry;
  currency: string;
  editing: boolean;
  draft: string;
  processingDraft: string | null;
  onStartEditing: () => void;
  onChangeDraft: (draft: string) => void;
  onCommit: () => void;
  onProcessedCommit: (entry: JournalEntry, finishEditing: boolean) => void;
  onProcessingStarted: (entryId: string, draft: string) => void;
  onReturn: (entryId: string) => void;
  inputRef: (input: TextInput | null) => void;
}) {
  const total = entryTotal(entry);
  const detailLabel = entry.status === "review"
    ? total
      ? "Review split"
      : "Add amount"
    : money(total, currency);
  const activeDraft = editing ? draft : processingDraft ?? entry.note;
  const hasDraftChanges = activeDraft !== entry.note;
  const buildPendingEntry = useCallback(
    (note: string): PendingEntryResult => {
      const trimmedNote = note.trim();
      const parsedAmount = amountFromNote(trimmedNote);
      const sources = entry.sources.map((source) =>
        source.title === "Your original note"
          ? { ...source, detail: trimmedNote }
          : source,
      );
      const nextEntry: JournalEntry = {
        ...entry,
        note: trimmedNote,
        sources,
        ...(parsedAmount
          ? {
              status: "ready" as const,
              items: [
                {
                  id: entry.items[0]?.id ?? `${entry.id}-item`,
                  name: trimmedNote,
                  quantity: 1,
                  amountMinor: parsedAmount,
                  category: entry.category,
                },
              ],
            }
          : {}),
      };
      const nextTotal = entryTotal(nextEntry);
      const review = nextEntry.status === "review";
      return {
        entry: nextEntry,
        resultLabel: review
          ? nextTotal
            ? "Review split"
            : "Add amount"
          : money(nextTotal, currency),
        review,
        sourceCount: nextEntry.sources.length,
      };
    },
    [currency, entry],
  );
  const commitProcessedEntry = useCallback(
    (
      result: PendingEntryResult,
      { dismissKeyboard }: { dismissKeyboard: boolean },
    ) => onProcessedCommit(result.entry, dismissKeyboard),
    [onProcessedCommit],
  );
  const processing = useJournalEntryProcessing({
    draft: activeDraft,
    enabled: editing && hasDraftChanges,
    buildResult: buildPendingEntry,
    onCommit: commitProcessedEntry,
    preserveActivePipeline: true,
  });
  const handleBlur = () => {
    if (
      !activeDraft.trim() ||
      (processing.phase === "typing" && activeDraft.trim() === entry.note)
    ) {
      onCommit();
      return;
    }
    if (processing.requestManualCommit({ note: activeDraft })) {
      onProcessingStarted(entry.id, activeDraft);
    }
  };
  const handleSubmit = (event: TextInputSubmitEditingEvent) => {
    const submittedDraft = event.nativeEvent.text;
    if (submittedDraft !== draft) onChangeDraft(submittedDraft);

    if (
      submittedDraft.trim() &&
      submittedDraft !== entry.note &&
      processing.requestManualCommit({
        note: submittedDraft,
        dismissKeyboard: false,
      })
    ) {
      onProcessingStarted(entry.id, submittedDraft);
    }

    onReturn(entry.id);
  };

  return (
    <View style={styles.row}>
      {editing ? (
        <TextInput
          ref={inputRef}
          accessibilityLabel={`Edit ${entry.note}`}
          autoFocus
          multiline
          onBlur={handleBlur}
          onChangeText={onChangeDraft}
          onSubmitEditing={handleSubmit}
          scrollEnabled={false}
          selectionColor={Finn.primary}
          submitBehavior="submit"
          style={[styles.note, styles.input]}
          textAlignVertical="top"
          value={draft}
        />
      ) : (
        <Pressable
          accessibilityHint="Edits this entry directly in the journal."
          accessibilityLabel={`Edit ${entry.note}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onStartEditing}
          pressRetentionOffset={16}
          style={({ pressed }) => [
            styles.noteControl,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.note}>{entry.note}</Text>
        </Pressable>
      )}

      {editing ? (
        <View style={[styles.meta, styles.loader]}>
          {!hasDraftChanges ? (
            <EntryResult
              detailLabel={detailLabel}
              entry={entry}
            />
          ) : processing.phase === "typing" ? (
            <JournalProcessingDots />
          ) : (
            <JournalProcessingStatus
              phase={processing.phase}
              result={processing.pendingResult}
            />
          )}
        </View>
      ) : processingDraft !== null && processing.phase !== "typing" ? (
        <View style={[styles.meta, styles.loader]}>
          <JournalProcessingStatus
            phase={processing.phase}
            result={processing.pendingResult}
          />
        </View>
      ) : (
        <Button
          accessibilityHint="Opens the entry details bottom sheet."
          label={`Open ${entry.note}, ${detailLabel}`}
          hitSlop={10}
          onPress={() =>
            router.push({
              pathname: "/entries/[entryId]",
              params: { entryId: entry.id },
            })
          }
          style={styles.meta}
        >
          <EntryResult detailLabel={detailLabel} entry={entry} />
        </Button>
      )}
    </View>
  );
}

function EntryResult({
  detailLabel,
  entry,
}: {
  detailLabel: string;
  entry: JournalEntry;
}) {
  if (entry.status === "review") {
    return (
      <>
        <JournalGlyph name="sparkle" size={12} color={Finn.amber} />
        <Text style={styles.review}>{detailLabel}</Text>
      </>
    );
  }

  return (
    <>
      {entry.id === "groceries" && (
        <JournalGlyph
          name="sparkle"
          size={12}
          colors={BLUE_SPARKLE_COLORS}
        />
      )}
      <Text
        style={[
          styles.amount,
          entry.id === "groceries" && { color: Finn.blue },
        ]}
      >
        {detailLabel}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    minHeight: 53,
  },
  noteControl: {
    flex: 1,
  },
  note: {
    fontFamily: JournalType.medium,
    fontSize: 16,
    lineHeight: 25,
    includeFontPadding: false,
    color: Finn.ink,
    letterSpacing: -0.2,
  },
  input: {
    flex: 1,
    margin: 0,
    minHeight: 25,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  meta: {
    width: 112,
    minHeight: 25,
    paddingTop: 3,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 4,
    alignItems: "center",
  },
  loader: {
    alignSelf: "flex-start",
  },
  pressed: {
    opacity: 0.65,
  },
  amount: {
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 19,
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
    color: Finn.secondary,
  },
  review: {
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 19,
    includeFontPadding: false,
    color: Finn.secondary,
  },
});
