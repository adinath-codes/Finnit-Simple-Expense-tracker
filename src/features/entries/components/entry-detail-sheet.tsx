import { ContentFade, Reveal, DisclosureChevron, MotionLayout } from "@/components/ui/motion";
import { Fragment, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
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
import type { EntryItem } from "@/types/domain";
import { entryTotal } from "@/utils/amounts";
import { money } from "@/utils/currency";
import { TransactionBreakdown } from "./transaction-breakdown";
import { ReceiptPreview } from "./receipt-preview";
import { retryReceipt } from "@/features/camera/services/receipt-service";

const BANKNOTE_GREEN = "#20C878";
const REFERENCE_LINK_BLUE = "#5B9EC2";

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
  } = useJournal();
  const entry = entries.find((item) => item.id === entryId);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(entry?.note ?? "");
  const [saved, setSaved] = useState(false);
  const [confirmation, setConfirmation] = useState<{ kind: "note" | "shortcut"; trigger: number } | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(true);
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
  const saveEditedNote = async () => {
    if (note.trim()) {
      try { await updateEntry({ ...entry, note: note.trim() }); }
      catch { return; }
      setConfirmation((current) => ({ kind: "note", trigger: (current?.trigger ?? 0) + 1 }));
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
      right={
        <View style={styles.headerActions}>
          <IconButton
            name={editing ? "check" : "more"}
            label={editing ? "Save entry text" : "Entry actions"}
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
          <Text style={shared.subtle}>{confirmation.kind === "shortcut" ? "Saved to your shortcuts" : "Note saved"}</Text>
        </View>
      </ContentFade>}
      {entry.syncState === "pending" && (
        <View accessible accessibilityLiveRegion="polite" style={[shared.card, styles.syncCard]}>
          <Icon name="refresh" color={Finn.muted} size={16} />
          <View style={styles.syncCopy}>
            <Text style={styles.syncTitle}>Saved on this device</Text>
            <Text style={shared.subtle}>Waiting to sync. Finn will keep retrying automatically.</Text>
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
            label="Edit original note"
            onPress={() => {
              setActionsOpen(false);
              setEditing(true);
            }}
            style={styles.actionRow}
          >
            <Icon name="edit" size={15} color={Finn.primary} />
            <Text style={styles.actionText}>Edit original note</Text>
          </Button>
          <View style={styles.actionDivider} />
          <Button
            label={saved ? "Entry saved as a shortcut" : "Save as a shortcut"}
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
          accessibilityLabel="Edit original note"
          value={note}
          onChangeText={setNote}
          multiline
          autoFocus
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

      <View style={[shared.card, styles.amountCard]}>
        <AmountExpression items={entry.items} currency={settings.currency} />
      </View>

      <SectionLabel style={styles.sectionLabel}>Items</SectionLabel>
      <TransactionBreakdown entry={entry} onChange={updateEntry} />

      <SectionLabel style={styles.sectionLabel}>
        Finn’s thought process
      </SectionLabel>
      <View style={[shared.card, styles.thoughtCard]}>
        <View style={styles.confidence}>
          <View style={styles.confidenceRing}>
            <View style={styles.confidenceArc} />
            <Text style={styles.confidenceScore}>75</Text>
          </View>
          <View>
            <Text style={styles.confidenceLabel}>Confidence level</Text>
            <Text style={styles.confidenceTitle}>High</Text>
          </View>
        </View>
        <Text style={styles.thoughtText}>{entry.thought}</Text>
        <Button
          label="Edit original note"
          onPress={() => setEditing(true)}
          style={styles.correct}
        >
          <Icon name="edit" size={12} color={Finn.primary} />
          <Text style={styles.correctText}>Something off? Click to edit</Text>
        </Button>
      </View>

      <SectionLabel style={styles.sectionLabel}>References</SectionLabel>
      <MotionLayout style={[shared.card, styles.referencesCard]}>
        <Button
          label="Toggle entry references"
          accessibilityState={{ expanded: sourcesOpen }}
          onPress={() => setSourcesOpen((open) => !open)}
          style={styles.referencesHeader}
        >
          <View style={styles.sourceIcons}>
            {entry.sources.map((source, index) => (
              <View
                key={source.title}
                style={[
                  styles.sourceIcon,
                  { backgroundColor: index ? "#EAF8EF" : "#FFF0D6" },
                  { zIndex: entry.sources.length - index },
                ]}
              >
                <Icon
                  name={source.icon}
                  size={13}
                  color={index ? BANKNOTE_GREEN : Finn.amber}
                />
              </View>
            ))}
          </View>
          <Text style={styles.sourcesCount}>
            {entry.sources.length}{" "}
            {entry.sources.length === 1 ? "source" : "sources"}
          </Text>
          <DisclosureChevron expanded={sourcesOpen} size={13} color={Finn.muted} />
        </Button>
        <Reveal open={sourcesOpen}>
          <ScrollView
            horizontal
            contentContainerStyle={styles.sourceLinks}
            showsHorizontalScrollIndicator={false}
          >
            {entry.sources.map((source, index) => {
              const link = sourceWebsite(source, entry.id);
              const iconColor = index ? BANKNOTE_GREEN : Finn.amber;
              return (
                <Button
                  key={source.title}
                  accessibilityHint="Opens this reference"
                  label={link.accessibilityLabel}
                  onPress={() => {
                    if (link.url) void Linking.openURL(link.url);
                  }}
                  style={styles.sourceLink}
                >
                  <View
                    style={[
                      styles.sourceLinkIcon,
                    ]}
                  >
                    <Icon name={source.icon} size={13} color={iconColor} />
                  </View>
                  <Text numberOfLines={1} style={styles.sourceLinkText}>
                    {link.label}
                  </Text>
                  <Icon name="arrow" size={12} color={Finn.muted} />
                </Button>
              );
            })}
          </ScrollView>
        </Reveal>
      </MotionLayout>

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
  items,
  currency,
}: {
  items: EntryItem[];
  currency: string;
}) {
  return (
    <Text
      accessibilityLabel="Item quantities and line totals"
      style={styles.amountExpression}
    >
      {items.map((item, index) => {
        return (
          <Fragment key={item.id}>
            {index > 0 && <Text style={styles.amountOperator}> + </Text>}
            {item.quantity > 1 && item.unitPriceMinor !== null && item.unitPriceMinor !== undefined
              ? <Text>{item.quantity} × {money(item.unitPriceMinor, currency)} = {money(item.amountMinor, currency)}</Text>
              : item.quantity > 1
                ? <Text>{item.quantity} items · {money(item.amountMinor, currency)}</Text>
                : <Text>{money(item.amountMinor, currency)}</Text>}
          </Fragment>
        );
      })}
    </Text>
  );
}

function sourceWebsite(
  source: { icon: "note" | "location"; detail: string },
  entryId: string,
) {
  if (source.icon === "location") {
    return {
      accessibilityLabel: `Open ${source.detail} in Google Maps`,
      label: "maps.google.com",
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(source.detail)}`,
    };
  }

  return {
    accessibilityLabel: "View original entry note",
    label: `finn.app/entries/${entryId}`,
    url: Linking.createURL(`entries/${entryId}`),
  };
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
  confidence: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    marginBottom: 12,
  },
  confidenceRing: {
    alignItems: "center",
    borderColor: "#D8DDD9",
    borderRadius: 26,
    borderWidth: 3,
    height: 52,
    justifyContent: "center",
    position: "relative",
    width: 52,
  },
  confidenceArc: {
    borderColor: BANKNOTE_GREEN,
    borderRadius: 26,
    borderRightColor: "transparent",
    borderWidth: 3,
    height: 52,
    left: -3,
    position: "absolute",
    top: -3,
    transform: [{ rotate: "-45deg" }],
    width: 52,
  },
  confidenceScore: {
    color: BANKNOTE_GREEN,
    fontFamily: JournalType.bold,
    fontSize: 15,
  },
  confidenceLabel: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  confidenceTitle: {
    color: BANKNOTE_GREEN,
    fontFamily: JournalType.bold,
    fontSize: 14,
    lineHeight: 18,
  },
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
  referencesCard: { borderRadius: 17, padding: 12 },
  referencesHeader: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    minHeight: 28,
  },
  sourceIcons: { flex: 1, flexDirection: "row" },
  sourceIcon: {
    alignItems: "center",
    borderColor: "#fff",
    borderRadius: 14,
    borderWidth: 2,
    height: 28,
    justifyContent: "center",
    marginRight: -10,
    width: 28,
  },
  sourcesCount: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  sourceLinks: {
    flexDirection: "row",
    gap: 8,
    marginTop: 9,
    paddingRight: 4,
  },
  sourceLink: {

    borderColor: "#EEE7E1",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    maxWidth: "100%",
    minHeight: 36,
    paddingHorizontal: 8,
  },
  sourceLinkIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  sourceLinkText: {
    color: REFERENCE_LINK_BLUE,
    fontFamily: JournalType.medium,
    fontSize: 12,
    maxWidth: 150,
  },
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
