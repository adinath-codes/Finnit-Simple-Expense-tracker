import { ZoomLink } from "@/components/navigation/zoom-link";
import { useState } from "react";
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
import { entryTotal } from "@/utils/amounts";
import { receiptDisplayTotal } from "@/features/journal/services/journal-adapter";
import { JournalProcessingStatus } from "./journal-processing-status";
import { MotionLayout } from "@/components/ui/motion";

export function JournalEntryCard({
  entry,
  currency,
  editing,
  draft,
  onStartEditing,
  onChangeDraft,
  onCommit,
  onReturn,
  inputRef,
  onRetrySync,
}: {
  entry: JournalEntry;
  currency: string;
  editing: boolean;
  draft: string;
  onStartEditing: () => void;
  onChangeDraft: (draft: string) => void;
  onCommit: (draft: string) => Promise<boolean>;
  onReturn: (entryId: string) => void;
  inputRef: (input: TextInput | null) => void;
  onRetrySync: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const total = entryTotal(entry);
  const mixedCurrencies = new Set(entry.items.map((item) => item.currency ?? currency)).size > 1;
  const receiptStatus = entry.receipt?.status;
  const receiptTotal = receiptDisplayTotal(entry, currency);
  const detailLabel = receiptStatus
    ? {
        preparing: "Preparing…",
        queued: "Queued",
        scanning: `${entry.items.length} found`,
        needs_review: receiptTotal
          ? money(receiptTotal.amountMinor, receiptTotal.currency)
          : "Review receipt",
        complete: receiptTotal
          ? money(receiptTotal.amountMinor, receiptTotal.currency)
          : "Add amount",
        failed: "Retry scan",
      }[receiptStatus]
    : entry.syncState === "pending" && total === 0
      ? "Parsing…"
    : mixedCurrencies
      ? "Mixed currencies"
    : entry.status === "review" && total === 0
      ? "Add amount"
      : money(total, currency);
  const commit = async (note: string, advance: boolean) => {
    if (saving) return;
    setSaving(true);
    const saved = await onCommit(note);
    setSaving(false);
    if (saved && advance) onReturn(entry.id);
  };
  const handleSubmit = (event: TextInputSubmitEditingEvent) => {
    const submittedDraft = event.nativeEvent.text;
    if (submittedDraft !== draft) onChangeDraft(submittedDraft);
    void commit(submittedDraft, true);
  };

  return (
    <MotionLayout style={styles.entry}>
    <View style={styles.row}>
      {editing && !entry.receipt ? (
        <TextInput
          ref={inputRef}
          accessibilityLabel={`Edit ${entry.note}`}
          autoFocus
          multiline
          onChangeText={onChangeDraft}
          onSubmitEditing={handleSubmit}
          scrollEnabled={false}
          selectionColor={Finn.primary}
          submitBehavior="submit"
          style={[styles.note, styles.input]}
          textAlignVertical="top"
          value={draft}
        />
      ) : entry.receipt ? (
        <View style={styles.noteControl}>
          <Text ellipsizeMode="tail" numberOfLines={1} style={styles.note}>
            {entry.note}
          </Text>
        </View>
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

      {editing && !entry.receipt ? (
        <View style={[styles.meta, styles.loader]}>
          {saving ? (
            <JournalProcessingStatus
              phase="organizing"
              result={null}
            />
          ) : (
            <Button label={`Save edited note ${entry.note}`} onPress={() => {
              void commit(draft, false);
            }} style={styles.editDone}>
              <Icon name="check" size={19} color={Finn.primary} />
            </Button>
          )}
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
  editDone: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
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
