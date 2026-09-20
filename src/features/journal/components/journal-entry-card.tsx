import { ZoomLink } from "@/components/navigation/zoom-link";
import { useCallback, useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputSubmitEditingEvent,
  View,
} from "react-native";
import { Button } from "@/components/ui/button";
import { BLUE_SPARKLE_COLORS, Icon } from "@/components/ui/icon";
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
import { ContentFade, MotionLayout } from "@/components/ui/motion";

export function PendingJournalEntryCard({
  note,
  buildResult,
  onCommit,
  autoCommit = true,
  failed = false,
  onRetry,
}: {
  note: string;
  buildResult: (note: string) => PendingEntryResult;
  onCommit?: (result: PendingEntryResult) => void;
  autoCommit?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}) {
  const processing = useJournalEntryProcessing({
    draft: note,
    enabled: false,
    buildResult,
    onCommit: (result) => onCommit?.(result),
    preserveActivePipeline: true,
  });
  const requestManualCommit = processing.requestManualCommit;

  useEffect(() => {
    if (autoCommit) requestManualCommit({ note, dismissKeyboard: false });
  }, [autoCommit, note, requestManualCommit]);

  return (
    <View style={styles.row}>
      <Text style={styles.note}>{note}</Text>
      <View style={[styles.meta, styles.loader]}>
        {failed ? (
          <Button label="Retry saving note" onPress={onRetry} style={styles.retrySave}>
            <Text style={styles.retrySaveText}>Retry save</Text>
          </Button>
        ) : processing.phase === "typing" ? (
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
  onRetrySync,
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
  onRetrySync: () => void;
}) {
  const total = entryTotal(entry);
  const receiptStatus = entry.receipt?.status;
  const detailLabel = receiptStatus
    ? {
        preparing: "Preparing…",
        queued: "Queued",
        scanning: `${entry.items.length} found`,
        needs_review: "Review receipt",
        complete: money(total, currency),
        failed: "Retry scan",
      }[receiptStatus]
    : entry.status === "review"
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
        ...(parsedAmount && !entry.receipt
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
    <MotionLayout style={styles.entry}>
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
        <ZoomLink href={{ pathname: "/entries/[entryId]", params: { entryId: entry.id } }}>
        <Button
          accessibilityHint="Opens the entry details bottom sheet."
          label={`Open ${entry.note}, ${detailLabel}`}
          hitSlop={10}
          style={styles.meta}
        >
          <EntryResult detailLabel={detailLabel} entry={entry} />
        </Button>
        </ZoomLink>
      )}
    </View>
    <EntrySyncStatus entry={entry} onRetry={onRetrySync} />
    {!!entry.receipt && entry.items.length > 0 && (
      <View style={styles.receiptLines}>
        {entry.items.map((item) => (
          <ContentFade key={item.id} style={styles.receiptLine}>
            <View style={styles.receiptDescription}>
              <Text numberOfLines={1} style={styles.receiptName}>
                {item.name}
              </Text>
              {item.needsReview && <View accessibilityLabel="Needs review" style={styles.reviewDot} />}
            </View>
            <Text style={styles.receiptAmount}>
              {money(item.amountMinor * item.quantity, currency)}
            </Text>
          </ContentFade>
        ))}
      </View>
    )}
    </MotionLayout>
  );
}

function EntrySyncStatus({
  entry,
  onRetry,
}: {
  entry: JournalEntry;
  onRetry: () => void;
}) {
  if (!entry.syncState || entry.syncState === "synced") return null;
  if (entry.syncState === "pending") {
    return (
      <View accessible accessibilityLiveRegion="polite" style={styles.syncIssue}>
        <Icon name="refresh" size={11} color={Finn.muted} />
        <Text style={styles.syncPendingText}>Saved locally · waiting to sync</Text>
      </View>
    );
  }
  if (entry.syncIssue === "conflict") {
    return (
      <View accessibilityLiveRegion="polite" style={[styles.syncIssue, styles.syncActionRow]}>
        <JournalGlyph name="sparkle" size={11} color={Finn.amber} />
        <Text style={styles.syncConflictText}>Changed on another device</Text>
        <ZoomLink href={{ pathname: "/entries/[entryId]", params: { entryId: entry.id } }}>
          <Button label={`Resolve sync conflict for ${entry.note}`} style={styles.syncAction}>
            <Text style={styles.syncConflictAction}>Resolve</Text>
          </Button>
        </ZoomLink>
      </View>
    );
  }
  return (
    <View accessibilityLiveRegion="polite" style={[styles.syncIssue, styles.syncActionRow]}>
      <Icon name="offline" size={11} color={Finn.danger} />
      <Text style={styles.syncIssueText}>Sync failed · saved on this device</Text>
      <Button label={`Retry syncing ${entry.note}`} onPress={onRetry} style={styles.syncAction}>
        <Text style={styles.retrySaveText}>Retry</Text>
      </Button>
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
  entry: { width: "100%" },
  syncIssue: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: -7,
    paddingBottom: 8,
  },
  syncIssueText: { color: Finn.danger, fontSize: 10 },
  syncPendingText: { color: Finn.muted, fontSize: 10 },
  syncConflictText: { color: "#A16D20", flex: 1, fontSize: 10 },
  syncConflictAction: { color: "#A16D20", fontSize: 10, fontWeight: "600" },
  syncActionRow: { paddingRight: 2 },
  syncAction: { minHeight: 28, paddingHorizontal: 7 },
  retrySave: { minHeight: 30, paddingHorizontal: 8 },
  retrySaveText: { color: Finn.danger, fontSize: 10, fontWeight: "600" },
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
  receiptLines: {
    borderLeftColor: Finn.line,
    borderLeftWidth: StyleSheet.hairlineWidth,
    gap: 5,
    marginBottom: 8,
    marginLeft: 4,
    paddingLeft: 12,
  },
  receiptLine: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 23,
  },
  receiptDescription: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 7,
    paddingRight: 12,
  },
  receiptName: {
    color: Finn.secondary,
    flexShrink: 1,
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  receiptAmount: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    lineHeight: 18,
  },
  reviewDot: {
    backgroundColor: Finn.amber,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
});
