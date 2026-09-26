import { ZoomLink } from "@/components/navigation/zoom-link";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "@/components/ui/button";
import { BLUE_SPARKLE_COLORS, Icon } from "@/components/ui/icon";
import { Motion } from "@/constants/motion";
import { Finn, JournalType } from "@/constants/theme";
import { JournalGlyph } from "./journal-glyph";
import type { JournalEntry } from "@/types/domain";
import { money } from "@/utils/currency";
import { entryDisplayAmount, entryTotal } from "@/utils/amounts";
import { receiptDisplayTotal } from "@/features/journal/services/journal-adapter";
import { JournalProcessingStatus } from "./journal-processing-status";
import { MotionLayout } from "@/components/ui/motion";
import { MagicTypeText } from "@/components/ui/magic-type-text";

export function JournalEntryCard({
  entry,
  currency,
  editing,
  draft,
  onStartEditing,
  onChangeDraft,
  onRequestFinish,
  onEditBlur,
  onPrepareDelete,
  onRequestDelete,
  inputRef,
  editBusy = false,
  magicType = false,
  onMagicTypeComplete,
}: {
  entry: JournalEntry;
  currency: string;
  editing: boolean;
  draft: string;
  onStartEditing: () => void;
  onChangeDraft: (draft: string) => void;
  onRequestFinish: (advance: boolean) => void;
  onEditBlur: () => void;
  onPrepareDelete: () => void;
  onRequestDelete: () => void;
  inputRef: (input: TextInput | null) => void;
  editBusy?: boolean;
  magicType?: boolean;
  onMagicTypeComplete?: () => void;
}) {
  const total = entryTotal(entry);
  const mixedCurrencies = new Set(entry.items.map((item) => item.currency ?? currency)).size > 1;
  const displayAmount = entryDisplayAmount(entry, currency);
  const receiptStatus = entry.receipt?.status;
  const receiptTotal = receiptDisplayTotal(entry, currency);
  const detailLabel = receiptStatus
    ? {
        preparing: "Preparing…",
        queued: "Queued",
        scanning: `${entry.items.length} found`,
        needs_review: receiptTotal
          ? money(receiptTotal.amountMinor, receiptTotal.currency, currency)
          : "Review receipt",
        complete: receiptTotal
          ? money(receiptTotal.amountMinor, receiptTotal.currency, currency)
          : "Add amount",
        failed: "Retry scan",
      }[receiptStatus]
    : displayAmount
      ? `${displayAmount.scope === "group_total" ? "Group · " : ""}${displayAmount.provisional ? "≈" : ""}${money(displayAmount.amountMinor, displayAmount.currency, currency)}`
    : entry.syncState === "blocked"
      ? "Needs attention"
    : entry.syncState === "pending" && entry.syncError
      ? "Retry queued"
    : entry.syncState === "pending" && total === 0
      ? "Parsing…"
    : total === 0
      ? "Add amount"
    : mixedCurrencies
      ? "Mixed currencies"
      : money(total, currency);
  return (
    <MotionLayout style={styles.entry}>
    <View style={styles.row}>
      <View style={styles.noteRow}>
        {entry.syncIssue === "failed" && (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.retryIndicator}
          >
            <Icon
              animation={false}
              name="refresh"
              size={14}
              color={Finn.secondary}
            />
          </View>
        )}
        {editing && !entry.receipt ? (
          <TextInput
            ref={inputRef}
            accessibilityLabel={`Edit ${entry.note}`}
            autoFocus
            editable={!editBusy}
            multiline
            onBlur={onEditBlur}
            onChangeText={onChangeDraft}
            onSubmitEditing={() => onRequestFinish(true)}
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
            <MagicTypeText
              key={magicType ? "typing" : "static"}
              enabled={magicType}
              onComplete={magicType ? onMagicTypeComplete : undefined}
              style={styles.note}
            >
              {entry.note}
            </MagicTypeText>
          </Pressable>
        )}
      </View>

      {editing && !entry.receipt ? (
        <View style={styles.meta}>
          <Button
            disabled={editBusy}
            label={`Delete ${entry.note}`}
            onPress={onRequestDelete}
            onPressIn={onPrepareDelete}
            style={styles.deleteButton}
          >
            <Icon animation={false} name="trash" size={20} color={Finn.destructive} />
          </Button>
        </View>
      ) : (
        <ZoomLink href={{ pathname: "/entries/[entryId]", params: { entryId: entry.id } }}>
        <Button
          accessibilityHint="Opens the entry details bottom sheet."
          label={`Open ${entry.note}, ${detailLabel}`}
          hitSlop={10}
          style={styles.meta}
        >
          <EntryResult
            currency={currency}
            detailLabel={detailLabel}
            entry={entry}
            hasResolvedAmount={entry.receipt
              ? receiptStatus === "complete" || receiptStatus === "needs_review"
              : !!displayAmount && !displayAmount.provisional}
          />
        </Button>
        </ZoomLink>
      )}
    </View>
    <EntrySyncStatus entry={entry} />
    </MotionLayout>
  );
}

function EntrySyncStatus({
  entry,
}: {
  entry: JournalEntry;
}) {
  if (entry.syncIssue !== "conflict") return null;
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

function EntryResult({
  currency,
  detailLabel,
  entry,
  hasResolvedAmount,
}: {
  currency: string;
  detailLabel: string;
  entry: JournalEntry;
  hasResolvedAmount: boolean;
}) {
  const total = entryTotal(entry);
  const provisional = !entry.receipt && !!entry.amountPreview;
  const receiptProcessing = entry.receipt?.status === "preparing" ||
    entry.receipt?.status === "scanning";
  const pendingProcessing = receiptProcessing ||
    (!entry.receipt && entry.syncState === "pending" &&
      total === 0 && !provisional && !entry.syncError);
  const wasPending = useRef(pendingProcessing);
  const [presentation, setPresentation] = useState<
    "processing" | "preview" | "result" | "settling" | "settled"
  >(pendingProcessing ? "processing" : "settled");

  useEffect(() => {
    if (pendingProcessing) {
      wasPending.current = true;
      setPresentation("processing");
      return;
    }
    if (provisional) {
      wasPending.current = true;
      setPresentation("preview");
      return;
    }
    if (!wasPending.current) {
      setPresentation("settled");
      return;
    }

    if (!hasResolvedAmount) {
      wasPending.current = false;
      setPresentation("settled");
      return;
    }

    setPresentation("result");
    let finish: ReturnType<typeof setTimeout> | undefined;
    const settle = setTimeout(
      () => {
        setPresentation("settling");
        finish = setTimeout(() => {
          wasPending.current = false;
          setPresentation("settled");
        }, Motion.resultSettle + 50);
      },
      Motion.resultHold,
    );
    return () => {
      clearTimeout(settle);
      if (finish) clearTimeout(finish);
    };
  }, [hasResolvedAmount, pendingProcessing, provisional]);

  if (presentation === "processing") {
    return (
      <JournalProcessingStatus
        phase="thinking"
        result={null}
        variant={entry.receipt ? "receipt" : "text"}
      />
    );
  }

  if (presentation === "preview" || presentation === "result" || presentation === "settling") {
    const preview = entry.amountPreview;
    const accessibleAmount = preview
      ? `${money(preview.amountMinor, preview.currency, currency)}. ${preview.scope === "group_total" ? "Your share is still processing." : "Breakdown still processing."}`
      : `${detailLabel}. ${entry.status === "review" ? "Review required." : "Confirmed."}`;
    return (
      <JournalProcessingStatus
        phase={presentation}
        result={{
          resultLabel: detailLabel,
          review: preview?.needsReview ?? entry.status === "review",
          provisional: !!preview,
          accessibilityLabel: preview
            ? `Estimated ${preview.scope === "group_total" ? "group total" : "total"} ${accessibleAmount}`
            : accessibleAmount,
        }}
      />
    );
  }

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
  syncConflictText: { color: "#A16D20", flex: 1, fontSize: 10 },
  syncConflictAction: { color: "#A16D20", fontSize: 10, fontWeight: "600" },
  syncActionRow: { paddingRight: 2 },
  syncAction: { minHeight: 28, paddingHorizontal: 7 },
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
  noteRow: {
    alignItems: "flex-start",
    flex: 1,
    flexDirection: "row",
    gap: 7,
  },
  retryIndicator: {
    marginTop: 5,
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
  deleteButton: {
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
