import { ContentFade } from "@/components/ui/motion";
import { Fragment, useState } from "react";
import { Alert, Keyboard, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import {
  AppSheet,
  SectionLabel,
  sheetStyles as shared,
  closeSheet,
} from "@/components/sheets/app-sheet";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
import type { EntryAllocationRow, EntryAmountTerm } from "@/types/domain";
import { entryTotal } from "@/utils/amounts";
import { currencySymbol, moneyValue } from "@/utils/currency";
import { TransactionBreakdown } from "./transaction-breakdown";
import { ReceiptPreview } from "./receipt-preview";
import { retryReceipt } from "@/features/camera/services/receipt-service";
import { FinnCorrectionComposer } from "./finn-correction-composer";
import { useSession } from "@/features/auth/providers/session-provider";
import { amountBreakdownText } from "@/features/entries/services/breakdown-service";

const BANKNOTE_GREEN = "#20C878";

export default function EntryDetailSheet() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const {
    entries,
    updateEntry,
    savePreset,
    deleteEntry,
    settings,
    mutationError,
    clearMutationError,
    retrySync,
    keepLocalVersion,
    acceptRemoteVersion,
    askFinnToCorrectEntry,
  } = useJournal();
  const { session } = useSession();
  const entry = entries.find((item) => item.id === entryId);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(
    entry?.receipt ? entry.merchant : entry?.note ?? "",
  );
  const [saved, setSaved] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    kind: "note" | "merchant" | "shortcut";
    trigger: number;
  } | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [printedTotal, setPrintedTotal] = useState(
    entry?.receipt?.printedTotalMinor == null
      ? ""
      : String(entry.receipt.printedTotalMinor / 100),
  );
  const [receiptActionError, setReceiptActionError] = useState<string | null>(null);
  const [syncAction, setSyncAction] = useState<"retry" | "keep" | "remote" | null>(null);

  if (!entry) {
    return (
      <AppSheet title="Entry details">
        <Text style={shared.text}>This entry is no longer here.</Text>
      </AppSheet>
    );
  }

  const total = entryTotal(entry);
  const mixedCurrencies = new Set(entry.items.map((item) => item.currency ?? settings.currency)).size > 1;
  const saveEditedNote = async () => {
    const value = note.trim();
    if (entry.receipt || value) {
      try {
        await updateEntry(entry.receipt
          ? { ...entry, merchant: value }
          : { ...entry, note: value });
      }
      catch { return; }
      setConfirmation((current) => ({
        kind: entry.receipt ? "merchant" : "note",
        trigger: (current?.trigger ?? 0) + 1,
      }));
    }
    setEditing(false);
  };
  const runSyncAction = async (action: "retry" | "keep" | "remote") => {
    if (syncAction) return;
    setSyncAction(action);
    setReceiptActionError(null);
    try {
      if (action === "retry") await retrySync(entry.id);
      else if (action === "keep") await keepLocalVersion(entry.id);
      else await acceptRemoteVersion(entry.id);
    } catch {
      return;
    } finally {
      setSyncAction(null);
    }
  };
  const confirmUseRemoteVersion = () => {
    const accept = () => { void runSyncAction("remote"); };
    if (Platform.OS === "web") {
      if (window.confirm("Replace this device’s unsynced changes with the latest synced version?")) accept();
      return;
    }
    Alert.alert(
      "Use the synced version?",
      "This replaces the unsynced changes on this device. Your latest synced entry will remain.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Use synced version", style: "destructive", onPress: accept },
      ],
    );
  };

  return (
    <AppSheet
      title="Entry Details"
      headerLayout="leading"
      headerScrollable
      bodyStyle={styles.body}
      stickyFooter={correctionOpen}
      footer={correctionOpen ? (
        <FinnCorrectionComposer
          disabled={entry.syncState === "pending"}
          onSubmit={async (instruction) => {
            await askFinnToCorrectEntry(entry.id, instruction);
            setCorrectionOpen(false);
            Keyboard.dismiss();
          }}
        />
      ) : undefined}
      right={
        <View style={styles.headerActions}>
          <IconButton
            name={editing ? "check" : "more"}
            label={editing
              ? entry.receipt ? "Save receipt merchant" : "Save entry text"
              : "Entry actions"}
            onPress={async () => {
              if (editing) void saveEditedNote();
              else setActionsOpen((open) => !open);
            }}
          />
          <IconButton
            name="close"
            label="Close entry details"
            onPress={closeSheet}
          />
        </View>
      }
    >
      {(mutationError || receiptActionError) && (
        <View accessibilityLiveRegion="polite" style={[shared.card, styles.saveError]}>
          <Text style={styles.saveErrorText}>{mutationError ?? receiptActionError}</Text>
          <Button label="Dismiss entry error" onPress={() => {
            clearMutationError();
            setReceiptActionError(null);
          }}>
            <Text style={styles.saveErrorAction}>Dismiss</Text>
          </Button>
        </View>
      )}
      {confirmation && <ContentFade key={confirmation.trigger}>
        <View accessibilityLiveRegion="polite" style={[shared.row, { marginBottom: 12 }]}>
          <Icon name={confirmation.kind === "shortcut" ? "bookmark" : "check"} color={Finn.primary}
            animation={confirmation.kind === "shortcut" ? "scale" : "bounce"} animationTrigger={confirmation.trigger} size={15} />
          <Text style={shared.subtle}>
            {confirmation.kind === "shortcut"
              ? "Saved to your shortcuts"
              : confirmation.kind === "merchant"
                ? "Merchant saved"
                : "Note saved"}
          </Text>
        </View>
      </ContentFade>}
      {entry.syncState === "pending" && (
        <View accessible accessibilityLiveRegion="polite" style={[shared.card, styles.syncCard]}>
          <Icon name="refresh" color={Finn.muted} size={16} />
          <View style={styles.syncCopy}>
            <Text style={styles.syncTitle}>
              {entry.pendingAction === "ai_correct" ? "Finn is revising the breakdown" : "Saved on this device"}
            </Text>
            <Text style={shared.subtle}>
              {entry.pendingAction === "ai_correct"
                ? "The current breakdown stays here while this revision syncs."
                : "Waiting to sync. Finn will keep retrying automatically."}
            </Text>
          </View>
        </View>
      )}
      {entry.syncState === "blocked" && entry.syncIssue === "failed" && (
        <View accessibilityLiveRegion="polite" style={[shared.card, styles.syncCard, styles.syncFailedCard]}>
          <Icon name="offline" color={Finn.danger} size={16} />
          <View style={styles.syncCopy}>
            <Text style={[styles.syncTitle, { color: Finn.danger }]}>Couldn’t sync this entry</Text>
            <Text style={shared.subtle}>Your entry is safe on this device. Retry when you’re ready.</Text>
          </View>
          <Button
            disabled={!!syncAction}
            label="Retry syncing entry"
            onPress={() => { void runSyncAction("retry"); }}
            style={styles.syncButton}
          >
            <Text style={styles.retryText}>{syncAction === "retry" ? "Retrying…" : "Retry"}</Text>
          </Button>
        </View>
      )}
      {entry.syncState === "blocked" && entry.syncIssue === "conflict" && (
        <View accessibilityLiveRegion="polite" style={[shared.card, styles.conflictCard]}>
          <View style={styles.conflictHeader}>
            <Icon name="refresh" color="#A16D20" size={17} />
            <View style={styles.syncCopy}>
              <Text style={styles.conflictTitle}>This entry changed elsewhere</Text>
              <Text style={shared.subtle}>
                Choose whether this device’s edits or the latest synced version should win.
              </Text>
            </View>
          </View>
          <View style={styles.conflictActions}>
            <Button
              disabled={!!syncAction}
              label="Keep this device’s entry changes"
              onPress={() => { void runSyncAction("keep"); }}
              style={styles.keepButton}
            >
              <Text style={styles.keepButtonText}>{syncAction === "keep" ? "Saving…" : "Keep mine"}</Text>
            </Button>
            <Button
              disabled={!!syncAction}
              label="Use latest synced entry version"
              onPress={confirmUseRemoteVersion}
              style={styles.remoteButton}
            >
              <Text style={styles.remoteButtonText}>{syncAction === "remote" ? "Loading…" : "Use synced"}</Text>
            </Button>
          </View>
        </View>
      )}
      {actionsOpen && !editing && (
        <View style={[shared.card, styles.actionsMenu]}>
          <Button
            label={entry.receipt ? "Edit receipt merchant" : "Edit original note"}
            onPress={() => {
              setActionsOpen(false);
              setNote(entry.receipt
                ? entry.merchant
                : entry.note);
              setEditing(true);
            }}
            style={styles.actionRow}
          >
            <Icon name="edit" size={15} color={Finn.primary} />
            <Text style={styles.actionText}>
              {entry.receipt ? "Edit receipt merchant" : "Edit original note"}
            </Text>
          </Button>
          <View style={styles.actionDivider} />
          <Button
            label={saved ? "Entry saved as a shortcut" : "Save as a shortcut"}
            disabled={mixedCurrencies}
            onPress={async () => {
              try {
                await savePreset({
                  id: `saved-${entry.id}`,
                  name: entry.note.split("\n")[0],
                  note: entry.note,
                  amountMinor: total,
                  category: entry.category,
                });
              } catch { return; }
              setSaved(true);
              setConfirmation((current) => ({ kind: "shortcut", trigger: (current?.trigger ?? 0) + 1 }));
              setActionsOpen(false);
            }}
            style={styles.actionRow}
          >
            <Icon
              name={saved ? "check" : "bookmark"}
              size={15}
              color={Finn.primary}
            />
            <Text style={styles.actionText}>
              {saved ? "Saved" : "Save entry"}
            </Text>
          </Button>
          <View style={styles.actionDivider} />
          <Button
            label="Remove entry"
            onPress={async () => {
              setActionsOpen(false);
              setDeleting(true);
            }}
            style={styles.actionRow}
          >
            <Icon name="trash" size={15} color={Finn.danger} />
            <Text style={[styles.actionText, { color: Finn.danger }]}>
              Remove entry
            </Text>
          </Button>
        </View>
      )}

      {editing ? (
        <TextInput
          accessibilityLabel={entry.receipt ? "Edit receipt merchant" : "Edit original note"}
          value={note}
          onChangeText={setNote}
          multiline
          autoFocus
          placeholder={entry.receipt ? "Merchant not found" : undefined}
          style={[shared.input, styles.noteInput]}
        />
      ) : (
        <Text accessibilityRole="header" style={styles.title}>
          {entry.note}
        </Text>
      )}

      {entry.receipt && <ReceiptPreview receipt={entry.receipt} />}

      {entry.receipt?.status === "failed" && (
        <View style={[shared.card, styles.receiptFailure]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.receiptFailureTitle}>Receipt scan paused</Text>
            <Text style={shared.subtle}>
              The image is safe. Retry, or use Add line below to enter the receipt manually.
            </Text>
          </View>
          <Button
            label="Retry receipt scan"
            onPress={() => {
              setReceiptActionError(null);
              void retryReceipt(entry.id).catch((error) => {
                setReceiptActionError(
                  error instanceof Error ? error.message : "Couldn’t retry this receipt.",
                );
              });
            }}
            style={styles.receiptTotalSave}
          >
            <Text style={styles.correctText}>Retry</Text>
          </Button>
        </View>
      )}

      {entry.receipt && (
        <View style={[shared.card, styles.receiptTotalCard]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.receiptTotalLabel}>Printed receipt total</Text>
            <TextInput
              accessibilityLabel="Printed receipt total"
              keyboardType="decimal-pad"
              onChangeText={setPrintedTotal}
              placeholder="Missing"
              style={styles.receiptTotalInput}
              value={printedTotal}
            />
          </View>
          <Button
            disabled={printedTotal !== "" && !/^\d+(?:\.\d{1,2})?$/.test(printedTotal)}
            label="Save printed receipt total"
            onPress={async () => {
              const minor = printedTotal === ""
                ? null
                : Math.round(Number(printedTotal) * 100);
              try {
                await updateEntry({
                  ...entry,
                  accountingTotalMinor: minor ?? undefined,
                  receipt: { ...entry.receipt!, printedTotalMinor: minor },
                });
              } catch { return; }
              setConfirmation((current) => ({ kind: "note", trigger: (current?.trigger ?? 0) + 1 }));
            }}
            style={styles.receiptTotalSave}
          >
            <Text style={styles.correctText}>Save total</Text>
          </Button>
        </View>
      )}

      <SectionLabel style={styles.sectionLabel}>Amount breakdown</SectionLabel>
      <View style={[shared.card, styles.amountCard]}>
        <AmountExpression terms={entry.amountBreakdown ?? []} />
      </View>

      <SectionLabel style={styles.sectionLabel}>Items breakdown</SectionLabel>
      {!entry.receipt && entry.allocationRows?.length
        ? <ParticipantBreakdown
            rows={entry.allocationRows}
            selfName={session?.user.user_metadata.full_name ?? session?.user.user_metadata.name}
          />
        : <TransactionBreakdown entry={entry} onChange={updateEntry} />}

      <SectionLabel style={styles.sectionLabel}>
        Finn’s thought process
      </SectionLabel>
      <View style={[shared.card, styles.thoughtCard]}>
        <Image
          accessibilityLabel="Finn working on a laptop"
          contentFit="contain"
          source={require("../../../../assets/images/character/onboarding/future-question-base.png")}
          style={styles.thoughtIllustration}
        />
        <Text style={styles.thoughtText}>{entry.thought}</Text>
        {!entry.receipt && (
          <Button
            disabled={entry.syncState === "pending"}
            label="Tell Finn what to change in the breakdown"
            onPress={() => setCorrectionOpen(true)}
            style={styles.correct}
          >
            <Icon name="edit" size={12} color={Finn.primary} />
            <Text style={styles.correctText}>Something’s off? Click here to edit.</Text>
          </Button>
        )}
      </View>

      {deleting && (
        <View style={styles.deleteConfirm}>
          <Text style={styles.deleteQuestion}>
            Remove this entry from your journal?
          </Text>
          <View style={styles.deleteActions}>
            <Button label="Cancel removal" onPress={() => setDeleting(false)}>
              <Text style={styles.cancelText}>Keep it</Text>
            </Button>
            <Button
              label="Confirm removal"
              onPress={async () => {
                try { await deleteEntry(entry.id); } catch { return; }
                closeSheet();
              }}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Button>
          </View>
        </View>
      )}
    </AppSheet>
  );
}

function AmountExpression({
  terms,
}: {
  terms: EntryAmountTerm[];
}) {
  const [expanded, setExpanded] = useState(false);
  const approximate = terms.some((term) => term.approximate);
  const label = amountBreakdownText(terms);
  if (!terms.length) {
    return <Text style={styles.amountPlaceholder}>No amount breakdown yet</Text>;
  }
  return (
    <View style={styles.amountExpressionWrap}>
      <Button
        accessibilityHint="Toggles the complete amount calculation"
        accessibilityState={{ expanded }}
        label={expanded ? "Collapse amount breakdown" : `Expand amount breakdown: ${label}`}
        onPress={() => setExpanded((current) => !current)}
        style={styles.amountExpressionButton}
      >
        <Text
          accessibilityLabel={label}
          ellipsizeMode="tail"
          numberOfLines={expanded ? undefined : 1}
          style={styles.amountExpression}
        >
          {terms.map((term, index) => (
            <Fragment key={term.id}>
              {index > 0 && <Text style={styles.amountOperator}> + </Text>}
              <Text>{term.factors.join(" * ")} * </Text>
              <Text style={styles.currencySymbol}>{currencySymbol(term.currency)}</Text>
              <Text>{moneyValue(term.unitAmountMinor, term.currency)}</Text>
            </Fragment>
          ))}
        </Text>
      </Button>
      {approximate && <Text style={styles.approximate}>(approx breakdown)</Text>}
    </View>
  );
}

function ParticipantBreakdown({
  rows,
  selfName,
}: {
  rows: EntryAllocationRow[];
  selfName?: string;
}) {
  return <View style={[shared.card, styles.participantCard]}>
    {rows.map((row, index) => (
      <View key={row.id} style={[styles.participantRow, index > 0 && styles.participantDivider]}>
        <Text style={styles.participantName}>
          {row.partyKind === "self" ? selfName?.trim() || "You" : row.label}
        </Text>
        <Text style={styles.participantAmount}>
          <Text style={styles.currencySymbol}>{currencySymbol(row.currency)}</Text>
          {moneyValue(row.amountMinor, row.currency)}
        </Text>
      </View>
    ))}
  </View>;
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20 },
  saveError: { alignItems: "center", flexDirection: "row", gap: 10, marginBottom: 12 },
  saveErrorText: { color: Finn.danger, flex: 1, fontSize: 12, lineHeight: 17 },
  saveErrorAction: { color: Finn.danger, fontSize: 11, fontWeight: "600" },
  syncCard: { alignItems: "center", flexDirection: "row", gap: 11, marginBottom: 14, padding: 14 },
  syncFailedCard: { backgroundColor: "#FFF7F5" },
  syncCopy: { flex: 1, gap: 2 },
  syncTitle: { color: Finn.ink, fontFamily: JournalType.medium, fontSize: 13 },
  syncButton: { minHeight: 36, paddingHorizontal: 9 },
  retryText: { color: Finn.danger, fontFamily: JournalType.medium, fontSize: 12 },
  conflictCard: { backgroundColor: "#FFF9EE", gap: 13, marginBottom: 14, padding: 14 },
  conflictHeader: { alignItems: "center", flexDirection: "row", gap: 11 },
  conflictTitle: { color: "#8B5C18", fontFamily: JournalType.medium, fontSize: 13 },
  conflictActions: { flexDirection: "row", gap: 9, justifyContent: "flex-end" },
  keepButton: { backgroundColor: "#8B5C18", borderRadius: 16, minHeight: 36, paddingHorizontal: 12 },
  keepButtonText: { color: "#FFFFFF", fontFamily: JournalType.medium, fontSize: 12 },
  remoteButton: { borderColor: "#DFC69F", borderRadius: 16, borderWidth: 1, minHeight: 36, paddingHorizontal: 12 },
  remoteButtonText: { color: "#8B5C18", fontFamily: JournalType.medium, fontSize: 12 },
  headerActions: { flexDirection: "row", gap: 8 },
  title: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
    marginBottom: 22,
  },
  noteInput: {
    fontFamily: JournalType.medium,
    fontSize: 20,
    lineHeight: 28,
    marginBottom: 22,
  },
  amountCard: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 108,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  receiptTotalCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    padding: 14,
  },
  receiptFailure: { alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 12, padding: 14 },
  receiptFailureTitle: { color: Finn.ink, fontFamily: JournalType.medium, fontSize: 14, marginBottom: 3 },
  receiptTotalLabel: { color: Finn.secondary, fontFamily: JournalType.regular, fontSize: 12 },
  receiptTotalInput: { color: Finn.ink, fontFamily: JournalType.medium, fontSize: 18, paddingVertical: 5 },
  receiptTotalSave: { minHeight: 38, paddingHorizontal: 10 },
  amountExpression: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 27,
    lineHeight: 35,
    letterSpacing: -0.65,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  amountExpressionButton: {
    minHeight: 44,
    width: "100%",
  },
  amountExpressionWrap: { alignItems: "center", gap: 5 },
  amountPlaceholder: {
    color: Finn.muted,
    fontFamily: JournalType.regular,
    fontSize: 13,
  },
  approximate: {
    color: Finn.muted,
    fontFamily: JournalType.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  amountOperator: { color: Finn.secondary },
  currencySymbol: { color: BANKNOTE_GREEN },
  sectionLabel: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 16,
    lineHeight: 21,
    marginBottom: 10,
    marginTop: 22,
    paddingLeft: 0,
  },
  thoughtCard: { borderRadius: 18, padding: 16 },
  thoughtIllustration: { height: 62, marginBottom: 10, width: 82 },
  thoughtText: {
    color: Finn.ink,
    fontFamily: JournalType.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  correct: {
    flexDirection: "row",
    gap: 5,
    justifyContent: "flex-start",
    marginTop: 4,
    minHeight: 28,
  },
  correctText: {
    color: Finn.primary,
    fontFamily: JournalType.medium,
    fontSize: 12,
  },
  participantCard: { gap: 0, paddingVertical: 5 },
  participantRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 3,
  },
  participantDivider: { borderTopColor: Finn.line, borderTopWidth: StyleSheet.hairlineWidth },
  participantName: { color: Finn.ink, fontFamily: JournalType.medium, fontSize: 14 },
  participantAmount: { color: Finn.ink, fontFamily: JournalType.bold, fontSize: 15 },
  actionsMenu: {
    marginBottom: 18,
    marginTop: -7,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-start",
    minHeight: 42,
  },
  actionText: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
  actionDivider: {
    backgroundColor: Finn.line,
    height: StyleSheet.hairlineWidth,
  },
  deleteConfirm: { alignItems: "center", gap: 7, marginTop: 22 },
  deleteQuestion: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 12,
  },
  deleteActions: { flexDirection: "row", gap: 22 },
  cancelText: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
  removeText: {
    color: Finn.danger,
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
});
